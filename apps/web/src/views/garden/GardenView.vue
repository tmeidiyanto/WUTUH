<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import { useFmt } from '@/composables/useFmt';
import { api } from '@/lib/api';
import CyclesPanel from '@/components/CyclesPanel.vue';

const { t } = useI18n();
const { fmtQty } = useFmt();
const lands = useQuery({ queryKey: ['lands'], queryFn: async () => (await api.get('/lands')).data });
const gardens = computed(() => (lands.data.value ?? []).filter((l: any) => l.landUse === 'kebun' && l.isActive));
</script>

<template>
  <div>
    <!-- Blok kebun -->
    <div class="page-head"><h2>{{ t('garden.title') }}</h2></div>
    <div v-if="gardens.length" class="cards-grid garden-cards">
      <div v-for="g in gardens" :key="g.id" class="kpi-card">
        <i class="pi pi-sparkles" />
        <div class="meta">
          <span class="t">{{ g.code }} · {{ g.village ?? t('garden.gardenFallback') }}</span>
          <span class="v">{{ g.name }}</span>
          <span class="t">{{ fmtQty(g.areaHa) }} ha{{ g.soilType ? ` · ${g.soilType}` : '' }}</span>
        </div>
      </div>
    </div>
    <p v-else class="empty-note">{{ t('garden.noGarden') }}</p>

    <!-- Siklus kategori kebun -->
    <CyclesPanel category="kebun" :title="t('garden.cyclesTitle')" style="margin-top: 1rem" />
  </div>
</template>

<style scoped>
.garden-cards { margin-bottom: 0.5rem; }
</style>
