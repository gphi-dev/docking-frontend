<script setup>
import { computed, ref, watch } from "vue";
import { apiRequest } from "../api/http.js";

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  mode: {
    type: String,
    default: "create",
    validator: (value) => ["create", "edit"].includes(value),
  },
  user: {
    type: Object,
    default: null,
  },
  roles: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "created", "updated"]);

const username = ref("");
const email = ref("");
const password = ref("");
const selectedRoleId = ref("");
const status = ref("active");
const errorMessage = ref("");
const isSubmitting = ref(false);

const activeRoles = computed(() => props.roles.filter((role) => role.is_active !== false));
const selectableRoles = computed(() =>
  props.roles.filter((role) => role.is_active !== false || String(role.id) === String(selectedRoleId.value)),
);
const selectedRole = computed(() =>
  props.roles.find((role) => String(role.id) === String(selectedRoleId.value)) || null,
);

function isEditMode() {
  return props.mode === "edit";
}

function getDefaultRoleId() {
  const defaultRole = activeRoles.value.find((role) => role.slug === "admin") || activeRoles.value[0];
  return defaultRole?.id ? String(defaultRole.id) : "";
}

function resetForm() {
  username.value = "";
  email.value = "";
  password.value = "";
  selectedRoleId.value = getDefaultRoleId();
  status.value = "active";
  errorMessage.value = "";
  isSubmitting.value = false;
}

function populateForm() {
  username.value = props.user?.username ?? "";
  email.value = props.user?.email ?? "";
  password.value = ""; // Usually keep password blank during edit
  selectedRoleId.value = props.user?.role_id ? String(props.user.role_id) : getDefaultRoleId();
  status.value = props.user?.status ?? "active";
  errorMessage.value = "";
  isSubmitting.value = false;
}

watch(
  () => [props.open, props.mode, props.user, props.roles],
  ([isOpen]) => {
    if (!isOpen) return;
    isEditMode() ? populateForm() : resetForm();
  },
  { immediate: true },
);

async function handleSubmit() {
  errorMessage.value = "";
  
  if (!username.value.trim() || !email.value.trim()) {
    errorMessage.value = "Username and Email are required";
    return;
  }

  if (!selectedRoleId.value) {
    errorMessage.value = "Role is required";
    return;
  }

  if (!isEditMode() && !password.value) {
    errorMessage.value = "Password is required for new users";
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      username: username.value.trim(),
      email: email.value.trim(),
      role_id: selectedRoleId.value,
      status: status.value,
    };

    // Only include password if it's a new user or the field is filled
    if (password.value) {
      payload.password = password.value;
    }

    const savedUser = await apiRequest(isEditMode() ? `/api/admins/${props.user?.id}` : "/api/admins", {
      method: isEditMode() ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    isEditMode() ? emit("updated", savedUser) : emit("created", savedUser);
    emit("close");
  } catch (error) {
    errorMessage.value = error?.message || `Could not ${isEditMode() ? "update" : "create"} admin`;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @keydown.esc.stop.prevent
    >
      <div
        class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        @click.stop
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              {{ isEditMode() ? "Update Admin" : "Add Admin User" }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ isEditMode() ? "Modify administrator permissions and details." : "Grant administrative access to a new user." }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            :disabled="isSubmitting"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Username
            </label>
            <input
              v-model="username"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="e.g. jdoe_admin"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Address
            </label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="admin@company.com"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password {{ isEditMode() ? "(Leave blank to keep current)" : "" }}
            </label>
            <input
              v-model="password"
              type="password"
              :required="!isEditMode()"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
            </label>
            <select
              v-model="selectedRoleId"
              required
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
            >
              <option value="" disabled>Select role</option>
              <option
                v-for="roleOption in selectableRoles"
                :key="roleOption.id"
                :value="String(roleOption.id)"
              >
                {{ roleOption.name }}{{ roleOption.is_active === false ? " (Inactive)" : "" }}
              </option>
            </select>
            <p class="mt-2 text-xs leading-5 text-slate-500">
              {{ selectedRole?.description || "Role permissions are managed from the RBAC screen." }}
            </p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              v-model="status"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:border-sky-500 focus:ring-2"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <p v-if="errorMessage" class="text-sm text-rose-600">
            {{ errorMessage }}
          </p>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? "Saving…" : isEditMode() ? "Update Admin" : "Create Admin" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
