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
  return permissionKeys.filter((permissionKey) => permissionKey !== RBAC_MANAGE_PERMISSION_KEY);
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

  return isSelectedRoleLocked.value || selectedRolePermissions.value.has(permissionKey);
}

function togglePermission(permissionKey) {
  if (isSelectedRoleLocked.value || !selectedRoleId.value || isAdminRestrictedPermission(permissionKey)) {
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
    [selectedRoleId.value]: [...currentPermissions],
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
  <div class="space-y-8">
    <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.3),_transparent_35%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.9)_45%,_rgba(236,252,203,0.92))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
      <div class="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
      <div class="pointer-events-none absolute bottom-0 left-12 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />
      <div class="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Access Control</p>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950 md:text-3xl">RBAC permissions</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/70">
            Assign role access to dashboard actions and API endpoints for create, update, delete, and view operations.
          </p>
        </div>
        <div class="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-right backdrop-blur">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">Allowed Actions</p>
          <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ allowedCount }} / {{ totalPermissionCount }}</p>
        </div>
      </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
      <aside class="space-y-4">
        <div class="overflow-hidden rounded-[24px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
          <div class="border-b border-emerald-100/80 px-4 py-3">
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700/70">Roles</p>
          </div>
          <div class="space-y-2 p-3">
            <p v-if="isLoading" class="px-3 py-4 text-sm text-emerald-900/55">Loading roles…</p>
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="w-full rounded-2xl border px-4 py-3 text-left transition"
              :class="
                selectedRoleId === rolePolicyKey(role)
                  ? 'border-emerald-300 bg-emerald-950 text-white shadow-lg shadow-emerald-950/15'
                  : 'border-transparent bg-emerald-50/70 text-emerald-950 hover:border-emerald-200 hover:bg-emerald-50'
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

        <div class="rounded-[24px] border border-emerald-200/70 bg-white/90 p-4">
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700/70">Selected Role</p>
          <h2 class="mt-2 text-xl font-bold text-emerald-950">{{ selectedRoleDetails?.name || "No role selected" }}</h2>
          <p class="mt-2 text-sm leading-6 text-emerald-900/65">{{ selectedRoleDetails?.description || "Select a role to manage permissions." }}</p>
          <p v-if="isSelectedRoleLocked" class="mt-3 rounded-2xl bg-emerald-950 px-3 py-2 text-xs font-semibold text-lime-100">
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
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Permissions</p>
            <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Actions and endpoints</h2>
          </div>
          <div class="flex max-w-full flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-55"
              :disabled="isSelectedRoleLocked || isLoading || isSaving"
              @click="resetSelectedRole"
            >
              Reset role
            </button>
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
              :disabled="isLoading || isSaving"
              @click="resetAllRoles"
            >
              Reset all
            </button>
            <button
              type="button"
              class="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-900"
              :disabled="isSelectedRoleLocked || isLoading || isSaving"
              @click="savePolicy"
            >
              {{ isSaving ? "Saving…" : "Save permissions" }}
            </button>
          </div>
        </div>

        <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {{ loadError }}
        </p>

        <p v-if="statusMessage" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {{ statusMessage }}
        </p>

        <div class="min-w-0 overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
          <div class="overflow-x-auto">
            <table class="w-full table-fixed divide-y divide-slate-200 text-sm">
              <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                <tr>
                  <th class="w-[8.5rem] px-4 py-3">Access</th>
                  <th class="w-[18rem] px-4 py-3">Action</th>
                  <th class="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody
                v-for="group in permissionCatalog"
                :key="group.group"
                class="divide-y divide-emerald-100/80"
              >
                <tr class="bg-emerald-50/70">
                  <td colspan="3" class="px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-emerald-800/70">
                    {{ group.group }}
                  </td>
                </tr>
                <tr
                  v-for="permission in group.permissions"
                  :key="permission.action_key"
                  class="transition hover:bg-emerald-50/70"
                >
                  <td class="px-4 py-3">
                    <label class="flex cursor-pointer flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500"
                        :checked="isPermissionEnabled(permission.action_key)"
                        :disabled="isSelectedRoleLocked || isAdminRestrictedPermission(permission.action_key) || isLoading || isSaving"
                        @change="togglePermission(permission.action_key)"
                      />
                      <span class="text-xs font-semibold text-emerald-900/60">
                        {{ isPermissionEnabled(permission.action_key) ? "Allowed" : "Denied" }}
                      </span>
                    </label>
                  </td>
                  <td class="break-words px-4 py-3 font-semibold text-emerald-950">
                    {{ permission.action_name }}
                    <span class="mt-1 block text-xs font-medium text-emerald-900/45">
                      {{ permission.method || "LOCAL" }} {{ permission.endpoint || "—" }}
                    </span>
                  </td>
                  <td class="break-words px-4 py-3 text-emerald-900/60">
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
