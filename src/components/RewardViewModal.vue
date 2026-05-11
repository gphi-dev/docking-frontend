<script setup>
import { computed, ref, watch } from "vue";
import { resolveAssetUrl } from "../api/http";

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  reward: {
    type: Object,
    default: null,
  },
  gameName: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close"]);

const hasPictureFailed = ref(false);

const pictureSrc = computed(() => resolveAssetUrl(String(props.reward?.picture || "").trim()));

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

watch(
  () => [props.open, props.reward?.id],
  () => {
    hasPictureFailed.value = false;
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/60 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 sm:max-h-[calc(100vh-2rem)]"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
          <div>
            <h2 class="text-lg font-semibold text-slate-950">Reward details</h2>
            <p class="mt-1 text-sm text-slate-500">Probability is shown exactly as backend-computed.</p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
            @click="emit('close')"
          >
            x
          </button>
        </div>

        <div v-if="reward" class="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div class="grid gap-5 md:grid-cols-[minmax(0,220px)_1fr]">
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img
                v-if="pictureSrc && !hasPictureFailed"
                :src="pictureSrc"
                :alt="reward.prize || 'Reward picture'"
                class="h-56 w-full object-contain"
                @error="hasPictureFailed = true"
              />
              <div
                v-else
                class="flex h-56 items-center justify-center px-4 text-center text-sm font-semibold text-slate-500"
              >
                No image
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Prize</p>
                <p class="mt-1 text-2xl font-bold text-slate-950">{{ reward.prize }}</p>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-slate-200 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">ID</p>
                  <p class="mt-1 font-semibold text-slate-950">{{ reward.id }}</p>
                </div>
                <div class="rounded-xl border border-slate-200 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Game</p>
                  <p class="mt-1 font-semibold text-slate-950">{{ gameName || `Game ${reward.game_id}` }}</p>
                </div>
                <div class="rounded-xl border border-slate-200 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Holdings</p>
                  <p class="mt-1 font-semibold text-slate-950">{{ reward.holdings }}</p>
                </div>
                <div class="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Probability</p>
                  <p class="mt-1 font-bold text-emerald-950">{{ formatProbability(reward) }}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
            <p class="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {{ reward.description || "No description provided." }}
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-xl border border-slate-200 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <span
                class="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset"
                :class="
                  isRewardActive(reward)
                    ? 'bg-lime-400/15 text-lime-900 ring-lime-500/20'
                    : 'bg-slate-100 text-slate-600 ring-slate-300/60'
                "
              >
                {{ isRewardActive(reward) ? "Active" : "Inactive" }}
              </span>
            </div>
            <div class="rounded-xl border border-slate-200 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Created At</p>
              <p class="mt-1 text-sm font-semibold text-slate-950">{{ formatDateTime(reward.created_at) }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated At</p>
              <p class="mt-1 text-sm font-semibold text-slate-950">{{ formatDateTime(reward.updated_at) }}</p>
            </div>
          </div>
        </div>

        <div class="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div class="flex justify-end">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="emit('close')"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
