<script setup>
import { ref, watch } from "vue";
import { apiRequest, resolveAssetUrl } from "../api/http.js";

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
  game: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close", "created", "updated"]);

const name = ref("");
const gameid = ref("");
const gamesecretkey = ref("");
const description = ref("");
const imageUrl = ref("");
const imageSource = ref("url");
const uploadedImageData = ref("");
const uploadedImageName = ref("");
const uploadedImagePath = ref("");
const isGameSecretKeyVisible = ref(false);
const errorMessage = ref("");
const isSubmitting = ref(false);
const isLoadingNextGameId = ref(false);
const isResizingImage = ref(false);
let nextGameIdRequestId = 0;
const maxImageUrlLength = 2048;
const maxUploadedImageDataLength = 720000;
const maxImageDimension = 900;
const minImageDimension = 260;
const initialImageQuality = 0.82;
const minImageQuality = 0.42;
const legacyUploadPathPattern = /^\/?uploads\//;

function isEditMode() {
  return props.mode === "edit";
}

function resetForm() {
  name.value = "";
  gameid.value = "";
  gamesecretkey.value = "";
  description.value = "";
  imageUrl.value = "";
  imageSource.value = "upload";
  clearUploadedImage();
  isGameSecretKeyVisible.value = false;
  errorMessage.value = "";
  isSubmitting.value = false;
  isLoadingNextGameId.value = false;
  isResizingImage.value = false;
}

function populateForm() {
  name.value = props.game?.name ?? "";
  gameid.value = props.game?.game_id ?? "";
  gamesecretkey.value = props.game?.game_secret_key ?? "";
  description.value = props.game?.description ?? "";
  imageUrl.value = props.game?.image_url ?? "";
  imageSource.value = "url";
  clearUploadedImage();
  isGameSecretKeyVisible.value = false;
  errorMessage.value = "";
  isSubmitting.value = false;
  isLoadingNextGameId.value = false;
  isResizingImage.value = false;
}

function getNextGameId(games) {
  const latestGameId = games.reduce((latest, game) => {
    const numericGameId = Number(game?.game_id);
    return Number.isFinite(numericGameId) ? Math.max(latest, numericGameId) : latest;
  }, 0);

  return latestGameId + 1;
}

async function loadNextGameId() {
  const requestId = ++nextGameIdRequestId;
  isLoadingNextGameId.value = true;

  try {
    const payload = await apiRequest("/api/games");
    const games = Array.isArray(payload) ? payload : [];
    if (requestId === nextGameIdRequestId && !isEditMode()) {
      gameid.value = String(getNextGameId(games));
    }
  } catch (error) {
    if (requestId === nextGameIdRequestId) {
      errorMessage.value = error?.message || "Could not load the next Game ID";
    }
  } finally {
    if (requestId === nextGameIdRequestId) {
      isLoadingNextGameId.value = false;
    }
  }
}

watch(
  () => [props.open, props.mode, props.game],
  ([isOpen]) => {
    if (!isOpen) {
      return;
    }

    if (isEditMode()) {
      populateForm();
      return;
    }

    resetForm();
    loadNextGameId();
  },
  { immediate: true },
);

function getPreviewImageSrc() {
  if (imageSource.value === "upload") {
    return uploadedImageData.value || "";
  }
  return resolveAssetUrl(imageUrl.value.trim());
}

function clearUploadedImage() {
  uploadedImageData.value = "";
  uploadedImageName.value = "";
  uploadedImagePath.value = "";
}

function handleImageSourceChange(source) {
  imageSource.value = source;
  errorMessage.value = "";
}

function validateImageUrl(value) {
  if (!value) {
    return "";
  }

  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("data:image/")) {
    if (trimmedValue.length > maxUploadedImageDataLength) {
      return "Uploaded image is too large. Please choose a smaller image.";
    }

    return "";
  }

  if (trimmedValue.startsWith("data:") || trimmedValue.startsWith("blob:")) {
    return "Image URL must be a hosted URL or backend asset path, not image data.";
  }

  if (trimmedValue.length > maxImageUrlLength) {
    return "Image URL is too long. Please use a shorter hosted image URL or backend asset path.";
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

function drawResizedImage(image, maxDimension) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare image upload");
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

  throw new Error("Image is too large to upload. Please choose a smaller image.");
}

