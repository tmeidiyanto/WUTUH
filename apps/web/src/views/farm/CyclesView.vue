<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SelectButton from 'primevue/selectbutton';
import CyclesPanel from '@/components/CyclesPanel.vue';

const { t } = useI18n();
const cat = ref<string | null>(null);
const options = computed(() => [
  { value: null, label: t('common.all') },
  { value: 'tanaman', label: t('enum.cycleCatShort.tanaman') },
  { value: 'kebun', label: t('enum.cycleCatShort.kebun') },
  { value: 'ternak', label: t('enum.cycleCatShort.ternak') },
]);
</script>

<template>
  <div>
    <SelectButton
      v-model="cat"
      :options="options"
      optionValue="value"
      optionLabel="label"
      :allowEmpty="false"
      size="small"
      style="margin-bottom: 0.8rem"
    />
    <CyclesPanel :key="cat ?? 'all'" :category="cat ?? undefined" />
  </div>
</template>
