<script setup>
import { computed, ref, watch } from "vue";
import { resolveAssetUrl } from "../api/http";
import { createReward, updateReward } from "../api/rewards";

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  mode: {
    type: String,
    default: "create",
    validator: (value) => ["create", "edit"].includes(value),
  },
  reward: {
    type: Object,
    default: null,
  },
  games: {
    type: Array,
    default: () => [],
  },
  loadingGames: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "created", "updated"]);

const gameId = ref("");
const picture = ref("");
const description = ref("");
const prize = ref("");
const holdings = ref("");
const isActive = ref("1");
const errorMessage = ref("");
const isSubmitting = ref(false);

const isEditMode = computed(() => props.mode === "edit");

const gameOptions = computed(() =>
  props.games
    .map((game) => {
      const value = getGameOptionValue(game);
      if (value === undefined || value === null || String(value).trim() === "") {
        return null;
      }

      const gameName = game?.name || game?.title || `Game ${value}`;
      return {
        value: String(value),
        label: `${gameName} (ID ${value})`,
      };
    })
    .filter(Boolean),
);

const selectedGameOptionExists = computed(() =>
  gameOptions.value.some((option) => option.value === String(gameId.value)),
);

const previewPictureSrc = computed(() => resolveAssetUrl(picture.value.trim()));

function isRewardActive(reward) {
  return reward?.is_active === 1 || reward?.is_active === true || reward?.is_active === "1";
}

function getGameOptionValue(game) {
  return game?.game_id ?? game?.gameId ?? game?.gameid ?? game?.public_game_id ?? game?.publicGameId ?? game?.id;
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

function resetForm() {
  gameId.value = "";
  picture.value = "";
  description.value = "";
  prize.value = "";
  holdings.value = "";
  isActive.value = "1";
  errorMessage.value = "";
  isSubmitting.value = false;
}

function populateForm() {
  gameId.value = props.reward?.game_id !== undefined && props.reward?.game_id !== null
    ? String(props.reward.game_id)
    : "";
  picture.value = props.reward?.picture ?? "";
  description.value = props.reward?.description ?? "";
  prize.value = props.reward?.prize ?? "";
  holdings.value = props.reward?.holdings !== undefined && props.reward?.holdings !== null
    ? String(props.reward.holdings)
    : "";
  isActive.value = isRewardActive(props.reward) ? "1" : "0";
  errorMessage.value = "";
  isSubmitting.value = false;
}

watch(
  () => [props.open, props.mode, props.reward],
  ([isOpen]) => {
    if (!isOpen) {
      return;
    }

    if (isEditMode.value) {
      populateForm();
      return;
    }

    resetForm();
  },
  { immediate: true },
);

function validateForm() {
  if (!gameId.value) {
    return "Game is required";
  }

  const numericGameId = Number(gameId.value);
  if (!Number.isInteger(numericGameId) || numericGameId < 1) {
    return "Game is required";
  }

  if (!prize.value.trim()) {
    return "Prize is required";
  }

  const holdingsValue = String(holdings.value).trim();
  if (!holdingsValue) {
    return "Holdings is required";
  }

  const numericHoldings = Number(holdingsValue);
  if (!Number.isFinite(numericHoldings)) {
    return "Holdings must be a number";
  }

  if (!Number.isInteger(numericHoldings)) {
    return "Holdings must be an integer";
  }

  if (numericHoldings < 0) {
    return "Holdings must be greater than or equal to 0";
  }

  if (!["0", "1"].includes(String(isActive.value))) {
    return "Status must be active or inactive";
  }

  return "";
}

function buildPayload() {
  return {
    game_id: Number(gameId.value),
    picture: picture.value.trim() || null,
    description: description.value.trim() || null,
    prize: prize.value.trim(),
    holdings: Number(holdings.value),
    is_active: isActive.value === "1" ? 1 : 0,
  };
}

async function handleSubmit() {
  errorMessage.value = "";
  const validationError = validateForm();
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  if (isEditMode.value && !props.reward?.id) {
    errorMessage.value = "Reward not found.";
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = buildPayload();
    const savedReward = isEditMode.value
      ? await updateReward(props.reward.id, payload)
      : await createReward(payload);

    if (isEditMode.value) {
      emit("updated", savedReward);
    } else {
      emit("created", savedReward);
    }
    emit("close");
  } catch (error) {
    if (error?.status === 404) {
      errorMessage.value = "Reward not found.";
    } else if (error?.status >= 500) {
      errorMessage.value = "Could not save reward. Please try again.";
    } else {
      errorMessage.value = error?.message || `Could not ${isEditMode.value ? "update" : "create"} reward`;
    }
  } finally {
    isSubmitting.value = false;
  }
}
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
            <h2 class="text-lg font-semibold text-slate-950">
              {{ isEditMode ? "Edit reward" : "Create reward" }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ isEditMode ? "Update reward details. Probability remains backend-controlled." : "Add a reward for a game. Probability will be computed automatically." }}
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

        <form class="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6" @submit.prevent="handleSubmit">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Game
              </label>
              <select
                v-model="gameId"
                required
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
                :disabled="isSubmitting || loadingGames"
              >
                <option value="" disabled>
                  {{ loadingGames ? "Loading games..." : "Select game" }}
                </option>
                <option
                  v-if="gameId && !selectedGameOptionExists"
                  :value="gameId"
                >
                  Current game ID {{ gameId }}
                </option>
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
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Prize
              </label>
              <input
                v-model="prize"
                required
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
                placeholder="100 Coins"
              />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Holdings
              </label>
              <input
                v-model="holdings"
                required
                type="number"
                min="0"
                step="1"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
                placeholder="50"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                v-model="isActive"
                required
                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
                :disabled="isSubmitting"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Picture URL
            </label>
            <input
              v-model="picture"
              type="text"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div v-if="previewPictureSrc" class="space-y-2">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Picture Preview
            </label>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img
                :src="previewPictureSrc"
                alt="Reward picture preview"
                class="max-h-48 w-full object-contain sm:max-h-56"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <textarea
              v-model="description"
              rows="4"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
              placeholder="Free coins reward"
            />
          </div>

          <div
            v-if="isEditMode"
            class="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">Probability</p>
            <p class="mt-1 text-lg font-bold text-emerald-950">{{ formatProbability(reward) }}</p>
          </div>

          <p v-if="errorMessage" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {{ errorMessage }}
          </p>

          <div class="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSubmitting || loadingGames"
            >
              {{ isSubmitting ? "Saving..." : isEditMode ? "Update reward" : "Create reward" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
