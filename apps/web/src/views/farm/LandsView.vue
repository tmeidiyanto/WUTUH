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

const query = useQuery({ queryKey: ['lands'], queryFn: async () => (await api.get('/lands')).data });

const USES = ['sawah', 'ladang', 'kebun', 'kandang', 'tambak', 'pekarangan'];
const useOptions = computed(() => USES.map((v) => ({ value: v, label: t(`enum.landUse.${v}`) })));
const useLabel = (v: string) => (USES.includes(v) ? t(`enum.landUse.${v}`) : v);
const useSeverity: Record<string, string> = {
  sawah: 'success', ladang: 'info', kebun: 'success', kandang: 'warn', tambak: 'info', pekarangan: 'secondary',
};

const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ code: '', name: '', landUse: 'sawah', areaHa: '0', village: '', soilType: '', irrigation: '' });
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { code: r.code, name: r.name, landUse: r.landUse, areaHa: r.areaHa, village: r.village ?? '', soilType: r.soilType ?? '', irrigation: r.irrigation ?? '' };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    const payload = {
      name: form.value.name,
      landUse: form.value.landUse,
      areaHa: String(form.value.areaHa || 0),
      village: form.value.village || undefined,
      soilType: form.value.soilType || undefined,
      irrigation: form.value.irrigation || undefined,
    };
    return editId.value
      ? (await api.patch(`/lands/${editId.value}`, payload)).data
      : (await api.post('/lands', { code: form.value.code, ...payload })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['lands'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('lands.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('lands.searchPh')" />
        </span>
        <Button v-if="auth.can('master.write')" :label="t('lands.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []"
      :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'name', 'village']"
      tableStyle="min-width: 46rem"
    >
      <template #empty><div class="empty-note">{{ t('lands.empty') }}</div></template>
      <Column field="code" :header="t('common.code')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column field="name" :header="t('common.name')" sortable style="min-width: 12rem" />
      <Column :header="t('common.type')" sortable field="landUse" style="min-width: 8rem">
        <template #body="{ data }"><Tag :value="useLabel(data.landUse)" :severity="useSeverity[data.landUse] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.area')" sortable field="areaHa" style="min-width: 7rem"><template #body="{ data }">{{ fmtQty(data.areaHa) }}</template></Column>
      <Column field="village" :header="t('lands.village')" style="min-width: 10rem"><template #body="{ data }">{{ data.village ?? '-' }}</template></Column>
      <Column field="irrigation" :header="t('lands.irrigation')" style="min-width: 8rem"><template #body="{ data }">{{ data.irrigation ?? '-' }}</template></Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="auth.can('master.write')">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="editId ? t('lands.edit') : t('lands.new')" modal :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.code') }}</label><InputText v-model="form.code" :disabled="!!editId" maxlength="20" placeholder="LHN-A" fluid /></div>
          <div><label>{{ t('common.type') }}</label><Select v-model="form.landUse" :options="useOptions" optionValue="value" optionLabel="label" fluid /></div>
        </div>
        <label>{{ t('common.name') }}</label>
        <InputText v-model="form.name" maxlength="80" fluid />
        <div class="row2">
          <div><label>{{ t('common.area') }}</label><InputText v-model="form.areaHa" type="number" step="0.01" min="0" fluid /></div>
          <div><label>{{ t('lands.village') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.village" maxlength="80" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('lands.soilType') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.soilType" maxlength="40" fluid /></div>
          <div><label>{{ t('lands.irrigation') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.irrigation" maxlength="40" fluid /></div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.code || !form.name" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>
