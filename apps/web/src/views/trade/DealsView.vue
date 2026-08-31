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
const { fmtQty, fmtMoney, fmtDate, today } = useFmt();

const query = useQuery({ queryKey: ['deals'], queryFn: async () => (await api.get('/deals')).data });
const partners = useQuery({ queryKey: ['partners'], queryFn: async () => (await api.get('/partners')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });

const statusSeverity: Record<string, string> = {
  draf: 'secondary', negosiasi: 'warn', kontrak: 'info', berjalan: 'info', selesai: 'success', batal: 'danger',
};
const statusFlow = ['draf', 'negosiasi', 'kontrak', 'berjalan', 'selesai'];
const statusLabel = (v: string) => ([...statusFlow, 'batal'].includes(v) ? t(`enum.dealStatus.${v}`) : v);
const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });
const canWrite = computed(() => auth.can('trade.write'));

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ partnerId: '', commodityId: '', qty: '', unit: 'kg', pricePerUnit: '', deliveryTerms: '', startDate: today(), endDate: '', status: 'draf', note: '' });
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = { partnerId: r.partnerId, commodityId: r.commodityId, qty: r.qty, unit: r.unit, pricePerUnit: r.pricePerUnit, deliveryTerms: r.deliveryTerms ?? '', startDate: r.startDate, endDate: r.endDate ?? '', status: r.status, note: r.note ?? '' };
  show.value = true;
}
function onCommodityChange() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === form.value.commodityId);
  if (c) form.value.unit = c.unit;
}
const totalValue = computed(() => Number(form.value.qty || 0) * Number(form.value.pricePerUnit || 0));
/** Pilihan status yang boleh dipilih saat edit (maju satu-satu atau batal). */
const statusOptions = computed(() => {
  const cur = statusFlow.indexOf(form.value.status);
  const opts = statusFlow.map((s, i) => ({ value: s, label: statusLabel(s), disabled: i < cur }));
  return [...opts, { value: 'batal', label: statusLabel('batal'), disabled: false }];
});

const save = useMutation({
  mutationFn: async () => {
    if (editId.value) {
      return (await api.patch(`/deals/${editId.value}`, {
        qty: String(form.value.qty),
        pricePerUnit: String(form.value.pricePerUnit),
        deliveryTerms: form.value.deliveryTerms || undefined,
        endDate: form.value.endDate || undefined,
        status: form.value.status,
        note: form.value.note || undefined,
      })).data;
    }
    return (await api.post('/deals', {
      partnerId: form.value.partnerId,
      commodityId: form.value.commodityId,
      qty: String(form.value.qty),
      unit: form.value.unit,
      pricePerUnit: String(form.value.pricePerUnit),
      deliveryTerms: form.value.deliveryTerms || undefined,
      startDate: form.value.startDate,
      endDate: form.value.endDate || undefined,
      note: form.value.note || undefined,
    })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('deals.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('deals.searchPh')" />
        </span>
        <Button v-if="canWrite" :label="t('deals.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'partnerName', 'commodityName']"
      tableStyle="min-width: 56rem"
    >
      <template #empty><div class="empty-note">{{ t('deals.empty') }}</div></template>
      <Column field="code" :header="t('orders.no')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column field="partnerName" :header="t('deals.partner')" sortable style="min-width: 12rem" />
      <Column field="commodityName" :header="t('common.commodity')" style="min-width: 9rem" />
      <Column :header="t('deals.volume')" style="min-width: 8rem"><template #body="{ data }">{{ fmtQty(data.qty) }} {{ data.unit }}</template></Column>
      <Column :header="t('deals.value')" sortable field="totalValue" style="min-width: 10rem"><template #body="{ data }"><strong>{{ fmtMoney(data.totalValue) }}</strong></template></Column>
      <Column :header="t('deals.period')" style="min-width: 11rem">
        <template #body="{ data }">{{ fmtDate(data.startDate) }} — {{ fmtDate(data.endDate) }}</template>
      </Column>
      <Column :header="t('common.status')" field="status" sortable style="min-width: 7rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="canWrite">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text :disabled="['selesai', 'batal'].includes(data.status)" @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="editId ? t('deals.edit') : t('deals.new')" modal :style="{ width: '520px' }">
      <div class="form-grid">
        <label>{{ t('deals.partner') }}</label>
        <Select v-model="form.partnerId" :options="partners.data.value ?? []" optionValue="id" filter :disabled="!!editId" :optionLabel="(p: any) => `${p.code} — ${p.name}`" :placeholder="t('common.pick')" fluid />
        <label>{{ t('common.commodity') }}</label>
        <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :disabled="!!editId" :optionLabel="(c: any) => c.name" :placeholder="t('common.pick')" @change="onCommodityChange" fluid />
        <div class="row2">
          <div><label>{{ t('deals.volumeUnit', { unit: form.unit }) }}</label><InputText v-model="form.qty" type="number" min="0" fluid /></div>
          <div><label>{{ t('common.pricePerUnit', { unit: form.unit }) }}</label><InputText v-model="form.pricePerUnit" type="number" min="0" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('common.start') }}</label><InputText v-model="form.startDate" type="date" :disabled="!!editId" fluid /></div>
          <div><label>{{ t('common.end') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.endDate" type="date" fluid /></div>
        </div>
        <label>{{ t('deals.terms') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.deliveryTerms" maxlength="120" :placeholder="t('deals.termsPh')" fluid />
        <div v-if="editId">
          <label>{{ t('common.status') }}</label>
          <Select v-model="form.status" :options="statusOptions" optionValue="value" optionLabel="label" optionDisabled="disabled" fluid />
          <small v-if="form.status === 'selesai'" class="hintx"><i class="pi pi-link" /> {{ t('deals.doneHint') }}</small>
        </div>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.note" maxlength="300" fluid />
        <div class="total-line">{{ t('deals.contractValue') }}: <strong>{{ fmtMoney(totalValue) }}</strong></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="(!editId && (!form.partnerId || !form.commodityId)) || !form.qty || !form.pricePerUnit" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.total-line {
  margin-top: 0.5rem; padding: 0.5rem 0.7rem; border-radius: 8px;
  background: color-mix(in srgb, var(--app-primary) 10%, transparent);
  font-size: 0.9rem;
}
.hintx { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.3rem; }
</style>
