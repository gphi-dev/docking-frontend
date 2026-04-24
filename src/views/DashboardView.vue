<script setup>
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { apiRequest, resolveAssetUrl } from "../api/http";
import { extractUsermobileRecords } from "../api/response";
import AddGameModal from "../components/AddGameModal.vue";

const router = useRouter();
const games = ref([]);
const featuredGames = ref([]);
const newGames = ref([]);
const recentSubscribers = ref([]);
const loadError = ref("");
const isLoading = ref(true);
const isAddGameModalOpen = ref(false);
const isEditGameModalOpen = ref(false);
const selectedGame = ref(null);
const deletingGameId = ref(null);
const editingGameId = ref(null);

function extractDashboardCollections(payload) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }

  return payload && typeof payload === "object" ? payload : {};
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

async function loadDashboardData() {
  loadError.value = "";
  isLoading.value = true;
  try {
    const [payload, usermobilePayload] = await Promise.all([
      apiRequest("/api/games?featured_limit=3&new_limit=3"),
      apiRequest("/api/usermobile/"),
    ]);
    const collections = extractDashboardCollections(payload);
    const usermobileRecords = extractUsermobileRecords(usermobilePayload);

    games.value = Array.isArray(collections.games) ? collections.games : [];
    featuredGames.value = Array.isArray(collections.featured_games) ? collections.featured_games : [];
    newGames.value = Array.isArray(collections.new_games) ? collections.new_games : [];
    recentSubscribers.value = usermobileRecords.length > 0
      ? [...usermobileRecords]
          .sort((left, right) => {
            const leftTimestamp = new Date(left?.created_at || 0).getTime();
            const rightTimestamp = new Date(right?.created_at || 0).getTime();
            return rightTimestamp - leftTimestamp;
          })
          .slice(0, 5)
      : [];
  } catch (error) {
    loadError.value = error?.message || "Failed to load dashboard";
  } finally {
    isLoading.value = false;
  }
}

function handleGameCreated() {
  loadDashboardData();
}

function handleGameUpdated() {
  loadDashboardData();
}

