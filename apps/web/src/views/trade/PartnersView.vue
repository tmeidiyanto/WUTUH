<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();

const query = useQuery({ queryKey: ['partners'], queryFn: async () => (await api.get('/partners')).data });

const TYPES = ['pembeli', 'pemasok', 'eksportir', 'koperasi', 'pengolah'];
const typeOptions = computed(() => TYPES.map((v) => ({ value: v, label: t(`enum.partnerType.${v}`) })));
const typeLabel = (v: string) => (TYPES.includes(v) ? t(`enum.partnerType.${v}`) : v);
const typeSeverity: Record<string, string> = { pembeli: 'success', pemasok: 'info', eksportir: 'warn', koperasi: 'info', pengolah: 'secondary' };

const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ code: '', name: '', partnerType: 'pembeli', contactName: '', phone: '', email: '', city: '', note: '' });
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { code: r.code, name: r.name, partnerType: r.partnerType, contactName: r.contactName ?? '', phone: r.phone ?? '', email: r.email ?? '', city: r.city ?? '', note: r.note ?? '' };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    const payload = {
      name: form.value.name,
      partnerType: form.value.partnerType,
      contactName: form.value.contactName || undefined,
      phone: form.value.phone || undefined,
      email: form.value.email || undefined,
      city: form.value.city || undefined,
      note: form.value.note || undefined,
    };
    return editId.value
      ? (await api.patch(`/partners/${editId.value}`, payload)).data
      : (await api.post('/partners', { code: form.value.code, ...payload })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['partners'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('partners.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('partners.searchPh')" />
        </span>
        <Button v-if="auth.can('trade.write')" :label="t('partners.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'name', 'city', 'contactName']"
      tableStyle="min-width: 48rem"
    >
      <template #empty><div class="empty-note">{{ t('partners.empty') }}</div></template>
      <Column field="code" :header="t('common.code')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column field="name" :header="t('common.name')" sortable style="min-width: 13rem" />
      <Column :header="t('common.type')" field="partnerType" sortable style="min-width: 7.5rem">
        <template #body="{ data }"><Tag :value="typeLabel(data.partnerType)" :severity="typeSeverity[data.partnerType] ?? 'secondary'" /></template>
      </Column>
      <Column field="contactName" :header="t('partners.contact')" style="min-width: 9rem"><template #body="{ data }">{{ data.contactName ?? '-' }}</template></Column>
      <Column field="phone" :header="t('partners.phone')" style="min-width: 8rem"><template #body="{ data }">{{ data.phone ?? '-' }}</template></Column>
      <Column field="city" :header="t('partners.city')" style="min-width: 7rem"><template #body="{ data }">{{ data.city ?? '-' }}</template></Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="auth.can('trade.write')">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="editId ? t('partners.edit') : t('partners.new')" modal :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.code') }}</label><InputText v-model="form.code" :disabled="!!editId" maxlength="20" placeholder="MTR-004" fluid /></div>
          <div><label>{{ t('common.type') }}</label><Select v-model="form.partnerType" :options="typeOptions" optionValue="value" optionLabel="label" fluid /></div>
        </div>
        <label>{{ t('partners.partnerName') }}</label>
        <InputText v-model="form.name" maxlength="100" :placeholder="t('partners.namePh')" fluid />
        <div class="row2">
          <div><label>{{ t('partners.contactName') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.contactName" maxlength="80" fluid /></div>
          <div><label>{{ t('partners.phone') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.phone" maxlength="30" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('common.email') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.email" type="email" fluid /></div>
          <div><label>{{ t('partners.city') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.city" maxlength="60" fluid /></div>
        </div>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.note" maxlength="300" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.code || !form.name" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>
