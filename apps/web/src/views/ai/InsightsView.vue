<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import { api } from '@/lib/api';

const { t, locale } = useI18n();
const insights = useQuery({ queryKey: ['ai-insights'], queryFn: async () => (await api.get('/ai/insights')).data });
// Teks wawasan dibuat backend sesuai bahasa → muat ulang saat bahasa berganti.
watch(locale, () => insights.refetch());

const SEVS = ['bahaya', 'perhatian', 'peluang', 'info'];
const filter = ref<string | null>(null);
const filterOptions = computed(() => [
  { value: null, label: t('common.all') },
  ...SEVS.map((s) => ({ value: s, label: t(`enum.severity.${s}`) })),
]);

const sevMeta: Record<string, { icon: string; cls: string }> = {
  bahaya: { icon: 'pi-exclamation-triangle', cls: 'sev-danger' },
  perhatian: { icon: 'pi-bell', cls: 'sev-warn' },
  peluang: { icon: 'pi-thumbs-up', cls: 'sev-good' },
  info: { icon: 'pi-info-circle', cls: 'sev-info' },
};

const list = computed(() =>
  (insights.data.value ?? []).filter((i: any) => !filter.value || i.severity === filter.value),
);
const countBy = (sev: string) => (insights.data.value ?? []).filter((i: any) => i.severity === sev).length;
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>{{ t('insights.title') }}</h2>
        <p class="sub">{{ t('insights.sub') }}</p>
      </div>
      <Button icon="pi pi-refresh" text :loading="insights.isFetching.value" @click="insights.refetch()" v-tooltip.left="t('insights.refresh')" />
    </div>

    <div class="sev-summary">
      <div v-for="s in SEVS" :key="s" class="sev-chip" :class="sevMeta[s].cls">
        <i class="pi" :class="sevMeta[s].icon" /> {{ t(`enum.severity.${s}`) }}: <strong>{{ countBy(s) }}</strong>
      </div>
    </div>

    <SelectButton v-model="filter" :options="filterOptions" optionValue="value" optionLabel="label" :allowEmpty="false" size="small" style="margin-bottom: 0.9rem" />

    <div v-if="insights.isLoading.value" class="empty-note">{{ t('insights.analyzing') }}</div>
    <div v-else-if="!list.length" class="empty-note">{{ t('insights.noneFilter') }}</div>
    <div v-else class="insight-grid">
      <RouterLink v-for="(ins, i) in list" :key="i" :to="ins.route ?? ''" class="insight-card" :class="sevMeta[ins.severity]?.cls">
        <div class="ic-head">
          <i class="pi" :class="sevMeta[ins.severity]?.icon" />
          <span class="ic-module">WUTUH {{ ins.module }}</span>
        </div>
        <div class="ic-title">{{ ins.title }}</div>
        <div class="ic-detail">{{ ins.detail }}</div>
        <span class="ic-go">{{ t('insights.open') }} <i class="pi pi-arrow-right" /></span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.sub { margin: 0.2rem 0 0; color: var(--app-text-muted); font-size: 0.85rem; max-width: 620px; }
.sev-summary { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.sev-chip {
  display: inline-flex; align-items: center; gap: 0.4rem;
  border: 1px solid var(--app-border); border-radius: 999px;
  padding: 0.3rem 0.7rem; font-size: 0.8rem; background: var(--app-surface);
}
.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 0.8rem;
}
@media (max-width: 560px) { .insight-grid { grid-template-columns: 1fr; } }
.insight-card {
  display: flex; flex-direction: column; gap: 0.35rem;
  background: var(--app-surface); border: 1px solid var(--app-border);
  border-left: 4px solid var(--app-border-strong);
  border-radius: 12px; padding: 0.85rem 0.95rem;
  text-decoration: none; color: var(--app-text);
  transition: transform 0.12s ease, border-color 0.15s ease;
}
.insight-card:hover { transform: translateY(-2px); }
.ic-head { display: flex; align-items: center; justify-content: space-between; }
.ic-module { font-size: 0.66rem; font-weight: 700; color: var(--app-text-muted); background: var(--app-surface-2); padding: 0.15rem 0.45rem; border-radius: 6px; }
.ic-title { font-weight: 700; font-size: 0.92rem; }
.ic-detail { font-size: 0.8rem; color: var(--app-text-muted); flex: 1; }
.ic-go { font-size: 0.75rem; font-weight: 600; color: var(--app-primary); display: inline-flex; align-items: center; gap: 0.3rem; }
.ic-go .pi { font-size: 0.65rem; }

.sev-danger { border-left-color: var(--app-danger); }
.sev-danger .ic-head > .pi { color: var(--app-danger); }
.sev-warn { border-left-color: #d97706; }
.sev-warn .ic-head > .pi { color: #d97706; }
.sev-good { border-left-color: var(--app-primary); }
.sev-good .ic-head > .pi { color: var(--app-primary); }
.sev-info { border-left-color: var(--app-accent); }
.sev-info .ic-head > .pi { color: var(--app-accent); }
</style>
