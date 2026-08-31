<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import { compressImage } from '@/lib/image';
import { stageIndex, STAGES } from '@/lib/stages';
import StageTag from '@/components/StageTag.vue';
import ChainBar from '@/components/ChainBar.vue';

const props = defineProps<{
  /** Filter kategori: 'tanaman' | 'kebun' | 'ternak' | undefined (semua). */
  category?: string;
  title?: string;
}>();

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { fmtQty, fmtMoney, fmtDate, fmtDateTime, today } = useFmt();

const listKey = computed(() => ['cycles', props.category ?? 'all']);
const query = useQuery({
  queryKey: listKey,
  queryFn: async () => (await api.get('/cycles', { params: props.category ? { category: props.category } : {} })).data,
});
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const lands = useQuery({ queryKey: ['lands'], queryFn: async () => (await api.get('/lands')).data });
const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/warehouses')).data });

const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });
const canWrite = computed(() => auth.can('farm.write'));

const statusSeverity: Record<string, string> = { berjalan: 'info', selesai: 'success', gagal: 'danger' };
const statusLabel = (v: string) => t(`enum.cycleStatus.${v}`);
const catOptions = computed(() => ['tanaman', 'kebun', 'ternak'].map((v) => ({ value: v, label: t(`enum.cycleCat.${v}`) })));
const ACTS = ['pengolahan', 'penyemaian', 'penanaman', 'pemupukan', 'penyiraman', 'penyiangan', 'hama_penyakit', 'pakan', 'vitamin', 'lainnya'];
const actTypes = computed(() => ACTS.map((v) => ({ value: v, label: t(`enum.activity.${v}`) })));
const actLabel = (v: string) => (ACTS.includes(v) ? t(`enum.activity.${v}`) : v);
const qualityOptions = computed(() => ['A', 'B', 'C'].map((v) => ({ value: v, label: t(`enum.quality.${v}`) })));

// ===== Buat / ubah siklus =====
const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({
  name: '', category: props.category ?? 'tanaman', commodityId: '', landId: '',
  startDate: today(), targetHarvestDate: '', areaHa: '', initialQty: '', note: '',
});
const form = ref(blank());
function openCreate() { editId.value = null; form.value = blank(); show.value = true; }
function openEdit(r: any) {
  editId.value = r.id;
  form.value = {
    name: r.name, category: r.category, commodityId: r.commodityId, landId: r.landId ?? '',
    startDate: r.startDate, targetHarvestDate: r.targetHarvestDate ?? '', areaHa: r.areaHa ?? '',
    initialQty: r.initialQty ?? '', note: r.note ?? '',
  };
  show.value = true;
}

