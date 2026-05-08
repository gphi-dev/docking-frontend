<script setup>
import { computed, ref, watch } from "vue";
import { resolveAssetUrl } from "../api/http";
import { createReward, updateReward, uploadRewardPicture } from "../api/rewards";

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
const pictureSource = ref("upload");
const uploadedPictureData = ref("");
const uploadedPictureFile = ref(null);
const uploadedPictureName = ref("");
const description = ref("");
const prize = ref("");
const holdings = ref("");
const isActive = ref("1");
const errorMessage = ref("");
const isSubmitting = ref(false);
const isResizingPicture = ref(false);
const maxPictureLength = 255;
const maxUploadedImageDataLength = 720000;
const maxImageDimension = 900;
const minImageDimension = 260;
const initialImageQuality = 0.82;
const minImageQuality = 0.42;

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

const previewPictureSrc = computed(() => {
  if (pictureSource.value === "upload") {
    return uploadedPictureData.value || "";
  }

  return resolveAssetUrl(picture.value.trim());
});

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
  pictureSource.value = "upload";
  clearUploadedPicture();
  description.value = "";
  prize.value = "";
  holdings.value = "";
  isActive.value = "1";
  errorMessage.value = "";
  isSubmitting.value = false;
  isResizingPicture.value = false;
}

function populateForm() {
  gameId.value = props.reward?.game_id !== undefined && props.reward?.game_id !== null
    ? String(props.reward.game_id)
    : "";
  picture.value = props.reward?.picture ?? "";
  pictureSource.value = "url";
  clearUploadedPicture();
  description.value = props.reward?.description ?? "";
  prize.value = props.reward?.prize ?? "";
  holdings.value = props.reward?.holdings !== undefined && props.reward?.holdings !== null
    ? String(props.reward.holdings)
    : "";
  isActive.value = isRewardActive(props.reward) ? "1" : "0";
  errorMessage.value = "";
  isSubmitting.value = false;
  isResizingPicture.value = false;
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

function clearUploadedPicture() {
  uploadedPictureData.value = "";
  uploadedPictureFile.value = null;
  uploadedPictureName.value = "";
}

function handlePictureSourceChange(source) {
  pictureSource.value = source;
  errorMessage.value = "";
}

function validatePictureValue(value) {
  if (!value) {
    return "";
  }

  const trimmedValue = String(value).trim();
  if (trimmedValue.startsWith("data:image/")) {
    return "Uploaded picture must be saved before submitting. Please try again.";
  }

  if (trimmedValue.startsWith("data:") || trimmedValue.startsWith("blob:")) {
    return "Picture must be a hosted URL, backend asset path, or uploaded image file.";
  }

  if (trimmedValue.length > maxPictureLength) {
    return "Picture must be 255 characters or less.";
  }

  return "";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  return `${Math.ceil(bytes / 1024)} KB`;
}

function loadImageFromSource(source, cleanup = () => {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Could not load the selected image"));
    };
    image.src = source;
  });
}

function dataUrlToBlob(dataUrl) {
  const [metadata, base64Data] = dataUrl.split(",");
  const contentType = metadata?.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const binaryString = window.atob(base64Data || "");
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function drawResizedImage(image, maxDimension) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare picture upload");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

async function resizeLoadedImage(image) {
  let dimension = maxImageDimension;
  let quality = initialImageQuality;

  while (dimension >= minImageDimension) {
    const canvas = drawResizedImage(image, dimension);

    while (quality >= minImageQuality) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= maxUploadedImageDataLength) {
        return {
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          byteLength: Math.ceil((dataUrl.length * 3) / 4),
        };
      }

      quality -= 0.08;
    }

    dimension = Math.floor(dimension * 0.82);
    quality = initialImageQuality;
  }

  throw new Error("Picture is too large to upload. Please choose a smaller image.");
}

async function resizeImageFile(file) {
  const objectUrl = URL.createObjectURL(file);
  const image = await loadImageFromSource(objectUrl, () => URL.revokeObjectURL(objectUrl));
  return resizeLoadedImage(image);
}