function openGameDetail(gameId) {
  if (!gameId) {
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

  deletingGameId.value = game.id;
  loadError.value = "";

  try {
    await apiRequest(`/api/games/${game.id}`, { method: "DELETE" });
    games.value = games.value.filter((item) => item.id !== game.id);
    featuredGames.value = featuredGames.value.filter((item) => item.id !== game.id);
    newGames.value = newGames.value.filter((item) => item.id !== game.id);
    recentSubscribers.value = recentSubscribers.value.filter((item) => String(item.game_id) !== String(game.game_id));
  } catch (error) {
    loadError.value = error?.message || "Could not delete game";
  } finally {
    deletingGameId.value = null;
  }
}

onMounted(() => {
  loadDashboardData();
});
</script>

<template>
  <div class="space-y-8">
    <section class="flex items-center justify-between gap-4">
      
      <div>
        <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.3),_transparent_35%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.9)_45%,_rgba(236,252,203,0.92))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
      <div class="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
      <div class="pointer-events-none absolute bottom-0 left-12 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />
      <div class="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Dashboard</p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950 md:text-3xl">Game overview</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/70">
            Browse every world in your lineup and jump straight into the detail view for players, activity, and health checks.
          </p>
        </div>
        <div class="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-right backdrop-blur">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">Active Rooms</p>
          <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ games.length }}</p>
        </div>
      </div>
    </section>

      
      </div>
      
      <div class="flex shrink-0 justify-end">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-emerald-800/10 bg-emerald-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-900"
          @click="isAddGameModalOpen = true"
        >
          Add game
        </button>
      </div>
    </section>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <section class="space-y-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Arcade Worlds</p>
          <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Featured game rooms</h2>
        </div>
        <RouterLink
          :to="{ name: 'games' }"
          class="text-sm font-semibold text-emerald-800 transition hover:text-emerald-600"
        >
          View all
        </RouterLink>
      </div>

      <div
        v-if="isLoading"
        class="rounded-[24px] border border-dashed border-emerald-200 bg-white/80 p-10 text-center text-sm text-emerald-900/60"
      >
        Loading featured games…
      </div>
      <div
        v-else-if="featuredGames.length === 0"
        class="rounded-[24px] border border-dashed border-emerald-200 bg-white/80 p-10 text-center text-sm text-emerald-900/60"
      >
        No featured games yet. Add game activity to populate this section.
      </div>
      <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="(game, index) in featuredGames"
          :key="game.id"
          class="group relative overflow-hidden rounded-[26px] border shadow-[0_20px_60px_-36px_rgba(20,83,45,0.55)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-36px_rgba(20,83,45,0.65)]"
          :class="getGameCardTheme(index).shell"
        >
          <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-95" :class="getGameCardTheme(index).frame" />
          <div class="pointer-events-none absolute -right-10 top-10 h-24 w-24 rounded-full blur-3xl" :class="getGameCardTheme(index).glow" />

          <button
            type="button"
            class="relative flex min-w-0 flex-1 flex-col text-left"
            @click="openGameDetail(game.slug)"
          >
            <div class="flex items-start gap-4 p-4 pt-5">
              <div class="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-emerald-950/80 shadow-lg shadow-emerald-950/25 ring-1 ring-white/10">
                <img
                  v-if="game.image_url"
                  :src="resolveAssetUrl(game.image_url)"
                  :alt="game.name"
                  class="h-full w-full object-cover"
                  loading="lazy"
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
                  Game ID: {{ game.game_id }}
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
              <div class="mt-4 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-900/45">
                    Added {{ formatDateTime(game.created_at) }}
                  </p>
                  <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800/65">
                    {{ game.total_players ?? 0 }} players
                  </p>
                </div>
                <span class="inline-flex items-center rounded-full bg-emerald-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-100">
                  Enter
                </span>
              </div>
            </div>
          </button>

          <div class="flex gap-2 border-t border-emerald-100/80 bg-white/80 px-4 py-3 backdrop-blur">
            <button
              type="button"
              class="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="getGameCardTheme(index).button"
              :disabled="editingGameId === game.id"
              @click="openEditGameModal(game)"
            >
              {{ editingGameId === game.id ? "Loading..." : "Edit" }}
            </button>
            <button
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
    </section>

    <section class="space-y-5">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Launch Queue</p>
          <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">New games</h2>
        </div>
        <p class="text-sm text-emerald-900/55">Latest 3</p>
      </div>
      <div
        v-if="isLoading"
        class="rounded-[24px] border border-dashed border-emerald-200 bg-white/80 p-10 text-center text-sm text-emerald-900/60"
      >
        Loading new games…
      </div>
      <div
        v-else-if="newGames.length === 0"
        class="rounded-[24px] border border-dashed border-emerald-200 bg-white/80 p-10 text-center text-sm text-emerald-900/60"
      >
        No new games yet.
      </div>
      <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="(game, index) in newGames"
          :key="game.id"
          class="group relative overflow-hidden rounded-[26px] border shadow-[0_20px_60px_-36px_rgba(20,83,45,0.55)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-36px_rgba(20,83,45,0.65)]"
          :class="getGameCardTheme(index).shell"
        >
          <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-95" :class="getGameCardTheme(index).frame" />
          <div class="pointer-events-none absolute -right-10 top-10 h-24 w-24 rounded-full blur-3xl" :class="getGameCardTheme(index).glow" />

          <button
            type="button"
            class="relative flex min-w-0 flex-1 flex-col text-left"
            @click="openGameDetail(game.slug)"
          >
            <div class="flex items-start gap-4 p-4 pt-5">
              <div class="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-emerald-950/80 shadow-lg shadow-emerald-950/25 ring-1 ring-white/10">
                <img
                  v-if="game.image_url"
                  :src="resolveAssetUrl(game.image_url)"
                  :alt="game.name"
                  class="h-full w-full object-cover"
                  loading="lazy"
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
                  Game ID: {{ game.game_id }}
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
              type="button"
              class="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="getGameCardTheme(index).button"
              :disabled="editingGameId === game.id"
              @click="openEditGameModal(game)"
            >
              {{ editingGameId === game.id ? "Loading..." : "Edit" }}
            </button>
            <button
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
    </section>

    <section class="space-y-5">
      <div class="flex items-end justify-between gap-3">
        <div>
          
          <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Recent Subscribers</h2>
        </div>
        <p class="text-sm text-emerald-900/55">Latest 5</p>
      </div>
      <div class="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800/70">
              <tr>
                <th class="px-4 py-3">Phone Number</th>
                <th class="px-4 py-3">Game ID</th>
                <th class="px-4 py-3">Verified</th>
                <th class="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-emerald-100/80">
              <tr v-if="isLoading">
                <td colspan="4" class="px-4 py-10 text-center text-emerald-900/55">Loading recent subscribers…</td>
              </tr>
              <tr v-else-if="recentSubscribers.length === 0">
                <td colspan="4" class="px-4 py-10 text-center text-emerald-900/55">No recent subscribers found.</td>
              </tr>
              <tr
                v-for="subscriber in recentSubscribers"
                :key="subscriber.id"
                class="transition hover:bg-emerald-50/70"
              >
                <td class="px-4 py-3">
                  <span class="font-semibold text-emerald-950">
                    {{ subscriber.phone || "—" }}
                  </span>
                </td>
                <td class="px-4 py-3 text-emerald-900/65">
                  <span class="inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-inset ring-emerald-500/20">
                    {{ subscriber.game_id || "—" }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                  {{ subscriber.is_verified ? "Yes" : "No" }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-emerald-900/55">
                  {{ formatDateTime(subscriber.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
  </div>
</template>
