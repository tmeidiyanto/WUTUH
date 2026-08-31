<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * Lencana "Penjual Terverifikasi" — dihitung API dari data nyata
 * (ketertelusuran, kecepatan respons, transaksi selesai, kelengkapan profil).
 */
const props = withDefaults(
  defineProps<{
    trust?: { score: number; tier: string } | null;
    /** Sembunyikan bila tier masih 'baru' (untuk kartu pasar agar tidak ramai). */
    hideNew?: boolean;
    showScore?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { trust: null, hideNew: false, showScore: false, size: 'sm' },
);

const { t } = useI18n();
const tier = computed(() => props.trust?.tier ?? null);
const visible = computed(() => !!tier.value && !(props.hideNew && tier.value === 'baru'));
const icon = computed(() =>
  tier.value === 'terverifikasi' ? 'pi-verified' : tier.value === 'tepercaya' ? 'pi-shield' : 'pi-user',
);
</script>

<template>
  <span v-if="visible" class="tbadge" :class="[tier, size]" :title="t('trust.tooltip', { score: trust!.score })">
    <i class="pi" :class="icon" />
    {{ t(`trust.tier.${tier}`) }}<template v-if="showScore"> · {{ trust!.score }}</template>
  </span>
</template>

<style scoped>
.tbadge {
  display: inline-flex; align-items: center; gap: 0.28rem;
  border-radius: 999px; font-weight: 700; white-space: nowrap;
  padding: 0.14rem 0.55rem; font-size: 0.68rem; line-height: 1.35;
}
.tbadge.md { padding: 0.24rem 0.75rem; font-size: 0.78rem; }
.tbadge .pi { font-size: 0.82em; }
.tbadge.terverifikasi { background: linear-gradient(120deg, #15803d, #0369a1); color: #fff; }
.tbadge.tepercaya {
  background: color-mix(in srgb, #0369a1 14%, transparent);
  color: #0369a1; border: 1px solid color-mix(in srgb, #0369a1 40%, transparent);
}
.tbadge.baru {
  background: var(--app-surface-2, #f1f5f1); color: var(--app-text-muted, #64748b);
  border: 1px solid var(--app-border, #dde5de);
}
</style>
