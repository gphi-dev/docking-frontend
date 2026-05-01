<script setup>
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const navigationLinks = [
  { to: { name: "dashboard" }, label: "Dashboard" },
  { to: { name: "games" }, label: "Games" },
  { to: { name: "admins" }, label: "Admin users", requiresSuperAdmin: true },
  { to: { name: "user-api" }, label: "Subscribers" },
];

const visibleNavigationLinks = computed(() =>
  navigationLinks.filter((navigationItem) => !navigationItem.requiresSuperAdmin || authStore.canManageAdmins),
);

function handleLogout() {
  authStore.logout();
  router.push({ name: "login" });
}

function isNavigationActive(routeName) {
  if (routeName === "games") {
    return route.name === "games" || route.name === "game-detail";
  }

  return route.name === routeName;
}
</script>

<template>
  <div class="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(187,247,208,0.38),transparent_32%),linear-gradient(135deg,#f7fee7,#f0fdf4_42%,#ecfdf5)]">
    <aside
      class="sticky top-0 hidden h-screen w-72 shrink-0 overflow-hidden border-r border-emerald-900/30 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.24),transparent_35%),linear-gradient(180deg,#052e16,#064e3b_50%,#022c22)] text-emerald-50 shadow-[18px_0_60px_-38px_rgba(2,44,34,0.85)] md:flex md:flex-col"
    >
      <div class="pointer-events-none absolute -left-12 top-16 h-44 w-44 rounded-full bg-lime-300/10 blur-3xl" />
      <div class="pointer-events-none absolute bottom-24 right-0 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl" />

      <div class="relative border-b border-white/10 px-5 py-5">
        <div class="flex items-center gap-3">
          <div class="flex h-14 w-28 items-center justify-center rounded-2xl border border-white/15 bg-white/95 p-2 shadow-lg shadow-emerald-950/35 ring-1 ring-white/10">
            <img
              src="/bybet.jpg"
              alt="ByBet"
              class="h-full w-full rounded-xl object-contain"
            />
          </div>
          <!-- <div class="min-w-0">
            <p class="truncate text-base font-bold tracking-tight text-white">Game Docking</p>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/60">Admin System</p>
          </div> -->
        </div>
        <div class="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <p class="text-[11px] font-bold uppercase tracking-[0.25em] text-lime-100/60">Signed in as</p>
          <div class="mt-2 flex items-center justify-between">
            <p class="text-sm font-semibold text-white">{{ authStore.adminUser?.username || "admin" }}</p>
            <span class="h-2.5 w-2.5 rounded-full bg-lime-300 shadow-[0_0_20px_rgba(190,242,100,0.9)]" />
          </div>
        </div>
      </div>

      <nav class="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        <p class="px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-100/40">Navigation</p>
        <RouterLink
          v-for="navigationItem in visibleNavigationLinks"
          :key="navigationItem.label"
          :to="navigationItem.to"
          class="group rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:border-white/10 hover:bg-white/10 hover:text-white"
          :class="
            isNavigationActive(navigationItem.to.name)
              ? 'border-lime-300/30 bg-lime-300/15 text-white shadow-lg shadow-emerald-950/20'
              : 'border-transparent text-emerald-100/70'
          "
        >
          <span class="flex items-center justify-between gap-3">
            <span>{{ navigationItem.label }}</span>
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-200/30 transition group-hover:bg-lime-200" />
          </span>
        </RouterLink>
      </nav>

      <div class="relative border-t border-white/10 p-4">
        <div class="rounded-2xl border border-white/10 bg-white/10 p-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-100/45">Signed in as</p>
          <p class="mt-1 truncate text-sm font-semibold text-white">
            {{ authStore.adminUser?.username || "admin" }}
          </p>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-emerald-200/70 bg-white/75 px-4 py-3 shadow-sm shadow-emerald-950/5 backdrop-blur-xl md:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div class="hidden min-w-0 items-center gap-3 md:flex">

            <div class="min-w-0">
              <p class="truncate text-sm font-black uppercase tracking-[0.18em] text-emerald-950">
                Game Docking - Admin System
              </p>
              <p class="truncate text-xs font-semibold text-emerald-900/55">
                Professional dashboard console
              </p>
            </div>
          </div>
          <div class="flex h-10 w-20 items-center justify-center rounded-2xl border border-emerald-200 bg-white p-1.5 shadow-sm md:hidden">
            <img
              src="/bybet.jpg"
              alt="ByBet"
              class="h-full w-full rounded-xl object-contain"
            />
          </div>
          <div class="min-w-0 md:hidden">
            <p class="truncate text-sm font-bold text-emerald-950">Game Docking</p>
            <p class="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800/50">Admin System</p>
          </div>
        </div>

        <nav class="flex flex-1 items-center justify-center gap-1 overflow-x-auto md:hidden">
          <RouterLink
            v-for="navigationItem in visibleNavigationLinks"
            :key="`m-${navigationItem.label}`"
            :to="navigationItem.to"
            class="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-emerald-50"
            :class="
              isNavigationActive(navigationItem.to.name)
                ? 'border-emerald-200 bg-emerald-950 text-lime-100 hover:bg-emerald-950'
                : 'border-transparent text-emerald-900/65'
            "
          >
            {{ navigationItem.label }}
          </RouterLink>
        </nav>

        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          @click="handleLogout"
        >
          Logout
        </button>
      </header>

      <main class="flex-1 px-4 py-6 md:px-8 md:py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
