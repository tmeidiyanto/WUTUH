<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { api } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { STAGES, stageIndex, type Stage } from '@/lib/stages';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { fmtQty, fmtMoney, fmtDate, fmtDateTime } = useFmt();

const id = computed(() => String(route.params.id));
const query = useQuery({
  queryKey: computed(() => ['cycle-trace', id.value]),
  queryFn: async () => (await api.get(`/cycles/${id.value}/trace`)).data,
});
const r = computed(() => query.data.value);

const stageLbl = (s: string) => (STAGES.includes(s as Stage) ? t(`stage.${s}`) : s);
const actLbl = (v: string) => t(`enum.activity.${v}`);
const orderStatusLbl = (v: string) => t(`enum.orderStatus.${v}`);
const cycleStatusLbl = (v: string) => t(`enum.cycleStatus.${v}`);
const refLbl = (v: string) => t(`enum.movementRef.${v}`);
const catLbl = (v: string) => t(`enum.finCategory.${v}`);
const devLbl = (v: string) => t(`enum.deviceType.${v}`);
const landUseLbl = (v: string) => t(`enum.landUse.${v}`);
const bizLbl = (v: string) => t(`login.types.${v}`);
const sexLbl = (v: string) => t(`enum.sex.${v}`);
const lsLbl = (v: string) => t(`enum.livestockStatus.${v}`);

const curIdx = computed(() => stageIndex(r.value?.cycle?.stage ?? ''));
const isMarketplace = (o: any) => (o.note ?? '').startsWith('[Pasar WUTUH]');
const realizationPct = computed(() => {
  const m = r.value?.metrics;
  return m?.predicted ? Math.round((m.totalHarvest / m.predicted) * 100) : null;
});
const printPage = () => window.print();
const toast = useToast();

// Kode lacak publik + QR (dibuat idempoten saat laporan dibuka).
const traceUrl = ref<string | null>(null);
const qrDataUrl = ref<string | null>(null);
watch(
  r,
  async (v) => {
    if (!v || traceUrl.value) return;
    try {
      const { data } = await api.post(`/cycles/${id.value}/share`);
      traceUrl.value = `${location.origin}/lacak/${data.traceCode}`;
      qrDataUrl.value = await QRCode.toDataURL(traceUrl.value, { margin: 1, width: 220 });
    } catch {
      /* laporan tetap tampil tanpa QR */
    }
  },
  { immediate: true },
);
function copyLink() {
  if (!traceUrl.value) return;
  navigator.clipboard?.writeText(traceUrl.value);
  toast.add({ severity: 'info', summary: t('trace.copied'), life: 1800 });
}
</script>

