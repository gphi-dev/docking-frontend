<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

async function handleSubmit() {
  errorMessage.value = "";
  isSubmitting.value = true;
  try {
    await authStore.loginWithCredentials(username.value.trim(), password.value);
    const redirectTarget = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    await router.replace(redirectTarget || "/");
  } catch (error) {
    errorMessage.value = error?.message || "Login failed";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12 font-sans">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-950 text-lg font-bold text-white shadow-sm"
        >
          DA
        </div>
        <h1 class="text-xl font-bold tracking-tight text-slate-950">Sign in</h1>
        <p class="mt-1 text-sm text-slate-500">Use your admin credentials</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label for="username" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Username
          </label>
          <input
            id="username"
            v-model="username"
            name="username"
            autocomplete="username"
            required
            class="form-control"
            placeholder="admin"
          />
        </div>
        <div>
          <label for="password" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            class="form-control"
            placeholder="••••••••"
          />
        </div>

        <p v-if="errorMessage" class="alert-danger">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          class="btn-primary flex w-full"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "Signing in…" : "Sign in" }}
        </button>
      </form>
    </div>
  </div>
</template>
