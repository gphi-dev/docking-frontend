<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { apiRequest, resolveAssetUrl } from "../api/http";
import { extractUsermobileRecords } from "../api/response";

const SUBSCRIBER_PAGE_SIZE = 20;
const SUBSCRIBER_NICKNAME_FIELDS = ["nickname", "name", "display_name", "displayName", "username"];
const SUBSCRIBER_POINTS_FIELDS = ["points", "score", "total_points", "totalPoints", "top_score", "high_score"];

const props = defineProps({
  gameId: {
    type: String,
    required: true,
  },
});

const game = ref(null);
const subscribers = ref([]);
const currentPage = ref(1);
const subscribersTotal = ref(0);
const subscribersTotalPages = ref(1);
const loadError = ref("");
const isLoading = ref(true);
const isSubscribersLoading = ref(false);
const hasGameImageLoadFailed = ref(false);
const hasGameBackgroundLoadFailed = ref(false);

// props.gameId is treated as a slug by the router
// const numericGameId = computed(() => Number(props.gameId));

const subscriberRangeLabel = computed(() => {
  if (subscribersTotal.value === 0) {
    return "0 subscribers";
  }
  const startIndex = (currentPage.value - 1) * SUBSCRIBER_PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage.value * SUBSCRIBER_PAGE_SIZE, subscribersTotal.value);
  return `Showing ${startIndex}–${endIndex} of ${subscribersTotal.value}`;
});

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

function getGameUrlLabel(gameRecord) {
  const gameUrl = String(gameRecord?.game_url ?? "").trim();
  return gameUrl || "—";
}

