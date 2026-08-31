<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();

const users = useQuery({ queryKey: ['iam-users'], queryFn: async () => (await api.get('/iam/users')).data });
const roles = useQuery({ queryKey: ['iam-roles'], queryFn: async () => (await api.get('/iam/roles')).data });
const activeOptions = computed(() => [
  { value: true, label: t('common.active') },
  { value: false, label: t('common.inactive') },
]);

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ email: '', fullName: '', phone: '', password: '', roleId: '', isActive: true });
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { email: r.email, fullName: r.fullName, phone: r.phone ?? '', password: '', roleId: r.roleId ?? '', isActive: r.isActive };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    if (editId.value) {
      return (await api.patch(`/iam/users/${editId.value}`, {
        fullName: form.value.fullName,
        phone: form.value.phone || undefined,
        password: form.value.password || undefined,
        roleId: form.value.roleId || undefined,
        isActive: form.value.isActive,
      })).data;
    }
    return (await api.post('/iam/users', {
      email: form.value.email,
      fullName: form.value.fullName,
      phone: form.value.phone || undefined,
      password: form.value.password,
      roleId: form.value.roleId,
    })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['iam-users'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>{{ t('users.title') }}</h2>
        <p class="sub">{{ t('users.business') }}: <strong>{{ auth.user?.companyName }}</strong> ({{ auth.user?.companyCode }})</p>
      </div>
      <Button v-if="auth.can('iam.write')" :label="t('users.new')" icon="pi pi-plus" @click="openCreate" />
    </div>

    <DataTable
      :value="users.data.value ?? []" :loading="users.isLoading.value"
      dataKey="id" rowHover scrollable size="small" stripedRows
      tableStyle="min-width: 42rem"
    >
      <template #empty><div class="empty-note">{{ t('users.empty') }}</div></template>
      <Column field="fullName" :header="t('common.name')" sortable style="min-width: 11rem"><template #body="{ data }"><strong>{{ data.fullName }}</strong></template></Column>
      <Column field="email" :header="t('common.email')" style="min-width: 12rem" />
      <Column field="phone" :header="t('common.phone')" style="min-width: 8rem"><template #body="{ data }">{{ data.phone ?? '-' }}</template></Column>
      <Column :header="t('users.role')" style="min-width: 8rem">
        <template #body="{ data }"><Tag :value="data.roleName ?? '-'" :severity="data.roleCode === 'ADMIN' ? 'success' : 'info'" /></template>
      </Column>
      <Column :header="t('common.status')" style="min-width: 6.5rem">
        <template #body="{ data }"><Tag :value="data.isActive ? t('common.active') : t('common.inactive')" :severity="data.isActive ? 'success' : 'danger'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="auth.can('iam.write')">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <h3 class="roles-title">{{ t('users.roles') }}</h3>
    <div class="role-cards">
      <div v-for="r in roles.data.value ?? []" :key="r.id" class="role-card">
        <div class="rc-head"><i class="pi pi-shield" /> <strong>{{ r.name }}</strong> <small>({{ r.code }})</small></div>
        <div class="rc-perms">
          <Tag v-for="p in r.permissions" :key="p" :value="p" severity="secondary" />
        </div>
      </div>
    </div>

    <Dialog v-model:visible="show" :header="editId ? t('users.edit') : t('users.new')" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <label>{{ t('users.fullName') }}</label>
        <InputText v-model="form.fullName" maxlength="80" fluid />
        <div class="row2">
          <div><label>{{ t('common.email') }}</label><InputText v-model="form.email" type="email" :disabled="!!editId" fluid /></div>
          <div><label>{{ t('common.phone') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.phone" maxlength="30" fluid /></div>
        </div>
        <div class="row2">
          <div>
            <label>{{ t('users.role') }}</label>
            <Select v-model="form.roleId" :options="roles.data.value ?? []" optionValue="id" :optionLabel="(r: any) => r.name" fluid />
          </div>
          <div v-if="editId">
            <label>{{ t('common.status') }}</label>
            <Select v-model="form.isActive" :options="activeOptions" optionValue="value" optionLabel="label" fluid />
          </div>
        </div>
        <label>{{ editId ? t('users.newPassword') : t('users.password') }}</label>
        <Password v-model="form.password" :feedback="false" toggleMask fluid autocomplete="new-password" />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.fullName || (!editId && (!form.email || form.password.length < 6 || !form.roleId))" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.sub { margin: 0.2rem 0 0; color: var(--app-text-muted); font-size: 0.85rem; }
.roles-title { margin: 1.2rem 0 0.6rem; }
.role-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.8rem; }
.role-card { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 0.8rem 0.9rem; }
.rc-head { display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.5rem; }
.rc-head .pi { color: var(--app-primary); }
.rc-head small { color: var(--app-text-muted); }
.rc-perms { display: flex; flex-wrap: wrap; gap: 0.3rem; }
</style>