async function handlePictureFileChange(event) {
  const [file] = event.target.files || [];

  if (!file) {
    clearUploadedPicture();
    return;
  }

  if (!file.type.startsWith("image/")) {
    clearUploadedPicture();
    errorMessage.value = "Please choose a valid picture file";
    event.target.value = "";
    return;
  }

  errorMessage.value = "";

  try {
    isResizingPicture.value = true;
    clearUploadedPicture();
    const resizedImage = await resizeImageFile(file);
    const resizedBlob = dataUrlToBlob(resizedImage.dataUrl);
    uploadedPictureData.value = resizedImage.dataUrl;
    uploadedPictureFile.value = new File(
      [resizedBlob],
      file.name.replace(/\.[^.]+$/, ".jpg") || "reward-picture.jpg",
      { type: "image/jpeg" },
    );
    uploadedPictureName.value = `${file.name} - prepared ${resizedImage.width}x${resizedImage.height} (${formatBytes(
      resizedImage.byteLength,
    )})`;
  } catch (error) {
    clearUploadedPicture();
    event.target.value = "";
    errorMessage.value = error?.message || "Could not prepare the selected picture";
  } finally {
    isResizingPicture.value = false;
  }
}

async function getPreparedPicture() {
  if (pictureSource.value === "upload") {
    if (!uploadedPictureFile.value) {
      return null;
    }

    return uploadRewardPicture(uploadedPictureFile.value);
  }

  return picture.value.trim() || null;
}

function buildPayload(preparedPicture) {
  return {
    game_id: Number(gameId.value),
    picture: preparedPicture,
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
    const preparedPicture = await getPreparedPicture();
    const pictureError = validatePictureValue(preparedPicture);
    if (pictureError) {
      errorMessage.value = pictureError;
      isSubmitting.value = false;
      return;
    }

    const payload = buildPayload(preparedPicture);
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

          <div class="space-y-3">
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-semibold transition"
                :class="
                  pictureSource === 'url'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                "
                :disabled="isSubmitting || isResizingPicture"
                @click="handlePictureSourceChange('url')"
              >
                URL / Path
              </button>
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-semibold transition"
                :class="
                  pictureSource === 'upload'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                "
                :disabled="isSubmitting || isResizingPicture"
                @click="handlePictureSourceChange('upload')"
              >
                Upload File
              </button>
            </div>

            <div v-if="pictureSource === 'url'" class="space-y-2">
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Picture URL or Asset Path
              </label>
              <input
                v-model="picture"
                type="text"
                maxlength="255"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/25 transition focus:border-emerald-500 focus:ring-2"
                placeholder="https://example.com/image.jpg"
              />
              <p class="text-xs text-slate-500">
                Must be 255 characters or less.
              </p>
            </div>

            <div v-else class="space-y-2">
              <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Upload Reward Picture File
              </label>
              <input
                type="file"
                accept="image/*"
                class="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-700"
                :disabled="isSubmitting || isResizingPicture"
                @change="handlePictureFileChange"
              />
              <p v-if="isResizingPicture" class="text-xs font-medium text-emerald-700">
                Preparing picture...
              </p>
              <p v-else class="text-xs text-slate-500">
                The uploaded file will be saved first, then its URL will be used as the reward picture.
              </p>
              <div v-if="uploadedPictureName" class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <p class="truncate text-xs text-slate-600">
                  {{ uploadedPictureName }}
                </p>
                <button
                  type="button"
                  class="shrink-0 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                  :disabled="isSubmitting || isResizingPicture"
                  @click="clearUploadedPicture"
                >
                  Remove
                </button>
              </div>
            </div>
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
              :disabled="isSubmitting || loadingGames || isResizingPicture"
            >
              {{ isSubmitting ? "Saving..." : isResizingPicture ? "Preparing..." : isEditMode ? "Update reward" : "Create reward" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
