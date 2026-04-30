<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { apiRequest, resolveAssetUrl } from "../api/http";

const SUBSCRIBER_PAGE_SIZE = 20;

const props = defineProps({
  gameId: {
    type: String,
    required: true,
  },
});

const game = ref(null);
const subscribers = ref([]);
const usermobiles = ref([]);
const currentPage = ref(1);
const subscribersTotal = ref(0);
const subscribersTotalPages = ref(1);
const loadError = ref("");
const usermobilesLoadError = ref("");
const isLoading = ref(true);
const isSubscribersLoading = ref(false);
const isUsermobilesLoading = ref(false);
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

async function requestByGameCandidates(buildPath) {
  const candidates = getGameIdentifierCandidates();
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

    const queryParameters = new URLSearchParams({
      page: String(currentPage.value),
      pageSize: String(SUBSCRIBER_PAGE_SIZE),
    });

    const subscribersPayload = await requestByGameCandidates(
      (candidate) => `/api/subscribers/games/${candidate}?${queryParameters.toString()}`,
    );

    subscribers.value = Array.isArray(subscribersPayload.items) ? subscribersPayload.items : [];
    subscribersTotal.value = typeof subscribersPayload.total === "number" ? subscribersPayload.total : 0;
    subscribersTotalPages.value = typeof subscribersPayload.totalPages === "number" ? subscribersPayload.totalPages : 1;
    if (typeof subscribersPayload.page === "number") {
      currentPage.value = subscribersPayload.page;
    }
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

async function loadUsermobiles() {
  usermobilesLoadError.value = "";
  isUsermobilesLoading.value = true;
  try {
    if (!game.value) {
      usermobiles.value = [];
      return;
    }

    const usermobilesPayload = await requestByGameCandidates(
      (candidate) => `/api/usermobile/games/${candidate}`,
    );
    usermobiles.value = Array.isArray(usermobilesPayload) ? usermobilesPayload : [];
  } catch (error) {
    usermobiles.value = [];
    usermobilesLoadError.value = error?.message || "Failed to load verified mobile users";
  } finally {
    isUsermobilesLoading.value = false;
  }
}

async function loadInitial() {
  loadError.value = "";
  usermobilesLoadError.value = "";
  isLoading.value = true;
  hasGameImageLoadFailed.value = false;
  hasGameBackgroundLoadFailed.value = false;
  game.value = null;
  subscribers.value = [];
  usermobiles.value = [];
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
    await Promise.all([loadSubscribers(), loadUsermobiles()]);
  } catch (error) {
    loadError.value = error?.message || "Failed to load game";
    game.value = null;
    subscribers.value = [];
    usermobiles.value = [];
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
  <div class="space-y-8">
    <div>
      <RouterLink
        :to="{ name: 'games' }"
        class="text-sm font-semibold text-emerald-800 hover:text-emerald-600"
      >
        ← Back to games
      </RouterLink>
    </div>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <div v-else-if="isLoading" class="rounded-[26px] border border-dashed border-emerald-200 bg-white/90 p-10 text-center text-sm text-emerald-900/55">
      Loading game…
    </div>

    <template v-else-if="game">
      <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.3),_transparent_35%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.9)_45%,_rgba(236,252,203,0.92))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
        <img
          v-if="game.background_url && !hasGameBackgroundLoadFailed"
          :src="resolveAssetUrl(game.background_url)"
          alt=""
          class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
          @error="hasGameBackgroundLoadFailed = true"
        />
        <div class="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
        <div class="pointer-events-none absolute bottom-0 left-12 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />
        <div class="relative grid gap-6 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
          <div class="overflow-hidden rounded-[24px] border border-white/40 bg-emerald-950/90 shadow-xl shadow-emerald-950/15 ring-1 ring-white/10">
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
            <p class="text-xs font-bold uppercase tracking-[0.35em] text-emerald-800/70">World Detail</p>
            <h1 class="text-3xl font-bold tracking-tight text-emerald-950 md:text-4xl">
              {{ game.name }}
            </h1>
            <div class="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-900 ring-1 ring-inset ring-emerald-500/20">
              Game ID: {{ game.game_id || "—" }}
            </div>
            <p class="max-w-2xl text-sm leading-6 text-emerald-950/70">
              {{ game.description || "No description provided." }}
            </p>
            <p class="text-xs font-medium uppercase tracking-[0.25em] text-emerald-900/45">
              Created {{ formatDateTime(game.created_at) }}
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Audience Feed</p>
            <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Subscribers</h2>
          </div>
          <p class="text-sm text-emerald-900/55">
            {{ subscriberRangeLabel }}
          </p>
        </div>
        <div
          class="relative overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]"
          :class="{ 'opacity-70': isSubscribersLoading }"
        >
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800/70">
                <tr>
                  <th class="px-4 py-3">Phone</th>
                  <th class="px-4 py-3">Subscribed</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-emerald-100/80">
                <tr v-if="!isSubscribersLoading && subscribers.length === 0">
                  <td colspan="2" class="px-4 py-8 text-center text-emerald-900/55">
                    No subscribers for this game yet.
                  </td>
                </tr>
                <tr v-for="subscriber in subscribers" :key="subscriber.id" class="hover:bg-emerald-50/70">
                  <td class="whitespace-nowrap px-4 py-3 font-medium text-emerald-950">
                    {{ subscriber.phone_number }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                    {{ formatDateTime(subscriber.created_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="isSubscribersLoading"
            class="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-emerald-900/60"
          >
            Loading subscribers…
          </p>
        </div>

        <div
          v-if="subscribersTotal > 0"
          class="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
        >
          <p class="text-xs text-emerald-900/50">
            Page {{ currentPage }} of {{ subscribersTotalPages }}
          </p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isSubscribersLoading || currentPage <= 1"
              aria-label="Previous page"
              @click="goToPage(currentPage - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isSubscribersLoading || currentPage >= subscribersTotalPages"
              aria-label="Next page"
              @click="goToPage(currentPage + 1)"
            >
              Next
            </button>
          </div>

        </div>
      </section>

      <section class="space-y-5">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Signal Watch</p>
            <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Verified Mobile Users</h2>
          </div>
          <p class="text-sm text-emerald-900/55">
            {{ usermobiles.length }} Records
          </p>
        </div>

        <p
          v-if="usermobilesLoadError"
          class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {{ usermobilesLoadError }}
        </p>

        <div
          class="relative overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]"
          :class="{ 'opacity-70': isUsermobilesLoading }"
        >
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800/70">
                <tr>
                  <th class="px-4 py-3">Phone Number</th>
                  <th class="px-4 py-3">Game ID</th>
                  <th class="px-4 py-3">Verified</th>
                  <th class="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-emerald-100/80">
                <tr v-if="!isUsermobilesLoading && usermobiles.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-emerald-900/55">
                    No verified mobile users for this game yet.
                  </td>
                </tr>
                <tr v-for="usermobile in usermobiles" :key="usermobile.id" class="hover:bg-emerald-50/70">
                  <td class="whitespace-nowrap px-4 py-3 font-medium text-emerald-950">
                    {{ usermobile.phone }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-emerald-900/65">
                    {{ usermobile.game_id }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                    {{ usermobile.is_verified ? "Yes" : "No" }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                    {{ formatDateTime(usermobile.created_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="isUsermobilesLoading"
            class="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-emerald-900/60"
          >
            Loading verified mobile users…
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
