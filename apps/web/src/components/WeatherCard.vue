<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

/** Prakiraan cuaca BMKG lokasi usaha + saran WUTUH AI. */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t, locale } = useI18n();

const query = useQuery({ queryKey: ['weather'], queryFn: async () => (await api.get('/weather')).data });
const fc = computed(() => query.data.value);
const canConfig = computed(() => auth.can('settings.write'));

const editing = ref(false);
const adm4 = ref('');
const save = useMutation({
  mutationFn: async () => (await api.put('/weather/location', adm4.value.trim() ? { adm4: adm4.value.trim() } : {})).data,
  onSuccess: (d) => {
    editing.value = false;
    const place = d.location ? [d.location.village, d.location.regency].filter(Boolean).join(', ') : '';
    toast.add({ severity: 'success', summary: d.weatherCode ? t('weather.saved', { place }) : t('weather.cleared'), life: 3000 });
    qc.invalidateQueries({ queryKey: ['weather'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 4000 }),
});

function emoji(desc: string, descEn: string) {
  const s = `${desc} ${descEn}`.toLowerCase();
  if (/petir|badai|thunder|storm/.test(s)) return '⛈️';
  if (/lebat|heavy/.test(s)) return '🌧️';
  if (/hujan|rain|drizzle/.test(s)) return '🌦️';
  if (/kabut|asap|fog|haze|mist|smoke/.test(s)) return '🌫️';
  if (/cerah berawan|partly/.test(s)) return '⛅';
  if (/berawan|cloud|overcast/.test(s)) return '☁️';
  return '☀️';
}
const descOf = (d: { desc: string; descEn: string }) => (locale.value === 'en' ? d.descEn || d.desc : d.desc);
const dayName = (iso: string, i: number) => {
  if (i === 0) return t('weather.today');
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en' : 'id', { weekday: 'short' }).format(new Date(`${iso}T12:00:00`));
};
const adviceTexts = computed<string[]>(() => {
  const a = fc.value?.advice;
  if (!a) return [];
  return locale.value === 'en' ? a.en : a.id;
});
const placeName = computed(() => {
  const l = fc.value?.location;
  return l ? [l.village, l.district, l.regency].filter(Boolean).slice(0, 2).join(', ') : '';
});
</script>

<template>
  <section class="wx" :class="{ compact }">
    <!-- Belum disetel -->
    <template v-if="fc && !fc.configured && !editing">
      <div class="wx-empty">
        <span class="wx-emo">🌦️</span>
        <div class="wx-emain">
          <strong>{{ t('weather.title') }}</strong>
          <small>{{ canConfig ? t('weather.emptyCta') : t('weather.emptyAsk') }}</small>
        </div>
        <Button v-if="canConfig" :label="t('weather.setLocation')" size="small" outlined icon="pi pi-map-marker" @click="editing = true" />
      </div>
    </template>

    <!-- Form kode wilayah -->
    <template v-else-if="editing">
      <div class="wx-form">
        <strong>{{ t('weather.setLocation') }}</strong>
        <small class="wx-hint">{{ t('weather.codeHint') }}</small>
        <div class="wx-row">
          <InputText v-model="adm4" placeholder="34.04.07.2003" class="wx-in" />
          <Button :label="t('common.save')" size="small" :loading="save.isPending.value" @click="save.mutate()" />
          <Button :label="t('common.cancel')" size="small" text @click="editing = false" />
        </div>
      </div>
    </template>

    <!-- BMKG tak terjangkau -->
    <template v-else-if="fc && fc.configured && !fc.available">
      <div class="wx-empty">
        <span class="wx-emo">🌫️</span>
        <div class="wx-emain"><strong>{{ t('weather.title') }}</strong><small>{{ t('weather.unavailable') }}</small></div>
        <Button v-if="canConfig" icon="pi pi-pencil" size="small" text rounded @click="editing = true" />
      </div>
    </template>

    <!-- Prakiraan -->
    <template v-else-if="fc && fc.available">
      <div class="wx-head">
        <strong>🌤️ {{ t('weather.titleAt', { place: placeName }) }}</strong>
        <span class="wx-src">BMKG</span>
        <Button v-if="canConfig" icon="pi pi-pencil" size="small" text rounded class="wx-edit" @click="editing = true" />
      </div>
      <div class="wx-days">
        <div v-for="(d, i) in fc.days" :key="d.date" class="wx-day" :class="{ first: i === 0 }">
          <span class="wd-name">{{ dayName(d.date, i) }}</span>
          <span class="wd-emo">{{ emoji(d.desc, d.descEn) }}</span>
          <span class="wd-t">{{ Math.round(d.tmin) }}–{{ Math.round(d.tmax) }}°C</span>
          <span class="wd-desc">{{ descOf(d) }}</span>
          <span v-if="d.rainMm >= 1" class="wd-rain">💧 {{ d.rainMm }} mm</span>
        </div>
      </div>
      <div v-if="!compact && adviceTexts.length" class="wx-advice" :class="fc.advice.level">
        <i class="pi" :class="fc.advice.level === 'warn' ? 'pi-exclamation-triangle' : fc.advice.level === 'ok' ? 'pi-check-circle' : 'pi-lightbulb'" />
        <div class="wa-lines"><p v-for="(a, i) in adviceTexts" :key="i">{{ a }}</p></div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.wx {
  background: var(--app-surface); border: 1px solid var(--app-border);
  border-radius: 14px; padding: 0.8rem 1rem; min-width: 0;
}
.wx-empty { display: flex; align-items: center; gap: 0.7rem; }
.wx-emo { font-size: 1.7rem; }
.wx-emain { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.wx-emain small { color: var(--app-text-muted); font-size: 0.78rem; }

.wx-form { display: flex; flex-direction: column; gap: 0.35rem; }
.wx-hint { color: var(--app-text-muted); font-size: 0.75rem; }
.wx-row { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
.wx-in { width: 12rem; }

.wx-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.wx-head strong { font-size: 0.92rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wx-src { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.05em; color: var(--app-text-muted); background: var(--app-surface-2); border-radius: 5px; padding: 0.12rem 0.4rem; }
.wx-edit { flex-shrink: 0; }

.wx-days { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.wx-day {
  background: var(--app-surface-2); border-radius: 10px; padding: 0.45rem 0.55rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.05rem; text-align: center;
}
.wx-day.first { outline: 1px solid color-mix(in srgb, var(--app-primary) 35%, transparent); }
.wd-name { font-size: 0.68rem; font-weight: 700; text-transform: capitalize; color: var(--app-text-muted); }
.wd-emo { font-size: 1.5rem; line-height: 1.2; }
.wd-t { font-size: 0.82rem; font-weight: 700; }
.wd-desc { font-size: 0.68rem; color: var(--app-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.wd-rain { font-size: 0.66rem; color: var(--app-accent); }

.wx-advice {
  margin-top: 0.55rem; display: flex; gap: 0.45rem; align-items: flex-start;
  border-radius: 10px; padding: 0.5rem 0.65rem; font-size: 0.8rem;
  background: color-mix(in srgb, var(--app-accent) 9%, transparent);
}
.wx-advice.warn { background: color-mix(in srgb, #d97706 12%, transparent); }
.wx-advice.warn .pi { color: #d97706; }
.wx-advice.info .pi { color: var(--app-accent); }
.wx-advice.ok { background: color-mix(in srgb, var(--app-primary) 9%, transparent); }
.wx-advice.ok .pi { color: var(--app-primary); }
.wx-advice .pi { margin-top: 2px; }
.wa-lines { display: flex; flex-direction: column; gap: 0.2rem; }
.wa-lines p { margin: 0; }

.wx.compact { padding: 0.6rem 0.8rem; }
.wx.compact .wx-days { grid-template-columns: repeat(3, minmax(0, 1fr)); }
</style>
