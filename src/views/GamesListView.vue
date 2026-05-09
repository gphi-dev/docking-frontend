<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiRequest, resolveAssetUrl } from "../api/http";
import AddGameModal from "../components/AddGameModal.vue";
import ConfirmActionModal from "../components/ConfirmActionModal.vue";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const games = ref([]);
const loadError = ref("");
const isLoading = ref(true);
const isAddGameModalOpen = ref(false);
const isEditGameModalOpen = ref(false);
const selectedGame = ref(null);
const editingGameId = ref(null);
const deletingGameId = ref(null);
const pendingDeleteGame = ref(null);
const deleteGameError = ref("");
const failedImageUrls = ref(new Set());

const skeletonCards = Array.from({ length: 8 }, (_, index) => index);

const canCreateGames = computed(() => authStore.canAccess("games.create"));
const canUpdateGames = computed(() => authStore.canAccess("games.update"));
const canDeleteGames = computed(() => authStore.canAccess("games.delete"));
const gameCountLabel = computed(() => `${games.value.length} ${games.value.length === 1 ? "game" : "games"}`);

function extractGamesList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && typeof payload.data === "object" && Array.isArray(payload.data.games)) {
    return payload.data.games;
  }

  if (Array.isArray(payload.games)) {
    return payload.games;
  }

  return [];
}

