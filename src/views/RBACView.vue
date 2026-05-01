<script setup>
import { computed, ref } from "vue";
import { useAuthStore } from "../stores/auth";
import {
  cloneRbacPolicy,
  defaultRbacPolicy,
  getRolePermissions,
  permissionCatalog,
  roleOptions,
} from "../rbac/permissions";

const authStore = useAuthStore();
const selectedRole = ref("admin");
const draftPolicy = ref(cloneRbacPolicy(authStore.rbacPolicy));
const statusMessage = ref("");

const selectedRoleDetails = computed(() =>
  roleOptions.find((role) => role.value === selectedRole.value) || roleOptions[0],
);

const selectedRolePermissions = computed(() =>
  new Set(getRolePermissions(draftPolicy.value, selectedRole.value)),
);

const isSelectedRoleLocked = computed(() => selectedRole.value === "superadmin");

const totalPermissionCount = computed(() =>
  permissionCatalog.reduce((total, group) => total + group.permissions.length, 0),
);
const allowedCount = computed(() => (isSelectedRoleLocked.value ? totalPermissionCount.value : selectedRolePermissions.value.size));

function isPermissionEnabled(permissionKey) {
  return isSelectedRoleLocked.value || selectedRolePermissions.value.has(permissionKey);
}

function togglePermission(permissionKey) {
  if (isSelectedRoleLocked.value) {
    return;
  }

  const currentPermissions = new Set(getRolePermissions(draftPolicy.value, selectedRole.value));
  if (currentPermissions.has(permissionKey)) {
    currentPermissions.delete(permissionKey);
  } else {
    currentPermissions.add(permissionKey);
  }

  draftPolicy.value = {
    ...draftPolicy.value,
    [selectedRole.value]: [...currentPermissions],
  };
  statusMessage.value = "";
}

function savePolicy() {
  authStore.setRbacPolicy(draftPolicy.value);
  statusMessage.value = "RBAC permissions saved.";
}

function resetSelectedRole() {
  draftPolicy.value = {
    ...draftPolicy.value,
    [selectedRole.value]: [...(defaultRbacPolicy[selectedRole.value] || [])],
  };
  statusMessage.value = "";
}

function resetAllRoles() {
  draftPolicy.value = cloneRbacPolicy(defaultRbacPolicy);
  statusMessage.value = "";
}
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
            <button
              v-for="role in roleOptions"
              :key="role.value"
              type="button"
              class="w-full rounded-2xl border px-4 py-3 text-left transition"
              :class="
                selectedRole === role.value
                  ? 'border-emerald-300 bg-emerald-950 text-white shadow-lg shadow-emerald-950/15'
                  : 'border-transparent bg-emerald-50/70 text-emerald-950 hover:border-emerald-200 hover:bg-emerald-50'
              "
              @click="selectedRole = role.value"
            >
              <span class="block text-sm font-bold">{{ role.label }}</span>
              <span
                class="mt-1 block text-xs leading-5"
                :class="selectedRole === role.value ? 'text-emerald-100/75' : 'text-emerald-900/55'"
              >
                {{ role.description }}
              </span>
            </button>
          </div>
        </div>

        <div class="rounded-[24px] border border-emerald-200/70 bg-white/90 p-4">
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700/70">Selected Role</p>
          <h2 class="mt-2 text-xl font-bold text-emerald-950">{{ selectedRoleDetails.label }}</h2>
          <p class="mt-2 text-sm leading-6 text-emerald-900/65">{{ selectedRoleDetails.description }}</p>
          <p v-if="isSelectedRoleLocked" class="mt-3 rounded-2xl bg-emerald-950 px-3 py-2 text-xs font-semibold text-lime-100">
            Super Admin always keeps full system access.
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
              :disabled="isSelectedRoleLocked"
              @click="resetSelectedRole"
            >
              Reset role
            </button>
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
              @click="resetAllRoles"
            >
              Reset all
            </button>
            <button
              type="button"
              class="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-900"
              @click="savePolicy"
            >
              Save permissions
            </button>
          </div>
        </div>

        <p v-if="statusMessage" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {{ statusMessage }}
        </p>

        <div class="min-w-0 overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
          <div class="overflow-x-auto">
            <table class="w-full table-fixed divide-y divide-slate-200 text-sm">
              <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                <tr>
                  <th class="w-[8.5rem] px-4 py-3">Access</th>
                  <th class="w-[13rem] px-4 py-3">Action</th>
                  <th class="w-[7rem] px-4 py-3">Method</th>
                  <th class="w-[15rem] px-4 py-3">Endpoint</th>
                  <th class="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody
                v-for="group in permissionCatalog"
                :key="group.group"
                class="divide-y divide-emerald-100/80"
              >
                <tr class="bg-emerald-50/70">
                  <td colspan="5" class="px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-emerald-800/70">
                    {{ group.group }}
                  </td>
                </tr>
                <tr
                  v-for="permission in group.permissions"
                  :key="permission.key"
                  class="transition hover:bg-emerald-50/70"
                >
                  <td class="px-4 py-3">
                    <label class="flex cursor-pointer flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500"
                        :checked="isPermissionEnabled(permission.key)"
                        :disabled="isSelectedRoleLocked"
                        @change="togglePermission(permission.key)"
                      />
                      <span class="text-xs font-semibold text-emerald-900/60">
                        {{ isPermissionEnabled(permission.key) ? "Allowed" : "Denied" }}
                      </span>
                    </label>
                  </td>
                  <td class="break-words px-4 py-3 font-semibold text-emerald-950">
                    {{ permission.action }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <span class="inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-900 ring-1 ring-inset ring-emerald-500/20">
                      {{ permission.method }}
                    </span>
                  </td>
                  <td class="break-all px-4 py-3 font-mono text-xs text-slate-700">
                    {{ permission.endpoint }}
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
