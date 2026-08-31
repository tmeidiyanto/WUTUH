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
import { intlLocale } from '@/i18n';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t, locale } = useI18n();
const { fmtMoney, fmtDate, today } = useFmt();

const tx = useQuery({ queryKey: ['fin-tx'], queryFn: async () => (await api.get('/finance/transactions')).data });
const summary = useQuery({ queryKey: ['fin-summary'], queryFn: async () => (await api.get('/finance/summary')).data });
const cycles = useQuery({ queryKey: ['cycles', 'all'], queryFn: async () => (await api.get('/cycles')).data });

const canWrite = computed(() => auth.can('finance.write'));

const CATS = ['penjualan', 'pembelian_input', 'tenaga_kerja', 'transportasi', 'sewa', 'pakan', 'obat', 'alat', 'lainnya'];
const catOptions = computed(() => CATS.map((v) => ({ value: v, label: t(`enum.finCategory.${v}`) })));
const catLabel = (v: string) => (CATS.includes(v) ? t(`enum.finCategory.${v}`) : v);
const kindOptions = computed(() => ['masuk', 'keluar'].map((v) => ({ value: v, label: t(`enum.finKindLong.${v}`) })));
const kindLabel = (v: string) => (['masuk', 'keluar'].includes(v) ? t(`enum.finKind.${v}`) : v);

/** Grafik batang bulanan masuk vs keluar (12 bulan). */
const monthly = computed(() => {
  void locale.value; // reaktif terhadap bahasa (nama bulan)
  const map = new Map<string, { masuk: number; keluar: number }>();
  for (const m of summary.data.value?.monthly ?? []) {
    if (!map.has(m.month)) map.set(m.month, { masuk: 0, keluar: 0 });
    map.get(m.month)![m.kind as 'masuk' | 'keluar'] = Number(m.total);
  }
  const rows = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...rows.flatMap(([, v]) => [v.masuk, v.keluar]));
  return rows.map(([month, v]) => ({
    month,
    label: new Date(`${month}-01`).toLocaleDateString(intlLocale(), { month: 'short' }),
    ...v,
    hIn: (v.masuk / max) * 100,
    hOut: (v.keluar / max) * 100,
  }));
});
const totals = computed(() => {
  let masuk = 0;
  let keluar = 0;
  for (const m of summary.data.value?.monthly ?? []) {
    if (m.kind === 'masuk') masuk += Number(m.total);
    else keluar += Number(m.total);
  }
  return { masuk, keluar, net: masuk - keluar };
});

/** Laba/rugi per siklus. */
const byCycle = computed(() => {
  const map = new Map<string, { code: string; name: string; masuk: number; keluar: number }>();
  for (const r of summary.data.value?.byCycle ?? []) {
    const key = r.cycleId;
    if (!map.has(key)) map.set(key, { code: r.cycleCode, name: r.cycleName, masuk: 0, keluar: 0 });
    map.get(key)![r.kind as 'masuk' | 'keluar'] = Number(r.total);
  }
  return [...map.values()].map((c) => ({ ...c, net: c.masuk - c.keluar })).sort((a, b) => b.net - a.net);
});