function isTruthy(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function getMobileLabel(gameRecord) {
  return isTruthy(gameRecord?.is_mobile) ? "Mobile" : "Web";
}

// async function loadGame() {
//   const gamePayload = await apiRequest(`/api/games/${numericGameId.value}`);
//   game.value = gamePayload;
// }

async function loadGame() {
  // props.gameId is technically your slug now based on the router params
  const gamePayload = await apiRequest(`/api/games/${props.gameId}`);
  game.value = gamePayload;
}

function getGameIdentifierCandidates() {
  return [...new Set([
    game.value?.id,
    game.value?.game_id,
    game.value?.slug,
    props.gameId,
  ].filter((value) => value !== undefined && value !== null && String(value).trim() !== ""))];
}

function getUsermobileGameIdCandidates() {
  return [...new Set([
    game.value?.game_id,
    props.gameId,
    game.value?.slug,
  ].filter((value) => value !== undefined && value !== null && String(value).trim() !== ""))];
}

async function requestByGameCandidates(buildPath, options = {}) {
  const { candidates = getGameIdentifierCandidates() } = options;
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return await apiRequest(buildPath(String(candidate)));
    } catch (error) {
      lastError = error;
      if (error?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Game not found");
}

async function loadSubscribers() {
  isSubscribersLoading.value = true;
  try {
    loadError.value = "";

    if (!game.value) {
      subscribers.value = [];
      subscribersTotal.value = 0;
      subscribersTotalPages.value = 1;
      return;
    }

    // usersmobile.game_id stores the public game_id, so try that before slug/router values.
    const subscribersPayload = await requestByGameCandidates(
      (candidate) => `/api/usermobile/games/${candidate}`,
      { candidates: getUsermobileGameIdCandidates() },
    );
    const subscriberRecords = extractUsermobileRecords(subscribersPayload);

    subscribers.value = subscriberRecords;
    subscribersTotal.value = subscriberRecords.length;
    subscribersTotalPages.value = Math.max(1, Math.ceil(subscriberRecords.length / SUBSCRIBER_PAGE_SIZE));
  } catch (error) {
    subscribers.value = [];
    subscribersTotal.value = 0;
    subscribersTotalPages.value = 1;
    loadError.value = error?.message || "Failed to load subscribers";
    console.error("Failed to load subscribers", error);
  } finally {
    isSubscribersLoading.value = false;
  }
}

async function loadInitial() {
  loadError.value = "";
  isLoading.value = true;
  hasGameImageLoadFailed.value = false;
  hasGameBackgroundLoadFailed.value = false;
  game.value = null;
  subscribers.value = [];
  subscribersTotal.value = 0;
  subscribersTotalPages.value = 1;

  // Expecting a non-empty slug in the URL
  if (!props.gameId || typeof props.gameId !== "string") {
    loadError.value = "Invalid game id";
    isLoading.value = false;
    return;
  }

  try {
    await loadGame();
    await loadSubscribers();
  } catch (error) {
    loadError.value = error?.message || "Failed to load game";
    game.value = null;
    subscribers.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function goToPage(nextPage) {
  if (nextPage < 1 || nextPage > subscribersTotalPages.value) {
    return;
  }
  currentPage.value = nextPage;
  try {
    await loadSubscribers();
  } catch (error) {
    loadError.value = error?.message || "Failed to load subscribers";
  }
}

function getSubscriberPhone(subscriber) {
  return subscriber?.phone || subscriber?.phone_number || "—";
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

function getSubscriberPoints(subscriber) {
  for (const field of SUBSCRIBER_POINTS_FIELDS) {
    const points = Number(subscriber?.[field]);
    if (Number.isFinite(points)) {
      return points;
    }
  }

  return null;
}

function formatSubscriberPoints(subscriber) {
  const points = getSubscriberPoints(subscriber);
  if (points === null) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(points);
}

const displayedSubscribers = computed(() => {
  const startIndex = (currentPage.value - 1) * SUBSCRIBER_PAGE_SIZE;
  return subscribers.value.slice(startIndex, startIndex + SUBSCRIBER_PAGE_SIZE);
});

onMounted(() => {
  loadInitial();
});

watch(
  () => props.gameId,
  () => {
    currentPage.value = 1;
    loadInitial();
  },
);
</script>

<template>
  <div class="page-stack">
    <div>
      <RouterLink
        :to="{ name: 'games' }"
        class="text-sm font-semibold text-emerald-800 transition-colors duration-200 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        Back to games
      </RouterLink>
    </div>

    <p v-if="loadError" class="alert-danger">
      {{ loadError }}
    </p>

    <div v-else-if="isLoading" class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
      Loading game…
    </div>

    <template v-else-if="game">
      <section class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <img
          v-if="game.background_url && !hasGameBackgroundLoadFailed"
          :src="resolveAssetUrl(game.background_url)"
          alt=""
          class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10"
          @error="hasGameBackgroundLoadFailed = true"
        />
        <div class="relative grid gap-6 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
          <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
            <img
              v-if="game.image_url && !hasGameImageLoadFailed"
              :src="resolveAssetUrl(game.image_url)"
              :alt="game.name"
              class="h-full w-full max-h-60 object-cover"
              @error="hasGameImageLoadFailed = true"
            />
            <div
              v-else
              class="flex h-56 items-center justify-center text-sm font-medium text-emerald-100/70"
            >
              Adventure Ready
            </div>
          </div>
          <div class="min-w-0 space-y-3">
            <p class="page-kicker">World Detail</p>
            <h1 class="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              {{ game.name }}
            </h1>
            <div class="badge-emerald uppercase tracking-widest">
              Game ID: {{ game.game_id || "—" }}
            </div>
            <div
              class="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ring-1 ring-inset"
              :class="
                isTruthy(game.is_mobile)
                  ? 'bg-sky-50 text-sky-800 ring-sky-200'
                  : 'bg-slate-100 text-slate-700 ring-slate-200'
              "
            >
              {{ getMobileLabel(game) }}
            </div>
            <p
              class="max-w-2xl truncate rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200"
              :title="getGameUrlLabel(game)"
            >
              Game URL: {{ getGameUrlLabel(game) }}
            </p>
            <p class="max-w-2xl text-sm leading-6 text-slate-600">
              {{ game.description || "No description provided." }}
            </p>
            <p class="text-xs font-medium uppercase tracking-widest text-slate-500">
              Created {{ formatDateTime(game.created_at) }}
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="page-kicker">Audience Feed</p>
            <h2 class="section-heading mt-1">Subscribers</h2>
          </div>
          <p class="text-sm text-slate-500">
            {{ subscriberRangeLabel }}
          </p>
        </div>
        <div
          class="table-shell relative"
          :class="{ 'opacity-70': isSubscribersLoading }"
        >
          <div class="table-scroll">
            <table class="responsive-table">
              <thead class="table-head">
                <tr>
                  <th class="px-4 py-3">Phone</th>
                  <th class="px-4 py-3">Nickname</th>
                  <th class="px-4 py-3">Points</th>
                  <th class="px-4 py-3">Subscribed</th>
                </tr>
              </thead>
              <tbody class="table-body">
                <tr v-if="!isSubscribersLoading && subscribers.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-slate-500">
                    No subscribers for this game yet.
                  </td>
                </tr>
                <tr v-for="subscriber in displayedSubscribers" :key="subscriber.id" class="table-row">
                  <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-950" data-label="Phone">
                    {{ getSubscriberPhone(subscriber) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900" data-label="Nickname">
                    {{ getSubscriberNickname(subscriber) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-950" data-label="Points">
                    {{ formatSubscriberPoints(subscriber) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-slate-500" data-label="Subscribed">
                    {{ formatDateTime(subscriber.created_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="isSubscribersLoading"
            class="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-500"
          >
            Loading subscribers…
          </p>
        </div>

        <div
          v-if="subscribersTotal > 0"
          class="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
        >
          <p class="text-xs text-slate-500">
            Page {{ currentPage }} of {{ subscribersTotalPages }}
          </p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="btn-secondary"
              :disabled="isSubscribersLoading || currentPage <= 1"
              aria-label="Previous page"
              @click="goToPage(currentPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="isSubscribersLoading || currentPage >= subscribersTotalPages"
              aria-label="Next page"
              @click="goToPage(currentPage + 1)"
            >
              Next
            </button>
          </div>

        </div>
      </section>
    </template>
  </div>
</template>
