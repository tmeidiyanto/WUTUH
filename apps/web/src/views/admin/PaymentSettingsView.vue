<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { compressImage } from '@/lib/image';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();

const query = useQuery({ queryKey: ['payment-settings'], queryFn: async () => (await api.get('/settings/payment')).data });
const qrisUrl = computed<string | null>(() => query.data.value?.qrisUrl ?? null);
const canWrite = computed(() => auth.can('settings.write'));

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (fileInput.value) fileInput.value.value = '';
  if (!file) return;
  uploading.value = true;
  try {
    // Kualitas tinggi agar kode QR tetap tajam & bisa dipindai.
    const dataUrl = await compressImage(file, 1200, 0.92);
    await api.put('/settings/payment', { qrisDataUrl: dataUrl });
    toast.add({ severity: 'success', summary: t('payment.saved'), life: 2500 });
    qc.invalidateQueries({ queryKey: ['payment-settings'] });
  } catch (err: unknown) {
    const detail = err instanceof Error && err.message === 'format' ? t('payment.badFormat') : apiError(err);
    toast.add({ severity: 'error', summary: t('msg.failed'), detail, life: 3500 });
  } finally {
    uploading.value = false;
  }
}

const remove = useMutation({
  mutationFn: async () => (await api.put('/settings/payment', { removeQris: true })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('payment.removed'), life: 2500 });
    qc.invalidateQueries({ queryKey: ['payment-settings'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>{{ t('payment.title') }}</h2>
        <p class="sub">{{ t('payment.sub') }}</p>
      </div>
    </div>

    <div class="pay-grid">
      <section class="pay-card">
        <header class="pay-head">
          <span class="pay-icon"><i class="pi pi-qrcode" /></span>
          <div class="pay-titles">
            <h3>QRIS</h3>
            <small>{{ t('payment.qrisDesc') }}</small>
          </div>
          <Tag :value="qrisUrl ? t('payment.active') : t('payment.inactive')" :severity="qrisUrl ? 'success' : 'secondary'" />
        </header>

        <div class="qris-zone">
          <img v-if="qrisUrl" :src="qrisUrl" class="qris-img" alt="QRIS" />
          <div v-else class="qris-empty">
            <i class="pi pi-qrcode" />
            <p>{{ t('payment.empty') }}</p>
          </div>
        </div>

        <div class="actions" v-if="canWrite">
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPick" />
          <Button
            :label="qrisUrl ? t('payment.replace') : t('payment.upload')"
            icon="pi pi-upload"
            :loading="uploading"
            @click="fileInput?.click()"
          />
          <Button
            v-if="qrisUrl"
            :label="t('common.delete')"
            icon="pi pi-trash"
            severity="danger"
            outlined
            :loading="remove.isPending.value"
            @click="remove.mutate()"
          />
        </div>

        <small class="hint"><i class="pi pi-info-circle" /> {{ t('payment.hint') }}</small>
      </section>

      <section class="pay-card how">
        <h3><i class="pi pi-lightbulb" /> {{ t('payment.howTitle') }}</h3>
        <ol>
          <li>{{ t('payment.how1') }}</li>
          <li>{{ t('payment.how2') }}</li>
          <li>{{ t('payment.how3') }}</li>
          <li>{{ t('payment.how4') }}</li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sub { margin: 0.2rem 0 0; color: var(--app-text-muted); font-size: 0.85rem; max-width: 640px; }
.pay-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; align-items: start; max-width: 1000px; }
.pay-card {
  background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 16px;
  padding: 1rem 1.15rem 1.15rem;
}
.pay-head { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.8rem; }
.pay-icon {
  width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
  background: color-mix(in srgb, var(--app-primary) 14%, transparent); color: var(--app-primary); font-size: 1.25rem; flex-shrink: 0;
}
.pay-titles { flex: 1; min-width: 0; }
.pay-titles h3 { margin: 0; font-size: 1.02rem; }
.pay-titles small { color: var(--app-text-muted); font-size: 0.76rem; }

.qris-zone {
  border: 2px dashed var(--app-border); border-radius: 14px; min-height: 220px;
  display: grid; place-items: center; padding: 0.8rem; background: var(--app-surface-2);
}
.qris-img { max-width: 100%; max-height: 320px; border-radius: 10px; background: #fff; }
.qris-empty { text-align: center; color: var(--app-text-muted); }
.qris-empty .pi { font-size: 2.4rem; display: block; margin-bottom: 0.5rem; }
.qris-empty p { margin: 0; font-size: 0.85rem; max-width: 260px; }

.actions { display: flex; gap: 0.5rem; margin-top: 0.8rem; flex-wrap: wrap; }
.hint { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: flex-start; margin-top: 0.7rem; font-size: 0.74rem; }

.how h3 { margin: 0 0 0.6rem; font-size: 1rem; display: flex; align-items: center; gap: 0.45rem; }
.how h3 .pi { color: var(--app-warn, #d97706); }
.how ol { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.86rem; }
</style>
