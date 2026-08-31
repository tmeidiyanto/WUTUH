<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import { waHref } from '@/lib/wa';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty, fmtMoney, fmtDate, today } = useFmt();

const query = useQuery({ queryKey: ['orders'], queryFn: async () => (await api.get('/market/orders')).data });
const listings = useQuery({ queryKey: ['listings'], queryFn: async () => (await api.get('/market/listings')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/warehouses')).data });
const cycles = useQuery({ queryKey: ['cycles', 'all'], queryFn: async () => (await api.get('/cycles')).data });

const statusSeverity: Record<string, string> = {
  baru: 'warn', dikonfirmasi: 'info', dikirim: 'info', selesai: 'success', batal: 'danger',
};
const STATUSES = ['baru', 'dikonfirmasi', 'dikirim', 'selesai', 'batal'];
const statusLabel = (v: string) => (STATUSES.includes(v) ? t(`enum.orderStatus.${v}`) : v);
/** Aksi lanjutan yang tersedia per status. */
const nextActions: Record<string, Array<{ to: string; key: string; icon: string; severity?: string }>> = {
  baru: [
    { to: 'dikonfirmasi', key: 'confirm', icon: 'pi-check' },
    { to: 'batal', key: 'reject', icon: 'pi-times', severity: 'danger' },
  ],
  dikonfirmasi: [
    { to: 'dikirim', key: 'ship', icon: 'pi-truck' },
    { to: 'batal', key: 'cancel', icon: 'pi-times', severity: 'danger' },
  ],
  dikirim: [{ to: 'selesai', key: 'done', icon: 'pi-verified', severity: 'success' }],
};

const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });
const canWrite = computed(() => auth.can('market.write'));

// ===== Kabari pembeli via WhatsApp =====
const waOrder = ref<any | null>(null);
const waText = ref('');
const showWa = computed({ get: () => !!waOrder.value, set: (v) => { if (!v) waOrder.value = null; } });
function composeWa(order: any, status: string) {
  const key = ['baru', 'dikonfirmasi', 'dikirim', 'selesai', 'batal', 'paid'].includes(status) ? status : 'baru';
  return t(`orders.wa.msg.${key}`, {
    buyer: order.buyerName,
    code: order.code,
    qty: fmtQty(order.qty),
    unit: order.unit,
    commodity: order.commodityName ?? '',
    total: fmtMoney(order.total),
    seller: auth.user?.companyName ?? '',
  });
}
function openWa(order: any, status: string) {
  waText.value = composeWa(order, status);
  waOrder.value = order;
}
const waLink = computed(() => (waOrder.value?.buyerPhone ? waHref(waOrder.value.buyerPhone, waText.value) : null));

const markPaid = useMutation({
  mutationFn: async (p: { id: string; order: any }) => (await api.post(`/market/orders/${p.id}/paid`)).data,
  onSuccess: (_d, p) => {
    toast.add({ severity: 'success', summary: t('orders.pay.marked'), life: 2500 });
    qc.invalidateQueries({ queryKey: ['orders'] });
    if (p.order?.buyerPhone) openWa(p.order, 'paid');
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const setStatus = useMutation({
  mutationFn: async (p: { id: string; status: string; order: any }) =>
    (await api.patch(`/market/orders/${p.id}/status`, { status: p.status })).data,
  onSuccess: (_d, p) => {
    const extra = p.status === 'dikirim' ? t('orders.shippedStock') : p.status === 'selesai' ? t('orders.doneFinance') : undefined;
    toast.add({ severity: 'success', summary: t('orders.statusSet', { status: statusLabel(p.status) }), detail: extra, life: 2500 });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['stock'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    // Setiap aksi penjual → siapkan pesan WA ke pembeli (bila nomornya ada).
    if (p.order?.buyerPhone) openWa(p.order, p.status);
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const show = ref(false);
const blank = () => ({ listingId: '', buyerName: '', buyerPhone: '', commodityId: '', qty: '', unit: 'kg', pricePerUnit: '', orderDate: today(), warehouseId: '', cycleId: '', note: '' });
const form = ref(blank());
function openCreate() { form.value = blank(); show.value = true; }
function onListingChange() {
  const l = (listings.data.value ?? []).find((x: any) => x.id === form.value.listingId);
  if (l) {
    form.value.commodityId = l.commodityId;
    form.value.unit = l.unit;
    form.value.pricePerUnit = l.pricePerUnit;
  }
}
function onCommodityChange() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === form.value.commodityId);
  if (c) form.value.unit = c.unit;
}
const total = computed(() => Number(form.value.qty || 0) * Number(form.value.pricePerUnit || 0));

const save = useMutation({
  mutationFn: async () =>
    (await api.post('/market/orders', {
      listingId: form.value.listingId || undefined,
      buyerName: form.value.buyerName,
      buyerPhone: form.value.buyerPhone || undefined,
      commodityId: form.value.commodityId,
      qty: String(form.value.qty),
      unit: form.value.unit,
      pricePerUnit: String(form.value.pricePerUnit),
      orderDate: form.value.orderDate,
      warehouseId: form.value.warehouseId || undefined,
      cycleId: form.value.cycleId || undefined,
      note: form.value.note || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('orders.created'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['orders'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('orders.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('orders.searchPh')" />
        </span>
        <Button v-if="canWrite" :label="t('orders.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'buyerName', 'commodityName']"
      tableStyle="min-width: 56rem"
    >
      <template #empty><div class="empty-note">{{ t('orders.empty') }}</div></template>
      <Column field="code" :header="t('orders.no')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column :header="t('common.date')" field="orderDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.orderDate) }}</template></Column>
      <Column field="buyerName" :header="t('orders.buyer')" sortable style="min-width: 11rem" />
      <Column field="commodityName" :header="t('common.commodity')" style="min-width: 9rem" />
      <Column :header="t('common.qty')" style="min-width: 7rem"><template #body="{ data }">{{ fmtQty(data.qty) }} {{ data.unit }}</template></Column>
      <Column :header="t('common.total')" sortable field="total" style="min-width: 9rem"><template #body="{ data }"><strong>{{ fmtMoney(data.total) }}</strong></template></Column>
      <Column :header="t('orders.pay.col')" style="min-width: 9rem">
        <template #body="{ data }">
          <div class="pay-cell">
            <span class="pay-method" :class="{ qris: data.paymentMethod === 'qris' }">
              <i class="pi" :class="data.paymentMethod === 'qris' ? 'pi-qrcode' : 'pi-wallet'" />
              {{ data.paymentMethod === 'qris' ? 'QRIS' : t('orders.pay.cash') }}
            </span>
            <Tag
              v-if="data.status !== 'batal'"
              :value="data.paidAt ? t('orders.pay.paid') : t('orders.pay.unpaid')"
              :severity="data.paidAt ? 'success' : 'warn'"
            />
          </div>
        </template>
      </Column>
      <Column :header="t('common.status')" field="status" sortable style="min-width: 7.5rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="min-width: 12.5rem" v-if="canWrite">
        <template #body="{ data }">
          <div class="row-actions">
            <Button
              v-for="a in nextActions[data.status] ?? []"
              :key="a.to"
              :label="t(`orders.act.${a.key}`)"
              :icon="`pi ${a.icon}`"
              size="small"
              :severity="(a.severity as any) ?? 'primary'"
              :outlined="a.to === 'batal'"
              :loading="setStatus.isPending.value"
              @click="setStatus.mutate({ id: data.id, status: a.to, order: data })"
            />
            <Button
              v-if="!data.paidAt && data.status !== 'batal'"
              :label="t('orders.pay.mark')"
              icon="pi pi-check-circle"
              size="small"
              severity="help"
              outlined
              :loading="markPaid.isPending.value"
              @click="markPaid.mutate({ id: data.id, order: data })"
            />
            <button
              v-if="data.buyerPhone"
              type="button"
              class="wa-row"
              :title="t('orders.wa.rowTip')"
              @click="openWa(data, data.status)"
            >
              <i class="pi pi-whatsapp" />
            </button>
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Dialog: kabari pembeli via WhatsApp -->
    <Dialog v-model:visible="showWa" :header="t('orders.wa.notifyTitle')" modal :style="{ width: '480px' }">
      <div class="form-grid" v-if="waOrder">
        <div class="wa-to">
          <i class="pi pi-whatsapp" />
          <div>
            <strong>{{ waOrder.buyerName }}</strong>
            <small>{{ waOrder.buyerPhone }} · {{ waOrder.code }}</small>
          </div>
        </div>
        <p class="wa-sub">{{ t('orders.wa.notifySub') }}</p>
        <Textarea v-model="waText" rows="7" fluid />
      </div>
      <template #footer>
        <Button :label="t('orders.wa.skip')" text @click="showWa = false" />
        <a v-if="waLink" :href="waLink" target="_blank" rel="noopener" class="wa-open" @click="showWa = false">
          <i class="pi pi-whatsapp" /> {{ t('orders.wa.open') }}
        </a>
      </template>
    </Dialog>

    <Dialog v-model:visible="show" :header="t('orders.new')" modal :style="{ width: '520px' }">
      <div class="form-grid">
        <label>{{ t('orders.fromListing') }} <small>({{ t('orders.fromListingHint') }})</small></label>
        <Select v-model="form.listingId" :options="listings.data.value ?? []" optionValue="id" showClear :optionLabel="(l: any) => `${l.code} — ${l.title}`" @change="onListingChange" fluid />
        <div class="row2">
          <div><label>{{ t('orders.buyerName') }}</label><InputText v-model="form.buyerName" maxlength="80" fluid /></div>
          <div><label>{{ t('common.phone') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.buyerPhone" maxlength="30" fluid /></div>
        </div>
        <label>{{ t('common.commodity') }}</label>
        <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :optionLabel="(c: any) => c.name" @change="onCommodityChange" fluid />
        <div class="row3">
          <div><label>{{ t('common.qtyUnit', { unit: form.unit }) }}</label><InputText v-model="form.qty" type="number" min="0" fluid /></div>
          <div><label>{{ t('common.pricePerUnit', { unit: form.unit }) }}</label><InputText v-model="form.pricePerUnit" type="number" min="0" fluid /></div>
          <div><label>{{ t('common.date') }}</label><InputText v-model="form.orderDate" type="date" fluid /></div>
        </div>
        <label>{{ t('orders.sourceWh') }} <small>({{ t('orders.sourceWhHint') }})</small></label>
        <Select v-model="form.warehouseId" :options="warehouses.data.value ?? []" optionValue="id" showClear :optionLabel="(w: any) => `${w.code} — ${w.name}`" fluid />
        <label>{{ t('orders.fromCycle') }} <small>({{ t('orders.fromCycleHint') }})</small></label>
        <Select v-model="form.cycleId" :options="cycles.data.value ?? []" optionValue="id" showClear filter :optionLabel="(c: any) => `${c.code} — ${c.name}`" fluid />
        <div class="total-line">{{ t('common.total') }}: <strong>{{ fmtMoney(total) }}</strong></div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.buyerName || !form.commodityId || !form.qty || !form.pricePerUnit" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.row-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }
.pay-cell { display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start; }
.pay-method { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: var(--app-text-muted); }
.pay-method.qris { color: var(--app-primary); font-weight: 600; }
.wa-row {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid #25d366;
  background: color-mix(in srgb, #25d366 14%, transparent); color: #25d366;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.wa-row:hover { background: #25d366; color: #fff; }
.wa-row .pi { font-size: 0.85rem; }
.wa-to { display: flex; align-items: center; gap: 0.6rem; background: var(--app-surface-2); border-radius: 10px; padding: 0.55rem 0.75rem; }
.wa-to > .pi { color: #25d366; font-size: 1.3rem; }
.wa-to strong { display: block; font-size: 0.9rem; }
.wa-to small { color: var(--app-text-muted); }
.wa-sub { margin: 0.4rem 0 0.1rem; font-size: 0.8rem; color: var(--app-text-muted); }
.wa-open {
  display: inline-flex; align-items: center; gap: 0.45rem;
  background: #25d366; color: #fff; text-decoration: none; font-weight: 700;
  padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.88rem;
}
.wa-open:hover { filter: brightness(1.06); }
.total-line {
  margin-top: 0.5rem; padding: 0.5rem 0.7rem; border-radius: 8px;
  background: color-mix(in srgb, var(--app-primary) 10%, transparent);
  font-size: 0.9rem;
}
</style>
