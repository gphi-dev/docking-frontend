<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiRequest } from "../api/http";
import AddGameModal from "../components/AddGameModal.vue";

const router = useRouter();
const games = ref([]);
const loadError = ref("");
const isLoading = ref(true);
const isAddGameModalOpen = ref(false);
const isEditGameModalOpen = ref(false);
const selectedGame = ref(null);
const editingGameId = ref(null);
const deletingGameId = ref(null);

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
        <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Game roster</h2>
      </div>
    </div>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <div class="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800/70">
            <tr>
              <th class="px-4 py-3">Game ID</th>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Description</th>
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-emerald-100/80">
            <tr v-if="isLoading">
              <td colspan="5" class="px-4 py-10 text-center text-emerald-900/55">Loading games…</td>
            </tr>
            <tr v-else-if="games.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-emerald-900/55">No games found.</td>
            </tr>
            <tr
              v-for="game in games"
              :key="game.id"
              class="cursor-pointer transition hover:bg-emerald-50/70"
              role="link"
              tabindex="0"
              @click="openGameRow(game.slug)"
              @keydown.enter.prevent="openGameRow(game.slug)">
              <td class="px-4 py-3">
                <span class="inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-inset ring-emerald-500/20">
                  {{ game.game_id || "—" }}
                </span>
              </td>
              <td class="px-4 py-3 font-semibold text-emerald-950">
                {{ game.name }}
              </td>
              <td class="max-w-md px-4 py-3 text-emerald-900/65">
                <span class="line-clamp-2">{{ game.description || "—" }}</span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-emerald-900/55">
                {{ formatDateTime(game.created_at) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="editingGameId === game.id"
                    @click.stop="openEditGameModal(game)"
                  >
                    {{ editingGameId === game.id ? "Loading..." : "Edit" }}
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="deletingGameId === game.id"
                    @click.stop="handleDeleteGame(game)"
                  >
                    {{ deletingGameId === game.id ? "Deleting…" : "Delete" }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