async function resizeImageFile(file) {
  const objectUrl = URL.createObjectURL(file);
  const image = await loadImageFromSource(objectUrl, () => URL.revokeObjectURL(objectUrl));
  return resizeLoadedImage(image);
}

function normalizePublicImagePath(value) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("public/uploads/games/") || trimmedValue.startsWith("/public/uploads/games/")) {
    return trimmedValue.replace(/^\/?public\//, "/");
  }

  return trimmedValue;
}

function isLegacyBackendUploadPath(value) {
  return typeof value === "string" && legacyUploadPathPattern.test(value.trim());
}

async function assertLegacyBackendUploadPathExists(value) {
  if (!isLegacyBackendUploadPath(value)) {
    return;
  }

  const normalizedPath = value.trim().startsWith("/") ? value.trim() : `/${value.trim()}`;
  let response = null;

  try {
    response = await fetch(resolveAssetUrl(normalizedPath), {
      method: "HEAD",
      cache: "no-store",
    });
  } catch {
    throw new Error(`Could not verify backend image path: ${normalizedPath}. Use Upload Image to send a new file to S3.`);
  }

  if (!response.ok) {
    throw new Error(`Image file not found on the backend: ${normalizedPath}. Use Upload Image to send a new file to S3.`);
  }
}

async function getPreparedImageUrl() {
  if (imageSource.value === "upload") {
    return uploadedImageData.value || null;
  }

  const rawImageValue = normalizePublicImagePath(imageUrl.value);

  if (typeof rawImageValue === "string" && rawImageValue.trim().startsWith("data:image/")) {
    throw new Error("Image URL must be a hosted URL or backend asset path, not base64 image data.");
  }

  await assertLegacyBackendUploadPathExists(rawImageValue);

  return rawImageValue;
}

async function handleImageFileChange(event) {
  const [file] = event.target.files || [];

  if (!file) {
    clearUploadedImage();
    return;
  }

  if (!file.type.startsWith("image/")) {
    clearUploadedImage();
    errorMessage.value = "Please choose a valid image file";
    event.target.value = "";
    return;
  }

  errorMessage.value = "";

  try {
    isResizingImage.value = true;
    clearUploadedImage();
    const resizedImage = await resizeImageFile(file);
    uploadedImageData.value = resizedImage.dataUrl;
    uploadedImageName.value = `${file.name} - prepared ${resizedImage.width}x${resizedImage.height} (${formatBytes(
      resizedImage.byteLength,
    )})`;
    uploadedImagePath.value = "Backend will upload this image to S3";
    errorMessage.value = "";
  } catch (error) {
    clearUploadedImage();
    event.target.value = "";
    errorMessage.value = error?.message || "Could not prepare the selected image";
  } finally {
    isResizingImage.value = false;
  }
}

