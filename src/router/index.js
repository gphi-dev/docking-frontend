import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import MainLayout from "../layouts/MainLayout.vue";
import DashboardView from "../views/DashboardView.vue";
import GamesListView from "../views/GamesListView.vue";
import GameDetailView from "../views/GameDetailView.vue";
import RewardsManagementView from "../views/RewardsManagementView.vue";
import AdminUsersView from "../views/AdminUsersView.vue";
import UserAPIView from "../views/UserAPIView.vue";
import RBACView from "../views/RBACView.vue";

const accessFallbackRoutes = [
  { name: "dashboard", requiredPermission: "dashboard.view" },
  { name: "games", requiredPermission: "games.view" },
  { name: "rewards", requiredPermission: "rewards.view" },
  { name: "admins", requiredPermission: "admins.view" },
  { name: "rbac", requiredPermission: "rbac.manage" },
  { name: "user-api", requiredPermission: "subscribers.view" },
];

function getFirstAccessibleRouteName(authStore) {
  return accessFallbackRoutes.find((route) => authStore.canAccess(route.requiredPermission))?.name || null;
}

async function refreshAuthenticatedPermissions(authStore) {
  if (!authStore.isAuthenticated) {
    return;
  }

  try {
    await authStore.refreshCurrentAdmin();
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      authStore.logout();
      return;
    }

    console.error("Failed to refresh route permissions", error);
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { isPublic: true },
    },
    {
      path: "/",
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "dashboard",
          component: DashboardView,
          meta: { requiredPermission: "dashboard.view" },
        },
        {
          path: "games",
          name: "games",
          component: GamesListView,
          meta: { requiredPermission: "games.view" },
        },
        {
          path: "games/:gameId",
          name: "game-detail",
          component: GameDetailView,
          props: true,
          meta: { requiredPermission: "games.view" },
        },
        {
          path: "rewards",
          alias: "/admin/rewards",
          name: "rewards",
          component: RewardsManagementView,
          meta: { requiredPermission: "rewards.view" },
        },
        {
          path: "admins",
          name: "admins",
          component: AdminUsersView,
          meta: { requiredPermission: "admins.view" },
        },
        {
          path: "rbac",
          name: "rbac",
          component: RBACView,
          meta: { requiredPermission: "rbac.manage" },
        },
        {
          path: "user-api",
          name: "user-api",
          component: UserAPIView,
          meta: { requiredPermission: "subscribers.view" },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (authStore.isAuthenticated) {
    await refreshAuthenticatedPermissions(authStore);
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.name === "login" && authStore.isAuthenticated) {
    const fallbackRouteName = getFirstAccessibleRouteName(authStore);
    return fallbackRouteName ? { name: fallbackRouteName } : false;
  }
  if (to.meta.requiresSuperAdmin && !authStore.isSuperAdmin) {
    const fallbackRouteName = getFirstAccessibleRouteName(authStore);
    return fallbackRouteName ? { name: fallbackRouteName } : false;
  }
  if (to.meta.requiredPermission && !authStore.canAccess(to.meta.requiredPermission)) {
    const fallbackRouteName = getFirstAccessibleRouteName(authStore);
    if (fallbackRouteName && fallbackRouteName !== to.name) {
      return { name: fallbackRouteName };
    }
    return false;
  }
  return true;
});