const save = useMutation({
  mutationFn: async () => {
    const f = form.value;
    const payload: Record<string, unknown> = {
      name: f.name,
      landId: f.landId || undefined,
      targetHarvestDate: f.targetHarvestDate || undefined,
      areaHa: f.areaHa ? String(f.areaHa) : undefined,
      initialQty: f.initialQty ? String(f.initialQty) : undefined,
      note: f.note || undefined,
    };
    if (editId.value) return (await api.patch(`/cycles/${editId.value}`, payload)).data;
    return (await api.post('/cycles', { ...payload, category: f.category, commodityId: f.commodityId, startDate: f.startDate })).data;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    qc.invalidateQueries({ queryKey: ['cycles'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

// ===== Detail siklus =====
const detailId = ref<string | null>(null);
const detail = useQuery({
  queryKey: computed(() => ['cycle-detail', detailId.value]),
  queryFn: async () => (await api.get(`/cycles/${detailId.value}`)).data,
  enabled: computed(() => !!detailId.value),
});
const showDetail = computed({ get: () => !!detailId.value, set: (v) => { if (!v) detailId.value = null; } });
function openDetail(r: any) { detailId.value = r.id; }
function refreshDetail() {
  qc.invalidateQueries({ queryKey: ['cycles'] });
  qc.invalidateQueries({ queryKey: ['cycle-detail'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

// Majukan tahap
const advance = useMutation({
  mutationFn: async (toStage?: string) =>
    (await api.post(`/cycles/${detailId.value}/advance`, toStage ? { toStage } : {})).data,
  onSuccess: () => { toast.add({ severity: 'success', summary: t('cycles.advanced'), life: 2000 }); refreshDetail(); },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
const nextStageOf = computed(() => {
  const s = detail.data.value?.stage;
  if (!s) return null;
  const i = stageIndex(s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
});

// Foto bukti kegiatan/panen (opsional; dikompres di browser sebelum diunggah)
const actPhoto = ref<string | null>(null);
const hvPhoto = ref<string | null>(null);
const actFile = ref<HTMLInputElement | null>(null);
const hvFile = ref<HTMLInputElement | null>(null);
async function onPickPhoto(e: Event, target: 'act' | 'hv') {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const dataUrl = await compressImage(file);
    if (target === 'act') actPhoto.value = dataUrl;
    else hvPhoto.value = dataUrl;
  } catch {
    toast.add({ severity: 'error', summary: t('cycles.photoBad'), life: 3000 });
  }
}

// Tambah kegiatan
const showAct = ref(false);
const actForm = ref({ activityDate: today(), activityType: 'pemupukan', description: '', cost: '' });
const saveAct = useMutation({
  mutationFn: async () =>
    (await api.post(`/cycles/${detailId.value}/activities`, {
      activityDate: actForm.value.activityDate,
      activityType: actForm.value.activityType,
      description: actForm.value.description || undefined,
      cost: actForm.value.cost ? String(actForm.value.cost) : undefined,
      photoDataUrl: actPhoto.value || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('cycles.activitySaved'), detail: Number(actForm.value.cost) > 0 ? t('cycles.activityFinance') : undefined, life: 2500 });
    showAct.value = false;
    actForm.value = { activityDate: today(), activityType: 'pemupukan', description: '', cost: '' };
    actPhoto.value = null;
    refreshDetail();
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});

// Catat panen
const showHarvest = ref(false);
const harvestForm = ref({ harvestDate: today(), qty: '', quality: '', warehouseId: '' });
const saveHarvest = useMutation({
  mutationFn: async () =>
    (await api.post(`/cycles/${detailId.value}/harvests`, {
      harvestDate: harvestForm.value.harvestDate,
      qty: String(harvestForm.value.qty),
      unit: detail.data.value?.commodityUnit ?? 'kg',
      quality: harvestForm.value.quality || undefined,
      warehouseId: harvestForm.value.warehouseId || undefined,
      photoDataUrl: hvPhoto.value || undefined,
    })).data,
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('cycles.harvestSaved'), detail: harvestForm.value.warehouseId ? t('cycles.harvestStock') : undefined, life: 2500 });
    showHarvest.value = false;
    harvestForm.value = { harvestDate: today(), qty: '', quality: '', warehouseId: '' };
    hvPhoto.value = null;
    refreshDetail();
    qc.invalidateQueries({ queryKey: ['stock'] });
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ title ?? t('cycles.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('cycles.searchPh')" />
        </span>
        <Button v-if="canWrite" :label="t('cycles.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'name', 'commodityName', 'landName']"
      tableStyle="min-width: 56rem"
    >
      <template #empty><div class="empty-note">{{ t('cycles.empty') }}</div></template>
      <Column field="code" :header="t('common.code')" sortable style="min-width: 7rem">
        <template #body="{ data }"><a class="linkish" @click="openDetail(data)"><strong>{{ data.code }}</strong></a></template>
      </Column>
      <Column field="name" :header="t('common.name')" sortable style="min-width: 13rem">
        <template #body="{ data }"><a class="linkish" @click="openDetail(data)">{{ data.name }}</a></template>
      </Column>
      <Column field="commodityName" :header="t('common.commodity')" sortable style="min-width: 9rem" />
      <Column field="landName" :header="t('common.land')" style="min-width: 9rem"><template #body="{ data }">{{ data.landName ?? '-' }}</template></Column>
      <Column :header="t('common.stage')" field="stage" sortable style="min-width: 9rem">
        <template #body="{ data }"><StageTag :stage="data.stage" /></template>
      </Column>
      <Column :header="t('common.start')" field="startDate" sortable style="min-width: 7rem"><template #body="{ data }">{{ fmtDate(data.startDate) }}</template></Column>
      <Column :header="t('cycles.targetHarvest')" field="targetHarvestDate" style="min-width: 7.5rem"><template #body="{ data }">{{ fmtDate(data.targetHarvestDate) }}</template></Column>
      <Column :header="t('common.status')" field="status" style="min-width: 6.5rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="width: 6rem">
        <template #body="{ data }">
          <Button icon="pi pi-eye" size="small" text @click="openDetail(data)" v-tooltip.top="t('common.detail')" />
          <Button v-if="canWrite" icon="pi pi-pencil" size="small" text @click="openEdit(data)" />
        </template>
      </Column>
    </DataTable>

    <!-- Dialog buat/ubah -->
    <Dialog v-model:visible="show" :header="editId ? t('cycles.edit') : t('cycles.new')" modal :style="{ width: '520px' }">
      <div class="form-grid">
        <label>{{ t('cycles.name') }}</label>
        <InputText v-model="form.name" maxlength="80" :placeholder="t('cycles.namePh')" fluid />
        <div class="row2">
          <div>
            <label>{{ t('common.category') }}</label>
            <Select v-model="form.category" :options="catOptions" optionValue="value" optionLabel="label" :disabled="!!editId || !!props.category" fluid />
          </div>
          <div>
            <label>{{ t('common.commodity') }}</label>
            <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :disabled="!!editId" :optionLabel="(c: any) => `${c.name}`" :placeholder="t('common.pick')" fluid />
          </div>
        </div>
        <label>{{ t('cycles.landPen') }} <small>({{ t('common.optional') }})</small></label>
        <Select v-model="form.landId" :options="lands.data.value ?? []" optionValue="id" showClear filter :optionLabel="(l: any) => `${l.code} — ${l.name}`" :placeholder="t('common.pick')" fluid />
        <div class="row2">
          <div><label>{{ t('cycles.startDate') }}</label><InputText v-model="form.startDate" type="date" fluid /></div>
          <div><label>{{ t('cycles.targetHarvestDate') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.targetHarvestDate" type="date" fluid /></div>
        </div>
        <div class="row2">
          <div><label>{{ t('common.area') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.areaHa" type="number" step="0.01" min="0" fluid /></div>
          <div><label>{{ t('cycles.initialQty') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.initialQty" type="number" min="0" fluid /></div>
        </div>
        <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
        <Textarea v-model="form.note" rows="2" maxlength="300" fluid />
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.name || (!editId && !form.commodityId)" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>

    <!-- Dialog detail -->
    <Dialog v-model:visible="showDetail" modal :style="{ width: '860px' }" :header="detail.data.value ? `${detail.data.value.code} — ${detail.data.value.name}` : t('common.detail')">
      <div v-if="detail.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
      <div v-else-if="detail.data.value" class="detail">
        <ChainBar compact :active-stage="detail.data.value.stage" />

        <div class="fact-grid">
          <div class="fact"><span class="fk">{{ t('common.commodity') }}</span><span class="fv">{{ detail.data.value.commodityName }}</span></div>
          <div class="fact"><span class="fk">{{ t('common.land') }}</span><span class="fv">{{ detail.data.value.landName ?? '-' }}</span></div>
          <div class="fact"><span class="fk">{{ t('common.start') }}</span><span class="fv">{{ fmtDate(detail.data.value.startDate) }}</span></div>
          <div class="fact"><span class="fk">{{ t('cycles.targetHarvestDate') }}</span><span class="fv">{{ fmtDate(detail.data.value.targetHarvestDate) }}</span></div>
          <div class="fact"><span class="fk">{{ t('cycles.totalCost') }}</span><span class="fv">{{ fmtMoney(detail.data.value.totalCost) }}</span></div>
          <div class="fact"><span class="fk">{{ t('cycles.totalHarvest') }}</span><span class="fv">{{ fmtQty(detail.data.value.totalHarvest) }} {{ detail.data.value.commodityUnit }}</span></div>
          <div class="fact" v-if="detail.data.value.predictedHarvest">
            <span class="fk">{{ t('cycles.predicted') }}</span>
            <span class="fv accent">± {{ fmtQty(Math.round(detail.data.value.predictedHarvest)) }} {{ detail.data.value.commodityUnit }}</span>
          </div>
        </div>

        <div class="stage-actions">
          <Button
            :label="t('trace.button')"
            icon="pi pi-verified"
            size="small"
            severity="info"
            outlined
            @click="router.push({ name: 'cycle-trace', params: { id: detailId! } })"
          />
        </div>

        <div v-if="canWrite && detail.data.value.status === 'berjalan'" class="stage-actions">
          <Button
            v-if="nextStageOf"
            :label="t('cycles.advanceTo', { stage: t(`stage.${nextStageOf}`) })"
            icon="pi pi-angle-double-right"
            size="small"
            :loading="advance.isPending.value"
            @click="advance.mutate(undefined)"
          />
          <Button :label="t('cycles.logActivity')" icon="pi pi-plus" size="small" outlined @click="showAct = true" />
          <Button :label="t('cycles.logHarvest')" icon="pi pi-inbox" size="small" severity="success" outlined @click="showHarvest = true" />
        </div>

        <div class="detail-cols">
          <section>
            <h4><i class="pi pi-list-check" /> {{ t('cycles.activities') }}</h4>
            <div v-if="!detail.data.value.activities.length" class="empty-note">{{ t('cycles.noActivities') }}</div>
            <div v-else class="mini-rows">
              <div v-for="a in detail.data.value.activities" :key="a.id" class="mini-row">
                <span class="mr-date">{{ fmtDate(a.activityDate) }}</span>
                <a v-if="a.photoUrl" :href="a.photoUrl" target="_blank" rel="noopener" class="mr-photo"><img :src="a.photoUrl" alt="" loading="lazy" /></a>
                <span class="mr-main"><strong>{{ actLabel(a.activityType) }}</strong><small v-if="a.description"> — {{ a.description }}</small></span>
                <span class="mr-val" v-if="Number(a.cost) > 0">{{ fmtMoney(a.cost) }}</span>
              </div>
            </div>

            <h4><i class="pi pi-inbox" /> {{ t('cycles.harvests') }}</h4>
            <div v-if="!detail.data.value.harvests.length" class="empty-note">{{ t('cycles.noHarvests') }}</div>
            <div v-else class="mini-rows">
              <div v-for="h in detail.data.value.harvests" :key="h.id" class="mini-row">
                <span class="mr-date">{{ fmtDate(h.harvestDate) }}</span>
                <a v-if="h.photoUrl" :href="h.photoUrl" target="_blank" rel="noopener" class="mr-photo"><img :src="h.photoUrl" alt="" loading="lazy" /></a>
                <span class="mr-main"><strong>{{ fmtQty(h.qty) }} {{ h.unit }}</strong><small v-if="h.quality"> — {{ t('cycles.quality', { q: h.quality }) }}</small></span>
                <Tag v-if="h.warehouseId" :value="t('cycles.toWarehouse')" severity="success" />
              </div>
            </div>
          </section>

          <section>
            <h4><i class="pi pi-history" /> {{ t('cycles.history') }}</h4>
            <div class="timeline">
              <div v-for="hs in detail.data.value.stageHistory" :key="hs.id" class="tl-item">
                <span class="tl-dot" />
                <div class="tl-body">
                  <StageTag :stage="hs.toStage" />
                  <span class="tl-at">{{ fmtDateTime(hs.at) }}</span>
                  <div v-if="hs.note" class="tl-note">{{ hs.note }}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Dialog>

    <!-- Dialog kegiatan -->
    <Dialog v-model:visible="showAct" :header="t('cycles.logActivity')" modal :style="{ width: '440px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.date') }}</label><InputText v-model="actForm.activityDate" type="date" fluid /></div>
          <div><label>{{ t('cycles.actType') }}</label><Select v-model="actForm.activityType" :options="actTypes" optionValue="value" optionLabel="label" fluid /></div>
        </div>
        <label>{{ t('cycles.actDesc') }} <small>({{ t('common.optional') }})</small></label>
        <InputText v-model="actForm.description" maxlength="300" fluid />
        <label>{{ t('common.costRp') }} <small>({{ t('cycles.actCostHint') }})</small></label>
        <InputText v-model="actForm.cost" type="number" min="0" fluid />
        <label>{{ t('cycles.photoLabel') }} <small>({{ t('common.optional') }})</small></label>
        <div class="photo-row">
          <input ref="actFile" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPickPhoto($event, 'act')" />
          <img v-if="actPhoto" :src="actPhoto" class="photo-thumb" alt="" />
          <Button :label="actPhoto ? t('cycles.photoChange') : t('cycles.photoPick')" icon="pi pi-camera" size="small" outlined @click="actFile?.click()" />
          <Button v-if="actPhoto" icon="pi pi-times" size="small" text severity="danger" @click="actPhoto = null" />
        </div>
        <small class="hint"><i class="pi pi-camera" /> {{ t('cycles.photoHint') }}</small>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="showAct = false" />
        <Button :label="t('common.save')" :loading="saveAct.isPending.value" @click="saveAct.mutate()" />
      </template>
    </Dialog>

    <!-- Dialog panen -->
    <Dialog v-model:visible="showHarvest" :header="t('cycles.logHarvest')" modal :style="{ width: '440px' }">
      <div class="form-grid">
        <div class="row2">
          <div><label>{{ t('common.date') }}</label><InputText v-model="harvestForm.harvestDate" type="date" fluid /></div>
          <div><label>{{ t('common.qtyUnit', { unit: detail.data.value?.commodityUnit ?? 'kg' }) }}</label><InputText v-model="harvestForm.qty" type="number" min="0" fluid /></div>
        </div>
        <div class="row2">
          <div>
            <label>{{ t('cycles.hvQuality') }} <small>({{ t('common.optional') }})</small></label>
            <Select v-model="harvestForm.quality" :options="qualityOptions" optionValue="value" optionLabel="label" showClear fluid />
          </div>
          <div>
            <label>{{ t('cycles.hvWarehouse') }} <small>({{ t('common.optional') }})</small></label>
            <Select v-model="harvestForm.warehouseId" :options="warehouses.data.value ?? []" optionValue="id" showClear :optionLabel="(w: any) => `${w.code} — ${w.name}`" fluid />
          </div>
        </div>
        <label>{{ t('cycles.photoLabel') }} <small>({{ t('common.optional') }})</small></label>
        <div class="photo-row">
          <input ref="hvFile" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPickPhoto($event, 'hv')" />
          <img v-if="hvPhoto" :src="hvPhoto" class="photo-thumb" alt="" />
          <Button :label="hvPhoto ? t('cycles.photoChange') : t('cycles.photoPick')" icon="pi pi-camera" size="small" outlined @click="hvFile?.click()" />
          <Button v-if="hvPhoto" icon="pi pi-times" size="small" text severity="danger" @click="hvPhoto = null" />
        </div>
        <small class="hint"><i class="pi pi-link" /> {{ t('cycles.hvHint') }}</small>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="showHarvest = false" />
        <Button :label="t('common.save')" :disabled="!harvestForm.qty" :loading="saveHarvest.isPending.value" @click="saveHarvest.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.linkish { cursor: pointer; color: var(--app-primary); text-decoration: none; }
.linkish:hover { text-decoration: underline; }

.detail { display: flex; flex-direction: column; gap: 0.8rem; }
.fact-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.5rem;
}
.fact {
  background: var(--app-surface-2); border-radius: 10px; padding: 0.5rem 0.7rem;
  display: flex; flex-direction: column; gap: 0.1rem;
}
.fk { font-size: 0.7rem; color: var(--app-text-muted); }
.fv { font-weight: 700; font-size: 0.9rem; }
.fv.accent { color: var(--app-accent); }
.stage-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.detail-cols { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; }
@media (max-width: 700px) { .detail-cols { grid-template-columns: 1fr; } }
.detail-cols h4 { margin: 0.4rem 0 0.4rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; }
.detail-cols h4 .pi { color: var(--app-primary); font-size: 0.85rem; }

.mini-rows { display: flex; flex-direction: column; gap: 0.25rem; max-height: 220px; overflow-y: auto; }
.mini-row {
  display: flex; align-items: baseline; gap: 0.55rem;
  padding: 0.35rem 0.5rem; border-radius: 8px; background: var(--app-surface-2);
  font-size: 0.82rem;
}
.mr-date { color: var(--app-text-muted); font-size: 0.72rem; flex-shrink: 0; width: 68px; }
.mr-main { flex: 1; min-width: 0; }
.mr-main small { color: var(--app-text-muted); }
.mr-val { font-weight: 600; white-space: nowrap; }

.timeline { position: relative; padding-left: 1rem; max-height: 300px; overflow-y: auto; }
.tl-item { position: relative; padding: 0 0 0.7rem 0.8rem; border-left: 2px solid var(--app-border); }
.tl-item:last-child { border-left-color: transparent; }
.tl-dot {
  position: absolute; left: -6px; top: 2px; width: 10px; height: 10px; border-radius: 50%;
  background: var(--app-grad); border: 2px solid var(--app-surface);
}
.tl-body { display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; }
.tl-at { font-size: 0.7rem; color: var(--app-text-muted); }
.tl-note { font-size: 0.76rem; color: var(--app-text-muted); }
.hint { color: var(--app-text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.3rem; }

.photo-row { display: flex; align-items: center; gap: 0.5rem; }
.photo-thumb { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; border: 1px solid var(--app-border); }
.mr-photo { flex-shrink: 0; align-self: center; }
.mr-photo img { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; display: block; border: 1px solid var(--app-border); }
</style>
