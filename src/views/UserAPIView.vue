<script setup>
import { onMounted, ref } from "vue";
import { apiRequest } from "../api/http";
import { extractUsermobileRecords } from "../api/response";

const usersmobile = ref([]);

const loadError = ref("");
const isLoadingMobile = ref(true);

// State for filtering and search
const selectedGameId = ref("");

// State for pagination
const currentPage = ref(1);
const totalPages = ref(1);
const totalUsers = ref(0);
const isServerPaginated = ref(false);

const displayedUsersmobile = computed(() => {
  if (isServerPaginated.value) {
    return usersmobile.value;
  }

  const startIndex = (currentPage.value - 1) * PAGE_SIZE;
  return usersmobile.value.slice(startIndex, startIndex + PAGE_SIZE);
});

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

const usersRangeLabel = computed(() => {
  if (totalUsers.value === 0) {
    return "0 users";
  }
  const startIndex = (currentPage.value - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage.value * PAGE_SIZE, totalUsers.value);
  return `Showing ${startIndex}–${endIndex} of ${totalUsers.value}`;
});

async function loadGames() {
  try {
    const payload = await apiRequest("/api/games");
    games.value = Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.error("Failed to load games for filter:", error);
  }
}

async function loadUsersmobile() {
  loadError.value = "";
  isLoadingMobile.value = true;
  try {
    const payload = await apiRequest("api/usermobile");
    usersmobile.value = Array.isArray(payload) ? payload : [];
  } catch (error) {
    usersmobile.value = [];
    totalUsers.value = 0;
    totalPages.value = 1;
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

// Watch for changes in filters and trigger a reload
watch(selectedGameId, () => {
  currentPage.value = 1;
  loadUsersmobile();
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
            Verified player mobile entries mapped to their game worlds for quick monitoring and support tracing.
          </p>
        </div>
        <div class="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-right backdrop-blur">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">Verified Entries</p>
          <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ usersmobile.length }}</p>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Player Signals</p>
        <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Verified mobile users</h2>
      </div>
    </div>

    <div class="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800/70">
            <tr>
              <th class="px-4 py-3">Game ID</th> 
              <th class="px-4 py-3">Game Name</th> 
              <th class="px-4 py-3">Phone Number</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-emerald-100/80">
            
            <tr v-if="isLoadingMobile">
              <td colspan="2" class="px-4 py-10 text-center text-emerald-900/55">Loading…</td>
            </tr>
            
            <tr v-else-if="usersmobile.length === 0">
              <td colspan="2" class="px-4 py-10 text-center text-emerald-900/55">No mobile users found.</td>
            </tr>
            
            <tr v-for="user in usersmobile" :key="user.id" class="hover:bg-emerald-50/70">
              <td class="px-4 py-3 font-semibold text-emerald-950">
                {{ user.phone }}
              </td>
              <td class="px-4 py-3 text-emerald-900/65">
                <span class="inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-inset ring-emerald-500/20">
                  {{ user.game_id }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ getGameName(user) }}
              </td>
              <td class="px-4 py-3 font-semibold text-slate-900">
                {{ user.phone }}
              </td>
              
            </tr>
            
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalUsers > 0 && totalPages > 1" class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <p class="text-xs text-slate-500">
        Page {{ currentPage }} of {{ totalPages }}
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
