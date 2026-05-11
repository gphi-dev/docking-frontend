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
  <div class="page-stack">
    <section class="page-hero">
      <div class="page-hero-header flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="page-kicker">Gatekeeper Console</p>
          <h1 class="page-title">Admin users</h1>
          <p class="page-copy">
            Manage the operators who can access this console and keep your arcade control room secure.
          </p>
        </div>
        <div class="flex shrink-0 justify-end">
          <button
            v-if="authStore.canAccess('admins.create')"
            type="button"
            class="btn-primary"
            @click="openAddAdminModal"
          >
            Add Admin
          </button>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="alert-danger">
      {{ loadError }}
    </p> 

    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="page-kicker">Control Roster</p>
        <h2 class="section-heading mt-1">Authorized operators</h2>
      </div>
      <div class="stat-card text-right">
        <p class="stat-label">Total Admins</p>
        <p class="stat-value">{{ admins.length }}</p>
      </div>
    </div>

    <div class="table-shell">
      <div class="table-scroll">
        <table class="responsive-table">
          <thead class="table-head">
            <tr>
              <th class="px-4 py-3">Username</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="table-body">
            <tr v-if="isLoading">
              <td colspan="5" class="px-4 py-10 text-center text-slate-500">Loading...</td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-slate-500">No admin users found.</td>
            </tr>
            <tr v-for="admin in admins" :key="admin.id" class="table-row">
              <td class="px-4 py-3 font-semibold text-slate-950" data-label="Username">
                {{ admin.username }}
              </td>
              <td class="whitespace-nowrap px-4 py-3" data-label="Role">
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
              <td class="whitespace-nowrap px-4 py-3" data-label="Status">
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
              <td class="whitespace-nowrap px-4 py-3 text-slate-500" data-label="Created">
                {{ formatDateTime(admin.created_at) }}
              </td>
              <td class="px-4 py-3 text-right" data-actions data-label="Actions">
                <div class="table-actions flex justify-end gap-2">
                  <span
                    v-if="!authStore.canAccess('admins.update') && !authStore.canAccess('admins.delete')"
                    class="text-sm text-emerald-900/40"
                  >
                    —
                  </span>
                  <button
                    v-if="authStore.canAccess('admins.update')"
                    type="button"
                    class="btn-secondary px-3 py-1.5"
                    @click="openEditAdminModal(admin)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="authStore.canAccess('admins.delete')"
                    type="button"
                    class="btn-danger px-3 py-1.5"
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
