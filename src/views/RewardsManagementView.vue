<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { apiRequest } from "../api/http";
import {
  deleteReward,
  getRewardById,
  getRewardsByGameCredentials,
  updateRewardProbability,
  updateRewardStatus,
} from "../api/rewards";
import BulkProbabilityModal from "../components/BulkProbabilityModal.vue";
import ConfirmActionModal from "../components/ConfirmActionModal.vue";
import RewardFormModal from "../components/RewardFormModal.vue";
import RewardsTable from "../components/RewardsTable.vue";
import RewardViewModal from "../components/RewardViewModal.vue";
import { useAuthStore } from "../stores/auth";

const PAGE_SIZE = 10;

const authStore = useAuthStore();
const rewards = ref([]);
const selectedGameRewards = ref([]);
const games = ref([]);
const gameSecretKeys = ref({});
const pagination = ref({
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  total_pages: 1,
});
const filters = reactive({
  game_id: "",
  is_active: "",
  search: "",
});
const searchText = ref("");
const loadError = ref("");
const gameLoadError = ref("");
const statusMessage = ref("");
const isLoadingRewards = ref(false);
const isLoadingGames = ref(false);
const isCreateModalOpen = ref(false);
const isEditModalOpen = ref(false);
const isViewModalOpen = ref(false);
const isProbabilityModalOpen = ref(false);
const isBulkProbabilitySubmitting = ref(false);
const selectedReward = ref(null);
const activeRewardId = ref(null);
const isConfirmSubmitting = ref(false);
const confirmAction = reactive({
  open: false,
  type: "",
  reward: null,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  variant: "danger",
});

let rewardsRequestId = 0;
let searchDebounceId = null;

const canCreateRewards = computed(() => authStore.canAccess("rewards.create"));
const canUpdateRewards = computed(() => authStore.canAccess("rewards.update"));
const canDeleteRewards = computed(() => authStore.canAccess("rewards.delete"));

const activeSelectedGameRewards = computed(() =>
  selectedGameRewards.value.filter(isRewardActive),
);

const totalPages = computed(() => Math.max(1, Number(pagination.value.total_pages) || 1));

const rewardsRangeLabel = computed(() => {
  if (pagination.value.total === 0) {
    return "0 rewards";
  }

  const startIndex = (pagination.value.page - 1) * pagination.value.limit + 1;
  const endIndex = Math.min(pagination.value.page * pagination.value.limit, pagination.value.total);
  return `Showing ${startIndex}-${endIndex} of ${pagination.value.total}`;
});

const gameOptions = computed(() =>
  games.value
    .map((game) => {
      const value = getGameOptionValue(game);
      if (!value) {
        return null;
      }

      return {
        value,
        label: `${game?.name || game?.title || `Game ${value}`} (ID ${value})`,
      };
    })
    .filter(Boolean),
);

const selectedGameFilterLabel = computed(() =>
  gameOptions.value.find((gameOption) => gameOption.value === filters.game_id)?.label || "",
);

const rewardsSectionTitle = computed(() =>
  selectedGameFilterLabel.value ? `Rewards for ${selectedGameFilterLabel.value}` : "Select a game",
);

const selectedRewardGameName = computed(() => getGameName(selectedReward.value));

function getGameOptionValue(game) {
  const value = game?.game_id ?? game?.gameId ?? game?.gameid ?? game?.public_game_id ?? game?.publicGameId ?? game?.id;
  if (value === undefined || value === null || String(value).trim() === "") {
    return "";
  }

  return String(value);
}

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

  if (Array.isArray(payload.games)) {
    return payload.games;
  }

  if (Array.isArray(payload.data?.games)) {
    return payload.data.games;
  }

  return [];
}

function extractGameRecord(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (payload.data && !Array.isArray(payload.data)) {
    return payload.data.game || payload.data;
  }

  return payload.game || payload;
}

function isRewardActive(reward) {
  return reward?.is_active === 1 || reward?.is_active === true || reward?.is_active === "1";
}

function getFriendlyError(error, fallbackMessage) {
  if (error?.status === 404) {
    return "Reward not found.";
  }

  if (error?.status >= 500) {
    return "Something went wrong on the server. Please try again.";
  }

  return error?.message || fallbackMessage;
}

function normalizeGameFilterValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return "";
  }

  const directPublicMatch = games.value.find((game) => getGameOptionValue(game) === rawValue);
  if (directPublicMatch) {
    return rawValue;
  }

  const internalIdMatch = games.value.find((game) => String(game?.id ?? "") === rawValue);
  return internalIdMatch ? getGameOptionValue(internalIdMatch) : rawValue;
}

function getGameSecretKey(game) {
  return String(
    game?.game_secret_key
      || game?.gamesecretkey
      || game?.gameSecretKey
      || game?.secret_key
      || game?.secretKey
      || "",
  ).trim();
}

function findGameByPublicId(gameId) {
  const normalizedGameId = normalizeGameFilterValue(gameId);
  return games.value.find((game) => getGameOptionValue(game) === normalizedGameId) || null;
}

function getGameDetailCandidates(game, gameId) {
  return [
    game?.slug,
    game?.id,
    getGameOptionValue(game),
    gameId,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function mergeGameRecord(gameId, gameRecord) {
  if (!gameRecord || typeof gameRecord !== "object") {
    return;
  }

  const normalizedGameId = normalizeGameFilterValue(gameId);
  const nextGames = [...games.value];
  const existingGameIndex = nextGames.findIndex((game) => getGameOptionValue(game) === normalizedGameId);
  if (existingGameIndex >= 0) {
    nextGames[existingGameIndex] = {
      ...nextGames[existingGameIndex],
      ...gameRecord,
    };
  } else {
    nextGames.push(gameRecord);
  }
  games.value = nextGames;
}

async function resolveGameSecretKey(gameId) {
  const normalizedGameId = normalizeGameFilterValue(gameId);
  if (gameSecretKeys.value[normalizedGameId]) {
    return gameSecretKeys.value[normalizedGameId];
  }

  const game = findGameByPublicId(normalizedGameId);
  const directSecretKey = getGameSecretKey(game);
  if (directSecretKey) {
    gameSecretKeys.value = {
      ...gameSecretKeys.value,
      [normalizedGameId]: directSecretKey,
    };
    return directSecretKey;
  }

  let lastError = null;
  for (const candidate of getGameDetailCandidates(game, normalizedGameId)) {
    try {
      const payload = await apiRequest(`/api/games/${candidate}`);
      const gameRecord = extractGameRecord(payload);
      const secretKey = getGameSecretKey(gameRecord);
      if (secretKey) {
        mergeGameRecord(normalizedGameId, gameRecord);
        gameSecretKeys.value = {
          ...gameSecretKeys.value,
          [normalizedGameId]: secretKey,
        };
        return secretKey;
      }
    } catch (error) {
      lastError = error;
      if (error?.status !== 404) {
        throw error;
      }
    }
  }

  if (lastError && lastError.status !== 404) {
    throw lastError;
  }

  throw new Error("Game secret key is missing for the selected game.");
}

function getGameName(reward) {
  if (!reward) {
    return "";
  }

  if (reward?.game?.name) {
    return reward.game.name;
  }

  const rewardGameId = String(reward?.game_id ?? "");
  const matchingGame = games.value.find((game) =>
    String(game?.id ?? "") === rewardGameId || String(game?.game_id ?? "") === rewardGameId,
  );

  return matchingGame?.name || matchingGame?.title || (rewardGameId ? `Game ${rewardGameId}` : "");
}

async function loadGames() {
  gameLoadError.value = "";
  isLoadingGames.value = true;

  try {
    const payload = await apiRequest("/api/games");
    games.value = extractGamesList(payload);
    if (!normalizeGameFilterValue(filters.game_id) && gameOptions.value.length > 0) {
      filters.game_id = gameOptions.value[0].value;
    }
  } catch (error) {
    games.value = [];
    gameLoadError.value = error?.message || "Failed to load games for rewards.";
  } finally {
    isLoadingGames.value = false;
  }
}

function filterGameRewards(rewardRecords) {
  const searchValue = filters.search.trim().toLowerCase();

  return rewardRecords.filter((reward) => {
    const matchesStatus = filters.is_active === ""
      ? true
      : String(isRewardActive(reward) ? 1 : 0) === String(filters.is_active);
    const searchableText = `${reward?.prize || ""} ${reward?.description || ""}`.toLowerCase();
    const matchesSearch = searchValue ? searchableText.includes(searchValue) : true;

    return matchesStatus && matchesSearch;
  });
}

async function getRewardsForSelectedGame(gameId, page) {
  const gamesecretkey = await resolveGameSecretKey(gameId);
  const result = await getRewardsByGameCredentials({
    game_id: gameId,
    gamesecretkey,
  });
  const filteredRewards = filterGameRewards(result.rewards);
  const total = filteredRewards.length;
  const totalPagesForGame = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPagesForGame);
  const startIndex = (safePage - 1) * PAGE_SIZE;

  return {
    rewards: filteredRewards.slice(startIndex, startIndex + PAGE_SIZE),
    allRewards: result.rewards,
    pagination: {
      page: safePage,
      limit: PAGE_SIZE,
      total,
      total_pages: totalPagesForGame,
    },
    raw: result.raw,
  };
}

async function loadRewards(page = pagination.value.page) {
  const requestId = ++rewardsRequestId;
  loadError.value = "";
  isLoadingRewards.value = true;

  try {
    const normalizedGameId = normalizeGameFilterValue(filters.game_id);
    if (!normalizedGameId) {
      if (requestId !== rewardsRequestId) {
        return;
      }

      rewards.value = [];
      selectedGameRewards.value = [];
      pagination.value = {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        total_pages: 1,
      };
      return;
    }

    const result = await getRewardsForSelectedGame(normalizedGameId, page);
    if (requestId !== rewardsRequestId) {
      return;
    }

    rewards.value = result.rewards;
    selectedGameRewards.value = result.allRewards || result.rewards;
    pagination.value = {
      ...result.pagination,
      limit: result.pagination.limit || PAGE_SIZE,
    };
  } catch (error) {
    if (requestId !== rewardsRequestId) {
      return;
    }

    rewards.value = [];
    selectedGameRewards.value = [];
    pagination.value = {
      page,
      limit: PAGE_SIZE,
      total: 0,
      total_pages: 1,
    };

    if (error?.status === 404) {
      return;
    }

    loadError.value = getFriendlyError(error, "Failed to load rewards.");
  } finally {
    if (requestId === rewardsRequestId) {
      isLoadingRewards.value = false;
    }
  }
}

function applyFilters() {
  statusMessage.value = "";
  loadRewards(1);
}

function handleGameFilterChange(event) {
  filters.game_id = normalizeGameFilterValue(event?.target?.value);
  applyFilters();
}

function handleStatusFilterChange(event) {
  filters.is_active = String(event?.target?.value ?? "");
  applyFilters();
}

function resetFilters() {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
    searchDebounceId = null;
  }

  filters.game_id = gameOptions.value[0]?.value || "";
  filters.is_active = "";
  filters.search = "";
  searchText.value = "";
  statusMessage.value = "";
  loadRewards(1);
}

