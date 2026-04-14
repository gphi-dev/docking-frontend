<script setup>
import { onMounted, ref } from "vue";
import { apiRequest } from "../api/http";
import AddAdminModal from "../components/AddAdminModal.vue";

const admins = ref([]);
const loadError = ref("");
const isLoading = ref(true);

// Defined all the missing modal states
const isAddAdminModalOpen = ref(false);
const isEditAdminModalOpen = ref(false);
const selectedAdmin = ref(null);

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

// Added the function to open the Add Modal
function openAddAdminModal() {
  isAddAdminModalOpen.value = true;
}

// Added the function to open the Edit Modal so you have it ready
function openEditAdminModal(admin) {
  selectedAdmin.value = admin;
  isEditAdminModalOpen.value = true;
}

function handleAdminCreated() {
  loadAdmins();
}

function handleAdminUpdated() {
  loadAdmins();
}

onMounted(() => {
  loadAdmins();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Admin users</h1>
        <p class="mt-1 text-sm text-slate-600">Accounts that can sign in to this console.</p>
      </div>
      <div class="flex shrink-0 justify-end">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
          @click="openAddAdminModal"
        >
          Add Admin
        </button>
      </div>
    </div>

    <p v-if="loadError" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ loadError }}
    </p> 

    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Username</th>
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading">
              <td colspan="3" class="px-4 py-10 text-center text-slate-500">Loading…</td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="3" class="px-4 py-10 text-center text-slate-500">No admin users found.</td>
            </tr>
            <tr v-for="admin in admins" :key="admin.id" class="hover:bg-slate-50/80">
              <td class="px-4 py-3 font-semibold text-slate-900">
                {{ admin.username }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-600">
                {{ formatDateTime(admin.created_at) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="text-sm font-medium text-sky-600 hover:text-sky-800 transition-colors"
                  @click="openEditAdminModal(admin)"
                >
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AddAdminModal
      :open="isAddAdminModalOpen"
      mode="create"
      @close="isAddAdminModalOpen = false"
      @created="handleAdminCreated"
    />

    <AddAdminModal
      :open="isEditAdminModalOpen"
      :user="selectedAdmin"
      mode="edit"
      @close="isEditAdminModalOpen = false"
      @updated="handleAdminUpdated"
    />
  </div>
</template>