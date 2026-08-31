<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { produceEmoji } from '@/lib/produce';
import { STAGES, stageIndex, type Stage } from '@/lib/stages';
import TrustBadge from '@/components/TrustBadge.vue';
import BazaarHeader from '@/views/bazaar/BazaarHeader.vue';

const route = useRoute();
const { t } = useI18n();
const { fmtQty, fmtDate, fmtDateTime } = useFmt();

const code = computed(() => String(route.params.code));
const query = useQuery({
  queryKey: computed(() => ['public-trace', code.value]),
  queryFn: async () => (await api.get(`/public/trace/${code.value}`)).data,
  retry: false,
});
const r = computed(() => query.data.value);

const stageLbl = (s: string) => (STAGES.includes(s as Stage) ? t(`stage.${s}`) : s);
const actLbl = (v: string) => t(`enum.activity.${v}`);
const landUseLbl = (v: string) => t(`enum.landUse.${v}`);
const bizLbl = (v: string) => t(`login.types.${v}`);
const curIdx = computed(() => stageIndex(r.value?.cycle?.stage ?? ''));

const qrDataUrl = ref<string | null>(null);
watch(
  r,
  async (v) => {
    if (v && !qrDataUrl.value) qrDataUrl.value = await QRCode.toDataURL(location.href, { margin: 1, width: 180 });
  },
  { immediate: true },
);
</script>

