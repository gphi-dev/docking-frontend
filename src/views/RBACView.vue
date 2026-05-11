<script setup>
import { computed, onMounted, ref } from "vue";
import { apiRequest } from "../api/http";
import { normalizeRole } from "../rbac/permissions";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const roles = ref([]);
const permissions = ref([]);
const selectedRoleId = ref("");
const draftPolicy = ref({});
const savedPolicy = ref({});
const statusMessage = ref("");
const loadError = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const RBAC_MANAGE_PERMISSION_KEY = "rbac.manage";
const ADMIN_VIEW_PERMISSION_KEY = "admins.view";
const ADMIN_MUTATION_PERMISSION_KEYS = new Set([
  "admins.create",
  "admins.update",
  "admins.delete",
]);
const GAMES_VIEW_PERMISSION_KEY = "games.view";
const GAMES_MUTATION_PERMISSION_KEYS = new Set([
  "games.create",
  "games.update",
  "games.delete",
]);
const REWARDS_VIEW_PERMISSION_KEY = "rewards.view";
const REWARDS_MUTATION_PERMISSION_KEYS = new Set([
  "rewards.create",
  "rewards.update",
  "rewards.delete",
]);
const SUBSCRIBERS_VIEW_PERMISSION_KEY = "subscribers.view";
const SUBSCRIBERS_DETAIL_PERMISSION_KEYS = new Set([
  "subscribers.view_by_game",
  "subscribers.view_game_subscribers",
]);
const VIEW_DEPENDENT_PERMISSION_GROUPS = [
  {
    viewPermissionKey: ADMIN_VIEW_PERMISSION_KEY,
    dependentPermissionKeys: ADMIN_MUTATION_PERMISSION_KEYS,
  },
  {
    viewPermissionKey: GAMES_VIEW_PERMISSION_KEY,
    dependentPermissionKeys: GAMES_MUTATION_PERMISSION_KEYS,
  },
  {
    viewPermissionKey: REWARDS_VIEW_PERMISSION_KEY,
    dependentPermissionKeys: REWARDS_MUTATION_PERMISSION_KEYS,
  },
  {
    viewPermissionKey: SUBSCRIBERS_VIEW_PERMISSION_KEY,
    dependentPermissionKeys: SUBSCRIBERS_DETAIL_PERMISSION_KEYS,
  },
];

function rolePolicyKey(roleOrId) {
  const roleId = typeof roleOrId === "object" ? roleOrId?.id : roleOrId;
  return String(roleId ?? "");
}

function isSuperAdminRole(role) {
  return normalizeRole(role?.slug || role?.name) === "superadmin";
}

function isDefaultAdminRole(role) {
  return normalizeRole(role?.slug || role?.name) === "admin";
}

function isAdminRestrictedPermission(permissionKey) {
  return isDefaultAdminRole(selectedRoleDetails.value) && permissionKey === RBAC_MANAGE_PERMISSION_KEY;
}

function sanitizeRolePermissionKeys(permissionKeys) {
  const nextPermissionKeys = permissionKeys.filter((permissionKey) => permissionKey !== RBAC_MANAGE_PERMISSION_KEY);
  const allowedPermissionKeys = new Set(nextPermissionKeys);

  for (const { viewPermissionKey, dependentPermissionKeys } of VIEW_DEPENDENT_PERMISSION_GROUPS) {
    if (!allowedPermissionKeys.has(viewPermissionKey)) {
      for (const dependentPermissionKey of dependentPermissionKeys) {
        allowedPermissionKeys.delete(dependentPermissionKey);
      }
    }
  }

  return nextPermissionKeys.filter((permissionKey) => allowedPermissionKeys.has(permissionKey));
}

function isEditablePermission(permission) {
  return permission?.action_key !== RBAC_MANAGE_PERMISSION_KEY;
}

function clonePolicy(policy) {
  return Object.fromEntries(
    Object.entries(policy || {}).map(([roleId, permissionKeys]) => [
      roleId,
      Array.isArray(permissionKeys) ? [...permissionKeys] : [],
    ]),
  );
}

