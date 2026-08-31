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
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty, fmtMoney, fmtDate, today } = useFmt();

const tab = ref<'produksi' | 'kesehatan'>('produksi');
const tabOptions = computed(() => [
  { value: 'produksi', label: t('ranch.production') },
  { value: 'kesehatan', label: t('ranch.health') },
]);

const production = useQuery({ queryKey: ['livestock-production'], queryFn: async () => (await api.get('/livestock-production')).data });
const health = useQuery({ queryKey: ['livestock-health'], queryFn: async () => (await api.get('/livestock-health')).data });
const livestock = useQuery({ queryKey: ['livestock'], queryFn: async () => (await api.get('/livestock')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const lands = useQuery({ queryKey: ['lands'], queryFn: async () => (await api.get('/lands')).data });
const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/warehouses')).data });

const pens = computed(() => (lands.data.value ?? []).filter((l: any) => l.landUse === 'kandang'));
const products = computed(() => (commodities.data.value ?? []).filter((c: any) => c.category === 'ternak'));
const canWrite = computed(() => auth.can('ranch.write'));

// ---- Produksi ----
const showProd = ref(false);
const prodForm = ref({ productionDate: today(), landId: '', livestockId: '', commodityId: '', qty: '', unit: 'kg', warehouseId: '' });
const saveProd = useMutation({
  mutationFn: async () =>
    (await api.post('/livestock-production', {
      productionDate: prodForm.value.productionDate,
      landId: prodForm.value.landId || undefined,
      livestockId: prodForm.value.livestockId || undefined,
      commodityId: prodForm.value.commodityId,
      qty: String(prodForm.value.qty),
      unit: prodForm.value.unit,
      warehouseId: prodForm.value.warehouseId || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('ranch.prodSaved'), detail: prodForm.value.warehouseId ? t('ranch.prodStock') : undefined, life: 2500 });
    showProd.value = false;
    prodForm.value = { productionDate: today(), landId: '', livestockId: '', commodityId: '', qty: '', unit: 'kg', warehouseId: '' };
    qc.invalidateQueries({ queryKey: ['livestock-production'] });
    qc.invalidateQueries({ queryKey: ['stock'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
function onProductChange() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === prodForm.value.commodityId);
  if (c) prodForm.value.unit = c.unit;
}

// ---- Kesehatan ----
const showHealth = ref(false);
const ACTIONS = ['vaksinasi', 'pengobatan', 'pemeriksaan', 'vitamin'];
const actionOptions = computed(() => ACTIONS.map((v) => ({ value: v, label: t(`enum.healthAction.${v}`) })));
const actionLabel = (v: string) => (ACTIONS.includes(v) ? t(`enum.healthAction.${v}`) : v);
const healthForm = ref({ healthDate: today(), livestockId: '', action: 'pemeriksaan', medicine: '', cost: '', nextDueDate: '', note: '' });
const saveHealth = useMutation({
  mutationFn: async () =>
    (await api.post('/livestock-health', {
      healthDate: healthForm.value.healthDate,
      livestockId: healthForm.value.livestockId,
      action: healthForm.value.action,
      medicine: healthForm.value.medicine || undefined,
      cost: healthForm.value.cost ? String(healthForm.value.cost) : undefined,
      nextDueDate: healthForm.value.nextDueDate || undefined,
      note: healthForm.value.note || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('ranch.healthSaved'), detail: Number(healthForm.value.cost) > 0 ? t('ranch.healthFinance') : undefined, life: 2500 });
    showHealth.value = false;
    healthForm.value = { healthDate: today(), livestockId: '', action: 'pemeriksaan', medicine: '', cost: '', nextDueDate: '', note: '' };
    qc.invalidateQueries({ queryKey: ['livestock-health'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('ranch.title') }}</h2>
      <div class="head-actions">
        <SelectButton v-model="tab" :options="tabOptions" optionValue="value" optionLabel="label" :allowEmpty="false" size="small" />
        <Button v-if="canWrite && tab === 'produksi'" :label="t('ranch.logProduction')" icon="pi pi-plus" @click="showProd = true" />
        <Button v-if="canWrite && tab === 'kesehatan'" :label="t('ranch.logHealth')" icon="pi pi-plus" @click="showHealth = true" />
      </div>
    </div>

    <DataTable
      v-if="tab === 'produksi'"
      :value="production.data.value ?? []" :loading="production.isLoading.value"
      dataKey="id" rowHover scrollable size="small" stripedRows removableSort
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 42rem"
    >
      <template #empty><div class="empty-note">{{ t('ranch.emptyProd') }}</div></template>
      <Column :header="t('common.date')" field="productionDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.productionDate) }}</template></Column>
      <Column field="commodityName" :header="t('ranch.product')" sortable style="min-width: 9rem" />
      <Column :header="t('common.qty')" style="min-width: 7rem"><template #body="{ data }"><strong>{{ fmtQty(data.qty) }}</strong> {{ data.unit }}</template></Column>
      <Column :header="t('ranch.source')" style="min-width: 10rem">
        <template #body="{ data }">{{ data.tag ?? data.penName ?? '-' }}</template>
      </Column>
      <Column :header="t('ranch.toWarehouse')" style="min-width: 6.5rem">
        <template #body="{ data }"><Tag v-if="data.warehouseId" :value="t('common.yes')" severity="success" /><span v-else>-</span></template>
      </Column>
      <Column field="note" :header="t('common.note')" style="min-width: 10rem"><template #body="{ data }">{{ data.note ?? '-' }}</template></Column>
    </DataTable>

    <DataTable
      v-else
      :value="health.data.value ?? []" :loading="health.isLoading.value"
      dataKey="id" rowHover scrollable size="small" stripedRows removableSort
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 44rem"
    >
      <template #empty><div class="empty-note">{{ t('ranch.emptyHealth') }}</div></template>
      <Column :header="t('common.date')" field="healthDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.healthDate) }}</template></Column>
      <Column field="tag" :header="t('ranch.animal')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.tag }}</strong></template></Column>
      <Column field="action" :header="t('ranch.action')" sortable style="min-width: 8rem">
        <template #body="{ data }"><Tag :value="actionLabel(data.action)" :severity="data.action === 'vaksinasi' ? 'info' : data.action === 'pengobatan' ? 'danger' : 'secondary'" /></template>
      </Column>
      <Column field="medicine" :header="t('ranch.medicine')" style="min-width: 9rem"><template #body="{ data }">{{ data.medicine ?? '-' }}</template></Column>
      <Column :header="t('common.cost')" style="min-width: 7rem"><template #body="{ data }">{{ Number(data.cost) > 0 ? fmtMoney(data.cost) : '-' }}</template></Column>
      <Column :header="t('ranch.nextDue')" field="nextDueDate" sortable style="min-width: 8rem"><template #body="{ data }">{{ fmtDate(data.nextDueDate) }}</template></Column>
    </DataTable>

    <!-- Dialog produksi -->
    <Dialog v-model:visible="showProd" :header="t('ranch.logProductionTitle')" modal :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.date') }}</label><InputText v-model="prodForm.productionDate" type="date" fluid /></div>
          <div>
            <label>{{ t('ranch.product') }}</label>
            <Select v-model="prodForm.commodityId" :options="products" optionValue="id" :optionLabel="(c: any) => c.name" :placeholder="t('ranch.productPh')" @change="onProductChange" fluid />
          </div>
        </div>
        <div class="row2">
          <div><label>{{ t('common.qtyUnit', { unit: prodForm.unit }) }}</label><InputText v-model="prodForm.qty" type="number" step="0.1" min="0" fluid /></div>
          <div>
            <label>{{ t('ranch.warehouseOpt') }} <small>({{ t('common.optional') }})</small></label>
            <Select v-model="prodForm.warehouseId" :options="warehouses.data.value ?? []" optionValue="id" showClear :optionLabel="(w: any) => w.name" fluid />
          </div>
        </div>
        <div class="row2">
          <div>
            <label>{{ t('ranch.fromPen') }} <small>({{ t('common.optional') }})</small></label>
            <Select v-model="prodForm.landId" :options="pens" optionValue="id" showClear :optionLabel="(l: any) => l.name" fluid />
          </div>
          <div>
            <label>{{ t('ranch.fromAnimal') }} <small>({{ t('common.optional') }})</small></label>
            <Select v-model="prodForm.livestockId" :options="livestock.data.value ?? []" optionValue="id" showClear filter :optionLabel="(a: any) => a.tag" fluid />
          </div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="showProd = false" />
        <Button :label="t('common.save')" :disabled="!prodForm.commodityId || !prodForm.qty" :loading="saveProd.isPending.value" @click="saveProd.mutate()" />
      </template>
    </Dialog>

    <!-- Dialog kesehatan -->
    <Dialog v-model:visible="showHealth" :header="t('ranch.logHealth')" modal :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.date') }}</label><InputText v-model="healthForm.healthDate" type="date" fluid /></div>
          <div>
            <label>{{ t('ranch.animal') }}</label>
            <Select v-model="healthForm.livestockId" :options="livestock.data.value ?? []" optionValue="id" filter :optionLabel="(a: any) => `${a.tag} (${a.commodityName ?? ''})`" :placeholder="t('common.pick')" fluid />
          </div>
        </div>
        <div class="row2">
          <div><label>{{ t('ranch.action') }}</label><Select v-model="healthForm.action" :options="actionOptions" optionValue="value" optionLabel="label" fluid /></div>
          <div><label>{{ t('ranch.medicine') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="healthForm.medicine" maxlength="120" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('common.costRp') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="healthForm.cost" type="number" min="0" fluid /></div>
          <div><label>{{ t('ranch.nextDueField') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="healthForm.nextDueDate" type="date" fluid /></div>
        </div>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="healthForm.note" maxlength="300" fluid />
        <small class="hintx"><i class="pi pi-microchip-ai" /> {{ t('ranch.nextDueHint') }}</small>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="showHealth = false" />
        <Button :label="t('common.save')" :disabled="!healthForm.livestockId" :loading="saveHealth.isPending.value" @click="saveHealth.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.hintx { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.3rem; }
</style>
