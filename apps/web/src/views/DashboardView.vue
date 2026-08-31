<script setup lang="ts">
import { computed, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import ChainBar from '@/components/ChainBar.vue';
import TrustBadge from '@/components/TrustBadge.vue';
import WeatherCard from '@/components/WeatherCard.vue';

const auth = useAuthStore();
const { t, locale } = useI18n();
const { fmtQty, fmtMoney, fmtDate } = useFmt();

const dash = useQuery({
  queryKey: ['dashboard'],
  queryFn: async () => (await api.get('/dashboard')).data,
});
// Wawasan AI dibuat backend sesuai bahasa → muat ulang saat bahasa berganti.
watch(locale, () => dash.refetch());

const kpi = computed(() => dash.data.value?.kpi ?? {});
const chainCounts = computed(() => {
  const out: Record<string, number> = {};
  for (const c of dash.data.value?.chain ?? []) out[c.stage] = c.count;
  return out;
});

const sevMeta: Record<string, { icon: string; cls: string }> = {
  bahaya: { icon: 'pi-exclamation-triangle', cls: 'sev-danger' },
  perhatian: { icon: 'pi-bell', cls: 'sev-warn' },
  peluang: { icon: 'pi-thumbs-up', cls: 'sev-good' },
  info: { icon: 'pi-info-circle', cls: 'sev-info' },
};

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 11) return t('dash.morning');
  if (h < 15) return t('dash.afternoon');
  if (h < 19) return t('dash.evening');
  return t('dash.night');
});

// Skor "Penjual Terverifikasi" — dihitung API dari data nyata usaha.
const trustQ = useQuery({ queryKey: ['trust-me'], queryFn: async () => (await api.get('/trust/me')).data });
const TRUST_PARTS = ['traceability', 'response', 'sales', 'profile'] as const;
const trustParts = computed(() =>
  TRUST_PARTS.map((key) => ({ key, ...(trustQ.data.value?.parts?.[key] ?? { score: 0, max: 1 }) })),
);
/** Bagian dengan rasio terendah → satu saran perbaikan paling berdampak. */
const trustTip = computed(() => {
  if (!trustQ.data.value) return null;
  const weakest = [...trustParts.value].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  return weakest && weakest.score < weakest.max ? weakest.key : null;
});
</script>

