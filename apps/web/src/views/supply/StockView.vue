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
const { fmtQty, fmtDate, today } = useFmt();

const tab = ref<'saldo' | 'kartu'>('saldo');
const tabOptions = computed(() => [
  { value: 'saldo', label: t('stock.balances') },
  { value: 'kartu', label: t('stock.card') },
]);

const balances = useQuery({ queryKey: ['stock'], queryFn: async () => (await api.get('/stock')).data });
const movements = useQuery({ queryKey: ['stock-movements'], queryFn: async () => (await api.get('/stock/movements')).data });
const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/warehouses')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const cycles = useQuery({ queryKey: ['cycles', 'all'], queryFn: async () => (await api.get('/cycles')).data });

const canWrite = computed(() => auth.can('supply.write'));
const refSeverity: Record<string, string> = {
  panen: 'success', produksi_ternak: 'success', pesanan: 'info', ekspor: 'warn', kirim: 'info', penyesuaian: 'secondary',
};
const REFS = ['panen', 'produksi_ternak', 'pesanan', 'ekspor', 'kirim', 'penyesuaian'];
const refLabel = (v: string) => (REFS.includes(v) ? t(`enum.movementRef.${v}`) : v);
const CATS = ['pangan', 'hortikultura', 'perkebunan', 'ternak', 'perikanan', 'olahan'];
const catLabel = (v: string | null) => (v && CATS.includes(v) ? t(`enum.commodityCat.${v}`) : '-');
const directionOptions = computed(() => ['masuk', 'keluar'].map((v) => ({ value: v, label: t(`enum.direction.${v}`) })));