function buildPolicyFromRoles(nextRoles) {
  return nextRoles.reduce((policy, role) => {
    const permissionKeys = Array.isArray(role.allowed_permission_keys)
      ? role.allowed_permission_keys
      : [];
    policy[rolePolicyKey(role)] = sanitizeRolePermissionKeys(permissionKeys);
    return policy;
  }, {});
}

function selectInitialRole(nextRoles) {
  const preferredRole =
    nextRoles.find((role) => role.slug === "admin") ||
    nextRoles.find((role) => !isSuperAdminRole(role)) ||
    nextRoles[0];

  selectedRoleId.value = preferredRole ? rolePolicyKey(preferredRole) : "";
}

function groupPermissions(permissionRecords) {
  const groupsByName = new Map();

  for (const permission of permissionRecords) {
    const groupName = permission.access_group || "Other";
    if (!groupsByName.has(groupName)) {
      groupsByName.set(groupName, []);
    }

    groupsByName.get(groupName).push(permission);
  }

  return Array.from(groupsByName.entries()).map(([group, groupPermissions]) => ({
    group,
    permissions: groupPermissions,
  }));
}

function getAllowedPermissionKeysFromMatrix(permissionMatrix) {
  if (!Array.isArray(permissionMatrix)) {
    return [];
  }

  return permissionMatrix
    .filter((permission) => Boolean(permission?.is_allowed))
    .map((permission) => permission.action_key)
    .filter(Boolean);
}

const editablePermissions = computed(() => permissions.value.filter(isEditablePermission));
const permissionCatalog = computed(() => groupPermissions(editablePermissions.value));

const selectedRoleDetails = computed(() =>
  roles.value.find((role) => rolePolicyKey(role) === selectedRoleId.value) || null,
);

const selectedRolePermissions = computed(() =>
  new Set(draftPolicy.value[selectedRoleId.value] || []),
);

const isSelectedRoleLocked = computed(() => isSuperAdminRole(selectedRoleDetails.value));

const totalPermissionCount = computed(() => editablePermissions.value.length);
const allowedCount = computed(() =>
  isSelectedRoleLocked.value ? totalPermissionCount.value : selectedRolePermissions.value.size,
);

function isPermissionEnabled(permissionKey) {
  if (isAdminRestrictedPermission(permissionKey)) {
    return false;
  }

  if (isViewDependentPermissionBlocked(permissionKey)) {
    return false;
  }

  return isSelectedRoleLocked.value || selectedRolePermissions.value.has(permissionKey);
}

function isViewDependentPermissionBlocked(permissionKey) {
  if (isSelectedRoleLocked.value) {
    return false;
  }

  const permissionGroup = VIEW_DEPENDENT_PERMISSION_GROUPS.find(({ dependentPermissionKeys }) =>
    dependentPermissionKeys.has(permissionKey),
  );

  return Boolean(
    permissionGroup &&
    !selectedRolePermissions.value.has(permissionGroup.viewPermissionKey),
  );
}

function isPermissionDisabled(permissionKey) {
  return (
    isSelectedRoleLocked.value ||
    isAdminRestrictedPermission(permissionKey) ||
    isViewDependentPermissionBlocked(permissionKey) ||
    isLoading.value ||
    isSaving.value
  );
}

function togglePermission(permissionKey) {
  if (!selectedRoleId.value || isPermissionDisabled(permissionKey)) {
    return;
  }

  const currentPermissions = new Set(draftPolicy.value[selectedRoleId.value] || []);
  if (currentPermissions.has(permissionKey)) {
    currentPermissions.delete(permissionKey);
  } else {
    currentPermissions.add(permissionKey);
  }

  draftPolicy.value = {
    ...draftPolicy.value,
    [selectedRoleId.value]: sanitizeRolePermissionKeys([...currentPermissions]),
  };
  statusMessage.value = "";
}

