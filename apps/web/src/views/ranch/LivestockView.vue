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
const { fmtQty, fmtDate } = useFmt();

const query = useQuery({ queryKey: ['livestock'], queryFn: async () => (await api.get('/livestock')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const lands = useQuery({ queryKey: ['lands'], queryFn: async () => (await api.get('/lands')).data });

const pens = computed(() => (lands.data.value ?? []).filter((l: any) => l.landUse === 'kandang'));
const animalCommodities = computed(() => (commodities.data.value ?? []).filter((c: any) => c.category === 'ternak'));

const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });
const statusSeverity: Record<string, string> = { sehat: 'success', sakit: 'danger', bunting: 'info', dijual: 'secondary', mati: 'contrast' };
const STATUSES = ['sehat', 'sakit', 'bunting', 'dijual', 'mati'];
const statusOptions = computed(() => STATUSES.map((v) => ({ value: v, label: t(`enum.livestockStatus.${v}`) })));
const statusLabel = (v: string) => (STATUSES.includes(v) ? t(`enum.livestockStatus.${v}`) : v);
const sexOptions = computed(() => ['jantan', 'betina'].map((v) => ({ value: v, label: t(`enum.sex.${v}`) })));
const sexLabel = (v: string) => (['jantan', 'betina'].includes(v) ? t(`enum.sex.${v}`) : v);

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ tag: '', commodityId: '', landId: '', sex: 'betina', birthDate: '', weightKg: '', status: 'sehat', note: '' });
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { tag: r.tag, commodityId: r.commodityId, landId: r.landId ?? '', sex: r.sex, birthDate: r.birthDate ?? '', weightKg: r.weightKg ?? '', status: r.status, note: r.note ?? '' };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    if (editId.value) {
      return (await api.patch(`/livestock/${editId.value}`, {
        landId: form.value.landId || undefined,
        weightKg: form.value.weightKg ? String(form.value.weightKg) : undefined,
        status: form.value.status,
        note: form.value.note || undefined,
      })).data;
    }
    return (await api.post('/livestock', {
      tag: form.value.tag,
      commodityId: form.value.commodityId,
      landId: form.value.landId || undefined,
      sex: form.value.sex,
      birthDate: form.value.birthDate || undefined,
      weightKg: form.value.weightKg ? String(form.value.weightKg) : undefined,
      note: form.value.note || undefined,
    })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['livestock'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('livestock.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('livestock.searchPh')" />
        </span>
        <Button v-if="auth.can('ranch.write')" :label="t('livestock.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['tag', 'commodityName', 'penName']"
      tableStyle="min-width: 48rem"
    >
      <template #empty><div class="empty-note">{{ t('livestock.empty') }}</div></template>
      <Column field="tag" :header="t('livestock.tag')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.tag }}</strong></template></Column>
      <Column field="commodityName" :header="t('livestock.species')" sortable style="min-width: 9rem" />
      <Column field="penName" :header="t('livestock.pen')" style="min-width: 9rem"><template #body="{ data }">{{ data.penName ?? '-' }}</template></Column>
      <Column field="sex" :header="t('livestock.sex')" style="min-width: 6rem"><template #body="{ data }">{{ sexLabel(data.sex) }}</template></Column>
      <Column :header="t('livestock.birth')" field="birthDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.birthDate) }}</template></Column>
      <Column :header="t('livestock.weight')" field="weightKg" sortable style="min-width: 6.5rem"><template #body="{ data }">{{ fmtQty(data.weightKg) }}</template></Column>
      <Column :header="t('common.status')" field="status" sortable style="min-width: 6.5rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="auth.can('ranch.write')">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="editId ? t('livestock.edit') : t('livestock.new')" modal :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('livestock.tagField') }}</label><InputText v-model="form.tag" :disabled="!!editId" maxlength="30" placeholder="SP-009" fluid /></div>
          <div>
            <label>{{ t('livestock.speciesField') }}</label>
            <Select v-model="form.commodityId" :options="animalCommodities" optionValue="id" :disabled="!!editId" :optionLabel="(c: any) => c.name" :placeholder="t('common.pick')" fluid />
          </div>
        </div>
        <div class="row2">
          <div>
            <label>{{ t('livestock.pen') }} <small>({{ t('common.optional') }})</small></label>
            <Select v-model="form.landId" :options="pens" optionValue="id" showClear :optionLabel="(l: any) => l.name" fluid />
          </div>
          <div>
            <label>{{ t('livestock.sex') }}</label>
            <Select v-model="form.sex" :options="sexOptions" optionValue="value" optionLabel="label" :disabled="!!editId" fluid />
          </div>
        </div>
        <div class="row2">
          <div><label>{{ t('livestock.birthDate') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.birthDate" type="date" :disabled="!!editId" fluid /></div>
          <div><label>{{ t('livestock.weight') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.weightKg" type="number" step="0.1" min="0" fluid /></div>
        </div>
        <div class="row2" v-if="editId">
          <div><label>{{ t('common.status') }}</label><Select v-model="form.status" :options="statusOptions" optionValue="value" optionLabel="label" fluid /></div>
        </div>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.note" maxlength="300" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!editId && (!form.tag || !form.commodityId)" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>
