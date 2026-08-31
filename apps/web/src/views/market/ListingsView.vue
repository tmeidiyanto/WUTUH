<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { produceEmoji } from '@/lib/produce';

const toast = useToast();
const qc = useQueryClient();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty, fmtMoney } = useFmt();

const query = useQuery({ queryKey: ['listings'], queryFn: async () => (await api.get('/market/listings')).data });
const commodities = useQuery({ queryKey: ['commodities'], queryFn: async () => (await api.get('/commodities')).data });
const cyclesQ = useQuery({ queryKey: ['cycles', 'all'], queryFn: async () => (await api.get('/cycles')).data });

const statusSeverity: Record<string, string> = { aktif: 'success', habis: 'warn', nonaktif: 'secondary' };
const STATUSES = ['aktif', 'habis', 'nonaktif'];
const statusOptions = computed(() => STATUSES.map((v) => ({ value: v, label: t(`enum.listingStatus.${v}`) })));
const statusLabel = (v: string) => (STATUSES.includes(v) ? t(`enum.listingStatus.${v}`) : v);
const filters = ref({ global: { value: null as string | null, matchMode: 'contains' } });

const show = ref(false);
const editId = ref<string | null>(null);
const blank = () => ({ commodityId: '', title: '', qty: '', unit: 'kg', pricePerUnit: '', minOrder: '', description: '', cycleId: '', status: 'aktif' });
const form = ref(blank());

// ---- Galeri foto produk (maks. 5; foto pertama = sampul) ----
const MAX_PHOTOS = 5;
type GalleryItem = { id?: string; url: string };
const fileInput = ref<HTMLInputElement | null>(null);
const photos = ref<GalleryItem[]>([]); // edit: dari server; lapak baru: data URL menunggu Simpan
const photoBusy = ref(false);

function refreshListingCaches() {
  qc.invalidateQueries({ queryKey: ['listings'] });
  qc.invalidateQueries({ queryKey: ['bazaar-list'] });
  qc.invalidateQueries({ queryKey: ['bazaar-detail'] });
}

function openCreate() {
  editId.value = null;
  form.value = blank();
  photos.value = [];
  show.value = true;
}
async function openEdit(r: any) {
  editId.value = r.id;
  form.value = { commodityId: r.commodityId, title: r.title, qty: r.qty, unit: r.unit, pricePerUnit: r.pricePerUnit, minOrder: r.minOrder ?? '', description: r.description ?? '', cycleId: r.cycleId ?? '', status: r.status };
  photos.value = [];
  show.value = true;
  try {
    photos.value = ((await api.get(`/market/listings/${r.id}/photos`)).data as any[]).map((p) => ({ id: p.id, url: p.url }));
  } catch (e) {
    toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3000 });
  }
}
function onCommodityChange() {
  const c = (commodities.data.value ?? []).find((x: any) => x.id === form.value.commodityId);
  if (c) form.value.unit = c.unit;
}

async function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  photoBusy.value = true;
  try {
    for (const f of files) {
      if (photos.value.length >= MAX_PHOTOS) {
        toast.add({ severity: 'warn', summary: t('listings.photoMax', { n: MAX_PHOTOS }), life: 3000 });
        break;
      }
      let dataUrl: string;
      try {
        dataUrl = await compressImage(f);
      } catch {
        toast.add({ severity: 'warn', summary: t('listings.photoBad'), life: 3000 });
        continue;
      }
      if (editId.value) {
        // Lapak sudah ada → langsung unggah.
        try {
          const row = (await api.post(`/market/listings/${editId.value}/photos`, { dataUrl })).data;
          photos.value.push({ id: row.id, url: row.url });
          refreshListingCaches();
        } catch (err) {
          toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(err), life: 3500 });
        }
      } else {
        photos.value.push({ url: dataUrl }); // diunggah saat Simpan
      }
    }
  } finally {
    photoBusy.value = false;
  }
}

async function removePhotoAt(i: number) {
  const p = photos.value[i];
  if (editId.value && p.id) {
    photoBusy.value = true;
    try {
      await api.delete(`/market/listings/${editId.value}/photos/${p.id}`);
      refreshListingCaches();
    } catch (err) {
      toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(err), life: 3500 });
      photoBusy.value = false;
      return;
    }
    photoBusy.value = false;
  }
  photos.value.splice(i, 1);
}

async function makeCover(i: number) {
  const p = photos.value[i];
  if (editId.value && p.id) {
    photoBusy.value = true;
    try {
      await api.patch(`/market/listings/${editId.value}/photos/${p.id}/cover`);
      refreshListingCaches();
    } catch (err) {
      toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(err), life: 3500 });
      photoBusy.value = false;
      return;
    }
    photoBusy.value = false;
  }
  const [x] = photos.value.splice(i, 1);
  photos.value.unshift(x);
}

