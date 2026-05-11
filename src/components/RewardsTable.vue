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

  return `${numericProbability.toFixed(2)}%`;
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
      <table class="responsive-table w-full min-w-[62rem] table-fixed">
        <colgroup>
          <col class="w-24" />
          <col class="w-36" />
          <col class="w-44" />
          <col class="w-24" />
          <col class="w-28" />
          <col class="w-24" />
          <col class="w-44" />
          <col class="w-28" />
        </colgroup>
        <thead class="table-head">
          <tr>
            <th class="px-3 py-3">Picture</th>
            <th class="px-3 py-3">Prize</th>
            <th class="px-3 py-3">Description</th>
            <th class="px-3 py-3">Holdings</th>
            <th class="px-3 py-3">Probability</th>
            <th class="px-3 py-3">Status</th>
            <th class="px-3 py-3">Created At</th>
            <th class="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="table-body">
          <tr v-if="isLoading">
            <td :colspan="tableColumnCount" class="px-3 py-10 text-center text-slate-500">
              Loading rewards...
            </td>
          </tr>
          <tr v-else-if="rewards.length === 0">
            <td :colspan="tableColumnCount" class="px-3 py-10 text-center text-slate-500">
              No rewards found.
            </td>
          </tr>
          <tr
            v-for="reward in rewards"
            :key="reward.id"
            class="table-row"
          >
            <td class="px-3 py-3" data-label="Picture">
              <div class="h-12 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
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
            <td class="px-3 py-3 font-semibold text-slate-950" data-label="Prize">
              {{ reward.prize }}
            </td>
            <td class="px-3 py-3 text-slate-600" data-label="Description">
              <p class="line-clamp-2" :title="getDescription(reward)">
                {{ getDescription(reward) }}
              </p>
            </td>
            <td class="whitespace-nowrap px-3 py-3 font-semibold text-slate-950" data-label="Holdings">
              {{ reward.holdings }}
            </td>
            <td class="whitespace-nowrap px-3 py-3 font-bold text-slate-950" data-label="Probability">
              {{ formatProbability(reward) }}
            </td>
            <td class="whitespace-nowrap px-3 py-3" data-label="Status">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset"
                :class="
                  isRewardActive(reward)
                    ? 'bg-lime-400/15 text-lime-900 ring-lime-500/20'
                    : 'bg-slate-100 text-slate-600 ring-slate-300/60'
                "
              >
                {{ isRewardActive(reward) ? "Active" : "Inactive" }}
              </span>
            </td>
            <td class="px-3 py-3 leading-5 text-slate-500" data-label="Created At">
              {{ formatDateTime(reward.created_at) }}
            </td>
            <td class="px-3 py-3" data-actions data-label="Actions">
              <div class="table-actions reward-actions ml-auto flex w-20 flex-col items-stretch gap-1.5">
                <button
                  type="button"
                  class="action-button action-button-view"
                  :aria-label="`View ${reward.prize || 'reward'}`"
                  :disabled="isRewardBusy(reward)"
                  :title="`View ${reward.prize || 'reward'}`"
                  @click="emit('view', reward)"
                >
                  {{ isRewardBusy(reward) ? "Wait" : "View" }}
                </button>
                <button
                  v-if="canUpdate"
                  type="button"
                  class="action-button action-button-edit"
                  :aria-label="`Edit ${reward.prize || 'reward'}`"
                  :disabled="isRewardBusy(reward)"
                  :title="`Edit ${reward.prize || 'reward'}`"
                  @click="emit('edit', reward)"
                >
                  Edit
                </button>
                <button
                  v-if="canUpdate && !isRewardActive(reward)"
                  type="button"
                  class="action-button action-button-activate"
                  :aria-label="`Activate ${reward.prize || 'reward'}`"
                  :disabled="isRewardBusy(reward)"
                  :title="`Activate ${reward.prize || 'reward'}`"
                  @click="emit('status', reward)"
                >
                  Activate
                </button>
                <button
                  v-if="canDelete"
                  type="button"
                  class="action-button action-button-delete"
                  :aria-label="`Delete ${reward.prize || 'reward'}`"
                  :disabled="isRewardBusy(reward)"
                  :title="`Delete ${reward.prize || 'reward'}`"
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
