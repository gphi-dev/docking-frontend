<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiRequest, resolveAssetUrl } from "../api/http";
import AddGameModal from "../components/AddGameModal.vue";
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
const failedImageUrls = ref(new Set());

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
    return "—";
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

function getGameUrlLabel(game) {
  const gameUrl = String(game?.game_url ?? "").trim();
  return gameUrl || "—";
}

function isTruthy(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function getMobileLabel(game) {
  return isTruthy(game?.is_mobile) ? "Mobile" : "Web";
}

function getGameCardTheme(index) {
  const themes = [
    {
      shell: "border-emerald-200/80 bg-white/95 hover:border-emerald-400 hover:shadow-emerald-950/10",
      frame: "from-emerald-950 via-emerald-900 to-lime-900",
      glow: "bg-emerald-400/20",
      badge: "bg-emerald-400/15 text-emerald-800 ring-1 ring-inset ring-emerald-500/20",
      button: "border-emerald-200 text-emerald-900 hover:bg-emerald-50",
    },
    {
      shell: "border-lime-200/80 bg-white/95 hover:border-lime-400 hover:shadow-lime-950/10",
      frame: "from-lime-950 via-green-900 to-emerald-900",
      glow: "bg-lime-400/20",
      badge: "bg-lime-400/15 text-lime-900 ring-1 ring-inset ring-lime-500/20",
      button: "border-lime-200 text-lime-900 hover:bg-lime-50",
    },
    {
      shell: "border-teal-200/80 bg-white/95 hover:border-teal-400 hover:shadow-teal-950/10",
      frame: "from-teal-950 via-emerald-900 to-green-900",
      glow: "bg-teal-400/20",
      badge: "bg-teal-400/15 text-teal-900 ring-1 ring-inset ring-teal-500/20",
      button: "border-teal-200 text-teal-900 hover:bg-teal-50",
    },
  ];

  return themes[index % themes.length];
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

function openGameRow(gameId) {
  if (!gameId) {
    // Prevent navigation to /games/undefined
    console.warn("Missing game id, aborting navigation");
    return;
  }
  router.push({ name: "game-detail", params: { gameId: String(gameId) } });
}

async function openEditGameModal(game) {
  if (!authStore.canAccess("games.update")) {
    loadError.value = "You do not have permission to update games.";
    return;
  }

  editingGameId.value = game.id;
  loadError.value = "";

  try {
    const fullGame = await apiRequest(`/api/games/${game.slug}`);
    selectedGame.value = fullGame;
    isEditGameModalOpen.value = true;
  } catch (error) {
    loadError.value = error?.message || `Could not load game "${game.name}" for editing.`;
  } finally {
    editingGameId.value = null;
  }
}

async function handleDeleteGame(game) {
  if (!authStore.canAccess("games.delete")) {
    loadError.value = "Only Super Admin users can delete games.";
    return;
  }

  const shouldDelete = window.confirm(`Delete "${game.name}"?`);
  if (!shouldDelete) {
    return;
  }

  const password = window.prompt(`Enter your password to delete "${game.name}":`);
  if (password === null) {
    return;
  }

  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    loadError.value = "Password is required to delete a game.";
    return;
  }

  deletingGameId.value = game.id;
  loadError.value = "";

  try {
    await apiRequest(`/api/games/${game.id}`, {
      method: "DELETE",
      body: JSON.stringify({ password: trimmedPassword }),
    });
    games.value = games.value.filter((item) => item.id !== game.id);
  } catch (error) {
    loadError.value = error?.message || "Could not delete game";
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
  <div class="space-y-8">
    <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.3),_transparent_35%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.9)_45%,_rgba(236,252,203,0.92))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
      <div class="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
      <div class="pointer-events-none absolute bottom-0 left-12 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />
      <div class="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-emerald-800/70">GPHI Game Registry</p>
          <h1 class="mt-3 text-3xl font-bold tracking-tight text-emerald-950 md:text-4xl">Games</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/70">
            Browse every world in your lineup and jump straight into the detail view for players, activity, and health checks.
          </p>
        </div>

        <div class="flex flex-col items-stretch gap-3">
          <div class="flex justify-end">
            <button
              v-if="authStore.canAccess('games.create')"
              type="button"
              class="inline-flex items-center justify-center rounded-full border border-emerald-800/10 bg-emerald-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-900"
              @click="isAddGameModalOpen = true"
            >
              Add game
            </button>
          </div>
          <div class="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-right backdrop-blur">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">GAME COUNT</p>
            <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ games.length }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">World Directory</p>
        <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">All game cards</h2>
      </div>
    </div>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <div
      v-if="isLoading"
      class="rounded-[24px] border border-dashed border-emerald-200 bg-white/80 p-10 text-center text-sm text-emerald-900/60"
    >
      Loading games…
    </div>
    <div
      v-else-if="games.length === 0"
      class="rounded-[24px] border border-dashed border-emerald-200 bg-white/80 p-10 text-center text-sm text-emerald-900/60"
    >
      No games found.
    </div>
    <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="(game, index) in games"
        :key="game.id"
        class="group relative overflow-hidden rounded-[26px] border shadow-[0_20px_60px_-36px_rgba(20,83,45,0.55)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-36px_rgba(20,83,45,0.65)]"
        :class="getGameCardTheme(index).shell"
      >
        <img
          v-if="game.background_url && !hasImageLoadFailed(game.background_url)"
          :src="resolveAssetUrl(game.background_url)"
          alt=""
          class="pointer-events-none absolute inset-x-0 top-0 h-28 w-full object-cover opacity-55"
          loading="lazy"
          @error="handleImageLoadError(game.background_url)"
        />
        <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-90" :class="getGameCardTheme(index).frame" />
        <div class="pointer-events-none absolute -right-10 top-10 h-24 w-24 rounded-full blur-3xl" :class="getGameCardTheme(index).glow" />

        <button
          type="button"
          class="relative flex min-w-0 flex-1 flex-col text-left"
          @click="openGameRow(game.slug)"
        >
          <div class="flex items-start gap-4 p-4 pt-5">
            <div class="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-emerald-950/80 shadow-lg shadow-emerald-950/25 ring-1 ring-white/10">
              <img
                v-if="game.image_url && !hasImageLoadFailed(game.image_url)"
                :src="resolveAssetUrl(game.image_url)"
                :alt="game.name"
                class="h-full w-full object-cover"
                loading="lazy"
                @error="handleImageLoadError(game.image_url)"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center bg-emerald-950 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/70"
              >
                Ready
              </div>
            </div>

            <div class="min-w-0 flex-1 pt-1">
              <div
                class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white"
                :class="getGameCardTheme(index).badge"
              >
                Game ID: {{ game.game_id || "—" }}
              </div>
              <div
                class="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                :class="
                  isTruthy(game.is_mobile)
                    ? 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-300/60'
                    : 'bg-white/80 text-emerald-900 ring-1 ring-inset ring-emerald-200'
                "
              >
                {{ getMobileLabel(game) }}
              </div>
              <p class="mt-3 truncate text-xl font-bold tracking-tight text-white">
                {{ game.name }}
              </p>
            </div>
          </div>

          <div class="flex min-w-0 flex-1 flex-col px-4 pb-4">
            <div class="rounded-2xl bg-emerald-50/80 p-4 ring-1 ring-inset ring-emerald-100">
              <p class="line-clamp-3 text-sm leading-6 text-emerald-950/75">
                {{ game.description || "No description yet. Add lore, action, or a hook to bring this arcade world to life." }}
              </p>
            </div>
            <p
              class="mt-3 truncate rounded-xl bg-white/75 px-3 py-2 text-xs font-semibold text-emerald-900/65 ring-1 ring-inset ring-emerald-100"
              :title="getGameUrlLabel(game)"
            >
              Game URL: {{ getGameUrlLabel(game) }}
            </p>
            <div class="mt-4 flex items-center justify-between gap-3">
              <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-900/45">
                Added {{ formatDateTime(game.created_at) }}
              </p>
              <span class="inline-flex items-center rounded-full bg-emerald-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-100">
                Enter
              </span>
            </div>
          </div>
        </button>

        <div class="flex gap-2 border-t border-emerald-100/80 bg-white/80 px-4 py-3 backdrop-blur">
          <button
            v-if="authStore.canAccess('games.update')"
            type="button"
            class="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="getGameCardTheme(index).button"
            :disabled="editingGameId === game.id"
            @click="openEditGameModal(game)"
          >
            {{ editingGameId === game.id ? "Loading..." : "Edit" }}
          </button>
          <button
            v-if="authStore.canAccess('games.delete')"
            type="button"
            class="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deletingGameId === game.id"
            @click="handleDeleteGame(game)"
          >
            {{ deletingGameId === game.id ? "Deleting…" : "Delete" }}
          </button>
        </div>
      </article>
    </div>

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
  </div>
</template>
