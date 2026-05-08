<script setup>
import { computed, ref } from "vue";
import { resolveAssetUrl } from "../api/http";

const props = defineProps({
  rewards: {
    type: Array,
    default: () => [],
  },
  games: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  canUpdate: {
    type: Boolean,
    default: false,
  },
  canDelete: {
    type: Boolean,
    default: false,
  },
  loadingRewardId: {
    type: [Number, String],
    default: null,
  },
});

const emit = defineEmits(["view", "edit", "status", "delete"]);

const failedPictureUrls = ref(new Set());
const tableColumnCount = 10;

const gameNameById = computed(() => {
  const entries = new Map();

  props.games.forEach((game) => {
    const label = game?.name || game?.title || "";
    if (!label) {
      return;
    }

    if (game?.id !== undefined && game?.id !== null) {
      entries.set(String(game.id), label);
    }

    if (game?.game_id !== undefined && game?.game_id !== null) {
      entries.set(String(game.game_id), label);
    }
  });

  return entries;
});

function isRewardActive(reward) {
  return reward?.is_active === 1 || reward?.is_active === true || reward?.is_active === "1";
}

function formatProbability(reward) {
  if (!isRewardActive(reward)) {
    return "0.00%";
  }

  const numericProbability = Number(reward?.probability);
  if (!Number.isFinite(numericProbability)) {
    return "0.00%";
  }

  const percentage = numericProbability > 1 ? numericProbability : numericProbability * 100;
  return `${percentage.toFixed(2)}%`;
}

function formatDateTime(isoString) {
  if (!isoString) {
    return "-";
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

function getGameName(reward) {
  if (reward?.game?.name) {
    return reward.game.name;
  }

  return gameNameById.value.get(String(reward?.game_id ?? "")) || `Game ${reward?.game_id ?? "-"}`;
}

function getPictureSrc(reward) {
  return resolveAssetUrl(String(reward?.picture || "").trim());
}

function hasPictureFailed(pictureUrl) {
  return Boolean(pictureUrl && failedPictureUrls.value.has(pictureUrl));
}

function handlePictureError(pictureUrl) {
  if (!pictureUrl) {
    return;
  }

  failedPictureUrls.value = new Set([...failedPictureUrls.value, pictureUrl]);
}

function getDescription(reward) {
  return String(reward?.description || "").trim() || "-";
}

function isRewardBusy(reward) {
  return String(props.loadingRewardId ?? "") === String(reward?.id ?? "");
}
</script>

<template>
  <div class="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/70">
          <tr>
            <th class="px-4 py-3">ID</th>
            <th class="px-4 py-3">Game</th>
            <th class="px-4 py-3">Picture</th>
            <th class="px-4 py-3">Prize</th>
            <th class="px-4 py-3">Description</th>
            <th class="px-4 py-3">Holdings</th>
            <th class="px-4 py-3">Probability</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Created At</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-emerald-100/80">
          <tr v-if="isLoading">
            <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-emerald-900/55">
              Loading rewards...
            </td>
          </tr>
          <tr v-else-if="rewards.length === 0">
            <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-emerald-900/55">
              No rewards found.
            </td>
          </tr>
          <tr
            v-for="reward in rewards"
            :key="reward.id"
            class="hover:bg-emerald-50/70"
          >
            <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
              {{ reward.id }}
            </td>
            <td class="min-w-40 px-4 py-3">
              <p class="font-semibold text-emerald-950">{{ getGameName(reward) }}</p>
              <p class="mt-0.5 text-xs text-emerald-900/50">ID {{ reward.game_id }}</p>
            </td>
            <td class="px-4 py-3">
              <div class="h-14 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img
                  v-if="getPictureSrc(reward) && !hasPictureFailed(reward.picture)"
                  :src="getPictureSrc(reward)"
                  :alt="reward.prize || 'Reward picture'"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  @error="handlePictureError(reward.picture)"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-semibold text-slate-500"
                >
                  No image
                </div>
              </div>
            </td>
            <td class="min-w-40 px-4 py-3 font-semibold text-slate-950">
              {{ reward.prize }}
            </td>
            <td class="max-w-72 px-4 py-3 text-slate-600">
              <p class="line-clamp-2" :title="getDescription(reward)">
                {{ getDescription(reward) }}
              </p>
            </td>
            <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
              {{ reward.holdings }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 font-bold text-emerald-950">
              {{ formatProbability(reward) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <span
                class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset"
                :class="
                  isRewardActive(reward)
                    ? 'bg-lime-400/15 text-lime-900 ring-lime-500/20'
                    : 'bg-slate-100 text-slate-600 ring-slate-300/60'
                "
              >
                {{ isRewardActive(reward) ? "Active" : "Inactive" }}
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
              {{ formatDateTime(reward.created_at) }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  class="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRewardBusy(reward)"
                  @click="emit('view', reward)"
                >
                  {{ isRewardBusy(reward) ? "Loading..." : "View" }}
                </button>
                <button
                  v-if="canUpdate"
                  type="button"
                  class="rounded-full border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRewardBusy(reward)"
                  @click="emit('edit', reward)"
                >
                  Edit
                </button>
                <button
                  v-if="canUpdate"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  :class="
                    isRewardActive(reward)
                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      : 'border-lime-200 text-lime-800 hover:bg-lime-50'
                  "
                  :disabled="isRewardBusy(reward)"
                  @click="emit('status', reward)"
                >
                  {{ isRewardActive(reward) ? "Deactivate" : "Activate" }}
                </button>
                <button
                  v-if="canDelete"
                  type="button"
                  class="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRewardBusy(reward)"
                  @click="emit('delete', reward)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
