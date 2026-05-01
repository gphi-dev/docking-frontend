export const RBAC_STORAGE_KEY = "docking_admin_rbac_policy";

export const roleOptions = [
  {
    value: "superadmin",
    label: "Super Admin",
    description: "Full access to games, admins, subscribers, and RBAC settings.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Default access for creating and updating games.",
  },
];

export const permissionCatalog = [
  {
    group: "Dashboard",
    permissions: [
      {
        key: "dashboard.view",
        action: "View dashboard",
        method: "GET",
        endpoint: "/",
        description: "Open dashboard overview and summary cards.",
      },
    ],
  },
  {
    group: "Games",
    permissions: [
      {
        key: "games.view",
        action: "View games",
        method: "GET",
        endpoint: "/api/games",
        description: "List games and open game details.",
      },
      {
        key: "games.create",
        action: "Create games",
        method: "POST",
        endpoint: "/api/games",
        description: "Create new game records.",
      },
      {
        key: "games.update",
        action: "Update games",
        method: "PUT",
        endpoint: "/api/games/:id",
        description: "Edit game records and visual assets.",
      },
      {
        key: "games.delete",
        action: "Delete games",
        method: "DELETE",
        endpoint: "/api/games/:id",
        description: "Delete game records.",
      },
    ],
  },
  {
    group: "Admin Users",
    permissions: [
      {
        key: "admins.view",
        action: "View admins",
        method: "GET",
        endpoint: "/api/admins",
        description: "List admin users and roles.",
      },
      {
        key: "admins.create",
        action: "Create admins",
        method: "POST",
        endpoint: "/api/admins",
        description: "Create new admin users.",
      },
      {
        key: "admins.update",
        action: "Update admins",
        method: "PUT",
        endpoint: "/api/admins/:id",
        description: "Update admin users and roles.",
      },
      {
        key: "admins.delete",
        action: "Delete admins",
        method: "DELETE",
        endpoint: "/api/admins/:id",
        description: "Delete admin users.",
      },
    ],
  },
  {
    group: "Subscribers",
    permissions: [
      {
        key: "subscribers.view",
        action: "View subscribers",
        method: "GET",
        endpoint: "/api/usermobile",
        description: "List subscriber mobile records.",
      },
      {
        key: "subscribers.view_by_game",
        action: "View subscribers by game",
        method: "GET",
        endpoint: "/api/usermobile/games/:gameId",
        description: "Open subscriber records for a selected game.",
      },
      {
        key: "subscribers.view_game_subscribers",
        action: "View game subscribers",
        method: "GET",
        endpoint: "/api/subscribers/games/:gameId",
        description: "Open paginated game subscriber records.",
      },
    ],
  },
  {
    group: "RBAC",
    permissions: [
      {
        key: "rbac.manage",
        action: "Manage RBAC",
        method: "LOCAL",
        endpoint: "localStorage:rbac_policy",
        description: "Assign frontend permissions to roles.",
      },
    ],
  },
];

export const allPermissionKeys = permissionCatalog.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

export const defaultRbacPolicy = {
  superadmin: [...allPermissionKeys],
  admin: [
    "dashboard.view",
    "games.view",
    "games.create",
    "games.update",
    "subscribers.view",
    "subscribers.view_by_game",
    "subscribers.view_game_subscribers",
  ],
};

export function normalizeRole(value) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

export function cloneRbacPolicy(policy) {
  return {
    superadmin: [...(policy?.superadmin || [])],
    admin: [...(policy?.admin || [])],
  };
}

export function readRbacPolicy() {
  if (typeof localStorage === "undefined") {
    return cloneRbacPolicy(defaultRbacPolicy);
  }

  try {
    const rawPolicy = localStorage.getItem(RBAC_STORAGE_KEY);
    if (!rawPolicy) {
      return cloneRbacPolicy(defaultRbacPolicy);
    }

    const parsedPolicy = JSON.parse(rawPolicy);
    return {
      superadmin: Array.isArray(parsedPolicy?.superadmin) ? parsedPolicy.superadmin : [...defaultRbacPolicy.superadmin],
      admin: Array.isArray(parsedPolicy?.admin) ? parsedPolicy.admin : [...defaultRbacPolicy.admin],
    };
  } catch {
    return cloneRbacPolicy(defaultRbacPolicy);
  }
}

export function saveRbacPolicy(policy) {
  const normalizedPolicy = cloneRbacPolicy(policy);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(RBAC_STORAGE_KEY, JSON.stringify(normalizedPolicy));
  }
  return normalizedPolicy;
}

export function getRolePermissions(policy, role) {
  return policy?.[normalizeRole(role)] || [];
}

export function roleHasPermission(policy, role, permissionKey) {
  return getRolePermissions(policy, role).includes(permissionKey);
}
