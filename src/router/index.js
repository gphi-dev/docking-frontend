import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import MainLayout from "../layouts/MainLayout.vue";
import DashboardView from "../views/DashboardView.vue";
import GamesListView from "../views/GamesListView.vue";
import GameDetailView from "../views/GameDetailView.vue";
import AdminUsersView from "../views/AdminUsersView.vue";
import UserAPIView from "../views/UserAPIView.vue";
import RBACView from "../views/RBACView.vue";

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

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && authStore.isAuthenticated) {
    return { name: "dashboard" };
  }
  if (to.meta.requiresSuperAdmin && !authStore.isSuperAdmin) {
    return { name: "dashboard" };
  }
  if (to.meta.requiredPermission && !authStore.canAccess(to.meta.requiredPermission)) {
    return { name: "dashboard" };
  }
  return true;
});
