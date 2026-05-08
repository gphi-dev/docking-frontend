<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  rewards: {
    type: Array,
    default: () => [],
  },
  gameLabel: {
    type: String,
    default: "",
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "submit"]);

const draftProbabilities = ref({});
const errorMessage = ref("");

const activeRewards = computed(() =>
  props.rewards.filter((reward) =>
    reward?.is_active === 1 || reward?.is_active === true || reward?.is_active === "1",
  ),
);

const probabilityTotal = computed(() =>
  activeRewards.value.reduce((total, reward) => {
    const value = Number(draftProbabilities.value[reward.id]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0),
);

const probabilityDifference = computed(() => Number((100 - probabilityTotal.value).toFixed(2)));

const totalLabel = computed(() => `${probabilityTotal.value.toFixed(2)}%`);

const canSubmit = computed(() =>
  activeRewards.value.length > 0 &&
  Math.abs(probabilityDifference.value) < 0.005 &&
  !props.isSubmitting,
);

function getInitialProbability(reward) {
  const value = Number(reward?.probability);
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function resetDraft() {
  draftProbabilities.value = Object.fromEntries(
    activeRewards.value.map((reward) => [reward.id, getInitialProbability(reward)]),
  );
  errorMessage.value = "";
}

function distributeEvenly() {
  const rewardCount = activeRewards.value.length;
  if (rewardCount === 0) {
    return;
  }

  const totalCents = 10000;
  const baseCents = Math.floor(totalCents / rewardCount);
  let remainder = totalCents - baseCents * rewardCount;

  draftProbabilities.value = Object.fromEntries(
    activeRewards.value.map((reward) => {
      const cents = baseCents + (remainder > 0 ? 1 : 0);
      remainder -= 1;
      return [reward.id, (cents / 100).toFixed(2)];
    }),
  );
  errorMessage.value = "";
}

function validateDraft() {
  if (activeRewards.value.length === 0) {
    return "There are no active rewards to update.";
  }

  for (const reward of activeRewards.value) {
    const value = Number(draftProbabilities.value[reward.id]);
    if (!Number.isFinite(value)) {
      return `Probability for "${reward.prize}" must be a number.`;
    }

    if (value < 0 || value > 100) {
      return `Probability for "${reward.prize}" must be between 0 and 100.`;
    }
  }

  if (Math.abs(probabilityDifference.value) >= 0.005) {
    return `Total probability must be exactly 100.00%. Current total is ${totalLabel.value}.`;
  }

  return "";
}

function handleSubmit() {
  errorMessage.value = "";
  const validationError = validateDraft();
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  emit(
    "submit",
    activeRewards.value.map((reward) => ({
      reward,
      probability: Number(Number(draftProbabilities.value[reward.id]).toFixed(2)),
    })),
  );
}

watch(
  () => [props.open, props.rewards],
  ([isOpen]) => {
    if (isOpen) {
      resetDraft();
    }
  },
  { immediate: true },
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
        class="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 sm:max-h-[calc(100vh-2rem)]"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
          <div>
            <h2 class="text-lg font-semibold text-slate-950">Update probabilities</h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ gameLabel || "Selected game" }} active rewards must total 100.00%.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
            :disabled="isSubmitting"
            @click="emit('close')"
          >
            x
          </button>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div class="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Total Probability</p>
              <p class="mt-1 text-2xl font-bold text-emerald-950">{{ totalLabel }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSubmitting || activeRewards.length === 0"
              @click="distributeEvenly"
            >
              Distribute evenly
            </button>
          </div>

          <div class="overflow-hidden rounded-xl border border-slate-200">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-3">Reward</th>
                  <th class="px-4 py-3">Holdings</th>
                  <th class="px-4 py-3">Current</th>
                  <th class="px-4 py-3">New Probability</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-if="activeRewards.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-slate-500">
                    No active rewards for this game.
                  </td>
                </tr>
                <tr
                  v-for="reward in activeRewards"
                  :key="reward.id"
                >
                  <td class="px-4 py-3">
                    <p class="font-semibold text-slate-950">{{ reward.prize }}</p>
                    <p class="mt-0.5 line-clamp-1 text-xs text-slate-500">{{ reward.description || "No description" }}</p>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                    {{ reward.holdings }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                    {{ getInitialProbability(reward) }}%
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <input
                        v-model="draftProbabilities[reward.id]"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        class="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-950 outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
                        :disabled="isSubmitting"
                      />
                      <span class="text-sm font-semibold text-slate-500">%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="errorMessage" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {{ errorMessage }}
          </p>
        </div>

        <div class="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              {{ isSubmitting ? "Saving..." : "Save probabilities" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
