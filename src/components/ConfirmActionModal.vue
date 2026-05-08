<script setup>
defineProps({
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
});

const emit = defineEmits(["close", "confirm"]);
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
        <div class="space-y-2">
          <h2 class="text-lg font-semibold text-slate-950">{{ title }}</h2>
          <p class="text-sm leading-6 text-slate-600">{{ message }}</p>
        </div>

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
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-950 hover:bg-emerald-900'
            "
            :disabled="isSubmitting"
            @click="emit('confirm')"
          >
            {{ isSubmitting ? "Working..." : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