// ---- Gudang baru ----
const showWh = ref(false);
const whForm = ref({ code: '', name: '', address: '', capacityKg: '' });
const saveWh = useMutation({
  mutationFn: async () =>
    (await api.post('/warehouses', {
      code: whForm.value.code,
      name: whForm.value.name,
      address: whForm.value.address || undefined,
      capacityKg: whForm.value.capacityKg ? String(whForm.value.capacityKg) : undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('stock.whSaved'), life: 2000 });
    showWh.value = false;
    whForm.value = { code: '', name: '', address: '', capacityKg: '' };
    qc.invalidateQueries({ queryKey: ['warehouses'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

// ---- Penyesuaian stok ----
const showAdj = ref(false);
const adjForm = ref({ warehouseId: '', commodityId: '', direction: 'masuk', qty: '', unit: 'kg', movementDate: today(), cycleId: '', note: '' });
/** Stok masuk WAJIB menyebut siklus asal (ketertelusuran). */
const adjNeedsCycle = computed(() => adjForm.value.direction === 'masuk');
function onAdjCommodity() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === adjForm.value.commodityId);
  if (c) adjForm.value.unit = c.unit;
}
const saveAdj = useMutation({
  mutationFn: async () =>
    (await api.post('/stock/adjust', {
      warehouseId: adjForm.value.warehouseId,
      commodityId: adjForm.value.commodityId,
      direction: adjForm.value.direction,
      qty: String(adjForm.value.qty),
      unit: adjForm.value.unit,
      movementDate: adjForm.value.movementDate,
      cycleId: adjNeedsCycle.value ? adjForm.value.cycleId || undefined : undefined,
      note: adjForm.value.note || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('stock.adjusted'), life: 2000 });
    showAdj.value = false;
    adjForm.value = { warehouseId: '', commodityId: '', direction: 'masuk', qty: '', unit: 'kg', movementDate: today(), cycleId: '', note: '' };
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['stock-movements'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('stock.title') }}</h2>
      <div class="head-actions">
        <SelectButton v-model="tab" :options="tabOptions" optionValue="value" optionLabel="label" :allowEmpty="false" size="small" />
        <Button v-if="canWrite" :label="t('stock.addWh')" icon="pi pi-plus" outlined size="small" @click="showWh = true" />
        <Button v-if="canWrite" :label="t('stock.adjust')" icon="pi pi-sliders-h" size="small" @click="showAdj = true" />
      </div>
    </div>

    <!-- Ringkasan gudang -->
    <div class="cards-grid wh-cards">
      <div v-for="w in warehouses.data.value ?? []" :key="w.id" class="kpi-card">
        <i class="pi pi-warehouse" />
        <div class="meta">
          <span class="t">{{ w.code }}{{ w.address ? ` · ${w.address}` : '' }}</span>
          <span class="v">{{ w.name }}</span>
          <span class="t" v-if="w.capacityKg">{{ t('stock.capacity', { n: fmtQty(w.capacityKg) }) }}</span>
        </div>
      </div>
    </div>

    <DataTable
      v-if="tab === 'saldo'"
      :value="balances.data.value ?? []" :loading="balances.isLoading.value"
      dataKey="id" rowHover scrollable size="small" stripedRows removableSort
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 40rem"
    >
      <template #empty><div class="empty-note">{{ t('stock.emptyBal') }}</div></template>
      <Column field="warehouseCode" :header="t('common.warehouse')" sortable style="min-width: 8rem">
        <template #body="{ data }"><strong>{{ data.warehouseCode }}</strong> <small>{{ data.warehouseName }}</small></template>
      </Column>
      <Column field="commodityName" :header="t('common.commodity')" sortable style="min-width: 11rem" />
      <Column :header="t('common.qty')" sortable field="qty" style="min-width: 8rem">
        <template #body="{ data }"><strong>{{ fmtQty(data.qty) }}</strong> {{ data.unit }}</template>
      </Column>
      <Column :header="t('common.category')" style="min-width: 8rem"><template #body="{ data }">{{ catLabel(data.commodityCategory) }}</template></Column>
    </DataTable>

    <DataTable
      v-else
      :value="movements.data.value ?? []" :loading="movements.isLoading.value"
      dataKey="id" rowHover scrollable size="small" stripedRows removableSort
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 48rem"
    >
      <template #empty><div class="empty-note">{{ t('stock.emptyMov') }}</div></template>
      <Column :header="t('common.date')" field="movementDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.movementDate) }}</template></Column>
      <Column field="warehouseName" :header="t('common.warehouse')" style="min-width: 8rem" />
      <Column field="commodityName" :header="t('common.commodity')" style="min-width: 10rem" />
      <Column :header="t('stock.movement')" style="min-width: 8rem">
        <template #body="{ data }">
          <span :class="data.direction === 'masuk' ? 'in-txt' : 'out-txt'">
            <i class="pi" :class="data.direction === 'masuk' ? 'pi-arrow-down-left' : 'pi-arrow-up-right'" />
            {{ data.direction === 'masuk' ? '+' : '−' }}{{ fmtQty(data.qty) }} {{ data.unit }}
          </span>
        </template>
      </Column>
      <Column :header="t('common.source')" field="refType" style="min-width: 8rem">
        <template #body="{ data }"><Tag :value="refLabel(data.refType)" :severity="refSeverity[data.refType] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('stock.originCycle')" field="cycleCode" style="min-width: 7.5rem">
        <template #body="{ data }"><strong v-if="data.cycleCode">{{ data.cycleCode }}</strong><span v-else>-</span></template>
      </Column>
      <Column field="note" :header="t('common.note')" style="min-width: 12rem"><template #body="{ data }">{{ data.note ?? '-' }}</template></Column>
    </DataTable>

    <!-- Dialog gudang -->
    <Dialog v-model:visible="showWh" :header="t('stock.whNew')" modal :style="{ width: '440px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.code') }}</label><InputText v-model="whForm.code" maxlength="20" placeholder="GDG-03" fluid /></div>
          <div><label>{{ t('stock.capacityKg') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="whForm.capacityKg" type="number" min="0" fluid /></div>
        </div>
        <label>{{ t('common.name') }}</label>
        <InputText v-model="whForm.name" maxlength="80" fluid />
        <label>{{ t('common.address') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="whForm.address" maxlength="200" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="showWh = false" />
        <Button :label="t('common.save')" :disabled="!whForm.code || !whForm.name" :loading="saveWh.isPending.value" @click="saveWh.mutate()" />
      </template>
    </Dialog>

    <!-- Dialog penyesuaian -->
    <Dialog v-model:visible="showAdj" :header="t('stock.adjustTitle')" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <label>{{ t('common.warehouse') }}</label>
        <Select v-model="adjForm.warehouseId" :options="warehouses.data.value ?? []" optionValue="id" :optionLabel="(w: any) => `${w.code} — ${w.name}`" :placeholder="t('common.pick')" fluid />
        <label>{{ t('common.commodity') }}</label>
        <Select v-model="adjForm.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :optionLabel="(c: any) => c.name" :placeholder="t('common.pick')" @change="onAdjCommodity" fluid />
        <div class="row3">
          <div>
            <label>{{ t('stock.direction') }}</label>
            <Select v-model="adjForm.direction" :options="directionOptions" optionValue="value" optionLabel="label" fluid />
          </div>
          <div><label>{{ t('common.qtyUnit', { unit: adjForm.unit }) }}</label><InputText v-model="adjForm.qty" type="number" min="0" fluid /></div>
          <div><label>{{ t('common.date') }}</label><InputText v-model="adjForm.movementDate" type="date" fluid /></div>
        </div>
        <template v-if="adjNeedsCycle">
          <label>{{ t('stock.originCycle') }} <span class="req">*</span></label>
          <Select
            v-model="adjForm.cycleId"
            :options="cycles.data.value ?? []"
            optionValue="id"
            filter
            :optionLabel="(c: any) => `${c.code} — ${c.name}`"
            :placeholder="t('common.pick')"
            fluid
          />
          <small class="cycle-hint"><i class="pi pi-sitemap" /> {{ t('stock.originCycleHint') }}</small>
        </template>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="adjForm.note" maxlength="300" :placeholder="t('stock.notePh')" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="showAdj = false" />
        <Button
          :label="t('common.save')"
          :disabled="!adjForm.warehouseId || !adjForm.commodityId || !adjForm.qty || (adjNeedsCycle && !adjForm.cycleId)"
          :loading="saveAdj.isPending.value"
          @click="saveAdj.mutate()"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.wh-cards { margin-bottom: 1rem; }
.in-txt { color: var(--app-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; }
.out-txt { color: var(--app-danger); font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; }
.in-txt .pi, .out-txt .pi { font-size: 0.7rem; }
.req { color: var(--app-danger); font-weight: 700; }
.cycle-hint { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.2rem; font-size: 0.74rem; }
</style>
