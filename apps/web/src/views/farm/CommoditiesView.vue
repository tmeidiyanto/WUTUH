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
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty } = useFmt();

const query = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });

const CATS = ['pangan', 'hortikultura', 'perkebunan', 'ternak', 'perikanan', 'olahan'];
const catOptions = computed(() => CATS.map((v) => ({ value: v, label: t(`enum.commodityCat.${v}`) })));
const unitOptions = ['kg', 'ton', 'ekor', 'liter', 'butir', 'ikat', 'karung'].map((u) => ({ value: u, label: u }));
const catLabel = (v: string) => (CATS.includes(v) ? t(`enum.commodityCat.${v}`) : v);
const catSeverity: Record<string, string> = {
  pangan: 'success', hortikultura: 'info', perkebunan: 'warn', ternak: 'danger', perikanan: 'info', olahan: 'secondary',
};

const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ code: '', name: '', category: 'pangan', unit: 'kg', avgYieldPerHa: '' });
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { code: r.code, name: r.name, category: r.category, unit: r.unit, avgYieldPerHa: r.avgYieldPerHa ?? '' };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    const payload = {
      name: form.value.name,
      category: form.value.category,
      unit: form.value.unit,
      avgYieldPerHa: form.value.avgYieldPerHa ? String(form.value.avgYieldPerHa) : undefined,
    };
    return editId.value
      ? (await api.patch(`/commodities/${editId.value}`, payload)).data
      : (await api.post('/commodities', { code: form.value.code, ...payload })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['commodities'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('commodities.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('commodities.searchPh')" />
        </span>
        <Button v-if="auth.can('master.write')" :label="t('commodities.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []"
      :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'name']"
      tableStyle="min-width: 42rem"
    >
      <template #empty><div class="empty-note">{{ t('commodities.empty') }}</div></template>
      <Column field="code" :header="t('common.code')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column field="name" :header="t('common.name')" sortable style="min-width: 12rem" />
      <Column :header="t('common.category')" field="category" sortable style="min-width: 9rem">
        <template #body="{ data }"><Tag :value="catLabel(data.category)" :severity="catSeverity[data.category] ?? 'secondary'" /></template>
      </Column>
      <Column field="unit" :header="t('common.unit')" style="min-width: 6rem" />
      <Column :header="t('commodities.avgYield')" style="min-width: 8rem">
        <template #body="{ data }">{{ data.avgYieldPerHa ? `${fmtQty(data.avgYieldPerHa)} ${data.unit}` : '-' }}</template>
      </Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="auth.can('master.write')">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="editId ? t('commodities.edit') : t('commodities.new')" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.code') }}</label><InputText v-model="form.code" :disabled="!!editId" maxlength="20" placeholder="PADI" fluid /></div>
          <div><label>{{ t('common.unit') }}</label><Select v-model="form.unit" :options="unitOptions" optionValue="value" optionLabel="label" fluid /></div>
        </div>
        <label>{{ t('common.name') }}</label>
        <InputText v-model="form.name" maxlength="80" fluid />
        <div class="row2">
          <div><label>{{ t('common.category') }}</label><Select v-model="form.category" :options="catOptions" optionValue="value" optionLabel="label" fluid /></div>
          <div><label>{{ t('commodities.avgYield') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.avgYieldPerHa" type="number" min="0" fluid /></div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.code || !form.name" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>
