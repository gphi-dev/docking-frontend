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
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-emerald-100/80">
            <tr v-if="isLoading">
              <td colspan="3" class="px-4 py-10 text-center text-emerald-900/55">Loading…</td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="3" class="px-4 py-10 text-center text-emerald-900/55">No admin users found.</td>
            </tr>
            <tr v-for="admin in admins" :key="admin.id" class="hover:bg-emerald-50/70">
              <td class="px-4 py-3 font-semibold text-emerald-950">
                {{ admin.username }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-emerald-900/60">
                {{ formatDateTime(admin.created_at) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-full border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 hover:text-emerald-700"
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
