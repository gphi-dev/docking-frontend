<script setup>
import { onMounted, ref, watch, computed } from "vue";
import { apiRequest } from "../api/http";

const PAGE_SIZE = 20;

const usersmobile = ref([]);
const games = ref([]);
const loadError = ref("");
const isLoadingMobile = ref(true);

// State for filtering and search
const selectedGameId = ref("");

// State for pagination
const currentPage = ref(1);
const totalPages = ref(1);
const totalUsers = ref(0);

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
    const params = new URLSearchParams({
      page: currentPage.value,
      pageSize: PAGE_SIZE,
      gameId: selectedGameId.value,
    });
    const payload = await apiRequest(`api/usermobile?${params.toString()}`);
    usersmobile.value = payload.items || [];
    totalUsers.value = payload.total || 0;
    totalPages.value = payload.totalPages || 1;
  } catch (error) {
    loadError.value = error?.message || "Failed to load mobile number of users";
  } finally {
    isLoadingMobile.value = false;
  }
}

async function goToPage(page) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;
  currentPage.value = page;
  await loadUsersmobile();
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
  <div class="space-y-6">

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>
    
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">API usersmobile</h1>
        <p class="mt-1 text-sm text-slate-600">Verified mobile number of the users and its Game ID.</p>
      </div>
      <p class="text-right text-sm text-slate-500 sm:mt-1">{{ usersRangeLabel }}</p>
    </div>
    
    <!-- Filters -->
    <div class="max-w-sm">
      <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Filter by Game
      </label>
      <select v-model="selectedGameId" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2">
        <option value="">All Games</option>
        <option v-for="game in games" :key="game.id" :value="game.game_id">
          {{ game.name }}
        </option>
      </select>
    </div>

    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Game ID</th> 
              <th class="px-4 py-3">Game Name</th> 
              <th class="px-4 py-3">Phone Number</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            
            <tr v-if="isLoadingMobile">
              <td colspan="3" class="px-4 py-10 text-center text-slate-500">Loading…</td>
            </tr>
            
            <tr v-else-if="usersmobile.length === 0">
              <td colspan="3" class="px-4 py-10 text-center text-slate-500">No mobile users found.</td>
            </tr>
            
            <tr v-for="user in usersmobile" :key="user.id" class="hover:bg-slate-50/80">

              <td class="px-4 py-3 text-slate-600">
                {{ user.game_id }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ user.game?.name || "—" }}
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