async function goToPage(page) {
  if (page < 1 || page > totalPages.value || page === pagination.value.page) {
    return;
  }

  await loadRewards(page);
}

function openCreateRewardModal() {
  if (!canCreateRewards.value) {
    loadError.value = "You do not have permission to create rewards.";
    return;
  }

  selectedReward.value = null;
  isCreateModalOpen.value = true;
}

function openProbabilityModal() {
  if (!canUpdateRewards.value) {
    loadError.value = "You do not have permission to update reward probabilities.";
    return;
  }

  if (!normalizeGameFilterValue(filters.game_id)) {
    loadError.value = "Select a game before updating probabilities.";
    return;
  }

  if (activeSelectedGameRewards.value.length === 0) {
    loadError.value = "This game has no active rewards to update.";
    return;
  }

  loadError.value = "";
  isProbabilityModalOpen.value = true;
}

async function loadRewardDetails(reward, fallbackMessage) {
  activeRewardId.value = reward?.id ?? null;
  loadError.value = "";

  try {
    return await getRewardById(reward.id);
  } catch (error) {
    loadError.value = getFriendlyError(error, fallbackMessage);
    return null;
  } finally {
    activeRewardId.value = null;
  }
}

async function openViewRewardModal(reward) {
  const rewardDetails = await loadRewardDetails(reward, "Could not load reward details.");
  if (!rewardDetails) {
    return;
  }

  selectedReward.value = rewardDetails;
  isViewModalOpen.value = true;
}

async function openEditRewardModal(reward) {
  if (!canUpdateRewards.value) {
    loadError.value = "You do not have permission to update rewards.";
    return;
  }

  const rewardDetails = await loadRewardDetails(reward, "Could not load reward for editing.");
  if (!rewardDetails) {
    return;
  }

  selectedReward.value = rewardDetails;
  isEditModalOpen.value = true;
}