<template>
  <div class="pt-page">
    <BazaarHeader />

    <main class="pt-main">
      <div v-if="query.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>

      <div v-else-if="query.isError.value" class="nf">
        <span class="nf-emo">🔍</span>
        <p>{{ t('trace.notFoundPage') }}</p>
        <RouterLink :to="{ name: 'bazaar' }" class="nf-link">{{ t('bazaar.brand') }} →</RouterLink>
      </div>

      <article v-else-if="r" class="paper">
        <!-- Badge terverifikasi -->
        <header class="vhead">
          <span class="vbadge"><i class="pi pi-verified" /> {{ t('trace.verified') }}</span>
          <p class="vsub">{{ t('trace.verifiedSub') }}</p>
        </header>

        <!-- Produk + produsen -->
        <section class="hero">
          <span class="hero-emo">{{ produceEmoji(null, r.commodity?.name, r.commodity?.category) }}</span>
          <div class="hero-body">
            <h1>{{ r.commodity?.name }}</h1>
            <p class="hero-cycle">{{ r.cycle.name }} · <code>{{ r.cycle.code }}</code></p>
            <p class="hero-prod">
              🧑‍🌾 <strong>{{ r.producer?.name }}</strong>
              <TrustBadge :trust="r.producer?.trust" hide-new />
              — {{ r.producer ? bizLbl(r.producer.businessType) : '' }}
              <template v-if="r.producer?.regency || r.producer?.province">
                · 📍 {{ [r.producer?.regency, r.producer?.province].filter(Boolean).join(', ') }}
              </template>
            </p>
            <p v-if="r.land" class="hero-land">
              {{ t('trace.land') }}: {{ r.land.name }} ({{ landUseLbl(r.land.landUse) }}, {{ fmtQty(r.land.areaHa) }} ha)<template v-if="r.land.village"> · {{ r.land.village }}</template>
            </p>
          </div>
          <img v-if="qrDataUrl" :src="qrDataUrl" class="hero-qr" alt="QR" />
        </section>

        <!-- Rantai -->
        <section>
          <h2>{{ t('trace.journey') }}</h2>
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

        <!-- Linimasa -->
        <section v-if="r.history.length">
          <h2>{{ t('trace.history') }}</h2>
          <div class="timeline">
            <div v-for="(h, i) in r.history" :key="i" class="tl">
              <span class="tl-dot" />
              <div class="tl-b">
                <strong>{{ stageLbl(h.toStage) }}</strong>
                <small>{{ fmtDateTime(h.at) }}</small>
                <span v-if="h.note" class="tl-note">{{ h.note }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Kegiatan (tanpa biaya) -->
        <section v-if="r.activities.length">
          <h2>{{ t('trace.activities') }}</h2>
          <table class="tbl">
            <thead><tr><th style="width: 22%">{{ t('common.date') }}</th><th style="width: 24%">{{ t('trace.aType') }}</th><th>{{ t('trace.aDesc') }}</th></tr></thead>
            <tbody>
              <tr v-for="(a, i) in r.activities" :key="i">
                <td>{{ fmtDate(a.activityDate) }}</td>
                <td>{{ actLbl(a.activityType) }}</td>
                <td>
                  <span class="cell-ph">
                    <a v-if="a.photoUrl" :href="a.photoUrl" target="_blank" rel="noopener"><img :src="a.photoUrl" class="row-ph" alt="" loading="lazy" /></a>
                    {{ a.description ?? '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Panen -->
        <section v-if="r.harvests.length">
          <h2>{{ t('trace.harvestsT') }}</h2>
          <table class="tbl">
            <thead><tr><th style="width: 25%">{{ t('common.date') }}</th><th class="num" style="width: 25%">{{ t('common.qty') }}</th><th>{{ t('trace.hvQuality') }}</th></tr></thead>
            <tbody>
              <tr v-for="(h, i) in r.harvests" :key="i">
                <td>{{ fmtDate(h.harvestDate) }}</td>
                <td class="num">{{ fmtQty(h.qty) }} {{ h.unit }}</td>
                <td>
                  <span class="cell-ph">
                    <a v-if="h.photoUrl" :href="h.photoUrl" target="_blank" rel="noopener"><img :src="h.photoUrl" class="row-ph" alt="" loading="lazy" /></a>
                    {{ h.quality ?? '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot><tr><td>{{ t('trace.hvTotal') }}</td><td class="num"><strong>{{ fmtQty(r.totalHarvest) }} {{ r.commodity?.unit }}</strong></td><td /></tr></tfoot>
          </table>
        </section>

        <!-- CTA beli -->
        <RouterLink v-if="r.listing" :to="{ name: 'bazaar-detail', params: { id: r.listing.id } }" class="buy-cta">
          🧺 {{ t('trace.buyCta') }} <i class="pi pi-arrow-right" />
        </RouterLink>

        <footer class="foot">🌾 {{ t('app.philosophy') }} — WUTUH · {{ t('app.tagline') }} · <code>{{ r.traceCode }}</code></footer>
      </article>
    </main>
  </div>
</template>

<style scoped>
.pt-page { min-height: 100vh; background: var(--app-bg); }
.pt-main { max-width: 780px; margin: 0 auto; padding: 1.2rem 1.25rem 3rem; }
.empty-note { padding: 1.5rem; color: var(--app-text-muted); }

.nf { text-align: center; padding: 3.5rem 1rem; color: var(--app-text-muted); }
.nf-emo { font-size: 3rem; display: block; margin-bottom: 0.6rem; }
.nf-link { color: var(--app-primary); font-weight: 700; text-decoration: none; }

.paper {
  --ink: #17261c; --muted: #5d6f63; --line: #dde5de; --band: #f2f7f2;
  --green: #15803d; --blue: #0369a1;
  background: #fff; color: var(--ink); border-radius: 14px;
  box-shadow: 0 14px 44px rgba(8, 30, 16, 0.25);
  padding: 1.6rem 1.8rem 1.4rem;
}
.paper h2 {
  font-size: 0.76rem; letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--green); border-bottom: 2px solid var(--line);
  padding-bottom: 0.3rem; margin: 1.3rem 0 0.6rem;
}

.vhead { text-align: center; margin-bottom: 0.9rem; }
.vbadge {
  display: inline-flex; align-items: center; gap: 0.45rem;
  background: linear-gradient(120deg, var(--green), var(--blue)); color: #fff;
  font-weight: 800; font-size: 0.92rem; padding: 0.45rem 1.1rem; border-radius: 999px;
}
.vsub { margin: 0.5rem 0 0; color: var(--muted); font-size: 0.78rem; }

.hero { display: flex; gap: 1rem; align-items: flex-start; border-bottom: 3px solid var(--green); padding-bottom: 0.9rem; }
.hero-emo { font-size: 3rem; }
.hero-body { flex: 1; min-width: 0; }
.hero-body h1 { margin: 0; font-size: 1.4rem; }
.hero-cycle { margin: 0.1rem 0 0.4rem; color: var(--muted); font-size: 0.82rem; }
.hero-cycle code { background: var(--band); padding: 0.05rem 0.4rem; border-radius: 5px; }
.hero-prod { margin: 0; font-size: 0.88rem; }
.hero-land { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.8rem; }
.hero-qr { width: 84px; height: 84px; border: 1px solid var(--line); border-radius: 8px; flex-shrink: 0; }
@media (max-width: 560px) { .hero-qr { display: none; } }

.chain { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.3rem; }
.cnode { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.5rem 0.18rem 0.22rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
.cdot { width: 18px; height: 18px; border-radius: 50%; background: var(--band); color: var(--muted); display: inline-flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 700; }
.clbl { font-size: 0.68rem; font-weight: 600; white-space: nowrap; }
.cnode.done { border-color: var(--green); color: var(--ink); }
.cnode.done .cdot { background: var(--green); color: #fff; }
.cnode.cur { border-color: var(--blue); color: var(--ink); box-shadow: 0 0 0 2px rgba(3, 105, 161, 0.18); }
.cnode.cur .cdot { background: var(--blue); color: #fff; }
.carrow { color: var(--line); font-weight: 700; }

.timeline { display: flex; flex-direction: column; }
.tl { display: flex; gap: 0.6rem; padding: 0.28rem 0; border-left: 2px solid var(--line); margin-left: 5px; padding-left: 0.8rem; position: relative; }
.tl-dot { position: absolute; left: -6px; top: 0.55rem; width: 10px; height: 10px; border-radius: 50%; background: var(--green); border: 2px solid #fff; }
.tl-b { display: flex; gap: 0.55rem; align-items: baseline; flex-wrap: wrap; font-size: 0.84rem; }
.tl-b small { color: var(--muted); }
.tl-note { color: var(--muted); font-size: 0.78rem; }

.tbl { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.tbl th { text-align: left; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); background: var(--band); padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--line); }
.tbl td { padding: 0.38rem 0.55rem; border-bottom: 1px solid var(--line); vertical-align: top; }
.tbl tfoot td { background: var(--band); font-weight: 600; border-bottom: none; }
.tbl .num, .tbl th.num { text-align: right; font-variant-numeric: tabular-nums; }
.cell-ph { display: flex; align-items: center; gap: 0.45rem; }
.row-ph { width: 30px; height: 30px; border-radius: 5px; object-fit: cover; display: block; border: 1px solid var(--line); }

.buy-cta {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  margin-top: 1.4rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none;
  background: linear-gradient(120deg, var(--green), var(--blue)); color: #fff; font-weight: 800; font-size: 0.95rem;
}
.buy-cta:hover { filter: brightness(1.06); }
.foot { margin-top: 1.4rem; padding-top: 0.7rem; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.7rem; font-style: italic; text-align: center; }
.foot code { background: var(--band); padding: 0.05rem 0.4rem; border-radius: 5px; font-style: normal; }
</style>
