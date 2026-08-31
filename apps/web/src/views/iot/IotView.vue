<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import MiniChart from '@/components/MiniChart.vue';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty, fmtDateTime } = useFmt();

const devices = useQuery({ queryKey: ['iot-devices'], queryFn: async () => (await api.get('/iot/devices')).data });
const lands = useQuery({ queryKey: ['lands'], queryFn: async () => (await api.get('/lands')).data });
const canWrite = computed(() => auth.can('iot.write'));

const TYPES: Array<{ value: string; unit: string }> = [
  { value: 'kelembapan_tanah', unit: '%' },
  { value: 'suhu_udara', unit: '°C' },
  { value: 'kelembapan_udara', unit: '%' },
  { value: 'ph_tanah', unit: 'pH' },
  { value: 'level_air', unit: 'cm' },
  { value: 'curah_hujan', unit: 'mm' },
];
const typeOptions = computed(() => TYPES.map((o) => ({ value: o.value, label: t(`enum.deviceType.${o.value}`) })));
const typeLabel = (v: string) => (TYPES.some((o) => o.value === v) ? t(`enum.deviceType.${v}`) : v);

// Grafik per perangkat yang dipilih
const selected = ref<any | null>(null);
const readings = useQuery({
  queryKey: computed(() => ['iot-readings', selected.value?.id]),
  queryFn: async () => (await api.get(`/iot/devices/${selected.value.id}/readings`, { params: { hours: 48 } })).data,
  enabled: computed(() => !!selected.value),
});
const showChart = computed({ get: () => !!selected.value, set: (v) => { if (!v) selected.value = null; } });
const chartValues = computed(() => (readings.data.value ?? []).map((r: any) => Number(r.value)));
const chartLabels = computed(() => {
  const rows = readings.data.value ?? [];
  if (!rows.length) return [];
  return [fmtDateTime(rows[0].readAt), fmtDateTime(rows[rows.length - 1].readAt)];
});

