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

const query = useQuery({ queryKey: ['deliveries'], queryFn: async () => (await api.get('/deliveries')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });

const FLOW = ['dijadwalkan', 'dimuat', 'perjalanan', 'tiba', 'selesai'];
const statusSeverity: Record<string, string> = { dijadwalkan: 'secondary', dimuat: 'warn', perjalanan: 'info', tiba: 'info', selesai: 'success' };
const statusLabel = (v: string) => (FLOW.includes(v) ? t(`enum.deliveryStatus.${v}`) : v);
const canWrite = computed(() => auth.can('supply.write'));
const nextOf = (s: string) => {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
};

const setStatus = useMutation({
  mutationFn: async (p: { id: string; status: string }) =>
    (await api.patch(`/deliveries/${p.id}/status`, { status: p.status })).data,
  onSuccess: (_d, p) => {
    toast.add({ severity: 'success', summary: t('deliveries.statusSet', { status: statusLabel(p.status) }), detail: p.status === 'selesai' ? t('deliveries.doneFinance') : undefined, life: 2500 });
    qc.invalidateQueries({ queryKey: ['deliveries'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const show = ref(false);
const blank = () => ({
  deliveryDate: today(), origin: '', destination: '', commodityId: '', qty: '', unit: 'kg',
  vehicle: '', driverName: '', driverPhone: '', cost: '', note: '',
});
const form = ref(blank());
function onCommodityChange() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === form.value.commodityId);
  if (c) form.value.unit = c.unit;
}
const save = useMutation({
  mutationFn: async () =>
    (await api.post('/deliveries', {
      deliveryDate: form.value.deliveryDate,
      origin: form.value.origin,
      destination: form.value.destination,
      commodityId: form.value.commodityId || undefined,
      qty: form.value.qty ? String(form.value.qty) : undefined,
      unit: form.value.qty ? form.value.unit : undefined,
      vehicle: form.value.vehicle || undefined,
      driverName: form.value.driverName || undefined,
      driverPhone: form.value.driverPhone || undefined,
      cost: form.value.cost ? String(form.value.cost) : undefined,
      note: form.value.note || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('deliveries.scheduled'), life: 2000 });
    show.value = false;
    form.value = blank();
    qc.invalidateQueries({ queryKey: ['deliveries'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('deliveries.title') }}</h2>
      <Button v-if="canWrite" :label="t('deliveries.new')" icon="pi pi-plus" @click="show = true" />
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 56rem"
    >
      <template #empty><div class="empty-note">{{ t('deliveries.empty') }}</div></template>
      <Column field="code" :header="t('orders.no')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column :header="t('common.date')" field="deliveryDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.deliveryDate) }}</template></Column>
      <Column :header="t('deliveries.route')" style="min-width: 15rem">
        <template #body="{ data }">
          <span class="route">{{ data.origin }} <i class="pi pi-arrow-right" /> {{ data.destination }}</span>
        </template>
      </Column>
      <Column :header="t('deliveries.cargo')" style="min-width: 9rem">
        <template #body="{ data }">{{ data.commodityName ? `${data.commodityName} (${fmtQty(data.qty)} ${data.unit})` : '-' }}</template>
      </Column>
      <Column :header="t('deliveries.fleet')" style="min-width: 9rem">
        <template #body="{ data }">{{ data.vehicle ?? '-' }}<small v-if="data.driverName"> · {{ data.driverName }}</small></template>
      </Column>
      <Column :header="t('deliveries.cost')" style="min-width: 7rem"><template #body="{ data }">{{ Number(data.cost) > 0 ? fmtMoney(data.cost) : '-' }}</template></Column>
      <Column :header="t('common.status')" field="status" sortable style="min-width: 7.5rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="min-width: 8rem" v-if="canWrite">
        <template #body="{ data }">
          <Button
            v-if="nextOf(data.status)"
            :label="statusLabel(nextOf(data.status)!)"
            icon="pi pi-angle-double-right"
            size="small"
            outlined
            :loading="setStatus.isPending.value"
            @click="setStatus.mutate({ id: data.id, status: nextOf(data.status)! })"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="t('deliveries.new')" modal :style="{ width: '520px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.date') }}</label><InputText v-model="form.deliveryDate" type="date" fluid /></div>
          <div><label>{{ t('deliveries.costRp') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.cost" type="number" min="0" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('deliveries.origin') }}</label><InputText v-model="form.origin" maxlength="120" :placeholder="t('deliveries.originPh')" fluid /></div>
          <div><label>{{ t('deliveries.destination') }}</label><InputText v-model="form.destination" maxlength="120" :placeholder="t('deliveries.destPh')" fluid /></div>
        </div>
        <label>{{ t('deliveries.cargo') }} <small>({{ t('common.optional') }})</small></label>
        <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" showClear filter :optionLabel="(c: any) => c.name" @change="onCommodityChange" fluid />
        <div class="row3" v-if="form.commodityId">
          <div><label>{{ t('common.qtyUnit', { unit: form.unit }) }}</label><InputText v-model="form.qty" type="number" min="0" fluid /></div>
        </div>
        <div class="row3">
          <div><label>{{ t('deliveries.vehicle') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.vehicle" maxlength="60" :placeholder="t('deliveries.vehiclePh')" fluid /></div>
          <div><label>{{ t('deliveries.driver') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.driverName" maxlength="80" fluid /></div>
          <div><label>{{ t('deliveries.driverPhone') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.driverPhone" maxlength="30" fluid /></div>
        </div>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.note" maxlength="300" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.origin || !form.destination" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.route { display: inline-flex; align-items: center; gap: 0.4rem; }
.route .pi { font-size: 0.65rem; color: var(--app-text-muted); }
</style>