const save = useMutation({
  mutationFn: async () => {
    let saved: any;
    if (editId.value) {
      saved = (await api.patch(`/market/listings/${editId.value}`, {
        title: form.value.title,
        qty: String(form.value.qty),
        pricePerUnit: String(form.value.pricePerUnit),
        minOrder: form.value.minOrder ? String(form.value.minOrder) : undefined,
        description: form.value.description || undefined,
        cycleId: form.value.cycleId || undefined,
        status: form.value.status,
      })).data;
    } else {
      saved = (await api.post('/market/listings', {
        commodityId: form.value.commodityId,
        title: form.value.title,
        qty: String(form.value.qty),
        unit: form.value.unit,
        pricePerUnit: String(form.value.pricePerUnit),
        minOrder: form.value.minOrder ? String(form.value.minOrder) : undefined,
        description: form.value.description || undefined,
        cycleId: form.value.cycleId || undefined,
      })).data;
      // Unggah foto yang menunggu, berurutan (yang pertama otomatis jadi sampul).
      for (const p of photos.value) {
        if (p.url.startsWith('data:')) await api.post(`/market/listings/${saved.id}/photos`, { dataUrl: p.url });
      }
    }
    return saved;
  },
  onSuccess: () => {
    toast.add({ severity: 'success', summary: t('msg.saved'), life: 2000 });
    show.value = false;
    refreshListingCaches();
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 3500 }),
});
</script>

