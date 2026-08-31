<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import MiniChart from '@/components/MiniChart.vue';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtMoney, fmtDate, today } = useFmt();

const prices = useQuery({ queryKey: ['market-prices'], queryFn: async () => (await api.get('/market/prices')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });

/** Kelompokkan per komoditas → deret waktu naik. */
const grouped = computed(() => {
  const map = new Map<string, { name: string; unit: string; rows: any[] }>();
  for (const p of prices.data.value ?? []) {
    const key = p.commodityId;
    if (!map.has(key)) map.set(key, { name: p.commodityName ?? '?', unit: p.unit, rows: [] });
    map.get(key)!.rows.push(p);
  }
  return [...map.values()].map((g) => {
    const rows = [...g.rows].sort((a, b) => a.priceDate.localeCompare(b.priceDate));
    const values = rows.map((r) => Number(r.pricePerUnit));
    const last = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : null;
    const change = prev ? ((last - prev) / prev) * 100 : null;
    return { ...g, rows, values, last, change, firstDate: rows[0]?.priceDate, lastDate: rows[rows.length - 1]?.priceDate };
  });
});

const show = ref(false);
const form = ref({ commodityId: '', region: 'Jawa Timur', priceDate: today(), pricePerUnit: '', source: '' });
const save = useMutation({
  mutationFn: async () => {
    const c = (commodities.data.value ?? []).find((x: any) => x.id === form.value.commodityId);
    return (await api.post('/market/prices', {
      commodityId: form.value.commodityId,
      region: form.value.region,
      priceDate: form.value.priceDate,
      pricePerUnit: String(form.value.pricePerUnit),
      unit: c?.unit ?? 'kg',
      source: form.value.source || undefined,
    })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('prices.saved'), life: 2000 });
    show.value = false;
    form.value = { commodityId: '', region: 'Jawa Timur', priceDate: today(), pricePerUnit: '', source: '' };
    qc.invalidateQueries({ queryKey: ['market-prices'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('prices.title') }}</h2>
      <Button v-if="auth.can('market.write')" :label="t('prices.log')" icon="pi pi-plus" @click="show = true" />
    </div>

    <div v-if="prices.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
    <div v-else-if="!grouped.length" class="empty-note">{{ t('prices.empty') }}</div>
    <div v-else class="price-grid">
      <div v-for="g in grouped" :key="g.name" class="price-card">
        <div class="pc-head">
          <div>
            <div class="pc-name">{{ g.name }}</div>
            <div class="pc-region">{{ g.rows[g.rows.length - 1]?.region }} · {{ fmtDate(g.lastDate) }}</div>
          </div>
          <div class="pc-right">
            <div class="pc-price">{{ fmtMoney(g.last) }}<small>/{{ g.unit }}</small></div>
            <div v-if="g.change != null" class="pc-change" :class="g.change >= 0 ? 'up' : 'down'">
              <i class="pi" :class="g.change >= 0 ? 'pi-arrow-up-right' : 'pi-arrow-down-right'" />
              {{ Math.abs(g.change).toFixed(1) }}%
            </div>
          </div>
        </div>
        <MiniChart :values="g.values" :labels="[fmtDate(g.firstDate), fmtDate(g.lastDate)]" :height="90" :formatValue="(v) => fmtMoney(v)" />
      </div>
    </div>

    <Dialog v-model:visible="show" :header="t('prices.logTitle')" modal :style="{ width: '440px' }">
      <div class="form-grid">
        <label>{{ t('common.commodity') }}</label>
        <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :optionLabel="(c: any) => c.name" :placeholder="t('common.pick')" fluid />
        <div class="row2">
          <div><label>{{ t('common.date') }}</label><InputText v-model="form.priceDate" type="date" fluid /></div>
          <div><label>{{ t('prices.pricePerUnit') }}</label><InputText v-model="form.pricePerUnit" type="number" min="0" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('prices.region') }}</label><InputText v-model="form.region" maxlength="60" fluid /></div>
          <div><label>{{ t('common.source') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.source" maxlength="80" :placeholder="t('prices.sourcePh')" fluid /></div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.commodityId || !form.pricePerUnit" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.9rem;
}
@media (max-width: 560px) {
  .price-grid { grid-template-columns: 1fr; }
}
.price-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 0.9rem 1rem 0.6rem;
}
.pc-head { display: flex; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.4rem; }
.pc-name { font-weight: 700; }
.pc-region { font-size: 0.72rem; color: var(--app-text-muted); }
.pc-right { text-align: right; }
.pc-price { font-weight: 700; color: var(--app-primary); white-space: nowrap; }
.pc-price small { color: var(--app-text-muted); font-weight: 500; }
.pc-change { font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.2rem; }
.pc-change.up { color: var(--app-primary); }
.pc-change.down { color: var(--app-danger); }
.pc-change .pi { font-size: 0.65rem; }
</style>
