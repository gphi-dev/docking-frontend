<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { apiRequest } from "../api/http";
import { extractUsermobileRecords } from "../api/response";

const PAGE_SIZE = 10;
const NICKNAME_FIELDS = ["nickname", "name", "display_name", "displayName", "username"];
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

function getSubscribedDate(user) {
  return user?.verified_at || user?.created_at || null;
}

function getSubscribedTimestamp(user) {
  const timestamp = new Date(getSubscribedDate(user) || 0).getTime();
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

  return getSubscribedTimestamp(nextUser) > getSubscribedTimestamp(currentUser);
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

function sortBySubscribedDateDesc(left, right) {
  return getSubscribedTimestamp(right) - getSubscribedTimestamp(left);
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

const isTopScorerMode = computed(() => subscriberViewMode.value === "top_scorer");

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

  const sortedUsers = [...matchingUsers].sort(sortBySubscribedDateDesc);
  if (isTopScorerMode.value) {
    return getTopScorersPerGame(sortedUsers);
  }

  return sortedUsers;
});

const totalUsers = computed(() => filteredUsersmobile.value.length);
const totalPages = computed(() => (isTopScorerMode.value ? 1 : Math.max(1, Math.ceil(totalUsers.value / PAGE_SIZE))));
const tableColumnCount = 6;

const displayedUsersmobile = computed(() => {
  if (isServerPaginated.value || isTopScorerMode.value) {
    return filteredUsersmobile.value;
  }

  const startIndex = (currentPage.value - 1) * PAGE_SIZE;
  return filteredUsersmobile.value.slice(startIndex, startIndex + PAGE_SIZE);
});

const usersRangeLabel = computed(() => {
  if (totalUsers.value === 0) {
    return "0 users";
  }
  if (isTopScorerMode.value) {
    return `Showing all ${totalUsers.value}`;
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

function getNickname(user) {
  for (const field of NICKNAME_FIELDS) {
    const nickname = String(user?.[field] ?? "").trim();
    if (nickname) {
      return nickname;
    }
  }

  return "—";
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
  <div class="page-stack">
    <section class="page-hero">
      <div class="page-hero-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="page-kicker">Signal Registry</p>
          <h1 class="page-title">API usersmobile</h1>
          <p class="page-copy">
            Player mobile entries mapped to their game worlds for quick monitoring and support tracing.
          </p>
        </div>
        <div class="stat-card text-right">
          <p class="stat-label">Shown Entries</p>
          <p class="stat-value">{{ totalUsers }}</p>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="alert-danger">
      {{ loadError }}
    </p>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="page-kicker">Player Signals</p>
        <h2 class="section-heading mt-1">Subscriber Mobile Numbers</h2>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="verificationFilter"
          class="form-control sm:w-auto"
          aria-label="Verification filter"
        >
          <option value="verified">Show Verified</option>
          <option value="not_verified">Show Not Verified</option>
        </select>
        <select
          v-model="subscriberViewMode"
          class="form-control sm:w-auto"
          aria-label="Subscriber view mode"
        >
          <option value="all">Show Subscribers</option>
          <option value="top_scorer">Top Scorer per Game</option>
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
              <th class="px-4 py-3">Game ID</th>
              <th class="px-4 py-3">Game Name</th>
              <th class="px-4 py-3">Points</th>
              <th class="px-4 py-3">Subscribed Date</th>
            </tr>
          </thead>
          <tbody class="table-body">
            <tr v-if="isLoadingMobile">
              <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-slate-500">Loading...</td>
            </tr>
            <tr v-else-if="displayedUsersmobile.length === 0">
              <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-slate-500">{{ emptyUsersMessage }}</td>
            </tr>
            <tr v-for="user in displayedUsersmobile" :key="user.id" class="table-row">
              <td class="px-4 py-3 font-semibold text-slate-900" data-label="Phone Number">
                {{ getPhoneNumber(user) }}
              </td>
              <td class="px-4 py-3 font-semibold text-slate-900" data-label="Nickname">
                {{ getNickname(user) }}
              </td>
              <td class="px-4 py-3 text-slate-600" data-label="Game ID">
                <span class="badge-emerald">
                  {{ user.game_id }}
                </span>
              </td>
              <td class="px-4 py-3 font-semibold text-slate-950" data-label="Game Name">
                {{ getGameName(user) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-950" data-label="Points">
                {{ formatUserScore(user) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-500" data-label="Subscribed Date">
                {{ formatDateTime(getSubscribedDate(user)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalUsers > 0 && (isTopScorerMode || totalPages > 1)" class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <p class="text-xs text-slate-500">
        {{ usersRangeLabel }}
      </p>

      <div v-if="totalPages > 1" class="flex justify-end gap-2">
        <button
          type="button"
          class="btn-secondary"
          :disabled="isLoadingMobile || currentPage <= 1"
          aria-label="Previous page"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <button
          type="button"
          class="btn-secondary"
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