<template>
  <div>
    <!-- Hero: sapaan + rantai nilai -->
    <section class="hero">
      <div class="hero-head">
        <div>
          <h2>{{ greeting }}, {{ auth.user?.fullName?.split(' ')[0] }} 👋</h2>
          <p class="hero-sub">{{ t('dash.sub', { company: auth.user?.companyName }) }}</p>
        </div>
        <RouterLink :to="{ name: 'insights' }" class="insight-pill" v-if="dash.data.value">
          <i class="pi pi-lightbulb" /> {{ t('dash.newInsights', { n: dash.data.value.insightCount }) }}
        </RouterLink>
      </div>
      <ChainBar :counts="chainCounts" />
    </section>

    <!-- Cuaca BMKG + saran WUTUH AI -->
    <WeatherCard class="wx-card" />

    <!-- KPI -->
    <section class="cards-grid kpis">
      <div class="kpi-card">
        <i class="pi pi-map" />
        <div class="meta"><span class="t">{{ t('dash.landsActive') }}</span><span class="v">{{ fmtQty(kpi.lands) }} <small>({{ fmtQty(kpi.landHa) }} ha)</small></span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-sync" />
        <div class="meta"><span class="t">{{ t('dash.cyclesRunning') }}</span><span class="v">{{ fmtQty(kpi.activeCycles) }}</span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-heart" />
        <div class="meta"><span class="t">{{ t('dash.livestock') }}</span><span class="v">{{ fmtQty(kpi.livestock) }} <small>{{ t('common.head') }}</small></span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-warehouse" />
        <div class="meta"><span class="t">{{ t('dash.stock') }}</span><span class="v">{{ fmtQty(kpi.stockQty) }} <small>{{ t('dash.stockKinds', { n: fmtQty(kpi.stockLines) }) }}</small></span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-arrow-down-left" />
        <div class="meta"><span class="t">{{ t('dash.incomeMonth') }}</span><span class="v good">{{ fmtMoney(kpi.monthIncome) }}</span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-arrow-up-right" />
        <div class="meta"><span class="t">{{ t('dash.expenseMonth') }}</span><span class="v bad">{{ fmtMoney(kpi.monthExpense) }}</span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-shopping-bag" />
        <div class="meta"><span class="t">{{ t('dash.openOrders') }}</span><span class="v">{{ fmtQty(kpi.openOrders) }} <small>{{ t('dash.listingsCount', { n: fmtQty(kpi.activeListings) }) }}</small></span></div>
      </div>
      <div class="kpi-card">
        <i class="pi pi-wifi" />
        <div class="meta"><span class="t">{{ t('dash.sensorsOnline') }}</span><span class="v">{{ fmtQty(kpi.devicesOnline) }}<small> / {{ fmtQty(kpi.devicesTotal) }}</small></span></div>
      </div>
    </section>

    <div class="two-col">
      <!-- Wawasan WUTUH AI -->
      <section class="panel">
        <div class="panel-head">
          <h3><i class="pi pi-microchip-ai" /> {{ t('dash.aiTitle') }}</h3>
          <RouterLink :to="{ name: 'insights' }"><Button :label="t('dash.all')" text size="small" icon="pi pi-arrow-right" iconPos="right" /></RouterLink>
        </div>
        <div v-if="dash.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
        <div v-else-if="!dash.data.value?.insights?.length" class="empty-note">{{ t('dash.noInsights') }}</div>
        <div v-else class="insight-list">
          <RouterLink
            v-for="(ins, i) in dash.data.value.insights"
            :key="i"
            :to="ins.route ?? '/ai/insights'"
            class="insight"
            :class="sevMeta[ins.severity]?.cls"
          >
            <i class="pi" :class="sevMeta[ins.severity]?.icon" />
            <div class="itxt">
              <span class="ititle">{{ ins.title }}</span>
              <span class="idetail">{{ ins.detail }}</span>
            </div>
            <span class="imod">{{ ins.module }}</span>
          </RouterLink>
        </div>
      </section>

      <!-- Harga pasar terkini -->
      <section class="panel">
        <div class="panel-head">
          <h3><i class="pi pi-chart-line" /> {{ t('dash.pricesTitle') }}</h3>
          <RouterLink :to="{ name: 'prices' }"><Button :label="t('dash.all')" text size="small" icon="pi pi-arrow-right" iconPos="right" /></RouterLink>
        </div>
        <div v-if="!dash.data.value?.latestPrices?.length" class="empty-note">{{ t('dash.noPrices') }}</div>
        <div v-else class="price-list">
          <div v-for="(p, i) in dash.data.value.latestPrices" :key="i" class="price-row">
            <span class="pname">{{ p.name }}</span>
            <span class="pdate">{{ fmtDate(p.date) }}</span>
            <span class="pval">{{ fmtMoney(p.price) }}<small>/{{ p.unit }}</small></span>
          </div>
        </div>
      </section>

      <!-- Skor Penjual Terverifikasi -->
      <section class="panel" v-if="trustQ.data.value">
        <div class="panel-head">
          <h3><i class="pi pi-verified" /> {{ t('trust.title') }}</h3>
          <TrustBadge :trust="trustQ.data.value" size="md" />
        </div>
        <div class="trust-body">
          <div class="trust-score">
            <span class="tnum">{{ trustQ.data.value.score }}</span>
            <small>/ 100</small>
          </div>
          <div class="trust-bars">
            <div v-for="p in trustParts" :key="p.key" class="tbar">
              <span class="tlabel">{{ t(`trust.part.${p.key}`) }}</span>
              <span class="ttrack"><span class="tfill" :style="{ width: `${(p.score / p.max) * 100}%` }" /></span>
              <span class="tval">{{ p.score }}/{{ p.max }}</span>
            </div>
          </div>
        </div>
        <p v-if="trustTip" class="trust-tip"><i class="pi pi-lightbulb" /> {{ t(`trust.tip.${trustTip}`) }}</p>
        <p class="trust-note">{{ t('trust.note') }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hero {
  background:
    radial-gradient(700px 280px at 90% -30%, color-mix(in srgb, var(--app-accent) 25%, transparent), transparent 65%),
    linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 14%, var(--app-surface)), var(--app-surface));
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 1.1rem 1.2rem 0.6rem;
  margin-bottom: 1rem;
}
.hero-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.8rem; flex-wrap: wrap; }
.hero h2 { margin: 0; }
.hero-sub { margin: 0.15rem 0 0.4rem; color: var(--app-text-muted); font-size: 0.88rem; }
.insight-pill {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--app-grad); color: #fff; text-decoration: none;
  font-size: 0.8rem; font-weight: 600; padding: 0.4rem 0.8rem; border-radius: 999px;
  white-space: nowrap; flex-shrink: 0;
}