const show = ref(false);
const blank = () => ({ txDate: today(), kind: 'keluar', category: 'lainnya', amount: '', cycleId: '', note: '' });
const form = ref(blank());
const save = useMutation({
  mutationFn: async () =>
    (await api.post('/finance/transactions', {
      txDate: form.value.txDate,
      kind: form.value.kind,
      category: form.value.category,
      amount: String(form.value.amount),
      cycleId: form.value.cycleId || undefined,
      note: form.value.note || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('finance.logged'), life: 2000 });
    show.value = false;
    form.value = blank();
    qc.invalidateQueries({ queryKey: ['fin-tx'] });
    qc.invalidateQueries({ queryKey: ['fin-summary'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const del = useMutation({
  mutationFn: async (id: string) => (await api.delete(`/finance/transactions/${id}`)).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.deleted'), life: 2000 });
    qc.invalidateQueries({ queryKey: ['fin-tx'] });
    qc.invalidateQueries({ queryKey: ['fin-summary'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('finance.title') }}</h2>
      <Button v-if="canWrite" :label="t('finance.log')" icon="pi pi-plus" @click="show = true" />
    </div>

    <!-- Ringkasan -->
    <div class="cards-grid fin-cards">
      <div class="kpi-card">
        <i class="pi pi-arrow-down-left" />
        <div class="meta"><span class="t">{{ t('finance.income12') }}</span><span class="v good">{{ fmtMoney(totals.masuk) }}</span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-arrow-up-right" />
        <div class="meta"><span class="t">{{ t('finance.expense12') }}</span><span class="v bad">{{ fmtMoney(totals.keluar) }}</span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-wallet" />
        <div class="meta"><span class="t">{{ t('finance.net') }}</span><span class="v" :class="totals.net >= 0 ? 'good' : 'bad'">{{ fmtMoney(totals.net) }}</span></div>
      </div>
    </div>

    <div class="fin-panels">
      <!-- Grafik bulanan -->
      <section class="panel">
        <h3><i class="pi pi-chart-bar" /> {{ t('finance.monthly') }}</h3>
        <div v-if="!monthly.length" class="empty-note">{{ t('finance.noData') }}</div>
        <div v-else class="bars">
          <div v-for="m in monthly" :key="m.month" class="bar-group" v-tooltip.top="`${m.label}: +${fmtMoney(m.masuk)} / −${fmtMoney(m.keluar)}`">
            <div class="bar-pair">
              <div class="bar in" :style="{ height: `${m.hIn}%` }" />
              <div class="bar out" :style="{ height: `${m.hOut}%` }" />
            </div>
            <span class="bar-label">{{ m.label }}</span>
          </div>
        </div>
        <div class="legend">
          <span><span class="dot in" /> {{ t('finance.in') }}</span>
          <span><span class="dot out" /> {{ t('finance.out') }}</span>
        </div>
      </section>

      <!-- Laba/rugi per siklus -->
      <section class="panel">
        <h3><i class="pi pi-sync" /> {{ t('finance.byCycle') }}</h3>
        <div v-if="!byCycle.length" class="empty-note">{{ t('finance.noCycleTx') }}</div>
        <div v-else class="cycle-pl">
          <div v-for="c in byCycle" :key="c.code" class="pl-row">
            <div class="pl-name"><strong>{{ c.code }}</strong> <small>{{ c.name }}</small></div>
            <div class="pl-nums">
              <span class="good">+{{ fmtMoney(c.masuk) }}</span>
              <span class="bad">−{{ fmtMoney(c.keluar) }}</span>
              <strong :class="c.net >= 0 ? 'good' : 'bad'">{{ fmtMoney(c.net) }}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Daftar transaksi -->
    <h3 class="tx-title">{{ t('finance.recent') }}</h3>
    <DataTable
      :value="tx.data.value ?? []" :loading="tx.isLoading.value"
      dataKey="id" rowHover scrollable size="small" stripedRows removableSort
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      tableStyle="min-width: 48rem"
    >
      <template #empty><div class="empty-note">{{ t('finance.empty') }}</div></template>
      <Column :header="t('common.date')" field="txDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.txDate) }}</template></Column>
      <Column :header="t('finance.kind')" field="kind" style="min-width: 6rem">
        <template #body="{ data }"><Tag :value="kindLabel(data.kind)" :severity="data.kind === 'masuk' ? 'success' : 'danger'" /></template>
      </Column>
      <Column :header="t('common.category')" field="category" style="min-width: 8rem"><template #body="{ data }">{{ catLabel(data.category) }}</template></Column>
      <Column :header="t('common.amount')" sortable field="amount" style="min-width: 9rem">
        <template #body="{ data }">
          <strong :class="data.kind === 'masuk' ? 'good' : 'bad'">{{ data.kind === 'masuk' ? '+' : '−' }}{{ fmtMoney(data.amount) }}</strong>
        </template>
      </Column>
      <Column :header="t('common.cycle')" style="min-width: 7rem"><template #body="{ data }">{{ data.cycleCode ?? '-' }}</template></Column>
      <Column field="note" :header="t('common.note')" style="min-width: 14rem"><template #body="{ data }">{{ data.note ?? '-' }}</template></Column>
      <Column :header="t('common.source')" style="min-width: 6.5rem">
        <template #body="{ data }">
          <Tag :value="t(`enum.refSource.${data.refType === 'manual' && !data.refId ? 'manual' : 'otomatis'}`)" :severity="data.refType === 'manual' && !data.refId ? 'secondary' : 'info'" />
        </template>
      </Column>
      <Column :header="t('common.actions')" style="width: 4.5rem" v-if="canWrite">
        <template #body="{ data }">
          <Button
            v-if="data.refType === 'manual' && !data.refId"
            icon="pi pi-trash" size="small" text severity="danger"
            :loading="del.isPending.value"
            @click="del.mutate(data.id)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="t('finance.log')" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <div class="row3">
          <div><label>{{ t('common.date') }}</label><InputText v-model="form.txDate" type="date" fluid /></div>
          <div>
            <label>{{ t('finance.kind') }}</label>
            <Select v-model="form.kind" :options="kindOptions" optionValue="value" optionLabel="label" fluid />
          </div>
          <div><label>{{ t('common.category') }}</label><Select v-model="form.category" :options="catOptions" optionValue="value" optionLabel="label" fluid /></div>
        </div>
        <label>{{ t('common.amountRp') }}</label>
        <InputText v-model="form.amount" type="number" min="0" fluid />
        <label>{{ t('finance.linkCycle') }} <small>({{ t('finance.linkCycleHint') }})</small></label>
        <Select v-model="form.cycleId" :options="cycles.data.value ?? []" optionValue="id" showClear filter :optionLabel="(c: any) => `${c.code} — ${c.name}`" fluid />
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="form.note" maxlength="300" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.amount" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.fin-cards { margin-bottom: 1rem; }
.good { color: var(--app-primary); }
.bad { color: var(--app-danger); }

.fin-panels { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; margin-bottom: 1.2rem; }
@media (max-width: 980px) { .fin-panels { grid-template-columns: 1fr; } }
.panel { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 14px; padding: 0.9rem 1rem; min-width: 0; }
.panel h3 { margin: 0 0 0.6rem; display: flex; align-items: center; gap: 0.45rem; font-size: 0.98rem; }
.panel h3 .pi { color: var(--app-primary); }

.bars { display: flex; align-items: flex-end; gap: 0.45rem; height: 150px; overflow-x: auto; padding-bottom: 0.2rem; }
.bar-group { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex: 1; min-width: 34px; height: 100%; }
.bar-pair { display: flex; gap: 3px; align-items: flex-end; flex: 1; width: 100%; justify-content: center; }
.bar { width: 11px; border-radius: 4px 4px 0 0; min-height: 2px; }
.bar.in { background: var(--app-primary); }
.bar.out { background: var(--app-accent); opacity: 0.75; }
.bar-label { font-size: 0.66rem; color: var(--app-text-muted); }
.legend { display: flex; gap: 1rem; font-size: 0.75rem; color: var(--app-text-muted); margin-top: 0.4rem; }
.legend .dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 0.3rem; }
.legend .dot.in { background: var(--app-primary); }
.legend .dot.out { background: var(--app-accent); opacity: 0.75; }

.cycle-pl { display: flex; flex-direction: column; gap: 0.4rem; max-height: 210px; overflow-y: auto; }
.pl-row {
  display: flex; justify-content: space-between; gap: 0.6rem; align-items: baseline;
  padding: 0.4rem 0.55rem; background: var(--app-surface-2); border-radius: 8px; flex-wrap: wrap;
}
.pl-name { min-width: 0; font-size: 0.84rem; }
.pl-name small { color: var(--app-text-muted); }
.pl-nums { display: flex; gap: 0.7rem; font-size: 0.8rem; align-items: baseline; flex-wrap: wrap; }
.tx-title { margin: 0 0 0.6rem; }
</style>
