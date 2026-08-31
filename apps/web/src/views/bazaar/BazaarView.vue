<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { api } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { produceEmoji, produceTint } from '@/lib/produce';
import TrustBadge from '@/components/TrustBadge.vue';
import BazaarHeader from './BazaarHeader.vue';

const { t } = useI18n();
const { fmtQty, fmtMoney } = useFmt();

const searchInput = ref('');
const search = ref('');
const category = ref<string | null>(null);
const sort = ref('terbaru');

const CATS = ['pangan', 'hortikultura', 'perkebunan', 'ternak', 'perikanan', 'olahan'];
const catChips = computed(() => [
  { value: null as string | null, label: t('bazaar.all'), emo: '🧺' },
  ...CATS.map((c) => ({ value: c as string | null, label: t(`enum.commodityCat.${c}`), emo: produceEmoji(null, null, c) })),
]);
const sortOptions = computed(() => [
  { value: 'terbaru', label: t('bazaar.sortNew') },
  { value: 'termurah', label: t('bazaar.sortCheap') },
  { value: 'termahal', label: t('bazaar.sortExp') },
]);

const query = useQuery({
  queryKey: computed(() => ['bazaar-list', search.value, category.value, sort.value]),
  queryFn: async () =>
    (await api.get('/bazaar/listings', {
      params: {
        search: search.value || undefined,
        category: category.value || undefined,
        sort: sort.value,
      },
    })).data,
});

function doSearch() {
  search.value = searchInput.value.trim();
}
const regionOf = (r: any) => [r.sellerRegency, r.sellerProvince].filter(Boolean).join(', ');
</script>

<template>
  <div class="bz-page">
    <BazaarHeader />

    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <h1>{{ t('bazaar.brand') }}</h1>
        <p class="tagline">{{ t('bazaar.tagline') }}</p>
        <form class="searchrow" @submit.prevent="doSearch">
          <InputText v-model="searchInput" :placeholder="t('bazaar.searchPh')" class="searchin" />
          <Button type="submit" icon="pi pi-search" rounded />
        </form>
        <div class="chips">
          <button
            v-for="c in catChips"
            :key="c.label"
            class="chip"
            :class="{ on: category === c.value }"
            @click="category = c.value"
          >
            <span class="emo">{{ c.emo }}</span> {{ c.label }}
          </button>
        </div>
      </div>
    </section>

    <!-- Toolbar + grid -->
    <main class="bz-main">
      <div class="toolbar">
        <span class="count">{{ t('bazaar.results', { n: query.data.value?.length ?? 0 }) }}</span>
        <Select v-model="sort" :options="sortOptions" optionValue="value" optionLabel="label" size="small" />
      </div>

      <div v-if="query.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
      <div v-else-if="!query.data.value?.length" class="bz-empty">
        <span class="big">🌾</span>
        <p>{{ t('bazaar.empty') }}</p>
      </div>
      <div v-else class="grid">
        <RouterLink
          v-for="r in query.data.value"
          :key="r.id"
          :to="{ name: 'bazaar-detail', params: { id: r.id } }"
          class="card"
        >
          <div class="tile" :style="r.photoUrl ? undefined : { background: produceTint(r.category) }">
            <img v-if="r.photoUrl" :src="r.photoUrl" class="tphoto" alt="" loading="lazy" />
            <span v-else class="emo">{{ produceEmoji(r.commodityCode, r.commodityName, r.category) }}</span>
            <span v-if="r.minOrder" class="badge">{{ t('bazaar.minOrder', { n: fmtQty(r.minOrder), unit: r.unit }) }}</span>
          </div>
          <div class="body">
            <div class="title">{{ r.title }}</div>
            <div class="price">{{ fmtMoney(r.pricePerUnit) }}<small>/{{ r.unit }}</small></div>
            <div class="meta">{{ t('bazaar.stock', { n: fmtQty(r.qty), unit: r.unit }) }}</div>
            <div class="seller">
              <span class="sname">🧑‍🌾 {{ r.sellerName }}</span>
              <TrustBadge :trust="r.sellerTrust" hide-new />
              <span v-if="regionOf(r)" class="sregion">📍 {{ regionOf(r) }}</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </main>
  </div>
</template>

<style scoped>
.bz-page { min-height: 100vh; background: var(--app-bg); }

.hero {
  background:
    radial-gradient(900px 360px at 85% -40%, rgba(255, 255, 255, 0.14), transparent 60%),
    linear-gradient(135deg, #14532d 0%, #15803d 45%, #0e7490 100%);
  color: #fff;
  padding: 2.2rem 1.25rem 1.6rem;
}
.hero-inner { max-width: 1120px; margin: 0 auto; }
h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.3rem); letter-spacing: 0.02em; }
.tagline { margin: 0.3rem 0 1.1rem; opacity: 0.92; font-size: 0.95rem; max-width: 46em; }
.searchrow { display: flex; gap: 0.5rem; max-width: 560px; }
.searchin { flex: 1; border-radius: 999px; padding-left: 1.1rem; }
.chips { display: flex; gap: 0.45rem; margin-top: 1rem; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip {
  display: inline-flex; align-items: center; gap: 0.35rem; flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.35); background: rgba(255, 255, 255, 0.12);
  color: #fff; font-weight: 600; font-size: 0.8rem; padding: 0.35rem 0.8rem;
  border-radius: 999px; cursor: pointer; font-family: inherit;
}
.chip.on { background: #fff; color: #14532d; border-color: #fff; }
.chip .emo { font-size: 0.95rem; }

.bz-main { max-width: 1120px; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin: 0.4rem 0 0.9rem; }
.count { font-size: 0.85rem; color: var(--app-text-muted); font-weight: 600; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
  gap: 0.9rem;
}
@media (max-width: 560px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
}
.card {
  background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 14px;
  overflow: hidden; text-decoration: none; color: var(--app-text);
  display: flex; flex-direction: column;
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}
.card:hover { transform: translateY(-3px); border-color: var(--app-primary); box-shadow: 0 10px 26px rgba(10, 40, 20, 0.12); }
.tile { position: relative; height: 118px; display: grid; place-items: center; overflow: hidden; }
.tile .emo { font-size: 3rem; filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18)); }
.tphoto { width: 100%; height: 100%; object-fit: cover; display: block; }
.badge {
  position: absolute; top: 8px; left: 8px;
  background: var(--app-surface); color: var(--app-text-muted);
  font-size: 0.66rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px;
  border: 1px solid var(--app-border);
}
.body { padding: 0.65rem 0.8rem 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
.title {
  font-weight: 700; font-size: 0.9rem; line-height: 1.25;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: 2.3em;
}
.price { font-weight: 800; font-size: 1.05rem; color: var(--app-primary); }
.price small { color: var(--app-text-muted); font-weight: 600; font-size: 0.72rem; }
.meta { font-size: 0.74rem; color: var(--app-text-muted); }
.seller { margin-top: auto; padding-top: 0.4rem; border-top: 1px dashed var(--app-border); display: flex; flex-direction: column; gap: 0.15rem; }
.sname { font-size: 0.76rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sregion { font-size: 0.7rem; color: var(--app-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.bz-empty { text-align: center; padding: 3rem 1rem; color: var(--app-text-muted); }
.bz-empty .big { font-size: 3rem; display: block; margin-bottom: 0.6rem; }
.empty-note { padding: 1.5rem; color: var(--app-text-muted); }
</style>