<template>
  <div>
    <div class="page-head">
      <h2>{{ t('listings.title') }}</h2>
      <div class="head-actions">
        <span class="searchbox">
          <i class="pi pi-search" />
          <InputText v-model="filters.global.value" :placeholder="t('listings.searchPh')" />
        </span>
        <Button v-if="auth.can('market.write')" :label="t('listings.open')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <DataTable
      :value="query.data.value ?? []" :loading="query.isLoading.value"
      dataKey="id" rowHover scrollable size="small" removableSort stripedRows
      paginator :rows="10" :rowsPerPageOptions="[10, 25, 50]"
      v-model:filters="filters" :globalFilterFields="['code', 'title', 'commodityName']"
      tableStyle="min-width: 54rem"
    >
      <template #empty><div class="empty-note">{{ t('listings.empty') }}</div></template>
      <Column :header="t('listings.photo')" style="width: 4.6rem">
        <template #body="{ data }">
          <img v-if="data.photoUrl" :src="data.photoUrl" class="thumb" alt="" loading="lazy" />
          <span v-else class="thumb thumb-emo">{{ produceEmoji(null, data.commodityName, null) }}</span>
        </template>
      </Column>
      <Column field="code" :header="t('common.code')" sortable style="min-width: 7rem"><template #body="{ data }"><strong>{{ data.code }}</strong></template></Column>
      <Column field="title" :header="t('listings.titleCol')" sortable style="min-width: 14rem" />
      <Column field="commodityName" :header="t('common.commodity')" style="min-width: 9rem" />
      <Column :header="t('listings.stock')" style="min-width: 8rem"><template #body="{ data }">{{ fmtQty(data.qty) }} {{ data.unit }}</template></Column>
      <Column :header="t('common.price')" sortable field="pricePerUnit" style="min-width: 9rem">
        <template #body="{ data }"><strong>{{ fmtMoney(data.pricePerUnit) }}</strong><small>/{{ data.unit }}</small></template>
      </Column>
      <Column :header="t('common.status')" field="status" style="min-width: 6.5rem">
        <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity[data.status] ?? 'secondary'" /></template>
      </Column>
      <Column :header="t('common.actions')" style="width: 5rem" v-if="auth.can('market.write')">
        <template #body="{ data }"><Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" /></template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="show" :header="editId ? t('listings.edit') : t('listings.open')" modal :style="{ width: '500px' }">
      <div class="form-grid">
        <label>{{ t('common.commodity') }}</label>
        <Select v-model="form.commodityId" :options="commodities.data.value ?? []" optionValue="id" filter :disabled="!!editId" :optionLabel="(c: any) => c.name" :placeholder="t('common.pick')" @change="onCommodityChange" fluid />
        <label>{{ t('listings.titleField') }}</label>
        <InputText v-model="form.title" maxlength="120" :placeholder="t('listings.titlePh')" fluid />

        <label>{{ t('listings.photos', { n: MAX_PHOTOS }) }} <small>({{ t('common.optional') }})</small></label>
        <div class="gal">
          <div v-for="(p, i) in photos" :key="p.id ?? `staged-${i}`" class="gal-item">
            <img :src="p.url" alt="" />
            <span v-if="i === 0" class="gal-cover">★ {{ t('listings.cover') }}</span>
            <div class="gal-acts">
              <button v-if="i !== 0" type="button" class="ga" :disabled="photoBusy" :title="t('listings.makeCover')" @click="makeCover(i)"><i class="pi pi-star" /></button>
              <button type="button" class="ga danger" :disabled="photoBusy" :title="t('listings.removePhoto')" @click="removePhotoAt(i)"><i class="pi pi-trash" /></button>
            </div>
          </div>
          <button v-if="photos.length < MAX_PHOTOS" type="button" class="gal-add" :disabled="photoBusy" @click="fileInput?.click()">
            <i class="pi" :class="photoBusy ? 'pi-spinner pi-spin' : 'pi-plus'" />
            <span>{{ t('listings.addPhoto') }}</span>
          </button>
        </div>
        <small class="photo-hint">{{ t('listings.photoHint') }}</small>
        <input ref="fileInput" type="file" multiple accept="image/jpeg,image/png,image/webp" class="hidden-file" @change="onPickFiles" />

        <div class="row3">
          <div><label>{{ t('common.qtyUnit', { unit: form.unit }) }}</label><InputText v-model="form.qty" type="number" min="0" fluid /></div>
          <div><label>{{ t('common.pricePerUnit', { unit: form.unit }) }}</label><InputText v-model="form.pricePerUnit" type="number" min="0" fluid /></div>
          <div><label>{{ t('listings.minOrder') }} <small>({{ t('common.optional') }})</small></label><InputText v-model="form.minOrder" type="number" min="0" fluid /></div>
        </div>
        <label>{{ t('listings.fromCycle') }} <small>({{ t('listings.fromCycleHint') }})</small></label>
        <Select v-model="form.cycleId" :options="cyclesQ.data.value ?? []" optionValue="id" showClear filter :optionLabel="(c: any) => `${c.code} — ${c.name}`" fluid />
        <label>{{ t('common.description') }} <small>({{ t('common.optional') }})</small></label>
        <Textarea v-model="form.description" rows="3" maxlength="500" fluid />
        <div v-if="editId">
          <label>{{ t('common.status') }}</label>
          <Select v-model="form.status" :options="statusOptions" optionValue="value" optionLabel="label" fluid />
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" text @click="show = false" />
        <Button :label="t('common.save')" :disabled="!form.title || (!editId && !form.commodityId) || !form.qty || !form.pricePerUnit" :loading="save.isPending.value" @click="save.mutate()" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.thumb {
  width: 46px; height: 46px; border-radius: 10px; object-fit: cover; display: block;
  border: 1px solid var(--app-border);
}
.thumb-emo {
  display: grid; place-items: center; font-size: 1.35rem;
  background: var(--app-surface-2);
}
.gal { display: flex; flex-wrap: wrap; gap: 0.55rem; }
.gal-item {
  position: relative; width: 86px; height: 86px; border-radius: 12px; overflow: hidden;
  border: 1px solid var(--app-border);
}
.gal-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gal-cover {
  position: absolute; left: 0; right: 0; bottom: 0;
  background: color-mix(in srgb, var(--app-primary) 82%, black); color: #fff;
  font-size: 0.58rem; font-weight: 700; text-align: center; padding: 0.14rem 0; letter-spacing: 0.03em;
}
.gal-acts { position: absolute; top: 4px; right: 4px; display: flex; gap: 3px; }
.ga {
  width: 22px; height: 22px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(10, 20, 14, 0.55); color: #fff; display: grid; place-items: center; padding: 0;
}
.ga .pi { font-size: 0.66rem; }
.ga:hover { background: var(--app-primary); }
.ga.danger:hover { background: var(--app-danger); }
.ga:disabled { opacity: 0.5; cursor: default; }
.gal-add {
  width: 86px; height: 86px; border-radius: 12px; cursor: pointer;
  border: 1px dashed var(--app-border-strong); background: var(--app-surface-2);
  color: var(--app-text-muted); display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.25rem; font-size: 0.62rem; font-weight: 700; font-family: inherit;
}
.gal-add:hover { color: var(--app-primary); border-color: var(--app-primary); }
.gal-add:disabled { opacity: 0.6; cursor: default; }
.gal-add .pi { font-size: 1rem; }
.photo-hint { color: var(--app-text-muted); font-size: 0.72rem; }
.hidden-file { display: none; }
</style>
