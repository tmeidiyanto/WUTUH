<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { STAGES, STAGE_ICONS, type Stage } from '@/lib/stages';

defineProps<{
  /** Jumlah siklus per tahap: { land: 2, ... }; opsional. */
  counts?: Partial<Record<string, number>>;
  /** Tahap yang di-highlight (mis. tahap siklus saat ini). */
  activeStage?: string;
  compact?: boolean;
}>();

const { t } = useI18n();
const icon = (s: Stage) => STAGE_ICONS[s];
</script>

<template>
  <div class="chain" :class="{ compact }">
    <template v-for="(s, i) in STAGES" :key="s">
      <div
        class="node"
        :class="{
          active: activeStage === s,
          filled: (counts?.[s] ?? 0) > 0,
          passed: activeStage && STAGES.indexOf(s) < STAGES.indexOf(activeStage as Stage),
        }"
      >
        <span class="ic"><i class="pi" :class="icon(s)" /></span>
        <span class="lbl">{{ t(`stage.${s}`) }}</span>
        <span v-if="counts && (counts[s] ?? 0) > 0" class="cnt">{{ counts[s] }}</span>
      </div>
      <i v-if="i < STAGES.length - 1" class="pi pi-angle-right arrow" />
    </template>
  </div>
</template>

<style scoped>
.chain {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  overflow-x: auto;
  padding: 0.5rem 0.2rem 0.65rem;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.28rem;
  min-width: 66px;
  padding: 0.5rem 0.3rem;
  border-radius: 10px;
  position: relative;
  flex-shrink: 0;
  color: var(--app-text-muted);
}
.node .ic {
  width: 34px; height: 34px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--app-surface-2);
  border: 1.5px solid var(--app-border-strong);
  font-size: 0.95rem;
  transition: all 0.15s ease;
}
.node .lbl { font-size: 0.66rem; font-weight: 600; white-space: nowrap; }
.node.filled .ic {
  background: color-mix(in srgb, var(--app-primary) 14%, transparent);
  border-color: var(--app-primary);
  color: var(--app-primary);
}
.node.filled { color: var(--app-text); }
.node.passed .ic {
  background: color-mix(in srgb, var(--app-primary) 18%, transparent);
  border-color: var(--app-primary);
  color: var(--app-primary);
}
.node.active .ic {
  background: var(--app-grad);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-primary) 22%, transparent);
}
.node.active { color: var(--app-text); }
.cnt {
  position: absolute; top: 2px; right: 6px;
  background: var(--app-accent); color: #fff;
  font-size: 0.62rem; font-weight: 700;
  min-width: 16px; height: 16px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 4px;
}
.arrow { color: var(--app-border-strong); font-size: 0.75rem; flex-shrink: 0; }
.compact .node { min-width: 52px; padding: 0.3rem 0.15rem; }
.compact .node .ic { width: 26px; height: 26px; font-size: 0.75rem; }
.compact .node .lbl { font-size: 0.58rem; }
</style>
