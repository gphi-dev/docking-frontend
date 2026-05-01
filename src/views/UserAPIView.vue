<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { apiRequest } from "../api/http";
import { extractUsermobileRecords } from "../api/response";

const PAGE_SIZE = 10;
const SCORE_FIELDS = ["score", "top_score", "high_score", "highest_score", "best_score", "points", "total_score"];

const games = ref([]);
const usersmobile = ref([]);
const loadError = ref("");
const isLoadingMobile = ref(true);
const selectedGameId = ref("");
const currentPage = ref(1);
const verificationFilter = ref("verified");
const subscriberViewMode = ref("all");
const isServerPaginated = ref(false);

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

function getCreatedTimestamp(user) {
  const timestamp = new Date(user?.created_at || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isVerifiedUser(user) {
  const value = user?.is_verified;
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function getUserScore(user) {
  for (const field of SCORE_FIELDS) {
    const score = Number(user?.[field]);
    if (Number.isFinite(score)) {
      return score;
    }
  }

  return null;
}

function formatUserScore(user) {
  const score = getUserScore(user);
  if (score === null) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(score);
}

function shouldReplaceTopScorer(currentUser, nextUser) {
  const currentScore = getUserScore(currentUser);
  const nextScore = getUserScore(nextUser);

  if (currentScore !== null && nextScore !== null && currentScore !== nextScore) {
    return nextScore > currentScore;
  }

  if (currentScore === null && nextScore !== null) {
    return true;
  }

  if (currentScore !== null && nextScore === null) {
    return false;
  }

  return getCreatedTimestamp(nextUser) > getCreatedTimestamp(currentUser);
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

function sortByCreatedDateDesc(left, right) {
  return getCreatedTimestamp(right) - getCreatedTimestamp(left);
}

function sortByGameId(left, right) {
  const leftGameId = left?.game_id;
  const rightGameId = right?.game_id;
  const leftNumber = Number(leftGameId);
  const rightNumber = Number(rightGameId);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return String(leftGameId ?? "").localeCompare(String(rightGameId ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getTopScorersPerGame(records) {
  const topScorerByGameId = new Map();

  for (const user of records) {
    const gameId = String(user?.game_id ?? "");
    if (!gameId) {
      continue;
    }

    const currentTopScorer = topScorerByGameId.get(gameId);
    if (!currentTopScorer || shouldReplaceTopScorer(currentTopScorer, user)) {
      topScorerByGameId.set(gameId, user);
    }
  }

  return Array.from(topScorerByGameId.values()).sort(sortByGameId);
}

const filteredUsersmobile = computed(() => {
  const matchingUsers = usersmobile.value.filter((user) => {
    const matchesGame = selectedGameId.value
      ? String(user?.game_id ?? "") === String(selectedGameId.value)
      : true;
    const matchesVerification = verificationFilter.value === "verified"
      ? isVerifiedUser(user)
      : !isVerifiedUser(user);

    return matchesGame && matchesVerification;
  });

  const sortedUsers = [...matchingUsers].sort(sortByCreatedDateDesc);
  if (subscriberViewMode.value === "top_scorer") {
    return getTopScorersPerGame(sortedUsers);
  }

  return sortedUsers;
});

const totalUsers = computed(() => filteredUsersmobile.value.length);
const totalPages = computed(() => Math.max(1, Math.ceil(totalUsers.value / PAGE_SIZE)));
const tableColumnCount = computed(() => (subscriberViewMode.value === "top_scorer" ? 5 : 4));

const displayedUsersmobile = computed(() => {
  if (isServerPaginated.value) {
    return filteredUsersmobile.value;
  }

  const startIndex = (currentPage.value - 1) * PAGE_SIZE;
  return filteredUsersmobile.value.slice(startIndex, startIndex + PAGE_SIZE);
});

const usersRangeLabel = computed(() => {
  if (totalUsers.value === 0) {
    return "0 users";
  }
  const startIndex = (currentPage.value - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage.value * PAGE_SIZE, totalUsers.value);
  return `Showing ${startIndex}–${endIndex} of ${totalUsers.value}`;
});

const emptyUsersMessage = computed(() => {
  const verificationLabel = verificationFilter.value === "verified" ? "verified" : "not verified";
  if (subscriberViewMode.value === "top_scorer") {
    return `No ${verificationLabel} top scorer records found.`;
  }

  return `No ${verificationLabel} mobile users found.`;
});

async function loadGames() {
  try {
    const payload = await apiRequest("/api/games");
    games.value = extractGamesList(payload);
  } catch (error) {
    console.error("Failed to load games for filter:", error);
  }
}

async function loadUsersmobile() {
  loadError.value = "";
  isLoadingMobile.value = true;
  try {
    const payload = await apiRequest("/api/usermobile");
    const records = extractUsermobileRecords(payload);

    isServerPaginated.value = false;
    usersmobile.value = records;
  } catch (error) {
    usersmobile.value = [];
    loadError.value = error?.message || "Failed to load mobile number of users";
  } finally {
    isLoadingMobile.value = false;
  }
}

async function goToPage(page) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;
  currentPage.value = page;
  if (isServerPaginated.value) {
    await loadUsersmobile();
  }
}

function getGameName(user) {
  if (user?.game?.name) {
    return user.game.name;
  }

  return gameNameById.value.get(String(user?.game_id ?? "")) || "—";
}

function getPhoneNumber(user) {
  return user?.phone ?? user?.phone_number ?? "—";
}

watch([selectedGameId, verificationFilter, subscriberViewMode], () => {
  currentPage.value = 1;
});

watch(totalPages, (nextTotalPages) => {
  if (currentPage.value > nextTotalPages) {
    currentPage.value = nextTotalPages;
  }
});

onMounted(() => {
  loadUsersmobile();
  loadGames();
});
</script>

<template>
  <div class="space-y-8">
    <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.3),_transparent_35%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.9)_45%,_rgba(236,252,203,0.92))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
      <div class="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
      <div class="pointer-events-none absolute bottom-0 left-12 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />
      <div class="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-emerald-800/70">Signal Registry</p>
          <h1 class="mt-3 text-3xl font-bold tracking-tight text-emerald-950 md:text-4xl">API usersmobile</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/70">
            Player mobile entries mapped to their game worlds for quick monitoring and support tracing.
          </p>
        </div>
        <div class="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-right backdrop-blur">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">Shown Entries</p>
          <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ totalUsers }}</p>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Player Signals</p>
        <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Subscriber Mobile Numbers</h2>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="verificationFilter"
          class="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
          aria-label="Verification filter"
        >
          <option value="verified">Show Verified</option>
          <option value="not_verified">Show Not Verified</option>
        </select>
        <select
          v-model="subscriberViewMode"
          class="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
          aria-label="Subscriber view mode"
        >
          <option value="all">Show Subscribers</option>
          <option value="top_scorer">Top Scorer per Game</option>
        </select>
      </div>
    </div>

    <div class="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800/70">
            <tr>
              <th class="px-4 py-3">Phone Number</th>
              <th class="px-4 py-3">Game ID</th>
              <th class="px-4 py-3">Game Name</th>
              <th v-if="subscriberViewMode === 'top_scorer'" class="px-4 py-3">Points</th>
              <th class="px-4 py-3">Subscribed Date</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-emerald-100/80">
            <tr v-if="isLoadingMobile">
              <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-emerald-900/55">Loading…</td>
            </tr>
            <tr v-else-if="displayedUsersmobile.length === 0">
              <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-emerald-900/55">{{ emptyUsersMessage }}</td>
            </tr>
            <tr v-for="user in displayedUsersmobile" :key="user.id" class="hover:bg-emerald-50/70">
              <td class="px-4 py-3 font-semibold text-slate-900">
                {{ getPhoneNumber(user) }}
              </td>
              <td class="px-4 py-3 text-emerald-900/65">
                <span class="inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-inset ring-emerald-500/20">
                  {{ user.game_id }}
                </span>
              </td>
              <td class="px-4 py-3 font-semibold text-emerald-950">
                {{ getGameName(user) }}
              </td>
              <td v-if="subscriberViewMode === 'top_scorer'" class="whitespace-nowrap px-4 py-3 font-semibold text-emerald-950">
                {{ formatUserScore(user) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                {{ formatDateTime(user.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalUsers > 0 && totalPages > 1" class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <p class="text-xs text-slate-500">
        {{ usersRangeLabel }}
      </p>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isLoadingMobile || currentPage <= 1"
          aria-label="Previous page"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isLoadingMobile || currentPage >= totalPages"
          aria-label="Next page"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
