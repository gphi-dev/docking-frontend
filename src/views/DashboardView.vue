<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { apiRequest, resolveAssetUrl } from "../api/http";
import { extractUsermobileRecords } from "../api/response";
import AddGameModal from "../components/AddGameModal.vue";
import ConfirmActionModal from "../components/ConfirmActionModal.vue";
import { useAuthStore } from "../stores/auth";

const SUBSCRIBER_NICKNAME_FIELDS = ["nickname", "name", "display_name", "displayName", "username"];
const SUBSCRIBER_POINTS_FIELDS = ["points", "score", "total_points", "totalPoints", "top_score", "high_score"];

const router = useRouter();
const authStore = useAuthStore();
const games = ref([]);
const featuredGames = ref([]);
const newGames = ref([]);
const recentSubscribers = ref([]);
const recentSubscribersDisplay = ref("10");
const loadError = ref("");
const isLoading = ref(true);
const isAddGameModalOpen = ref(false);
const isEditGameModalOpen = ref(false);
const selectedGame = ref(null);
const deletingGameId = ref(null);
const editingGameId = ref(null);
const pendingDeleteGame = ref(null);
const deleteGameError = ref("");
const failedImageUrls = ref(new Set());

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

function isVerifiedSubscriber(subscriber) {
  const value = subscriber?.is_verified;
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function isTruthy(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function getMobileLabel(game) {
  return isTruthy(game?.is_mobile) ? "Mobile" : "Web";
}

const gameNameById = computed(() => {
  const entries = new Map();

  for (const game of games.value) {
    if (game?.id !== undefined && game?.id !== null) {
      entries.set(String(game.id), game.name || "—");
    }
    if (game?.game_id !== undefined && game?.game_id !== null) {
      entries.set(String(game.game_id), game.name || "—");
    }
  }

  return entries;
});

const displayedRecentSubscribers = computed(() => {
  if (recentSubscribersDisplay.value === "all") {
    return recentSubscribers.value;
  }

  return recentSubscribers.value.slice(0, Number(recentSubscribersDisplay.value));
});

const recentSubscribersLabel = computed(() => {
  if (recentSubscribersDisplay.value === "all") {
    return `Showing all ${recentSubscribers.value.length}`;
  }

  return `Latest ${recentSubscribersDisplay.value}`;
});

function getSubscriberGameName(subscriber) {
  if (subscriber?.game?.name) {
    return subscriber.game.name;
  }

  return subscriber?.game_name || gameNameById.value.get(String(subscriber?.game_id ?? "")) || "—";
}

function getSubscriberNickname(subscriber) {
  for (const field of SUBSCRIBER_NICKNAME_FIELDS) {
    const nickname = String(subscriber?.[field] ?? "").trim();
    if (nickname) {
      return nickname;
    }
  }

  return "—";
}

function formatSubscriberPoints(subscriber) {
  for (const field of SUBSCRIBER_POINTS_FIELDS) {
    const points = Number(subscriber?.[field]);
    if (Number.isFinite(points)) {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(points);
    }
  }

  return "—";
}

function getGameCardTheme(index) {
  const themes = [
    {
      shell: "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md",
      badge: "bg-white text-emerald-950 shadow-sm ring-1 ring-inset ring-emerald-200",
      button: "border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900",
    },
    {
      shell: "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md",
      badge: "bg-white text-emerald-950 shadow-sm ring-1 ring-inset ring-emerald-200",
      button: "border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900",
    },
    {
      shell: "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md",
      badge: "bg-white text-emerald-950 shadow-sm ring-1 ring-inset ring-emerald-200",
      button: "border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900",
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
          .filter(isVerifiedSubscriber)
          .sort((left, right) => {
            const leftTimestamp = new Date(left?.created_at || 0).getTime();
            const rightTimestamp = new Date(right?.created_at || 0).getTime();
            return rightTimestamp - leftTimestamp;
          })
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

function hasImageLoadFailed(imageUrl) {
  return Boolean(imageUrl && failedImageUrls.value.has(imageUrl));
}

function handleImageLoadError(imageUrl) {
  if (!imageUrl) {
    return;
  }

  failedImageUrls.value = new Set([...failedImageUrls.value, imageUrl]);
}

function openGameDetail(gameId) {
  if (!gameId) {
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

function handleDeleteGame(game) {
  if (!authStore.canAccess("games.delete")) {
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
    featuredGames.value = featuredGames.value.filter((item) => item.id !== game.id);
    newGames.value = newGames.value.filter((item) => item.id !== game.id);
    recentSubscribers.value = recentSubscribers.value.filter((item) => String(item.game_id) !== String(game.game_id));
    pendingDeleteGame.value = null;
  } catch (error) {
    deleteGameError.value = error?.message || "Could not delete game";
  } finally {
    deletingGameId.value = null;
  }
}

onMounted(() => {
  loadDashboardData();
});
</script>

<template>
  <div class="page-stack">
    <section class="page-hero">
      <div class="page-hero-header flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="max-w-3xl">
          <p class="page-kicker">Dashboard</p>
          <h1 class="page-title">Operations overview</h1>

          <p class="page-copy">
            Browse every world in your lineup and jump straight into the detail view for players, activity, and health checks.
          </p>
        </div>
        <div class="flex shrink-0 justify-end">
          <button
            v-if="authStore.canAccess('games.create')"
            type="button"
            class="btn-primary"
            @click="isAddGameModalOpen = true"
          >
            Add game
          </button>
        </div>
      </div>

      <div class="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        <RouterLink
          :to="{ name: 'games' }"
          class="stat-card text-right transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50"
        >
          <p class="stat-label">View All Games</p>
          <p class="stat-value">{{ games.length }}</p>
        </RouterLink>
        <div class="stat-card text-right">
          <p class="stat-label">Featured Games</p>
          <p class="stat-value">{{ featuredGames.length }}</p>
        </div>
        <div class="stat-card text-right">
          <p class="stat-label">New Games</p>
          <p class="stat-value">{{ newGames.length }}</p>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="alert-danger">
      {{ loadError }}
    </p>

    <section class="space-y-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="page-kicker">GPHI Arcade World</p>
          <h2 class="section-heading mt-1">Featured game</h2>
        </div>
        <RouterLink
          :to="{ name: 'games' }"
          class="text-sm font-semibold text-emerald-800 transition-colors duration-200 hover:text-emerald-600"
        >
          View all
        </RouterLink>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm"
      >
        Loading featured games…
      </div>
      <div
        v-else-if="featuredGames.length === 0"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm"
      >
        No featured games yet. Add game activity to populate this section.
      </div>
      <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="(game, index) in featuredGames"
          :key="game.id"
          class="group relative overflow-hidden rounded-2xl border shadow-sm transition-colors duration-200"
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
          <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-emerald-950/85" />

          <button
            type="button"
            class="relative flex min-w-0 flex-1 flex-col text-left"
            @click="openGameDetail(game.slug)"
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
                  class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                  :class="getGameCardTheme(index).badge"
                >
                  Game ID: {{ game.game_id }}
                </div>
                <div
                  class="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                  :class="
                    isTruthy(game.is_mobile)
                      ? 'bg-sky-50 text-sky-950 shadow-sm ring-1 ring-inset ring-sky-200'
                      : 'bg-white text-emerald-950 shadow-sm ring-1 ring-inset ring-emerald-200'
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
              <div class="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <p class="line-clamp-3 text-sm leading-6 text-slate-600">
                  {{ game.description || "No description yet. Add lore, action, or a hook to bring this arcade world to life." }}
                </p>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Added {{ formatDateTime(game.created_at) }}
                  </p>
                  <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {{ game.total_players ?? 0 }} players
                  </p>
                </div>
                <span class="inline-flex items-center rounded-full bg-emerald-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-100">
                  Enter
                </span>
              </div>
            </div>
          </button>

          <div class="flex gap-2 border-t border-slate-100 bg-white px-4 py-3">
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
    </section>

    <section class="space-y-5">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Launch Queue</p>
          <h2 class="section-heading mt-1">New games</h2>
        </div>
        <p class="text-sm text-slate-500">Latest 3</p>
      </div>
      <div
        v-if="isLoading"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm"
      >
        Loading new games…
      </div>
      <div
        v-else-if="newGames.length === 0"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm"
      >
        No new games yet.
      </div>
      <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="(game, index) in newGames"
          :key="game.id"
          class="group relative overflow-hidden rounded-2xl border shadow-sm transition-colors duration-200"
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
          <div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-emerald-950/85" />

          <button
            type="button"
            class="relative flex min-w-0 flex-1 flex-col text-left"
            @click="openGameDetail(game.slug)"
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
                  class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                  :class="getGameCardTheme(index).badge"
                >
                  Game ID: {{ game.game_id }}
                </div>
                <div
                  class="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                  :class="
                    isTruthy(game.is_mobile)
                      ? 'bg-sky-50 text-sky-950 shadow-sm ring-1 ring-inset ring-sky-200'
                      : 'bg-white text-emerald-950 shadow-sm ring-1 ring-inset ring-emerald-200'
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
              <div class="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <p class="line-clamp-3 text-sm leading-6 text-slate-600">
                  {{ game.description || "No description yet. Add lore, action, or a hook to bring this arcade world to life." }}
                </p>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3">
                <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Added {{ formatDateTime(game.created_at) }}
                </p>
                <span class="inline-flex items-center rounded-full bg-emerald-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-100">
                  Enter
                </span>
              </div>
            </div>
          </button>

          <div class="flex gap-2 border-t border-slate-100 bg-white px-4 py-3">
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
    </section>

    <section class="space-y-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          
          <p class="page-kicker">Audience Feed</p>
          <h2 class="section-heading mt-1">Recent Subscribers</h2>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-sm text-slate-500">{{ recentSubscribersLabel }}</p>
          <select
            v-model="recentSubscribersDisplay"
            class="form-control sm:w-auto"
            aria-label="Recent subscribers display"
          >
            <option value="5">Show 5</option>
            <option value="10">Show 10</option>
            <option value="all">Show all</option>
          </select>
        </div>
      </div>
      <div class="table-shell">
        <div class="table-scroll">
          <table class="responsive-table">
            <thead class="table-head">
              <tr>
                <th class="px-4 py-3">Phone Number</th>
                <th class="px-4 py-3">Nickname</th>
                <th class="px-4 py-3">Points</th>
                <th class="px-4 py-3">Game ID</th>
                <th class="px-4 py-3">Game Name</th>
                <th class="px-4 py-3">Verified</th>
                <th class="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-if="isLoading">
                <td colspan="7" class="px-4 py-10 text-center text-slate-500">Loading recent subscribers...</td>
              </tr>
              <tr v-else-if="displayedRecentSubscribers.length === 0">
                <td colspan="7" class="px-4 py-10 text-center text-slate-500">No recent subscribers found.</td>
              </tr>
              <tr
                v-for="subscriber in displayedRecentSubscribers"
                :key="subscriber.id"
                class="table-row"
              >
                <td class="px-4 py-3" data-label="Phone Number">
                  <span class="font-semibold text-slate-950">
                    {{ subscriber.phone || "—" }}
                  </span>
                </td>
                <td class="px-4 py-3 font-semibold text-slate-900" data-label="Nickname">
                  {{ getSubscriberNickname(subscriber) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900" data-label="Points">
                  {{ formatSubscriberPoints(subscriber) }}
                </td>
                <td class="px-4 py-3 text-emerald-900/65" data-label="Game ID">
                  <span class="badge-emerald">
                    {{ subscriber.game_id || "—" }}
                  </span>
                </td>
                <td class="px-4 py-3 font-semibold text-slate-950" data-label="Game Name">
                  {{ getSubscriberGameName(subscriber) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-slate-600" data-label="Verified">
                  {{ isVerifiedSubscriber(subscriber) ? "Yes" : "No" }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-slate-500" data-label="Created">
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