function closeConfirmAction() {
  if (isConfirmSubmitting.value) {
    return;
  }

  confirmAction.open = false;
  confirmAction.type = "";
  confirmAction.reward = null;
}

function openStatusConfirmation(reward) {
  if (!canUpdateRewards.value) {
    loadError.value = "You do not have permission to update reward status.";
    return;
  }

  const nextStatusLabel = isRewardActive(reward) ? "deactivate" : "activate";
  confirmAction.open = true;
  confirmAction.type = "status";
  confirmAction.reward = reward;
  confirmAction.title = `${nextStatusLabel === "activate" ? "Activate" : "Deactivate"} reward`;
  confirmAction.message = `Are you sure you want to ${nextStatusLabel} "${reward.prize}"?`;
  confirmAction.confirmLabel = nextStatusLabel === "activate" ? "Activate" : "Deactivate";
  confirmAction.variant = nextStatusLabel === "activate" ? "primary" : "danger";
}

function openDeleteConfirmation(reward) {
  if (!canDeleteRewards.value) {
    loadError.value = "You do not have permission to delete rewards.";
    return;
  }

  confirmAction.open = true;
  confirmAction.type = "delete";
  confirmAction.reward = reward;
  confirmAction.title = "Delete reward";
  confirmAction.message = `Delete "${reward.prize}"? This action cannot be undone.`;
  confirmAction.confirmLabel = "Delete";
  confirmAction.variant = "danger";
}

async function confirmPendingAction() {
  if (!confirmAction.reward || !confirmAction.type) {
    return;
  }

  const reward = confirmAction.reward;
  isConfirmSubmitting.value = true;
  activeRewardId.value = reward.id;
  loadError.value = "";
  statusMessage.value = "";

  try {
    if (confirmAction.type === "status") {
      const nextIsActive = isRewardActive(reward) ? 0 : 1;
      await updateRewardStatus(reward.id, nextIsActive);
      statusMessage.value = `Reward ${nextIsActive === 1 ? "activated" : "deactivated"} successfully.`;
      await loadRewards(pagination.value.page);
    } else if (confirmAction.type === "delete") {
      await deleteReward(reward.id);
      statusMessage.value = "Reward deleted successfully.";
      const nextPage = rewards.value.length === 1 && pagination.value.page > 1
        ? pagination.value.page - 1
        : pagination.value.page;
      await loadRewards(nextPage);
    }

    confirmAction.open = false;
    confirmAction.type = "";
    confirmAction.reward = null;
  } catch (error) {
    loadError.value = getFriendlyError(error, "Could not complete reward action.");
  } finally {
    isConfirmSubmitting.value = false;
    activeRewardId.value = null;
  }
}

async function handleBulkProbabilitySubmit(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return;
  }

  isBulkProbabilitySubmitting.value = true;
  loadError.value = "";
  statusMessage.value = "";

  try {
    await Promise.all(
      updates.map(({ reward, probability }) =>
        updateRewardProbability(reward.id, reward, probability),
      ),
    );
    statusMessage.value = "Probabilities updated successfully.";
    isProbabilityModalOpen.value = false;
    await loadRewards(pagination.value.page);
  } catch (error) {
    loadError.value = getFriendlyError(error, "Could not update probabilities.");
  } finally {
    isBulkProbabilitySubmitting.value = false;
  }
}

function handleRewardCreated() {
  statusMessage.value = "Reward created successfully.";
  loadRewards(1);
}

function handleRewardUpdated() {
  statusMessage.value = "Reward updated successfully.";
  loadRewards(pagination.value.page);
}

watch(searchText, (nextSearchText) => {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
  }

  searchDebounceId = window.setTimeout(() => {
    filters.search = nextSearchText.trim();
    applyFilters();
  }, 350);
});

onMounted(async () => {
  await loadGames();
  loadRewards(1);
});

onBeforeUnmount(() => {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
  }
});
</script>