async function handleSubmit() {
  errorMessage.value = "";
  if (!name.value.trim()) {
    errorMessage.value = "Name is required";
    return;
  }

  if (!Number.isInteger(Number(gameid.value)) || Number(gameid.value) < 1) {
    errorMessage.value = "Game ID must be a positive integer";
    return;
  }

  let resolvedImageUrl = null;
  try {
    resolvedImageUrl = await getPreparedImageUrl();

    const imageUrlError = validateImageUrl(resolvedImageUrl);
    if (imageUrlError) {
      errorMessage.value = imageUrlError;
      return;
    }
  } catch (error) {
    errorMessage.value = error?.message || "Could not prepare the selected image";
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      name: name.value.trim(),
      game_id: Number(gameid.value),
      description: description.value.trim() || null,
      image_url: resolvedImageUrl,
    };

    if (!isEditMode() || gamesecretkey.value.trim()) {
      payload.game_secret_key = gamesecretkey.value.trim();
    }

    const savedGame = await apiRequest(isEditMode() ? `/api/games/${props.game?.id}` : "/api/games", {
      method: isEditMode() ? "PUT" : "POST",
      headers: {
       "Content-Type": "application/json",
        // static Bearer token frontend local dev!
        "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzc1ODEwNzU2LCJleHAiOjE3NzU4Mzk1NTYsInN1YiI6IjEifQ.oGCNUf1jrQJOqzMB-rwHaLSAQl4MJArK647pKz_r7kc` 
      },
      body: JSON.stringify(payload),
    });
    

    if (isEditMode()) {
      emit("updated", savedGame);
    } else {
      emit("created", savedGame);
    }

    emit("close");
  } catch (error) {
    errorMessage.value = error?.message || `Could not ${isEditMode() ? "update" : "create"} game`;
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
        class="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100vh-2rem)]"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              {{ isEditMode() ? "Update game" : "Add game" }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ isEditMode() ? "Update the selected game entry." : "Create a new game entry for your catalog." }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
            :disabled="isSubmitting"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <form class="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6" @submit.prevent="handleSubmit">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Name
            </label>
            <input
              v-model="name"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="e.g. Lunar Quest"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Game ID 
            </label>
            <input
              v-model="gameid"
              required
              type="number"
              min="1"
              step="1"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              :disabled="isLoadingNextGameId"
              :placeholder="isLoadingNextGameId ? 'Loading next Game ID...' : 'Must be integer, e.g. 12345'"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Game Secret Key
            </label>
            <div class="relative">
              <input
                v-model="gamesecretkey"
                :type="isGameSecretKeyVisible ? 'text' : 'password'"
                :required="!isEditMode()"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 pr-20 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
                :placeholder="isEditMode() && !gamesecretkey ? 'Leave blank to keep current key' : 'e.g. abc123'"
                autocomplete="off"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-3 my-auto h-fit text-xs font-semibold text-sky-700 transition hover:text-sky-600"
                :disabled="isSubmitting"
                @click="isGameSecretKeyVisible = !isGameSecretKeyVisible"
              >
                {{ isGameSecretKeyVisible ? "Hide" : "Show" }}
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <textarea
              v-model="description"
              rows="3"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="Short summary"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Image Source
            </label>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-semibold transition"
                :class="
                  imageSource === 'url'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                "
                :disabled="isSubmitting || isResizingImage"
                @click="handleImageSourceChange('url')"
              >
                Image URL / Path
              </button>
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-semibold transition"
                :class="
                  imageSource === 'upload'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                "
                :disabled="isSubmitting || isResizingImage"
                @click="handleImageSourceChange('upload')"
              >
                Upload Image
              </button>
            </div>
          </div>

          <div v-if="imageSource === 'url'" class="space-y-2">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Image URL or Asset Path
            </label>
            <input
              v-model="imageUrl"
              type="text"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="https://your-bucket.s3.region.amazonaws.com/images/game-cover.jpg"
            />
            <p class="text-xs text-slate-500">
              Use a full image URL, including an S3 public URL, or an existing backend /uploads path.
            </p>
          </div>

          <div v-else class="space-y-2">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upload Image File
            </label>
            <input
              type="file"
              accept="image/*"
              class="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-sky-700"
              :disabled="isSubmitting || isResizingImage"
              @change="handleImageFileChange"
            />
            <p v-if="isResizingImage" class="text-xs font-medium text-sky-700">
              Preparing image...
            </p>
            <div v-if="uploadedImageName" class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <p class="truncate text-xs text-slate-600">
                {{ uploadedImageName }}
              </p>
              <button
                type="button"
                class="shrink-0 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                :disabled="isSubmitting || isResizingImage"
                @click="clearUploadedImage"
              >
                Remove
              </button>
            </div>
            <p v-if="uploadedImagePath" class="truncate rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
              {{ uploadedImagePath }}
            </p>
            <p class="text-xs text-slate-500">
              The backend receives the prepared image data and stores it in S3 when you create or update the game.
            </p>
          </div>

          <div v-if="getPreviewImageSrc()" class="space-y-2">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Image Preview
            </label>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img
                :src="getPreviewImageSrc()"
                alt="Selected game image preview"
                class="max-h-48 w-full object-contain sm:max-h-56"
              />
            </div>
          </div>

          <p v-if="errorMessage" class="text-sm text-rose-600">
            {{ errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
              :disabled="isSubmitting || isLoadingNextGameId || isResizingImage"
            >
              {{ isSubmitting ? "Saving…" : isLoadingNextGameId || isResizingImage ? "Loading…" : isEditMode() ? "Update game" : "Create game" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