<template>
  <div class="trace-page">
    <div class="toolbar no-print">
      <Button :label="t('common.close')" icon="pi pi-arrow-left" text @click="router.back()" />
      <Button :label="t('trace.print')" icon="pi pi-print" @click="printPage" />
    </div>

    <div v-if="query.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>

    <article v-else-if="r" class="paper">
      <!-- Kop -->
      <header class="kop">
        <div class="kop-brand">
          <span class="wordmark">WUTUH</span><span class="wm-dot" />
          <small>The Complete Agribusiness Platform</small>
        </div>
        <div class="kop-title">
          <h1>{{ t('trace.title') }}</h1>
          <p>{{ t('trace.subtitle') }}</p>
        </div>
        <div class="kop-code">
          <span class="code">{{ r.cycle.code }}</span>
          <small>{{ t('trace.generated', { at: fmtDateTime(r.generatedAt) }) }}</small>
          <div v-if="qrDataUrl" class="qr-box">
            <img :src="qrDataUrl" alt="QR" />
            <small>{{ t('trace.qrTitle') }}</small>
          </div>
        </div>
      </header>

      <div v-if="traceUrl" class="share-row no-print">
        <span class="share-label">{{ t('trace.publicLink') }}:</span>
        <code class="share-url">{{ traceUrl }}</code>
        <Button :label="t('trace.copyLink')" icon="pi pi-copy" size="small" text @click="copyLink" />
      </div>

      <!-- Produsen + identitas -->
      <section class="two-col">
        <div class="box">
          <h2>{{ t('trace.producer') }}</h2>
          <div class="kv"><span>{{ r.company?.name }}</span></div>
          <div class="kv muted">
            {{ r.company ? bizLbl(r.company.businessType) : '' }}
            <template v-if="r.company?.regency || r.company?.province"> · {{ [r.company?.regency, r.company?.province].filter(Boolean).join(', ') }}</template>
          </div>
          <div v-if="r.company?.phone" class="kv muted">☎ {{ r.company.phone }}</div>
        </div>
        <div class="box">
          <h2>{{ t('trace.identity') }}</h2>
          <table class="kv-table">
            <tbody>
              <tr><td>{{ t('trace.commodity') }}</td><td><strong>{{ r.cycle.commodityName }}</strong> — {{ r.cycle.name }}</td></tr>
              <tr v-if="r.land"><td>{{ t('trace.land') }}</td><td>{{ r.land.name }} ({{ landUseLbl(r.land.landUse) }}) · {{ t('trace.area') }} {{ fmtQty(r.land.areaHa) }} ha<template v-if="r.land.village"> · {{ r.land.village }}</template></td></tr>
              <tr v-if="r.land?.soilType || r.land?.irrigation"><td>{{ t('trace.soil') }}</td><td>{{ r.land?.soilType ?? '—' }} · {{ t('trace.irrigation') }}: {{ r.land?.irrigation ?? '—' }}</td></tr>
              <tr><td>{{ t('trace.start') }}</td><td>{{ fmtDate(r.cycle.startDate) }} · {{ t('trace.target') }}: {{ fmtDate(r.cycle.targetHarvestDate) }}</td></tr>
              <tr><td>{{ t('trace.status') }}</td><td>{{ cycleStatusLbl(r.cycle.status) }} · {{ t('trace.currentStage') }}: <strong>{{ stageLbl(r.cycle.stage) }}</strong></td></tr>
              <tr v-if="r.cycle.initialQty"><td>{{ t('trace.population') }}</td><td>{{ fmtQty(r.cycle.initialQty) }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Rantai nilai -->
      <section>
        <h2>{{ t('trace.chain') }}</h2>
        <div class="chain">
          <template v-for="(s, i) in STAGES" :key="s">
            <div class="cnode" :class="{ done: i < curIdx, cur: i === curIdx }">
              <span class="cdot">{{ i + 1 }}</span>
              <span class="clbl">{{ stageLbl(s) }}</span>
            </div>
            <span v-if="i < STAGES.length - 1" class="carrow">›</span>
          </template>
        </div>
      </section>

      <!-- Metrik ringkas -->
      <section class="stats">
        <div class="stat"><small>{{ t('trace.hvTotal') }}</small><strong>{{ fmtQty(r.metrics.totalHarvest) }} {{ r.cycle.commodityUnit }}</strong><span v-if="r.metrics.predicted" class="sub">{{ t('trace.predicted') }} ± {{ fmtQty(Math.round(r.metrics.predicted)) }} ({{ realizationPct }}%)</span></div>
        <div class="stat" v-if="r.metrics.yieldPerHa"><small>{{ t('trace.yieldPerHa') }}</small><strong>{{ fmtQty(Math.round(r.metrics.yieldPerHa)) }} {{ r.cycle.commodityUnit }}/ha</strong></div>
        <div class="stat"><small>{{ t('trace.soldTotal') }}</small><strong>{{ fmtQty(r.metrics.soldQty) }} {{ r.cycle.commodityUnit }}</strong></div>
        <div class="stat"><small>{{ t('trace.fIncome') }}</small><strong class="pos">{{ fmtMoney(r.finance.income) }}</strong></div>
        <div class="stat"><small>{{ t('trace.fExpense') }}</small><strong class="neg">{{ fmtMoney(r.finance.expense) }}</strong></div>
        <div class="stat"><small>{{ t('trace.fNet') }}</small><strong :class="r.finance.net >= 0 ? 'pos' : 'neg'">{{ fmtMoney(r.finance.net) }}</strong><span v-if="r.metrics.costPerUnit" class="sub">{{ t('trace.costPerUnit', { unit: r.cycle.commodityUnit }) }}: {{ fmtMoney(Math.round(r.metrics.costPerUnit)) }}</span></div>
      </section>

      <!-- Linimasa tahap -->
      <section v-if="r.history.length">
        <h2>{{ t('trace.history') }}</h2>
        <table class="tbl">
          <thead><tr><th style="width: 30%">{{ t('common.stage') }}</th><th style="width: 25%">{{ t('trace.hTime') }}</th><th>{{ t('trace.hNote') }}</th></tr></thead>
          <tbody>
            <tr v-for="h in r.history" :key="h.id">
              <td><strong>{{ stageLbl(h.toStage) }}</strong></td>
              <td>{{ fmtDateTime(h.at) }}</td>
              <td>{{ h.note ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Kegiatan -->
      <section v-if="r.activities.length">
        <h2>{{ t('trace.activities') }}</h2>
        <table class="tbl">
          <thead><tr><th style="width: 16%">{{ t('common.date') }}</th><th style="width: 20%">{{ t('trace.aType') }}</th><th>{{ t('trace.aDesc') }}</th><th class="num" style="width: 16%">{{ t('trace.aCost') }}</th></tr></thead>
          <tbody>
            <tr v-for="a in r.activities" :key="a.id">
              <td>{{ fmtDate(a.activityDate) }}</td>
              <td>{{ actLbl(a.activityType) }}</td>
              <td>
                <span class="cell-ph">
                  <a v-if="a.photoUrl" :href="a.photoUrl" target="_blank" rel="noopener"><img :src="a.photoUrl" class="row-ph" alt="" /></a>
                  {{ a.description ?? '—' }}
                </span>
              </td>
              <td class="num">{{ Number(a.cost) > 0 ? fmtMoney(a.cost) : '—' }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="3">{{ t('trace.aTotal') }}</td><td class="num"><strong>{{ fmtMoney(r.activities.reduce((s: number, a: any) => s + Number(a.cost), 0)) }}</strong></td></tr></tfoot>
        </table>
      </section>

      <!-- Panen -->
      <section v-if="r.harvests.length">
        <h2>{{ t('trace.harvestsT') }}</h2>
        <table class="tbl">
          <thead><tr><th style="width: 18%">{{ t('common.date') }}</th><th class="num" style="width: 20%">{{ t('common.qty') }}</th><th style="width: 12%">{{ t('trace.hvQuality') }}</th><th style="width: 25%">{{ t('trace.hvWh') }}</th><th>{{ t('common.note') }}</th></tr></thead>
          <tbody>
            <tr v-for="h in r.harvests" :key="h.id">
              <td>{{ fmtDate(h.harvestDate) }}</td>
              <td class="num">{{ fmtQty(h.qty) }} {{ h.unit }}</td>
              <td>{{ h.quality ?? '—' }}</td>
              <td>{{ h.warehouseName ?? '—' }}</td>
              <td>
                <span class="cell-ph">
                  <a v-if="h.photoUrl" :href="h.photoUrl" target="_blank" rel="noopener"><img :src="h.photoUrl" class="row-ph" alt="" /></a>
                  {{ h.note ?? '—' }}
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td>{{ t('trace.hvTotal') }}</td><td class="num"><strong>{{ fmtQty(r.metrics.totalHarvest) }} {{ r.cycle.commodityUnit }}</strong></td><td colspan="3" /></tr></tfoot>
        </table>
      </section>

      <!-- Mutasi gudang -->
      <section v-if="r.movements.length">
        <h2>{{ t('trace.stockT') }}</h2>
        <table class="tbl">
          <thead><tr><th style="width: 18%">{{ t('common.date') }}</th><th style="width: 26%">{{ t('trace.hvWh') }}</th><th class="num" style="width: 20%">{{ t('trace.mvQty') }}</th><th style="width: 18%">{{ t('trace.mvSrc') }}</th><th>{{ t('common.note') }}</th></tr></thead>
          <tbody>
            <tr v-for="m in r.movements" :key="m.id">
              <td>{{ fmtDate(m.movementDate) }}</td>
              <td>{{ m.warehouseName ?? '—' }}</td>
              <td class="num" :class="m.direction === 'masuk' ? 'pos' : 'neg'">{{ m.direction === 'masuk' ? '+' : '−' }}{{ fmtQty(m.qty) }} {{ m.unit }}</td>
              <td>{{ refLbl(m.refType) }}</td>
              <td>{{ m.note ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Penjualan -->
      <section v-if="r.orders.length">
        <h2>{{ t('trace.salesT') }}</h2>
        <table class="tbl">
          <thead><tr><th style="width: 13%">{{ t('common.code') }}</th><th style="width: 15%">{{ t('common.date') }}</th><th>{{ t('trace.sBuyer') }}</th><th class="num" style="width: 13%">{{ t('common.qty') }}</th><th class="num" style="width: 16%">{{ t('common.total') }}</th><th style="width: 13%">{{ t('common.status') }}</th><th style="width: 13%">{{ t('trace.sChannel') }}</th></tr></thead>
          <tbody>
            <tr v-for="o in r.orders" :key="o.id">
              <td><strong>{{ o.code }}</strong></td>
              <td>{{ fmtDate(o.orderDate) }}</td>
              <td>{{ o.buyerName }}</td>
              <td class="num">{{ fmtQty(o.qty) }} {{ o.unit }}</td>
              <td class="num">{{ fmtMoney(o.total) }}</td>
              <td>{{ orderStatusLbl(o.status) }}</td>
              <td><span class="chip" :class="{ mkt: isMarketplace(o) }">{{ isMarketplace(o) ? t('trace.channelMarket') : t('trace.channelDirect') }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Keuangan -->
      <section>
        <h2>{{ t('trace.financeT') }}</h2>
        <div class="fin-wrap">
          <table class="tbl fin-main">
            <tbody>
              <tr><td>{{ t('trace.fIncome') }}</td><td class="num pos">{{ fmtMoney(r.finance.income) }}</td></tr>
              <tr><td>{{ t('trace.fExpense') }}</td><td class="num neg">{{ fmtMoney(r.finance.expense) }}</td></tr>
              <tr class="net"><td><strong>{{ t('trace.fNet') }}</strong></td><td class="num"><strong :class="r.finance.net >= 0 ? 'pos' : 'neg'">{{ fmtMoney(r.finance.net) }}</strong></td></tr>
            </tbody>
          </table>
          <table class="tbl fin-cat" v-if="Object.keys(r.finance.expenseByCategory).length">
            <thead><tr><th colspan="2">{{ t('trace.fByCat') }}</th></tr></thead>
            <tbody>
              <tr v-for="(v, k) in r.finance.expenseByCategory" :key="k">
                <td>{{ catLbl(String(k)) }}</td><td class="num">{{ fmtMoney(v) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Ternak -->
      <section v-if="r.animals.length">
        <h2>{{ t('trace.animalsT') }}</h2>
        <table class="tbl">
          <thead><tr><th>{{ t('livestock.tag') }}</th><th>{{ t('livestock.sex') }}</th><th class="num">{{ t('livestock.weight') }}</th><th>{{ t('common.status') }}</th></tr></thead>
          <tbody>
            <tr v-for="a in r.animals" :key="a.id">
              <td><strong>{{ a.tag }}</strong></td><td>{{ sexLbl(a.sex) }}</td><td class="num">{{ fmtQty(a.weightKg) }}</td><td>{{ lsLbl(a.status) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Sensor -->
      <section v-if="r.sensors.length">
        <h2>{{ t('trace.sensorsT') }}</h2>
        <table class="tbl">
          <thead><tr><th>{{ t('common.code') }}</th><th>{{ t('common.name') }}</th><th>{{ t('common.type') }}</th><th class="num">{{ t('trace.snLast') }}</th></tr></thead>
          <tbody>
            <tr v-for="s in r.sensors" :key="s.code">
              <td>{{ s.code }}</td><td>{{ s.name }}</td><td>{{ devLbl(s.deviceType) }}</td>
              <td class="num">{{ s.lastValue != null ? `${fmtQty(s.lastValue)}${s.unit} · ${fmtDateTime(s.lastReadAt)}` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Tanda tangan + footer -->
      <section class="signs">
        <div class="sign"><span>{{ t('trace.signPrepared') }}</span><div class="line" /></div>
        <div class="sign"><span>{{ t('trace.signChecked') }}</span><div class="line" /></div>
      </section>
      <footer class="foot">🌾 {{ t('app.philosophy') }} — {{ t('trace.footer') }}</footer>
    </article>
  </div>
</template>

<style scoped>
/* Dokumen "kertas": warna TETAP (independen tema aplikasi), rapi saat dicetak. */
.trace-page { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
.toolbar { width: 100%; max-width: 880px; display: flex; justify-content: space-between; }

.paper {
  --ink: #17261c; --muted: #5d6f63; --line: #dde5de; --band: #f2f7f2;
  --green: #15803d; --blue: #0369a1; --red: #b91c1c;
  width: 100%; max-width: 880px; background: #ffffff; color: var(--ink);
  border-radius: 12px; box-shadow: 0 14px 44px rgba(8, 30, 16, 0.25);
  padding: 2rem 2.2rem 1.6rem; box-sizing: border-box;
}
.paper h2 {
  font-size: 0.78rem; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--green); border-bottom: 2px solid var(--line);
  padding-bottom: 0.3rem; margin: 1.4rem 0 0.6rem;
}
.paper section:first-of-type h2 { margin-top: 0.9rem; }

/* Kop */
.kop { display: flex; gap: 1rem; align-items: flex-start; border-bottom: 3px solid var(--green); padding-bottom: 0.9rem; }
.kop-brand { display: flex; flex-direction: column; }
.wordmark {
  font-size: 1.6rem; font-weight: 800; letter-spacing: 0.05em;
  background: linear-gradient(120deg, var(--green), var(--blue));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.wm-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--blue); margin: -0.5rem 0 0 4.6rem; }
.kop-brand small { color: var(--muted); font-size: 0.62rem; margin-top: 0.1rem; }
.kop-title { flex: 1; text-align: center; }
.kop-title h1 { margin: 0; font-size: 1.3rem; }
.kop-title p { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.76rem; font-style: italic; }
.kop-code { text-align: right; display: flex; flex-direction: column; gap: 0.15rem; }
.kop-code .code { font-size: 1.15rem; font-weight: 800; color: var(--blue); }
.kop-code small { color: var(--muted); font-size: 0.68rem; }
.qr-box { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; margin-top: 0.3rem; }
.qr-box img { width: 92px; height: 92px; border: 1px solid var(--line); border-radius: 6px; }
.share-row {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  background: var(--band); border-radius: 8px; padding: 0.4rem 0.7rem; margin-top: 0.8rem;
  font-size: 0.78rem;
}
.share-label { color: var(--muted); font-weight: 700; }
.share-url { background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 0.15rem 0.5rem; word-break: break-all; }

.two-col { display: grid; grid-template-columns: 1fr 1.6fr; gap: 1rem; }
@media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } }
.box .kv { font-weight: 700; font-size: 0.95rem; }
.box .kv.muted { color: var(--muted); font-weight: 400; font-size: 0.8rem; margin-top: 0.15rem; }
.kv-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.kv-table td { padding: 0.22rem 0; vertical-align: top; }
.kv-table td:first-child { color: var(--muted); width: 32%; padding-right: 0.6rem; }

/* Rantai */
.chain { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.3rem; }
.cnode { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.5rem 0.18rem 0.22rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
.cdot {
  width: 18px; height: 18px; border-radius: 50%; background: var(--band); color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 700;
}
.clbl { font-size: 0.68rem; font-weight: 600; white-space: nowrap; }
.cnode.done { border-color: var(--green); color: var(--ink); }
.cnode.done .cdot { background: var(--green); color: #fff; }
.cnode.cur { border-color: var(--blue); color: var(--ink); box-shadow: 0 0 0 2px rgba(3, 105, 161, 0.18); }
.cnode.cur .cdot { background: var(--blue); color: #fff; }
.carrow { color: var(--line); font-weight: 700; }

/* Statistik */
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-top: 1rem; }
@media (max-width: 640px) { .stats { grid-template-columns: repeat(2, 1fr); } }
.stat { background: var(--band); border-radius: 10px; padding: 0.55rem 0.75rem; display: flex; flex-direction: column; }
.stat small { color: var(--muted); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; }
.stat strong { font-size: 1.02rem; margin-top: 0.1rem; }
.stat .sub { font-size: 0.7rem; color: var(--muted); margin-top: 0.1rem; }
.pos { color: var(--green); }
.neg { color: var(--red); }

/* Tabel */
.tbl { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.tbl th {
  text-align: left; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); background: var(--band); padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--line);
}
.tbl td { padding: 0.38rem 0.55rem; border-bottom: 1px solid var(--line); vertical-align: top; }
.tbl tfoot td { background: var(--band); font-weight: 600; border-bottom: none; }
.tbl .num, .tbl th.num { text-align: right; font-variant-numeric: tabular-nums; }
.cell-ph { display: flex; align-items: center; gap: 0.45rem; }
.row-ph { width: 30px; height: 30px; border-radius: 5px; object-fit: cover; display: block; border: 1px solid var(--line); }
.chip { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--band); color: var(--muted); }
.chip.mkt { background: rgba(3, 105, 161, 0.12); color: var(--blue); }

.fin-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
@media (max-width: 640px) { .fin-wrap { grid-template-columns: 1fr; } }
.fin-main .net td { background: var(--band); }

/* Tanda tangan + footer */
.signs { display: flex; gap: 3rem; margin-top: 2.2rem; justify-content: flex-end; }
.sign { display: flex; flex-direction: column; align-items: center; gap: 2.6rem; font-size: 0.78rem; color: var(--muted); }
.sign .line { width: 170px; border-bottom: 1px solid var(--ink); }
.foot { margin-top: 1.6rem; padding-top: 0.7rem; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.7rem; font-style: italic; }

.empty-note { padding: 1.5rem; color: var(--app-text-muted); }

@media print {
  .no-print { display: none !important; }
  .trace-page { display: block; }
  .paper { box-shadow: none; border-radius: 0; max-width: 100%; padding: 0; }
  @page { margin: 13mm; }
  .tbl, .stats, .chain, .kop, .two-col { break-inside: avoid-page; }
}
</style>