<template>
  <div class="space-y-8">
    <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.94)_46%,_rgba(236,252,203,0.9))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
      <div class="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-emerald-800/70">Rewards Console</p>
          <h1 class="mt-3 text-3xl font-bold tracking-tight text-emerald-950 md:text-4xl">Rewards Management</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/70">
            Manage game prizes, holdings, active status, and game-scoped probability distributions.
          </p>
        </div>

        <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <div class="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-right backdrop-blur">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">Total Rewards</p>
            <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ pagination.total }}</p>
          </div>
          <button
            v-if="canUpdateRewards"
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="activeSelectedGameRewards.length === 0"
            @click="openProbabilityModal"
          >
            Update probabilities
          </button>
          <button
            v-if="canCreateRewards"
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-emerald-800/10 bg-emerald-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-900"
            @click="openCreateRewardModal"
          >
            Add Reward
          </button>
        </div>
      </div>
    </section>

    <div class="grid gap-4 rounded-[24px] border border-emerald-200/70 bg-white/90 p-4 shadow-[0_18px_55px_-44px_rgba(20,83,45,0.45)] md:grid-cols-[minmax(12rem,1fr)_minmax(10rem,14rem)_minmax(14rem,1.4fr)_auto] md:items-end">
      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Game</label>
        <select
          v-model="filters.game_id"
          class="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
          :disabled="isLoadingGames"
          required
          @change="handleGameFilterChange"
        >
          <option value="" disabled>{{ isLoadingGames ? "Loading games..." : "Select game" }}</option>
          <option
            v-for="gameOption in gameOptions"
            :key="gameOption.value"
            :value="gameOption.value"
          >
            {{ gameOption.label }}
          </option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Status</label>
        <select
          v-model="filters.is_active"
          class="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
          @change="handleStatusFilterChange"
        >
          <option value="">All</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Search</label>
        <input
          v-model="searchText"
          type="search"
          class="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 outline-none ring-emerald-500/25 transition placeholder:text-emerald-900/35 focus:border-emerald-500 focus:ring-2"
          placeholder="Prize or description"
        />
      </div>

      <button
        type="button"
        class="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
        @click="resetFilters"
      >
        Reset filters
      </button>
    </div>

    <p v-if="gameLoadError" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {{ gameLoadError }}
    </p>

    <p v-if="statusMessage" class="rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
      {{ statusMessage }}
    </p>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p>

    <section class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Reward Directory</p>
          <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ rewardsSectionTitle }}</h2>
        </div>
        <p class="text-sm font-medium text-emerald-900/55">{{ rewardsRangeLabel }}</p>
      </div>

      <RewardsTable
        :rewards="rewards"
        :games="games"
        :is-loading="isLoadingRewards"
        :can-update="canUpdateRewards"
        :can-delete="canDeleteRewards"
        :loading-reward-id="activeRewardId"
        @view="openViewRewardModal"
        @edit="openEditRewardModal"
        @status="openStatusConfirmation"
        @delete="openDeleteConfirmation"
      />

      <div
        v-if="pagination.total > 0"
        class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
      >
        <p class="text-xs text-emerald-900/50">
          Page {{ pagination.page }} of {{ totalPages }}
        </p>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isLoadingRewards || pagination.page <= 1"
            aria-label="Previous page"
            @click="goToPage(pagination.page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isLoadingRewards || pagination.page >= totalPages"
            aria-label="Next page"
            @click="goToPage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <RewardFormModal
      :open="isCreateModalOpen"
      mode="create"
      :games="games"
      :loading-games="isLoadingGames"
      @close="isCreateModalOpen = false"
      @created="handleRewardCreated"
    />

    <RewardFormModal
      :open="isEditModalOpen"
      mode="edit"
      :reward="selectedReward"
      :games="games"
      :loading-games="isLoadingGames"
      @close="isEditModalOpen = false"
      @updated="handleRewardUpdated"
    />

    <RewardViewModal
      :open="isViewModalOpen"
      :reward="selectedReward"
      :game-name="selectedRewardGameName"
      @close="isViewModalOpen = false"
    />

    <BulkProbabilityModal
      :open="isProbabilityModalOpen"
      :rewards="selectedGameRewards"
      :game-label="selectedGameFilterLabel"
      :is-submitting="isBulkProbabilitySubmitting"
      @close="isProbabilityModalOpen = false"
      @submit="handleBulkProbabilitySubmit"
    />

    <ConfirmActionModal
      :open="confirmAction.open"
      :title="confirmAction.title"
      :message="confirmAction.message"
      :confirm-label="confirmAction.confirmLabel"
      :variant="confirmAction.variant"
      :is-submitting="isConfirmSubmitting"
      @close="closeConfirmAction"
      @confirm="confirmPendingAction"
    />
  </div>
</template>
