import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiRequest } from "../api/http";
import { normalizeRole } from "../rbac/permissions";

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

function getPermissionKey(permission) {
  if (typeof permission === "string") {
    return permission;
  }

  return permission?.action_key || permission?.key || "";
}

function getAdminPermissionKeys(adminUser) {
  const permissionRecords = Array.isArray(adminUser?.permissions) ? adminUser.permissions : [];
  const permissionKeys = Array.isArray(adminUser?.permission_keys) ? adminUser.permission_keys : [];
  const combinedPermissions = [...permissionRecords, ...permissionKeys];

  if (combinedPermissions.length === 0) {
    return [];
  }

  return [...new Set(
    combinedPermissions
      .map((permission) => String(getPermissionKey(permission)).trim())
      .filter(Boolean),
  )];
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem(localStorageTokenKey) || "");
  const adminUser = ref(readJsonFromLocalStorage(localStorageAdminKey));
  const isRefreshingCurrentAdmin = ref(false);
  let currentAdminRefreshPromise = null;

  const isAuthenticated = computed(() => Boolean(token.value));
  const adminRole = computed(() =>
    normalizeRole(adminUser.value?.rbac_role?.slug || adminUser.value?.rbac_role?.name || adminUser.value?.role),
  );
  const permissionKeys = computed(() => getAdminPermissionKeys(adminUser.value));
  const isSuperAdmin = computed(() =>
    adminRole.value === "superadmin" ||
    adminRole.value === "super-admin" ||
    isTruthy(adminUser.value?.is_super_admin),
  );

  function canAccess(permissionKey) {
    if (!isAuthenticated.value) {
      return false;
    }

    if (isSuperAdmin.value) {
      return true;
    }

    return permissionKeys.value.includes(permissionKey);
  }

  const canCreateGames = computed(() => canAccess("games.create"));
  const canUpdateGames = computed(() => canAccess("games.update"));
  const canDeleteGames = computed(() => canAccess("games.delete"));
  const canManageAdmins = computed(() => canAccess("admins.view"));
  const canManageRbac = computed(() => canAccess("rbac.manage"));

  function setAdminUserPermissions(nextPermissions) {
    if (!adminUser.value) {
      return;
    }

    const nextAdminUser = {
      ...adminUser.value,
      permissions: Array.isArray(nextPermissions) ? nextPermissions : [],
      permission_keys: Array.isArray(nextPermissions) ? nextPermissions : [],
    };
    persistSession(token.value, nextAdminUser);
  }

  function syncRolePermissions(roleRecord) {
    if (!adminUser.value || !roleRecord) {
      return;
    }

    if (String(adminUser.value.role_id ?? "") !== String(roleRecord.id ?? "")) {
      return;
    }

    setAdminUserPermissions(roleRecord.allowed_permission_keys || []);
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

  async function refreshCurrentAdmin() {
    if (!token.value) {
      return adminUser.value;
    }

    if (!currentAdminRefreshPromise) {
      isRefreshingCurrentAdmin.value = true;
      currentAdminRefreshPromise = (async () => {
        const payload = await apiRequest("/api/auth/me");
        if (payload?.admin) {
          persistSession(token.value, payload.admin);
        }
        return adminUser.value;
      })().finally(() => {
        currentAdminRefreshPromise = null;
        isRefreshingCurrentAdmin.value = false;
      });
    }

    return currentAdminRefreshPromise;
  }

  function logout() {
    persistSession("", null);
  }

  return {
    token,
    adminUser,
    isRefreshingCurrentAdmin,
    isAuthenticated,
    adminRole,
    permissionKeys,
    isSuperAdmin,
    canCreateGames,
    canUpdateGames,
    canDeleteGames,
    canManageAdmins,
    canManageRbac,
    canAccess,
    setAdminUserPermissions,
    syncRolePermissions,
    loginWithCredentials,
    refreshCurrentAdmin,
    logout,
  };
});
