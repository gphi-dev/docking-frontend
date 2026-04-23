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
const errorMessage = ref("");
const isSubmitting = ref(false);

function isEditMode() {
  return props.mode === "edit";
}

function resetForm() {
  name.value = "";
  gameid.value = "";
  gamesecretkey.value = "";
  description.value = "";
  imageUrl.value = "";
  imageSource.value = "url";
  uploadedImageData.value = "";
  uploadedImageName.value = "";
  errorMessage.value = "";
  isSubmitting.value = false;
}

function populateForm() {
  name.value = props.game?.name ?? "";
  gameid.value = props.game?.game_id ?? "";
  gamesecretkey.value = props.game?.game_secret_key ?? "";
  description.value = props.game?.description ?? "";
  imageUrl.value = props.game?.image_url ?? "";
  imageSource.value = props.game?.image_url?.startsWith("data:image/") ? "upload" : "url";
  uploadedImageData.value = imageSource.value === "upload" ? props.game?.image_url ?? "" : "";
  uploadedImageName.value = "";
  errorMessage.value = "";
  isSubmitting.value = false;
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
}

function handleImageSourceChange(source) {
  imageSource.value = source;
  errorMessage.value = "";
}

function handleImageFileChange(event) {
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

  const reader = new FileReader();
  reader.onload = () => {
    uploadedImageData.value = typeof reader.result === "string" ? reader.result : "";
    uploadedImageName.value = file.name;
    errorMessage.value = "";
  };
  reader.onerror = () => {
    clearUploadedImage();
    errorMessage.value = "Could not read the selected image";
  };
  reader.readAsDataURL(file);
}

async function handleSubmit() {
  errorMessage.value = "";
  if (!name.value.trim()) {
    errorMessage.value = "Name is required";
    return;
  }

  const resolvedImageUrl =
    imageSource.value === "upload" ? uploadedImageData.value || null : imageUrl.value.trim() || null;

  if (imageSource.value === "upload" && !resolvedImageUrl) {
    errorMessage.value = "Please upload an image file";
    return;
  }

  isSubmitting.value = true;
  try {
    const savedGame = await apiRequest(isEditMode() ? `/api/games/${props.game?.id}` : "/api/games", {
      method: isEditMode() ? "PUT" : "POST",
      headers: {
       "Content-Type": "application/json",
        // static Bearer token frontend local dev!
        "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzc1ODEwNzU2LCJleHAiOjE3NzU4Mzk1NTYsInN1YiI6IjEifQ.oGCNUf1jrQJOqzMB-rwHaLSAQl4MJArK647pKz_r7kc` 
      },
      body: JSON.stringify({
        name: name.value.trim(),
        game_id: Number(gameid.value),
        game_secret_key: gamesecretkey.value.trim(),
        description: description.value.trim() || null,
        image_url: resolvedImageUrl,
      }),
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
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="Must be integer, e.g. 12345"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Game Secret Key
            </label>
            <input
              v-model="gamesecretkey"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="e.g. abc123"
            />
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
                :disabled="isSubmitting"
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
                :disabled="isSubmitting"
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
              placeholder="https://… or /images/game-cover.png"
            />
            <p class="text-xs text-slate-500">
              Use a full image URL or a local public asset path.
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
              :disabled="isSubmitting"
              @change="handleImageFileChange"
            />
            <div v-if="uploadedImageName" class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <p class="truncate text-xs text-slate-600">
                {{ uploadedImageName }}
              </p>
              <button
                type="button"
                class="shrink-0 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                :disabled="isSubmitting"
                @click="clearUploadedImage"
              >
                Remove
              </button>
            </div>
            <p class="text-xs text-slate-500">
              Uploaded files are stored as the game image value and shown immediately in the app.
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
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? "Saving…" : isEditMode() ? "Update game" : "Create game" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
