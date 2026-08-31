<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { STAGES, stageIcon, stageIndex, type Stage } from '@/lib/stages';

const props = defineProps<{ stage: string }>();
const { t } = useI18n();

const label = computed(() => (STAGES.includes(props.stage as Stage) ? t(`stage.${props.stage}`) : props.stage));

/** Warna bergeser dari hijau (hulu) ke biru (hilir) mengikuti posisi di rantai. */
const cls = computed(() => {
  const i = stageIndex(props.stage);
  if (i < 0) return 'neutral';
  if (i <= 4) return 'upstream';
  if (i <= 8) return 'midstream';
  return 'downstream';
});
</script>

<template>
  <span class="stage-tag" :class="cls">
    <i class="pi" :class="stageIcon(stage)" />
    {{ label }}
  </span>
</template>

<style scoped>
.stage-tag {
  display: inline-flex; align-items: center; gap: 0.32rem;
  padding: 0.18rem 0.55rem; border-radius: 999px;
  font-size: 0.76rem; font-weight: 600; white-space: nowrap;
}
.stage-tag .pi { font-size: 0.7rem; }
.upstream { background: color-mix(in srgb, #16a34a 15%, transparent); color: #15803d; }
.midstream { background: color-mix(in srgb, #0d9488 15%, transparent); color: #0f766e; }
.downstream { background: color-mix(in srgb, #0284c7 15%, transparent); color: #0369a1; }
.neutral { background: var(--app-surface-2); color: var(--app-text-muted); }
:global(html.dark) .upstream { color: #4ade80; }
:global(html.dark) .midstream { color: #2dd4bf; }
:global(html.dark) .downstream { color: #38bdf8; }
</style>
