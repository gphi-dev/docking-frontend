<script setup>
import { onMounted, ref } from "vue";
import { apiRequest } from "../api/http";
import AddAdminModal from "../components/AddAdminModal.vue";
import ConfirmActionModal from "../components/ConfirmActionModal.vue";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const admins = ref([]);
const roles = ref([]);
const loadError = ref("");
const isLoading = ref(true);

// Defined all the missing modal states
const isAddAdminModalOpen = ref(false);
const isEditAdminModalOpen = ref(false);
const selectedAdmin = ref(null);
const deletingAdminId = ref(null);
const pendingDeleteAdmin = ref(null);
const deleteAdminError = ref("");

function formatDateTime(isoString) {
  if (!isoString) {
    return "—";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRole(role) {
  const normalizedRole = String(role || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (normalizedRole === "superadmin") {
    return "Super Admin";
  }

  return "Admin";
}

function getAdminRoleName(admin) {
  return admin?.rbac_role?.name || admin?.role || "Admin";
}

function formatStatus(status) {
  return String(status || "active").toLowerCase() === "inactive" ? "Inactive" : "Active";
}

async function loadAdmins() {
  loadError.value = "";
  isLoading.value = true;
  try {
    const payload = await apiRequest("/api/admins");
    admins.value = Array.isArray(payload) ? payload : [];
  } catch (error) {
    loadError.value = error?.message || "Failed to load admin users";
  } finally {
    isLoading.value = false;
  }
}

async function loadRoles() {
  try {
    const payload = await apiRequest("/api/rbac/roles");
    roles.value = Array.isArray(payload) ? payload : [];
    return true;
  } catch (error) {
    loadError.value = error?.message || "Failed to load roles";
    return false;
  }
}

async function ensureRolesLoaded() {
  if (roles.value.length > 0) {
    return true;
  }

  return loadRoles();
}

// Added the function to open the Add Modal
async function openAddAdminModal() {
  if (!authStore.canAccess("admins.create")) {
    loadError.value = "Only Super Admin users can create admin users.";
    return;
  }

  if (!(await ensureRolesLoaded())) {
    return;
  }

  isAddAdminModalOpen.value = true;
}

// Added the function to open the Edit Modal so you have it ready
async function openEditAdminModal(admin) {
  if (!authStore.canAccess("admins.update")) {
    loadError.value = "Only Super Admin users can update admin users.";
    return;
  }

  if (!(await ensureRolesLoaded())) {
    return;
  }

  selectedAdmin.value = admin;
  isEditAdminModalOpen.value = true;
}

function handleDeleteAdmin(admin) {
  if (!authStore.canAccess("admins.delete")) {
    loadError.value = "Only Super Admin users can delete admin users.";
    return;
  }

  pendingDeleteAdmin.value = admin;
  deleteAdminError.value = "";
  loadError.value = "";
}

function closeDeleteAdminConfirmation() {
  if (deletingAdminId.value) {
    return;
  }

  pendingDeleteAdmin.value = null;
  deleteAdminError.value = "";
}

async function confirmDeleteAdmin(password) {
  const admin = pendingDeleteAdmin.value;
  if (!admin) {
    return;
  }

  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    deleteAdminError.value = "Password is required to delete an admin user.";
    return;
  }

  deletingAdminId.value = admin.id;
  deleteAdminError.value = "";
  loadError.value = "";

  try {
    await apiRequest(`/api/admins/${admin.id}`, {
      method: "DELETE",
      body: JSON.stringify({ password: trimmedPassword }),
    });
    admins.value = admins.value.filter((item) => item.id !== admin.id);
    pendingDeleteAdmin.value = null;
  } catch (error) {
    deleteAdminError.value = error?.message || "Could not delete admin user";
  } finally {
    deletingAdminId.value = null;
  }
}

function handleAdminCreated() {
  loadAdmins();
}

function handleAdminUpdated() {
  loadAdmins();
}

onMounted(() => {
  loadAdmins();
  loadRoles();
});
</script>

<template>
  <div class="space-y-8">
    <section class="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,183,0.3),_transparent_35%),linear-gradient(135deg,_rgba(236,253,245,0.98),_rgba(240,253,244,0.9)_45%,_rgba(236,252,203,0.92))] p-6 shadow-[0_25px_80px_-40px_rgba(20,83,45,0.45)] md:p-8">
      <div class="pointer-events-none absolute -right-10 top-2 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
      <div class="pointer-events-none absolute bottom-0 left-12 h-24 w-24 rounded-full bg-lime-300/25 blur-2xl" />
      <div class="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.35em] text-emerald-800/70">Gatekeeper Console</p>
          <h1 class="mt-3 text-3xl font-bold tracking-tight text-emerald-950 md:text-4xl">Admin users</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/70">
            Manage the operators who can access this console and keep your arcade control room secure.
          </p>
        </div>
        <div class="flex shrink-0 justify-end">
          <button
            v-if="authStore.canAccess('admins.create')"
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-emerald-800/10 bg-emerald-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-900"
            @click="openAddAdminModal"
          >
            Add Admin
          </button>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p> 

    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700/70">Control Roster</p>
        <h2 class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">Authorized operators</h2>
      </div>
      <div class="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 text-right">
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/50">Total Admins</p>
        <p class="mt-1 text-2xl font-bold tracking-tight text-emerald-950">{{ admins.length }}</p>
      </div>
    </div>

    <div class="overflow-hidden rounded-[26px] border border-emerald-200/70 bg-white/95 shadow-[0_20px_60px_-42px_rgba(20,83,45,0.5)]">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-[linear-gradient(135deg,rgba(236,253,245,1),rgba(240,253,244,0.85))] text-left text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800/70">
            <tr>
              <th class="px-4 py-3">Username</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-emerald-100/80">
            <tr v-if="isLoading">
              <td colspan="5" class="px-4 py-10 text-center text-emerald-900/55">Loading…</td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-emerald-900/55">No admin users found.</td>
            </tr>
            <tr v-for="admin in admins" :key="admin.id" class="hover:bg-emerald-50/70">
              <td class="px-4 py-3 font-semibold text-emerald-950">
                {{ admin.username }}
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset"
                  :class="
                    formatRole(getAdminRoleName(admin)) === 'Super Admin'
                      ? 'bg-emerald-950 text-lime-100 ring-emerald-900/20'
                      : 'bg-emerald-400/15 text-emerald-900 ring-emerald-500/20'
                  "
                >
                  {{ getAdminRoleName(admin) }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset"
                  :class="
                    formatStatus(admin.status) === 'Active'
                      ? 'bg-lime-400/15 text-lime-900 ring-lime-500/20'
                      : 'bg-slate-100 text-slate-600 ring-slate-300/60'
                  "
                >
                  {{ formatStatus(admin.status) }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                {{ formatDateTime(admin.created_at) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <span
                    v-if="!authStore.canAccess('admins.update') && !authStore.canAccess('admins.delete')"
                    class="text-sm text-emerald-900/40"
                  >
                    —
                  </span>
                  <button
                    v-if="authStore.canAccess('admins.update')"
                    type="button"
                    class="rounded-full border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 hover:text-emerald-700"
                    @click="openEditAdminModal(admin)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="authStore.canAccess('admins.delete')"
                    type="button"
                    class="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="deletingAdminId === admin.id"
                    @click="handleDeleteAdmin(admin)"
                  >
                    {{ deletingAdminId === admin.id ? "Deleting…" : "Delete" }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AddAdminModal
      :open="isAddAdminModalOpen"
      :roles="roles"
      mode="create"
      @close="isAddAdminModalOpen = false"
      @created="handleAdminCreated"
    />

    <AddAdminModal
      :open="isEditAdminModalOpen"
      :user="selectedAdmin"
      :roles="roles"
      mode="edit"
      @close="isEditAdminModalOpen = false"
      @updated="handleAdminUpdated"
    />

    <ConfirmActionModal
      :open="Boolean(pendingDeleteAdmin)"
      title="Delete admin user"
      :message="`Enter your password to delete admin ${pendingDeleteAdmin?.username || 'this user'}. This action cannot be undone.`"
      confirm-label="Delete"
      variant="danger"
      requires-password
      password-label="Current password"
      password-placeholder="Enter your password"
      :error-message="deleteAdminError"
      :is-submitting="Boolean(deletingAdminId)"
      @close="closeDeleteAdminConfirmation"
      @confirm="confirmDeleteAdmin"
    />
  </div>
</template>
