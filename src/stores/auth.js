import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiRequest } from "../api/http";
import {
  normalizeRole,
  readRbacPolicy,
  roleHasPermission,
  saveRbacPolicy,
} from "../rbac/permissions";

const localStorageTokenKey = "docking_admin_token";
const localStorageAdminKey = "docking_admin_user";

function readJsonFromLocalStorage(key) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function isTruthy(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem(localStorageTokenKey) || "");
  const adminUser = ref(readJsonFromLocalStorage(localStorageAdminKey));
  const rbacPolicy = ref(readRbacPolicy());

  const isAuthenticated = computed(() => Boolean(token.value));
  const adminRole = computed(() => normalizeRole(adminUser.value?.role));
  const isSuperAdmin = computed(() => adminRole.value === "superadmin" || isTruthy(adminUser.value?.is_super_admin));

  function canAccess(permissionKey) {
    if (!isAuthenticated.value) {
      return false;
    }

    if (isSuperAdmin.value) {
      return true;
    }

    return roleHasPermission(rbacPolicy.value, adminRole.value, permissionKey);
  }

  const canCreateGames = computed(() => canAccess("games.create"));
  const canUpdateGames = computed(() => canAccess("games.update"));
  const canDeleteGames = computed(() => canAccess("games.delete"));
  const canManageAdmins = computed(() => canAccess("admins.view"));
  const canManageRbac = computed(() => canAccess("rbac.manage"));

  function setRbacPolicy(nextPolicy) {
    rbacPolicy.value = saveRbacPolicy(nextPolicy);
  }

  function persistSession(nextToken, nextAdminUser) {
    token.value = nextToken;
    adminUser.value = nextAdminUser;
    if (nextToken) {
      localStorage.setItem(localStorageTokenKey, nextToken);
    } else {
      localStorage.removeItem(localStorageTokenKey);
    }
    if (nextAdminUser) {
      localStorage.setItem(localStorageAdminKey, JSON.stringify(nextAdminUser));
    } else {
      localStorage.removeItem(localStorageAdminKey);
    }
  }

  async function loginWithCredentials(username, password) {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!payload?.token) {
      throw new Error("Login response missing token");
    }
    persistSession(payload.token, payload.admin || null);
    return payload;
  }

  function logout() {
    persistSession("", null);
  }

  return {
    token,
    adminUser,
    rbacPolicy,
    isAuthenticated,
    adminRole,
    isSuperAdmin,
    canCreateGames,
    canUpdateGames,
    canDeleteGames,
    canManageAdmins,
    canManageRbac,
    canAccess,
    setRbacPolicy,
    loginWithCredentials,
    logout,
  };
});
