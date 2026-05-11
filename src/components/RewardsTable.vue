<script setup>
import { ref } from "vue";
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
const tableColumnCount = 8;

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
  <div class="table-shell">
    <div class="table-scroll">
      <table class="responsive-table min-w-[78rem] table-fixed">
        <colgroup>
          <col class="w-28" />
          <col class="w-44" />
          <col class="w-52" />
          <col class="w-28" />
          <col class="w-32" />
          <col class="w-28" />
          <col class="w-44" />
          <col class="w-56" />
        </colgroup>
        <thead class="table-head">
          <tr>
            <th class="px-4 py-3">Picture</th>
            <th class="px-4 py-3">Prize</th>
            <th class="px-4 py-3">Description</th>
            <th class="px-4 py-3">Holdings</th>
            <th class="px-4 py-3">Probability</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Created At</th>
            <th class="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="table-body">
          <tr v-if="isLoading">
            <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-slate-500">
              Loading rewards...
            </td>
          </tr>
          <tr v-else-if="rewards.length === 0">
            <td :colspan="tableColumnCount" class="px-4 py-10 text-center text-slate-500">
              No rewards found.
            </td>
          </tr>
          <tr
            v-for="reward in rewards"
            :key="reward.id"
            class="table-row"
          >
            <td class="px-4 py-3" data-label="Picture">
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
            <td class="min-w-40 px-4 py-3 font-semibold text-slate-950" data-label="Prize">
              {{ reward.prize }}
            </td>
            <td class="max-w-72 px-4 py-3 text-slate-600" data-label="Description">
              <p class="line-clamp-2" :title="getDescription(reward)">
                {{ getDescription(reward) }}
              </p>
            </td>
            <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-950" data-label="Holdings">
              {{ reward.holdings }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 font-bold text-slate-950" data-label="Probability">
              {{ formatProbability(reward) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3" data-label="Status">
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
            <td class="whitespace-nowrap px-4 py-3 text-slate-500" data-label="Created At">
              {{ formatDateTime(reward.created_at) }}
            </td>
            <td class="px-4 py-3" data-actions data-label="Actions">
              <div class="table-actions ml-auto grid w-full grid-cols-2 gap-2">
                <button
                  type="button"
                  class="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-inset ring-white/70 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRewardBusy(reward)"
                  @click="emit('view', reward)"
                >
                  {{ isRewardBusy(reward) ? "Loading..." : "View" }}
                </button>
                <button
                  v-if="canUpdate"
                  type="button"
                  class="inline-flex h-9 items-center justify-center rounded-xl border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 shadow-sm ring-1 ring-inset ring-white/70 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRewardBusy(reward)"
                  @click="emit('edit', reward)"
                >
                  Edit
                </button>
                <button
                  v-if="canUpdate"
                  type="button"
                  class="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-xs font-semibold shadow-sm ring-1 ring-inset ring-white/70 transition disabled:cursor-not-allowed disabled:opacity-60"
                  :class="
                    isRewardActive(reward)
                      ? 'border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50'
                      : 'border-lime-200 text-lime-800 hover:border-lime-300 hover:bg-lime-50'
                  "
                  :disabled="isRewardBusy(reward)"
                  @click="emit('status', reward)"
                >
                  {{ isRewardActive(reward) ? "Deactivate" : "Activate" }}
                </button>
                <button
                  v-if="canDelete"
                  type="button"
                  class="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-inset ring-white/70 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
