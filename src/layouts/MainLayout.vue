<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const navigationLinks = [
  { to: { name: "dashboard" }, label: "Dashboard", requiredPermission: "dashboard.view" },
  { to: { name: "games" }, label: "Games", requiredPermission: "games.view" },
  { to: { name: "rewards" }, label: "Rewards", requiredPermission: "rewards.view" },
  { to: { name: "admins" }, label: "Admin users", requiredPermission: "admins.view" },
  { to: { name: "user-api" }, label: "Subscribers", requiredPermission: "subscribers.view" },
  { to: { name: "rbac" }, label: "Access Control", requiredPermission: "rbac.manage" },
];

function getNavigationRequiredPermission(navigationItem) {
  return navigationItem.requiredPermission || router.resolve(navigationItem.to).meta.requiredPermission || "";
}

function canShowNavigationItem(navigationItem) {
  const requiredPermission = getNavigationRequiredPermission(navigationItem);
  return !requiredPermission || authStore.canAccess(requiredPermission);
}

const visibleNavigationLinks = computed(() =>
  navigationLinks.filter(canShowNavigationItem),
);

const userRoleLabel = computed(() => {
  if (authStore.isSuperAdmin) {
    return "Super Admin";
  }

  return authStore.adminUser?.rbac_role?.name || authStore.adminUser?.role || "Admin";
});

const adminUsername = computed(() => {
  const username = authStore.adminUser?.username || authStore.adminUser?.name || authStore.adminUser?.email;

  return username ? String(username) : "Admin";
});

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

function getFirstVisibleNavigationTarget() {
  return visibleNavigationLinks.value[0]?.to || null;
}

function isCurrentRouteAllowed() {
  const requiredPermission = route.meta.requiredPermission;
  return !requiredPermission || authStore.canAccess(requiredPermission);
}

const canRenderCurrentRoute = computed(isCurrentRouteAllowed);

function redirectIfCurrentRouteDenied() {
  if (isCurrentRouteAllowed()) {
    return;
  }

  const fallbackTarget = getFirstVisibleNavigationTarget();
  if (fallbackTarget && fallbackTarget.name !== route.name) {
    router.replace(fallbackTarget);
  }
}

async function refreshSessionPermissions() {
  if (!authStore.isAuthenticated) {
    return;
  }

  try {
    await authStore.refreshCurrentAdmin();
    redirectIfCurrentRouteDenied();
  } catch (error) {
    if (error?.status !== 401 && error?.status !== 403) {
      console.error("Failed to refresh admin permissions", error);
    }
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    refreshSessionPermissions();
  }
}

onMounted(() => {
  refreshSessionPermissions();
  window.addEventListener("focus", refreshSessionPermissions);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("focus", refreshSessionPermissions);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});

watch(
  [
    () => route.name,
    () => route.meta.requiredPermission,
    () => authStore.isSuperAdmin,
    () => (Array.isArray(authStore.permissionKeys) ? authStore.permissionKeys.join("|") : ""),
  ],
  redirectIfCurrentRouteDenied,
);
</script>

<template>
  <div class="flex min-h-screen bg-slate-50 font-sans text-slate-950">
    <aside
      class="sticky top-0 hidden h-screen w-72 shrink-0 overflow-hidden border-r border-emerald-900/40 bg-emerald-950 text-emerald-50 shadow-xl shadow-slate-950/10 md:flex md:flex-col"
    >
      <div class="relative border-b border-white/10 px-5 py-5">
        <div class="flex items-center gap-3">
          <div class="flex h-14 w-28 items-center justify-center rounded-2xl border border-white/10 bg-white p-2 shadow-sm">
            <img
              src="/bybetlogo.jpg"
              alt="ByBet"
              class="h-full w-full rounded-xl object-contain"
            />
          </div>
          <div class="min-w-0">
            <p class="truncate text-base font-bold tracking-tight text-white">Admin</p>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/60">Dashboard</p>
          </div>
        </div>
        <div class="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="truncate text-base font-bold text-white">Hello {{ adminUsername }}</p>
            <span class="h-2.5 w-2.5 rounded-full bg-lime-300 ring-4 ring-lime-300/10" />
          </div>
        </div>
      </div>

      <nav class="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        <p class="px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-100/40">Navigation</p>
        <RouterLink
          v-for="navigationItem in visibleNavigationLinks"
          :key="navigationItem.label"
          :to="navigationItem.to"
          class="group rounded-xl border px-4 py-3 text-sm font-semibold transition-colors duration-200 hover:border-white/10 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          :class="
            isNavigationActive(navigationItem.to.name)
              ? 'border-emerald-300/30 bg-white/15 text-white shadow-sm'
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
          <p class="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-100/45">User Role</p>
          <p class="mt-1 truncate text-sm font-semibold text-white">
            {{ userRoleLabel }}
          </p>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl md:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div class="hidden min-w-0 items-center gap-3 md:flex">

            <div class="min-w-0">
              <p class="truncate text-sm font-black uppercase tracking-[0.18em] text-slate-950">
                Game Docking - Onboarding System
              </p>
              <p class="truncate text-xs font-semibold text-slate-500">
                Professional dashboard console
              </p>
            </div>
          </div>
          <div class="flex h-10 w-20 items-center justify-center rounded-2xl border border-emerald-200 bg-white p-1.5 shadow-sm md:hidden">
            <img
              src="/bybetlogo.jpg"
              alt="ByBet"
              class="h-full w-full rounded-xl object-contain"
            />
          </div>
          <div class="min-w-0 md:hidden">
            <p class="truncate text-sm font-bold text-emerald-950">Game Docking</p>
            <p class="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800/50">Onboarding System</p>
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
          class="btn-secondary"
          @click="handleLogout"
        >
          Logout
        </button>
      </header>

      <main class="flex-1 px-4 py-6 md:px-8 md:py-8">
        <RouterView v-if="canRenderCurrentRoute" />
      </main>
    </div>
  </div>
</template>