function formatDateTime(isoString) {
  if (!isoString) {
    return "-";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isTruthy(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function getGameUrlLabel(game) {
  const gameUrl = String(game?.game_url ?? "").trim();
  return gameUrl || "No URL configured";
}

function getGameTypeLabel(game) {
  return isTruthy(game?.is_mobile) ? "MOBILE" : "WEB";
}

function getGameRouteParam(game) {
  return game?.slug || game?.game_id || game?.id;
}

function getCoverImage(game) {
  return game?.background_url || game?.image_url || "";
}

function getThumbnailImage(game) {
  return game?.image_url || game?.background_url || "";
}

async function loadGames() {
  loadError.value = "";
  isLoading.value = true;

  try {
    const payload = await apiRequest("/api/games");
    games.value = extractGamesList(payload);
  } catch (error) {
    loadError.value = error?.message || "Failed to load games";
  } finally {
    isLoading.value = false;
  }
}

function openGameDetail(game) {
  const routeParam = getGameRouteParam(game);
  if (!routeParam) {
    console.warn("Missing game identifier, aborting navigation");
    return;
  }

  router.push({ name: "game-detail", params: { gameId: String(routeParam) } });
}

async function openEditGameModal(game) {
  if (!canUpdateGames.value) {
    loadError.value = "You do not have permission to update games.";
    return;
  }

  const gameLookupId = getGameRouteParam(game);
  if (!gameLookupId) {
    loadError.value = "Could not load this game because it has no identifier.";
    return;
  }

  editingGameId.value = game.id;
  loadError.value = "";

  try {
    const fullGame = await apiRequest(`/api/games/${gameLookupId}`);
    selectedGame.value = fullGame;
    isEditGameModalOpen.value = true;
  } catch (error) {
    loadError.value = error?.message || `Could not load game "${game.name}" for editing.`;
  } finally {
    editingGameId.value = null;
  }
}

function handleDeleteGame(game) {
  if (!canDeleteGames.value) {
    loadError.value = "Only Super Admin users can delete games.";
    return;
  }

  pendingDeleteGame.value = game;
  deleteGameError.value = "";
  loadError.value = "";
}

function closeDeleteGameConfirmation() {
  if (deletingGameId.value) {
    return;
  }

  pendingDeleteGame.value = null;
  deleteGameError.value = "";
}

async function confirmDeleteGame(password) {
  const game = pendingDeleteGame.value;
  if (!game) {
    return;
  }

  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    deleteGameError.value = "Password is required to delete a game.";
    return;
  }

  deletingGameId.value = game.id;
  deleteGameError.value = "";
  loadError.value = "";

  try {
    await apiRequest(`/api/games/${game.id}`, {
      method: "DELETE",
      body: JSON.stringify({ password: trimmedPassword }),
    });
    games.value = games.value.filter((item) => item.id !== game.id);
    pendingDeleteGame.value = null;
  } catch (error) {
    deleteGameError.value = error?.message || "Could not delete game";
  } finally {
    deletingGameId.value = null;
  }
}

function handleGameUpdated() {
  loadGames();
}

function handleGameCreated() {
  loadGames();
}

function hasImageLoadFailed(imageUrl) {
  return Boolean(imageUrl && failedImageUrls.value.has(imageUrl));
}

function handleImageLoadError(imageUrl) {
  if (!imageUrl) {
    return;
  }

  failedImageUrls.value = new Set([...failedImageUrls.value, imageUrl]);
}

onMounted(() => {
  loadGames();
});
</script>

<template>
  <div class="min-h-full space-y-6 font-sans text-slate-950">
    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Games Directory</p>
            <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Manage game catalog
            </h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review game availability, open details, and maintain catalog metadata from one responsive workspace.
            </p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Games</p>
              <p class="mt-1 text-2xl font-bold tracking-tight text-slate-950">{{ games.length }}</p>
            </div>
            <button
              v-if="canCreateGames"
              type="button"
              class="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-950 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              @click="isAddGameModalOpen = true"
            >
              Add game
            </button>
          </div>
        </div>
      </div>

    </section>

    <p
      v-if="loadError"
      class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
    >
      {{ loadError }}
    </p>

    <section class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Catalog</p>
          <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Game cards</h2>
        </div>
        <p class="text-sm font-medium text-slate-500">{{ gameCountLabel }}</p>
      </div>

      <div
        v-if="isLoading"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="index in skeletonCards"
          :key="index"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div class="aspect-[16/9] animate-pulse bg-slate-100" />
          <div class="space-y-3 p-4">
            <div class="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div class="h-7 w-3/4 animate-pulse rounded bg-slate-100" />
            <div class="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div class="grid grid-cols-3 gap-2">
              <div class="h-9 animate-pulse rounded-xl bg-slate-100" />
              <div class="h-9 animate-pulse rounded-xl bg-slate-100" />
              <div class="h-9 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        </article>
      </div>

      <div
        v-else-if="games.length === 0"
        class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm"
      >
        <p class="text-base font-semibold text-slate-950">No games found</p>
        <p class="mt-2 text-sm text-slate-500">Create a game to start building the directory.</p>
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="game in games"
          :key="game.id"
          class="group flex min-h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 hover:border-emerald-300 hover:shadow-md"
        >
          <div class="relative aspect-[16/9] overflow-hidden bg-slate-100">
            <img
              v-if="getCoverImage(game) && !hasImageLoadFailed(getCoverImage(game))"
              :src="resolveAssetUrl(getCoverImage(game))"
              :alt="`${game.name || 'Game'} cover`"
              class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              @error="handleImageLoadError(getCoverImage(game))"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-bold uppercase tracking-[0.2em] text-slate-400"
            >
              No cover
            </div>

            <div class="absolute left-3 top-3 flex flex-wrap gap-2">
              <span class="inline-flex rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-emerald-800 shadow-sm ring-1 ring-inset ring-emerald-200">
                ID {{ game.game_id || "-" }}
              </span>
              <span class="inline-flex rounded-full bg-emerald-950 px-2.5 py-1 text-[11px] font-bold text-emerald-50 shadow-sm">
                {{ getGameTypeLabel(game) }}
              </span>
            </div>
          </div>

          <div class="flex flex-1 flex-col p-4">
            <div class="flex items-start gap-3">
              <div class="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img
                  v-if="getThumbnailImage(game) && !hasImageLoadFailed(getThumbnailImage(game))"
                  :src="resolveAssetUrl(getThumbnailImage(game))"
                  :alt="`${game.name || 'Game'} thumbnail`"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  @error="handleImageLoadError(getThumbnailImage(game))"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"
                >
                  Game
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <h3 class="truncate text-lg font-bold tracking-tight text-slate-950" :title="game.name">
                  {{ game.name || "Untitled game" }}
                </h3>
                <p class="mt-1 truncate text-xs font-medium text-slate-500" :title="getGameUrlLabel(game)">
                  {{ getGameUrlLabel(game) }}
                </p>
              </div>
            </div>

            <p class="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600">
              {{ game.description || "No description has been added for this game yet." }}
            </p>

            <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <dt class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Created</dt>
                <dd class="mt-1 truncate text-xs font-semibold text-slate-600">
                  {{ formatDateTime(game.created_at) }}
                </dd>
              </div>
              <div>
                <dt class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Platform</dt>
                <dd class="mt-1 text-xs font-semibold text-slate-600">{{ getGameTypeLabel(game) }}</dd>
              </div>
            </dl>

            <div class="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                class="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-emerald-950 px-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                @click="openGameDetail(game)"
              >
                Enter
              </button>
              <button
                v-if="canUpdateGames"
                type="button"
                class="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="editingGameId === game.id"
                @click="openEditGameModal(game)"
              >
                {{ editingGameId === game.id ? "Loading..." : "Edit" }}
              </button>
              <button
                v-if="canDeleteGames"
                type="button"
                class="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition-colors duration-200 hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="deletingGameId === game.id"
                @click="handleDeleteGame(game)"
              >
                {{ deletingGameId === game.id ? "Deleting..." : "Delete" }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <AddGameModal
      :open="isAddGameModalOpen"
      mode="create"
      @close="isAddGameModalOpen = false"
      @created="handleGameCreated"
    />

    <AddGameModal
      :open="isEditGameModalOpen"
      :game="selectedGame"
      mode="edit"
      @close="isEditGameModalOpen = false"
      @updated="handleGameUpdated"
    />

    <ConfirmActionModal
      :open="Boolean(pendingDeleteGame)"
      title="Delete game"
      :message="`Enter your password to delete ${pendingDeleteGame?.name || 'this game'}. This action cannot be undone.`"
      confirm-label="Delete"
      variant="danger"
      requires-password
      password-label="Current password"
      password-placeholder="Enter your password"
      :error-message="deleteGameError"
      :is-submitting="Boolean(deletingGameId)"
      @close="closeDeleteGameConfirmation"
      @confirm="confirmDeleteGame"
    />
  </div>
</template>