const show = ref(false);
const form = ref({ code: '', name: '', deviceType: 'kelembapan_tanah', landId: '', unit: '%', minThreshold: '', maxThreshold: '' });
function onTypeChange() {
  const tp = TYPES.find((o) => o.value === form.value.deviceType);
  if (tp) form.value.unit = tp.unit;
}
const save = useMutation({
  mutationFn: async () =>
    (await api.post('/iot/devices', {
      code: form.value.code,
      name: form.value.name,
      deviceType: form.value.deviceType,
      landId: form.value.landId || undefined,
      unit: form.value.unit,
      minThreshold: form.value.minThreshold ? String(form.value.minThreshold) : undefined,
      maxThreshold: form.value.maxThreshold ? String(form.value.maxThreshold) : undefined,
    })).data,
  onSuccess: (d) => {
    toast.add({ severity: 'success', summary: t('iot.registered'), detail: `API key: ${d.apiKey}`, life: 6000 });
    show.value = false;
    form.value = { code: '', name: '', deviceType: 'kelembapan_tanah', landId: '', unit: '%', minThreshold: '', maxThreshold: '' };
    qc.invalidateQueries({ queryKey: ['iot-devices'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

function copyKey(key: string) {
  navigator.clipboard?.writeText(key);
  toast.add({ severity: 'info', summary: t('iot.copied'), life: 1500 });
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>{{ t('iot.title') }}</h2>
        <p class="sub">{{ t('iot.sub', { endpoint: 'POST /api/iot/ingest' }) }}</p>
      </div>
      <Button v-if="canWrite" :label="t('iot.register')" icon="pi pi-plus" @click="show = true" />
    </div>

    <div v-if="devices.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
    <div v-else-if="!devices.data.value?.length" class="empty-note">{{ t('iot.empty') }}</div>
    <div v-else class="dev-grid">
      <div v-for="d in devices.data.value" :key="d.id" class="dev-card" @click="selected = d">
        <div class="dev-head">
          <span class="dev-status" :class="{ online: d.online }" />
          <div class="dev-names">
            <div class="dev-name">{{ d.name }}</div>
            <div class="dev-sub">{{ d.code }} · {{ typeLabel(d.deviceType) }}{{ d.landName ? ` · ${d.landName}` : '' }}</div>
          </div>
          <Tag :value="d.online ? t('iot.online') : t('iot.offline')" :severity="d.online ? 'success' : 'danger'" />
        </div>
        <div class="dev-value">
          <template v-if="d.lastValue != null">
            <span class="val">{{ fmtQty(d.lastValue) }}<small>{{ d.unit }}</small></span>
            <span class="at">{{ fmtDateTime(d.lastReadAt) }}</span>
          </template>
          <span v-else class="at">{{ t('iot.noDataYet') }}</span>
        </div>
        <div class="dev-range" v-if="d.minThreshold != null || d.maxThreshold != null">
          {{ t('iot.range', { min: d.minThreshold ?? '—', max: d.maxThreshold ?? '—', unit: d.unit }) }}
        </div>
        <button class="key-btn" @click.stop="copyKey(d.apiKey)"><i class="pi pi-key" /> {{ t('iot.copyKey') }}</button>
      </div>
    </div>

    <!-- Grafik bacaan -->
    <Dialog v-model:visible="showChart" modal :style="{ width: '640px' }" :header="selected ? t('iot.chartTitle', { name: selected.name }) : ''">
      <div v-if="readings.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
      <div v-else-if="!chartValues.length" class="empty-note">{{ t('iot.noReadings') }}</div>
      <MiniChart
        v-else
        :values="chartValues"
        :labels="chartLabels"
        :height="180"
        :min="selected?.minThreshold != null ? Number(selected.minThreshold) : null"
        :max="selected?.maxThreshold != null ? Number(selected.maxThreshold) : null"
        :formatValue="(v) => `${fmtQty(v)}${selected?.unit ?? ''}`"
      />
      <p v-if="selected?.minThreshold != null || selected?.maxThreshold != null" class="chart-note">{{ t('iot.chartNote') }}</p>
    </Dialog>

    <!-- Daftarkan perangkat -->
    <Dialog v-model:visible="show" :header="t('iot.register')" modal :style="{ width: '480px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.code') }}</label><InputText v-model="form.code" maxlength="20" placeholder="SNS-004" fluid /></div>
          <div><label>{{ t('iot.sensorType') }}</label><Select v-model="form.deviceType" :options="typeOptions" optionValue="value" optionLabel="label" @change="onTypeChange" fluid /></div>
        </div>
        <label>{{ t('common.name') }}</label>
        <InputText v-model="form.name" maxlength="80" fluid />
        <label>{{ t('iot.location') }} <small>({{ t('common.optional') }})</small></label>
        <Select v-model="form.landId" :options="lands.data.value ?? []" optionValue="id" showClear filter :optionLabel="(l: any) => `${l.code} — ${l.name}`" fluid />
        <div class="row2">
          <div><label>{{ t('iot.minT', { unit: form.unit }) }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.minThreshold" type="number" step="0.1" fluid /></div>
          <div><label>{{ t('iot.maxT', { unit: form.unit }) }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.maxThreshold" type="number" step="0.1" fluid /></div>
        </div>
        <small class="hintx"><i class="pi pi-microchip-ai" /> {{ t('iot.hint') }}</small>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('iot.registerBtn')" :disabled="!form.code || !form.name" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.sub { margin: 0.2rem 0 0; color: var(--app-text-muted); font-size: 0.85rem; max-width: 640px; }
.dev-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.9rem;
}
@media (max-width: 560px) { .dev-grid { grid-template-columns: 1fr; } }
.dev-card {
  background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 14px;
  padding: 0.9rem 1rem; cursor: pointer; transition: transform 0.12s ease, border-color 0.12s ease;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.dev-card:hover { transform: translateY(-2px); border-color: var(--app-primary); }
.dev-head { display: flex; align-items: center; gap: 0.6rem; }
.dev-status { width: 10px; height: 10px; border-radius: 50%; background: var(--app-danger); flex-shrink: 0; }
.dev-status.online { background: var(--app-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-primary) 20%, transparent); }
.dev-names { flex: 1; min-width: 0; }
.dev-name { font-weight: 700; font-size: 0.92rem; }
.dev-sub { font-size: 0.72rem; color: var(--app-text-muted); }
.dev-value { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.val { font-size: 1.6rem; font-weight: 800; color: var(--app-primary); }
.val small { font-size: 0.85rem; color: var(--app-text-muted); font-weight: 600; margin-left: 2px; }
.at { font-size: 0.7rem; color: var(--app-text-muted); }
.dev-range { font-size: 0.72rem; color: var(--app-text-muted); }
.key-btn {
  align-self: flex-start; border: 1px dashed var(--app-border-strong); background: transparent;
  color: var(--app-text-muted); border-radius: 8px; padding: 0.25rem 0.55rem;
  font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; font-family: inherit;
}
.key-btn:hover { color: var(--app-primary); border-color: var(--app-primary); }
.chart-note { font-size: 0.76rem; color: var(--app-text-muted); margin: 0.6rem 0 0; }
.hintx { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.3rem; }
</style>
