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
import Checkbox from 'primevue/checkbox';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import { intlLocale } from '@/i18n';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty, fmtDate } = useFmt();

const query = useQuery({ queryKey: ['export-shipments'], queryFn: async () => (await api.get('/export-shipments')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/warehouses')).data });

const FLOW = ['persiapan', 'dokumen', 'pengapalan', 'tiba', 'selesai'];
const statusSeverity: Record<string, string> = { persiapan: 'secondary', dokumen: 'warn', pengapalan: 'info', tiba: 'info', selesai: 'success' };
const statusLabel = (v: string) => (FLOW.includes(v) ? t(`enum.exportStatus.${v}`) : v);
const DOC_KEYS = ['invoice', 'packingList', 'coo', 'phytosanitary', 'billOfLading'];
const docsDone = (d: Record<string, boolean>) => Object.values(d ?? {}).filter(Boolean).length;

const canWrite = computed(() => auth.can('export.write'));
const fmtVal = (amount: unknown, currency: string) =>
  `${currency === 'IDR' ? 'Rp ' : `${currency} `}${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 }).format(Number(amount))}`;

// ---- Buat pengiriman ----
const show = ref(false);
const blank = () => ({
  commodityId: '', destinationCountry: '', destinationPort: '', buyerName: '',
  qty: '', unit: 'kg', valueAmount: '', currency: 'USD', etd: '', eta: '', warehouseId: '', note: '',
});
const form = ref(blank());
function onCommodityChange() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === form.value.commodityId);
  if (c) form.value.unit = c.unit;
}
const save = useMutation({
  mutationFn: async () =>
    (await api.post('/export-shipments', {
      commodityId: form.value.commodityId,
      destinationCountry: form.value.destinationCountry,
      destinationPort: form.value.destinationPort || undefined,
      buyerName: form.value.buyerName || undefined,
      qty: String(form.value.qty),
      unit: form.value.unit,
      valueAmount: String(form.value.valueAmount),
      currency: form.value.currency,
      etd: form.value.etd || undefined,
      eta: form.value.eta || undefined,
      warehouseId: form.value.warehouseId || undefined,
      note: form.value.note || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('export.created'), life: 2000 });
    show.value = false;
    form.value = blank();
    qc.invalidateQueries({ queryKey: ['export-shipments'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

// ---- Detail: dokumen + status ----
const detailRow = ref<any | null>(null);
const docsForm = ref<Record<string, boolean>>({});
function openDetail(r: any) {
  detailRow.value = r;
  docsForm.value = { ...r.docs };
}
const showDetail = computed({ get: () => !!detailRow.value, set: (v) => { if (!v) detailRow.value = null; } });
const nextStatus = computed(() => {
  const i = FLOW.indexOf(detailRow.value?.status);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
});

const update = useMutation({
  mutationFn: async (p: { docs?: Record<string, boolean>; status?: string }) =>
    (await api.patch(`/export-shipments/${detailRow.value.id}`, p)).data,
  onSuccess: (data, p) => {
    const extra = p.status === 'pengapalan' ? t('export.shippedStock') : undefined;
    toast.add({ severity: 'success', summary: t('msg.saved'), detail: extra, life: 2500 });
    detailRow.value = data;
    docsForm.value = { ...data.docs };
    qc.invalidateQueries({ queryKey: ['export-shipments'] });
    qc.invalidateQueries({ queryKey: ['stock'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('export.title') }}</h2>
      <Button v-if="canWrite" :label="t('export.new')" icon="pi pi-plus" @click="show = true" />
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 56rem"
    >
      <template #empty><div class="empty-note">{{ t('export.empty') }}</div></template>
      <Column field="code" :header="t('orders.no')" sortable style="min-width: 7rem">
        <template #body="{ data }"><a class="linkish" @click="openDetail(data)"><strong>{{ data.code }}</strong></a></template>
      </Column>
      <Column field="commodityName" :header="t('common.commodity')" style="min-width: 9rem" />
      <Column field="destinationCountry" :header="t('export.country')" sortable style="min-width: 9rem">
        <template #body="{ data }">{{ data.destinationCountry }}<small v-if="data.destinationPort"> · {{ data.destinationPort }}</small></template>
      </Column>
      <Column field="buyerName" :header="t('export.buyer')" style="min-width: 10rem"><template #body="{ data }">{{ data.buyerName ?? '-' }}</template></Column>
      <Column :header="t('export.volume')" style="min-width: 7rem"><template #body="{ data }">{{ fmtQty(data.qty) }} {{ data.unit }}</template></Column>
      <Column :header="t('export.value')" style="min-width: 8rem"><template #body="{ data }"><strong>{{ fmtVal(data.valueAmount, data.currency) }}</strong></template></Column>
      <Column header="ETD" field="etd" style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.etd) }}</template></Column>
      <Column :header="t('export.docs')" style="min-width: 6.5rem">
        <template #body="{ data }">
          <Tag :value="`${docsDone(data.docs)}/5`" :severity="docsDone(data.docs) === 5 ? 'success' : 'warn'" />
        </template>
      </Column>
      <Column :header="t('common.status')" field="status" sortable style="min-width: 7.5rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
    </DataTable>

    <!-- Buat -->
    <Dialog v-model:visible="show" :header="t('export.new')" modal :style="{ width: '540px' }">
      <div class="form-grid">
        <label>{{ t('common.commodity') }}</label>
        <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :optionLabel="(c: any) => c.name" :placeholder="t('common.pick')" @change="onCommodityChange" fluid />
        <div class="row2">
          <div><label>{{ t('export.country') }}</label><InputText v-model="form.destinationCountry" maxlength="60" :placeholder="t('export.countryPh')" fluid /></div>
          <div><label>{{ t('export.port') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.destinationPort" maxlength="60" :placeholder="t('export.portPh')" fluid /></div>
        </div>
        <label>{{ t('export.buyer') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.buyerName" maxlength="100" fluid />
        <div class="row3">
          <div><label>{{ t('deals.volumeUnit', { unit: form.unit }) }}</label><InputText v-model="form.qty" type="number" min="0" fluid /></div>
          <div><label>{{ t('export.value') }}</label><InputText v-model="form.valueAmount" type="number" min="0" fluid /></div>
          <div>
            <label>{{ t('export.currency') }}</label>
            <Select v-model="form.currency" :options="['USD', 'IDR', 'EUR', 'JPY', 'SGD', 'CNY'].map((c) => ({ value: c, label: c }))" optionValue="value" optionLabel="label" fluid />
          </div>
        </div>
        <div class="row2">
          <div><label>ETD <small>({{ t('common.optional') }})</small></label><InputText v-model="form.etd" type="date" fluid /></div>
          <div><label>ETA <small>({{ t('common.optional') }})</small></label><InputText v-model="form.eta" type="date" fluid /></div>
        </div>
        <label>{{ t('export.sourceWh') }} <small>({{ t('export.sourceWhHint') }})</small></label>
        <Select v-model="form.warehouseId" :options="warehouses.data.value ?? []" optionValue="id" showClear :optionLabel="(w: any) => `${w.code} — ${w.name}`" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.commodityId || !form.destinationCountry || !form.qty || !form.valueAmount" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>

    <!-- Detail dokumen & status -->
    <Dialog v-model:visible="showDetail" modal :style="{ width: '480px' }" :header="detailRow ? `${detailRow.code} → ${detailRow.destinationCountry}` : ''">
      <div v-if="detailRow" class="form-grid">
        <div class="exp-status">
          <span v-for="(s, i) in FLOW" :key="s" class="exp-step" :class="{ done: FLOW.indexOf(detailRow.status) >= i, cur: detailRow.status === s }">
            {{ statusLabel(s) }}<i v-if="i < FLOW.length - 1" class="pi pi-angle-right" />
          </span>
        </div>

        <label>{{ t('export.docsTitle') }}</label>
        <div class="doc-list">
          <label v-for="k in DOC_KEYS" :key="k" class="doc-item">
            <Checkbox v-model="docsForm[k]" binary :disabled="!canWrite" />
            <span>{{ t(`export.doc.${k}`) }}</span>
          </label>
        </div>

        <div class="stage-actions" v-if="canWrite">
          <Button :label="t('export.saveDocs')" icon="pi pi-save" size="small" outlined :loading="update.isPending.value" @click="update.mutate({ docs: docsForm })" />
          <Button
            v-if="nextStatus"
            :label="t('export.next', { status: statusLabel(nextStatus) })"
            icon="pi pi-angle-double-right"
            size="small"
            :loading="update.isPending.value"
            @click="update.mutate({ status: nextStatus! })"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.linkish { cursor: pointer; color: var(--app-primary); text-decoration: none; }
.linkish:hover { text-decoration: underline; }
.doc-list { display: flex; flex-direction: column; gap: 0.45rem; }
.doc-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; cursor: pointer; }
.stage-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.6rem; }
.exp-status { display: flex; flex-wrap: wrap; gap: 0.25rem; font-size: 0.75rem; margin-bottom: 0.4rem; }
.exp-step { color: var(--app-text-muted); display: inline-flex; align-items: center; gap: 0.25rem; }
.exp-step .pi { font-size: 0.6rem; }
.exp-step.done { color: var(--app-primary); font-weight: 600; }
.exp-step.cur { text-decoration: underline; }
</style>
