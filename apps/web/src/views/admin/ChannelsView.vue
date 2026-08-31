<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();

const query = useQuery({ queryKey: ['channels'], queryFn: async () => (await api.get('/settings/channels')).data });
const wa = computed(() => (query.data.value ?? []).find((c: any) => c.channel === 'whatsapp'));
const others = computed(() => (query.data.value ?? []).filter((c: any) => !c.supported));
const canWrite = computed(() => auth.can('settings.write'));

const EVENTS = ['order_status_to_buyer', 'new_order_to_seller', 'agenda_reminder'];
const form = ref({ isEnabled: false, gatewayUrl: '', token: '', events: [...EVENTS] });
watch(
  wa,
  (v) => {
    if (v) form.value = { isEnabled: v.isEnabled, gatewayUrl: v.gatewayUrl ?? '', token: '', events: [...(v.events ?? EVENTS)] };
  },
  { immediate: true },
);

const sourceMeta = computed(() => {
  const s = wa.value?.source;
  if (s === 'company') return { label: t('channels.srcCompany'), severity: 'success' };
  if (s === 'env') return { label: t('channels.srcEnv'), severity: 'info' };
  return { label: t('channels.srcNone'), severity: 'secondary' };
});

const save = useMutation({
  mutationFn: async () =>
    (await api.put('/settings/channels/whatsapp', {
      isEnabled: form.value.isEnabled,
      config: { gatewayUrl: form.value.gatewayUrl.trim(), ...(form.value.token.trim() ? { token: form.value.token.trim() } : {}) },
      events: form.value.events,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('channels.saved'), life: 2500 });
    form.value.token = '';
    qc.invalidateQueries({ queryKey: ['channels'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

const testTarget = ref('');
const test = useMutation({
  mutationFn: async () =>
    (await api.post('/settings/channels/whatsapp/test', { target: testTarget.value.trim() || undefined })).data,
  onSuccess: (d) => {
    if (d.ok) toast.add({ severity: 'success', summary: t('channels.testOk'), detail: `→ ${d.target}`, life: 4000 });
    else toast.add({ severity: 'error', summary: t('channels.testFail'), detail: `${d.status}: ${d.detail}`.slice(0, 160), life: 5000 });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('channels.testFail'), detail: apiError(e), life: 4000 }),
});

const channelMeta: Record<string, { icon: string; name: string; descKey: string }> = {
  whatsapp: { icon: 'pi-whatsapp', name: 'WhatsApp', descKey: 'channels.waDesc' },
  email: { icon: 'pi-envelope', name: 'Email', descKey: 'channels.emailDesc' },
  telegram: { icon: 'pi-telegram', name: 'Telegram', descKey: 'channels.telegramDesc' },
};
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>{{ t('channels.title') }}</h2>
        <p class="sub">{{ t('channels.sub') }}</p>
      </div>
    </div>

    <div class="ch-grid">
      <!-- WhatsApp -->
      <section class="ch-card wa">
        <header class="ch-head">
          <span class="ch-icon wa-ic"><i class="pi pi-whatsapp" /></span>
          <div class="ch-titles">
            <h3>WhatsApp</h3>
            <small>{{ t('channels.waDesc') }}</small>
          </div>
          <ToggleSwitch v-model="form.isEnabled" :disabled="!canWrite" />
        </header>

        <Tag :value="sourceMeta.label" :severity="(sourceMeta.severity as any)" class="src-tag" />

        <div class="form-grid">
          <label>{{ t('channels.gatewayUrl') }}</label>
          <InputText v-model="form.gatewayUrl" :placeholder="t('channels.gatewayPh')" :disabled="!canWrite" fluid />
          <label>{{ t('channels.token') }}</label>
          <Password
            v-model="form.token"
            :feedback="false"
            toggleMask
            fluid
            :disabled="!canWrite"
            :placeholder="wa?.hasToken ? t('channels.tokenKeepPh') : t('channels.tokenPh')"
          />
          <small class="hint"><i class="pi pi-info-circle" /> {{ t('channels.gatewayHint') }}</small>

          <label class="ev-label">{{ t('channels.events') }}</label>
          <label v-for="ev in EVENTS" :key="ev" class="ev-item">
            <Checkbox v-model="form.events" :value="ev" :disabled="!canWrite" />
            <span>{{ t(`channels.ev.${ev}`) }}</span>
          </label>

          <div class="actions" v-if="canWrite">
            <Button :label="t('common.save')" icon="pi pi-save" :loading="save.isPending.value" @click="save.mutate()" />
          </div>

          <div class="test-row" v-if="canWrite">
            <InputText v-model="testTarget" :placeholder="t('channels.testTargetPh')" class="test-in" />
            <Button :label="t('channels.test')" icon="pi pi-send" outlined size="small" :loading="test.isPending.value" @click="test.mutate()" />
          </div>
        </div>
      </section>

      <!-- Saluran lain: segera hadir -->
      <section v-for="c in others" :key="c.channel" class="ch-card soon">
        <header class="ch-head">
          <span class="ch-icon"><i class="pi" :class="channelMeta[c.channel]?.icon" /></span>
          <div class="ch-titles">
            <h3>{{ channelMeta[c.channel]?.name ?? c.channel }}</h3>
            <small>{{ t(channelMeta[c.channel]?.descKey ?? '') }}</small>
          </div>
          <Tag :value="t('channels.soon')" severity="secondary" />
        </header>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sub { margin: 0.2rem 0 0; color: var(--app-text-muted); font-size: 0.85rem; max-width: 640px; }
.ch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; align-items: start; max-width: 1000px; }
.ch-card {
  background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 16px;
  padding: 1rem 1.15rem 1.15rem;
}
.ch-card.soon { opacity: 0.65; }
.ch-head { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.6rem; }
.ch-icon {
  width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
  background: var(--app-surface-2); color: var(--app-text-muted); font-size: 1.25rem; flex-shrink: 0;
}
.ch-icon.wa-ic { background: color-mix(in srgb, #25d366 16%, transparent); color: #25d366; }
.ch-titles { flex: 1; min-width: 0; }
.ch-titles h3 { margin: 0; font-size: 1.02rem; }
.ch-titles small { color: var(--app-text-muted); font-size: 0.76rem; }
.src-tag { margin-bottom: 0.6rem; }
.hint { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: flex-start; margin-top: 0.25rem; font-size: 0.74rem; }
.ev-label { margin-top: 0.6rem; }
.ev-item {
  display: flex; align-items: center; gap: 0.5rem; font-size: 0.86rem; font-weight: 400 !important;
  margin-top: 0.15rem !important; cursor: pointer;
}
.actions { margin-top: 0.8rem; }
.test-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center; }
.test-in { flex: 1; }
</style>