.wx-card { margin-bottom: 1rem; }
.kpis { margin-bottom: 1rem; }
.v.good { color: var(--app-primary); }
.v.bad { color: var(--app-danger); }

.two-col { display: grid; grid-template-columns: 1.25fr 1fr; gap: 1rem; }
@media (max-width: 980px) {
  .two-col { grid-template-columns: 1fr; }
}
.panel {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  min-width: 0;
}
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.panel-head h3 { margin: 0; display: flex; align-items: center; gap: 0.45rem; font-size: 0.98rem; }
.panel-head h3 .pi { color: var(--app-primary); }

.insight-list { display: flex; flex-direction: column; gap: 0.45rem; }
.insight {
  display: flex; align-items: flex-start; gap: 0.6rem;
  border: 1px solid var(--app-border); border-radius: 10px;
  padding: 0.55rem 0.7rem; text-decoration: none; color: var(--app-text);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.insight:hover { background: var(--app-row-hover); }
.insight > .pi { margin-top: 2px; font-size: 0.95rem; }
.itxt { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
.ititle { font-weight: 600; font-size: 0.86rem; }
.idetail { font-size: 0.76rem; color: var(--app-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.imod { font-size: 0.66rem; font-weight: 700; color: var(--app-text-muted); background: var(--app-surface-2); border-radius: 6px; padding: 0.15rem 0.4rem; flex-shrink: 0; }
.sev-danger > .pi { color: var(--app-danger); }
.sev-warn > .pi { color: #d97706; }
.sev-good > .pi { color: var(--app-primary); }
.sev-info > .pi { color: var(--app-accent); }

.trust-body { display: flex; gap: 1rem; align-items: center; }
.trust-score { display: flex; align-items: baseline; gap: 0.15rem; flex-shrink: 0; }
.tnum { font-size: 2.3rem; font-weight: 800; color: var(--app-primary); line-height: 1; }
.trust-score small { color: var(--app-text-muted); font-weight: 600; }
.trust-bars { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.tbar { display: grid; grid-template-columns: 7.5rem 1fr 2.8rem; align-items: center; gap: 0.5rem; font-size: 0.76rem; }
.tlabel { color: var(--app-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ttrack { height: 7px; border-radius: 999px; background: var(--app-surface-2); overflow: hidden; }
.tfill { display: block; height: 100%; border-radius: 999px; background: var(--app-grad); }
.tval { text-align: right; font-variant-numeric: tabular-nums; color: var(--app-text-muted); }
.trust-tip {
  margin: 0.7rem 0 0; font-size: 0.8rem; display: flex; gap: 0.4rem; align-items: flex-start;
  background: color-mix(in srgb, #d97706 10%, transparent); border-radius: 8px; padding: 0.45rem 0.6rem;
}
.trust-tip .pi { color: #d97706; margin-top: 1px; }
.trust-note { margin: 0.5rem 0 0; font-size: 0.7rem; color: var(--app-text-muted); }

.price-list { display: flex; flex-direction: column; }
.price-row {
  display: flex; align-items: baseline; gap: 0.6rem;
  padding: 0.5rem 0.2rem; border-bottom: 1px dashed var(--app-border);
}
.price-row:last-child { border-bottom: none; }
.pname { font-weight: 600; font-size: 0.88rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdate { font-size: 0.72rem; color: var(--app-text-muted); flex-shrink: 0; }
.pval { font-weight: 700; font-size: 0.9rem; color: var(--app-primary); white-space: nowrap; }
.pval small { color: var(--app-text-muted); font-weight: 500; }
</style>