async function loadRbac() {
  loadError.value = "";
  statusMessage.value = "";
  isLoading.value = true;

  try {
    const payload = await apiRequest("/api/rbac");
    roles.value = Array.isArray(payload?.roles) ? payload.roles : [];
    permissions.value = Array.isArray(payload?.permissions) ? payload.permissions : [];
    const rawPolicy = payload?.policy && typeof payload.policy === "object"
      ? clonePolicy(payload.policy)
      : buildPolicyFromRoles(roles.value);
    savedPolicy.value = roles.value.reduce((policy, role) => {
      policy[rolePolicyKey(role)] = sanitizeRolePermissionKeys(rawPolicy[rolePolicyKey(role)] || []);
      return policy;
    }, {});
    draftPolicy.value = clonePolicy(savedPolicy.value);

    if (!selectedRoleId.value || !roles.value.some((role) => rolePolicyKey(role) === selectedRoleId.value)) {
      selectInitialRole(roles.value);
    }
  } catch (error) {
    loadError.value = error?.message || "Failed to load RBAC permissions";
  } finally {
    isLoading.value = false;
  }
}

async function savePolicy() {
  if (!selectedRoleDetails.value || isSelectedRoleLocked.value) {
    return;
  }

  isSaving.value = true;
  loadError.value = "";
  statusMessage.value = "";

  try {
    const payload = await apiRequest(`/api/rbac/roles/${selectedRoleId.value}/permissions`, {
      method: "PUT",
      body: JSON.stringify({
        allowed_permission_keys: sanitizeRolePermissionKeys(draftPolicy.value[selectedRoleId.value] || []),
      }),
    });
    const updatedRole = payload?.role;

    if (updatedRole?.id) {
      const updatedAllowedPermissionKeys = Array.isArray(updatedRole.allowed_permission_keys)
        ? updatedRole.allowed_permission_keys
        : getAllowedPermissionKeysFromMatrix(payload?.permissions);
      const mergedRole = {
        ...(roles.value.find((role) => rolePolicyKey(role) === rolePolicyKey(updatedRole)) || {}),
        ...updatedRole,
        allowed_permission_keys: sanitizeRolePermissionKeys(updatedAllowedPermissionKeys),
      };

      roles.value = roles.value.map((role) =>
        rolePolicyKey(role) === rolePolicyKey(mergedRole) ? mergedRole : role,
      );
      savedPolicy.value = {
        ...savedPolicy.value,
        [rolePolicyKey(mergedRole)]: [...mergedRole.allowed_permission_keys],
      };
      draftPolicy.value = clonePolicy(savedPolicy.value);
      authStore.syncRolePermissions(mergedRole);
    }

    statusMessage.value = "RBAC permissions saved.";
  } catch (error) {
    loadError.value = error?.message || "Could not save RBAC permissions";
  } finally {
    isSaving.value = false;
  }
}

function resetSelectedRole() {
  if (!selectedRoleId.value) {
    return;
  }

  draftPolicy.value = {
    ...draftPolicy.value,
    [selectedRoleId.value]: [...(savedPolicy.value[selectedRoleId.value] || [])],
  };
  statusMessage.value = "";
}

function resetAllRoles() {
  draftPolicy.value = clonePolicy(savedPolicy.value);
  statusMessage.value = "";
}

onMounted(() => {
  loadRbac();
});
</script>

