<script setup>
import { nextTick, ref, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  confirmLabel: {
    type: String,
    default: "Confirm",
  },
  cancelLabel: {
    type: String,
    default: "Cancel",
  },
  variant: {
    type: String,
    default: "danger",
    validator: (value) => ["danger", "primary"].includes(value),
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: "",
  },
  requiresPassword: {
    type: Boolean,
    default: false,
  },
  passwordLabel: {
    type: String,
    default: "Password",
  },
  passwordPlaceholder: {
    type: String,
    default: "Enter your password",
  },
});

const emit = defineEmits(["close", "confirm"]);

const password = ref("");
const passwordError = ref("");
const passwordInput = ref(null);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      return;
    }

    password.value = "";
    passwordError.value = "";

    if (props.requiresPassword) {
      await nextTick();
      passwordInput.value?.focus();
    }
  },
);

function handleConfirm() {
  if (!props.requiresPassword) {
    emit("confirm");
    return;
  }

  const trimmedPassword = password.value.trim();
  if (!trimmedPassword) {
    passwordError.value = "Password is required.";
    return;
  }

  passwordError.value = "";
  emit("confirm", trimmedPassword);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
        @click.stop
      >
        <form @submit.prevent="handleConfirm">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold text-slate-950">{{ title }}</h2>
            <p class="text-sm leading-6 text-slate-600">{{ message }}</p>
          </div>

          <div v-if="requiresPassword" class="mt-5 space-y-2">
            <label
              for="confirm-action-password"
              class="block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {{ passwordLabel }}
            </label>
            <input
              id="confirm-action-password"
              ref="passwordInput"
              v-model="password"
              type="password"
              name="password"
              autocomplete="current-password"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/25 transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50"
              :placeholder="passwordPlaceholder"
              :disabled="isSubmitting"
              @input="passwordError = ''"
            />
          </div>

          <p
            v-if="passwordError || errorMessage"
            class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {{ passwordError || errorMessage }}
          </p>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              {{ cancelLabel }}
            </button>
            <button
              type="submit"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="
                variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-950 hover:bg-emerald-900'
              "
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? "Working..." : confirmLabel }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
