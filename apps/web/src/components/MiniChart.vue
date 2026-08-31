<script setup lang="ts">
import { computed } from 'vue';

/** Grafik garis SVG ringan (tanpa dependensi chart) — untuk harga & sensor. */
const props = withDefaults(
  defineProps<{
    values: number[];
    labels?: string[];
    height?: number;
    min?: number | null;
    max?: number | null;
    formatValue?: (v: number) => string;
  }>(),
  { height: 120, min: null, max: null },
);

const W = 600;
const PAD = 8;

const domain = computed(() => {
  const vals = [...props.values];
  if (props.min != null) vals.push(props.min);
  if (props.max != null) vals.push(props.max);
  if (!vals.length) return { lo: 0, hi: 1 };
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  return { lo: lo - pad, hi: hi + pad };
});

const pts = computed(() => {
  const { lo, hi } = domain.value;
  const n = props.values.length;
  if (n === 0) return [];
  const h = props.height;
  return props.values.map((v, i) => {
    const x = n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1);
    const y = h - PAD - ((v - lo) / (hi - lo)) * (h - PAD * 2);
    return [x, y] as const;
  });
});

const linePath = computed(() => pts.value.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
const areaPath = computed(() => {
  if (!pts.value.length) return '';
  const h = props.height;
  const first = pts.value[0];
  const last = pts.value[pts.value.length - 1];
  return `${linePath.value} L${last[0].toFixed(1)},${h - PAD} L${first[0].toFixed(1)},${h - PAD} Z`;
});

const yFor = (v: number) => {
  const { lo, hi } = domain.value;
  return props.height - PAD - ((v - lo) / (hi - lo)) * (props.height - PAD * 2);
};

const lastPoint = computed(() => pts.value[pts.value.length - 1] ?? null);
const lastValue = computed(() => props.values[props.values.length - 1]);
</script>

<template>
  <div class="minichart">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" :style="{ height: `${height}px` }">
      <defs>
        <linearGradient id="mc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--app-primary)" stop-opacity="0.28" />
          <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <line v-if="min != null" :x1="PAD" :x2="W - PAD" :y1="yFor(min)" :y2="yFor(min)" class="threshold" />
      <line v-if="max != null" :x1="PAD" :x2="W - PAD" :y1="yFor(max)" :y2="yFor(max)" class="threshold" />
      <path v-if="areaPath" :d="areaPath" fill="url(#mc-fill)" stroke="none" />
      <path v-if="linePath" :d="linePath" class="line" fill="none" />
      <circle v-if="lastPoint" :cx="lastPoint[0]" :cy="lastPoint[1]" r="4" class="dotend" />
    </svg>
    <div v-if="labels?.length" class="xlabels">
      <span>{{ labels[0] }}</span>
      <span v-if="lastValue != null" class="lastv">{{ formatValue ? formatValue(lastValue) : lastValue }}</span>
      <span>{{ labels[labels.length - 1] }}</span>
    </div>
  </div>
</template>

<style scoped>
.minichart { width: 100%; }
svg { width: 100%; display: block; }
.line { stroke: var(--app-primary); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.dotend { fill: var(--app-accent); stroke: var(--app-surface); stroke-width: 2; }
.threshold { stroke: var(--app-danger); stroke-width: 1; stroke-dasharray: 5 5; opacity: 0.55; vector-effect: non-scaling-stroke; }
.xlabels { display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: var(--app-text-muted); margin-top: 0.25rem; }
.lastv { font-weight: 700; color: var(--app-text); font-size: 0.8rem; }
</style>