<template>
  <div class="page-stack">
    <section class="page-hero">
      <div class="page-hero-header flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="max-w-3xl">
          <p class="page-kicker">Access Control</p>
          <h1 class="page-title">RBAC permissions</h1>
          <p class="page-copy">
            Assign role access to dashboard actions and API endpoints for create, update, delete, and view operations.
          </p>
        </div>
        <div class="stat-card text-right">
          <p class="stat-label">Allowed Actions</p>
          <p class="stat-value">{{ allowedCount }} / {{ totalPermissionCount }}</p>
        </div>
      </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
      <aside class="space-y-4">
        <div class="panel-card overflow-hidden">
          <div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p class="page-kicker">Roles</p>
          </div>
          <div class="space-y-2 p-3">
            <p v-if="isLoading" class="px-3 py-4 text-sm text-emerald-900/55">Loading roles…</p>
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="w-full rounded-xl border px-4 py-3 text-left transition-colors duration-200"
              :class="
                selectedRoleId === rolePolicyKey(role)
                  ? 'border-emerald-900 bg-emerald-950 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-950 hover:border-emerald-300 hover:bg-emerald-50'
              "
              @click="selectedRoleId = rolePolicyKey(role)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="block text-sm font-bold">{{ role.name }}</span>
                <span
                  v-if="role.is_active === false"
                  class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  Inactive
                </span>
              </span>
              <span
                class="mt-1 block text-xs leading-5"
                :class="selectedRoleId === rolePolicyKey(role) ? 'text-emerald-100/75' : 'text-emerald-900/55'"
              >
                {{ role.description }}
              </span>
            </button>
          </div>
        </div>

        <div class="panel-card p-4">
          <p class="page-kicker">Selected Role</p>
          <h2 class="mt-2 text-xl font-bold text-slate-950">{{ selectedRoleDetails?.name || "No role selected" }}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ selectedRoleDetails?.description || "Select a role to manage permissions." }}</p>
          <p v-if="isSelectedRoleLocked" class="mt-3 rounded-xl bg-emerald-950 px-3 py-2 text-xs font-semibold text-white">
            Super Admin always keeps full system access.
          </p>
          <p v-else-if="isDefaultAdminRole(selectedRoleDetails)" class="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Admin cannot be allowed to manage RBAC.
          </p>
        </div>
      </aside>

      <div class="min-w-0 space-y-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <p class="page-kicker">Permissions</p>
            <h2 class="section-heading mt-1">Actions</h2>
          </div>
          <div class="flex max-w-full flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              class="btn-secondary"
              :disabled="isSelectedRoleLocked || isLoading || isSaving"
              @click="resetSelectedRole"
            >
              Reset role
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="isLoading || isSaving"
              @click="resetAllRoles"
            >
              Reset all
            </button>
            <button
              type="button"
              class="btn-primary"
              :disabled="isSelectedRoleLocked || isLoading || isSaving"
              @click="savePolicy"
            >
              {{ isSaving ? "Saving…" : "Save permissions" }}
            </button>
          </div>
        </div>

        <p v-if="loadError" class="alert-danger">
          {{ loadError }}
        </p>

        <p v-if="statusMessage" class="alert-success">
          {{ statusMessage }}
        </p>

        <div class="table-shell min-w-0">
          <div class="table-scroll">
            <table class="responsive-table table-fixed">
              <thead class="table-head">
                <tr>
                  <th class="w-[8.5rem] px-4 py-3">Access</th>
                  <th class="w-[18rem] px-4 py-3">Action</th>
                  <th class="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody
                v-for="group in permissionCatalog"
                :key="group.group"
                class="table-body"
              >
                <tr class="bg-slate-50">
                  <td colspan="3" class="px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                    {{ group.group }}
                  </td>
                </tr>
                <tr
                  v-for="permission in group.permissions"
                  :key="permission.action_key"
                  class="table-row"
                >
                  <td class="px-4 py-3" data-label="Access">
                    <label class="flex cursor-pointer flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500"
                        :checked="isPermissionEnabled(permission.action_key)"
                        :disabled="isPermissionDisabled(permission.action_key)"
                        @change="togglePermission(permission.action_key)"
                      />
                      <span class="text-xs font-semibold text-emerald-900/60">
                        {{ isPermissionEnabled(permission.action_key) ? "Allowed" : "Denied" }}
                      </span>
                    </label>
                  </td>
                  <td class="break-words px-4 py-3 font-semibold text-emerald-950" data-label="Action">
                    {{ permission.action_name }}
                  </td>
                  <td class="break-words px-4 py-3 text-emerald-900/60" data-label="Description">
                    {{ permission.description }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
