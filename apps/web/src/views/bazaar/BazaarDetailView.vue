<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery, useMutation } from '@tanstack/vue-query';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { api, apiError } from '@/lib/api';
import { useFmt } from '@/composables/useFmt';
import { useAuthStore } from '@/stores/auth';
import { produceEmoji, produceTint } from '@/lib/produce';
import TrustBadge from '@/components/TrustBadge.vue';
import BazaarHeader from './BazaarHeader.vue';

const route = useRoute();
const toast = useToast();
const auth = useAuthStore();
const { t } = useI18n();
const { fmtQty, fmtMoney } = useFmt();

const id = computed(() => String(route.params.id));
const query = useQuery({
  queryKey: computed(() => ['bazaar-detail', id.value]),
  queryFn: async () => (await api.get(`/bazaar/listings/${id.value}`)).data,
});
const item = computed(() => query.data.value);

const form = ref({ qty: '', buyerName: auth.user?.fullName ?? '', buyerPhone: '', note: '', paymentMethod: 'tunai' });
const result = ref<any | null>(null);
watch(
  item,
  (v) => {
    if (v && !form.value.qty) form.value.qty = v.minOrder ?? '1';
    // QRIS jadi pilihan bawaan bila penjual menyediakannya.
    if (v?.sellerHasQris && form.value.paymentMethod === 'tunai' && !result.value) form.value.paymentMethod = 'qris';
  },
  { immediate: true },
);
// Pindah ke lapak lain → reset form & hasil.
watch(id, () => {
  result.value = null;
  form.value = { qty: '', buyerName: auth.user?.fullName ?? '', buyerPhone: '', note: '', paymentMethod: 'tunai' };
});

// Galeri: foto utama + strip thumbnail.
const photoIdx = ref(0);
const photos = computed<string[]>(() => item.value?.photos ?? []);
const mainPhoto = computed(() => photos.value[photoIdx.value] ?? photos.value[0] ?? null);
watch(id, () => { photoIdx.value = 0; });

const total = computed(() => Number(form.value.qty || 0) * Number(item.value?.pricePerUnit || 0));
const soldOut = computed(() => !item.value || item.value.status !== 'aktif' || Number(item.value.qty) <= 0);
const regionOf = computed(() => [item.value?.sellerRegency, item.value?.sellerProvince].filter(Boolean).join(', '));

const order = useMutation({
  mutationFn: async () =>
    (await api.post('/bazaar/orders', {
      listingId: id.value,
      buyerName: form.value.buyerName,
      buyerPhone: form.value.buyerPhone,
      qty: String(form.value.qty),
      paymentMethod: form.value.paymentMethod,
      note: form.value.note || undefined,
    })).data,
  onSuccess: (data) => {
    result.value = data;
    query.refetch();
  },
  onError: (e: unknown) => toast.add({ severity: 'error', summary: t('msg.failed'), detail: apiError(e), life: 4000 }),
});

const waLink = computed(() => {
  if (!result.value?.waPhone) return null;
  const text = t('bazaar.waText', {
    name: form.value.buyerName,
    qty: fmtQty(result.value.qty),
    unit: result.value.unit,
    title: result.value.title,
    code: result.value.code,
  });
  return `https://wa.me/${result.value.waPhone}?text=${encodeURIComponent(text)}`;
});
</script>

<template>
  <div class="bz-page">
    <BazaarHeader />

    <main class="bz-main">
      <RouterLink :to="{ name: 'bazaar' }" class="back"><i class="pi pi-arrow-left" /> {{ t('bazaar.detailBack') }}</RouterLink>

      <div v-if="query.isLoading.value" class="empty-note">{{ t('common.loading') }}</div>
      <template v-else-if="item">
        <div class="detail">
          <!-- Kiri: visual + deskripsi -->
          <section class="left">
            <div class="tile" :style="mainPhoto ? undefined : { background: produceTint(item.category) }">
              <img v-if="mainPhoto" :src="mainPhoto" class="tphoto" alt="" />
              <span v-else class="emo">{{ produceEmoji(item.commodityCode, item.commodityName, item.category) }}</span>
            </div>
            <div v-if="photos.length > 1" class="thumbs">
              <button
                v-for="(p, i) in photos"
                :key="p"
                type="button"
                class="th"
                :class="{ on: i === photoIdx }"
                @click="photoIdx = i"
              >
                <img :src="p" alt="" loading="lazy" />
              </button>
            </div>
            <div class="info">
              <Tag :value="t(`enum.commodityCat.${item.category}`)" severity="success" />
              <h1>{{ item.title }}</h1>
              <div class="price">{{ fmtMoney(item.pricePerUnit) }}<small>/{{ item.unit }}</small></div>
              <div class="meta">
                <span :class="{ out: soldOut }">{{ soldOut ? t('bazaar.soldOut') : t('bazaar.stock', { n: fmtQty(item.qty), unit: item.unit }) }}</span>
                <span v-if="item.minOrder">· {{ t('bazaar.minOrder', { n: fmtQty(item.minOrder), unit: item.unit }) }}</span>
              </div>
              <p v-if="item.description" class="desc">{{ item.description }}</p>

              <div class="seller-card">
                <span class="avatar">🧑‍🌾</span>
                <div class="s-info">
                  <span class="s-label">{{ t('bazaar.seller') }}</span>
                  <strong>{{ item.sellerName }} <TrustBadge :trust="item.sellerTrust" /></strong>
                  <small>{{ t(`login.types.${item.sellerType}`) }}{{ regionOf ? ` · 📍 ${regionOf}` : '' }}</small>
                </div>
              </div>
            </div>
          </section>

          <!-- Kanan: checkout -->
          <section class="checkout">
            <template v-if="!result">
              <h3>{{ t('bazaar.checkoutTitle') }}</h3>
              <div class="form-grid">
                <label>{{ t('bazaar.qty', { unit: item.unit }) }}</label>
                <InputText v-model="form.qty" type="number" :min="item.minOrder ?? '0'" step="0.25" :disabled="soldOut" fluid />
                <label>{{ t('bazaar.yourName') }}</label>
                <InputText v-model="form.buyerName" maxlength="80" :disabled="soldOut" fluid />
                <label>{{ t('bazaar.yourPhone') }}</label>
                <InputText v-model="form.buyerPhone" maxlength="30" placeholder="08xx-xxxx-xxxx" :disabled="soldOut" fluid />
                <label>{{ t('common.note') }} <small>({{ t('common.optional') }})</small></label>
                <Textarea v-model="form.note" rows="2" maxlength="300" :placeholder="t('bazaar.notePh')" :disabled="soldOut" fluid />

                <label>{{ t('bazaar.payMethod') }}</label>
                <div class="pay-opts">
                  <button
                    v-if="item.sellerHasQris"
                    type="button"
                    class="pay-opt"
                    :class="{ on: form.paymentMethod === 'qris' }"
                    :disabled="soldOut"
                    @click="form.paymentMethod = 'qris'"
                  >
                    <i class="pi pi-qrcode" />
                    <span class="po-body"><strong>QRIS</strong><small>{{ t('bazaar.payQrisSub') }}</small></span>
                  </button>
                  <button
                    type="button"
                    class="pay-opt"
                    :class="{ on: form.paymentMethod === 'tunai' }"
                    :disabled="soldOut"
                    @click="form.paymentMethod = 'tunai'"
                  >
                    <i class="pi pi-wallet" />
                    <span class="po-body"><strong>{{ t('bazaar.payCash') }}</strong><small>{{ t('bazaar.payCashSub') }}</small></span>
                  </button>
                </div>

                <div class="total-line">{{ t('bazaar.total') }}: <strong>{{ fmtMoney(total) }}</strong></div>
                <Button
                  :label="soldOut ? t('bazaar.soldOut') : t('bazaar.submit')"
                  icon="pi pi-send"
                  :disabled="soldOut || !form.qty || Number(form.qty) <= 0 || !form.buyerName || !form.buyerPhone"
                  :loading="order.isPending.value"
                  @click="order.mutate()"
                />
              </div>
            </template>

            <!-- Sukses -->
            <template v-else>
              <div class="success">
                <span class="check"><i class="pi pi-check" /></span>
                <h3>{{ t('bazaar.successTitle') }}</h3>
                <p>{{ t('bazaar.successSub', { code: result.code }) }}</p>
                <div class="sum">
                  <span>{{ fmtQty(result.qty) }} {{ result.unit }} · {{ result.title }}</span>
                  <strong>{{ fmtMoney(result.total) }}</strong>
                </div>

                <!-- Bayar via QRIS: tampilkan kode QR penjual + nominal -->
                <div v-if="result.paymentMethod === 'qris' && result.qrisUrl" class="qris-pay">
                  <h4><i class="pi pi-qrcode" /> {{ t('bazaar.qrisTitle') }}</h4>
                  <img :src="result.qrisUrl" class="qris-img" alt="QRIS" />
                  <p class="qris-amount">{{ t('bazaar.qrisAmount') }}: <strong>{{ fmtMoney(result.total) }}</strong></p>
                  <p class="qris-note">{{ t('bazaar.qrisNote', { code: result.code }) }}</p>
                </div>

                <a v-if="waLink" :href="waLink" target="_blank" rel="noopener" class="wa-btn">
                  <i class="pi pi-whatsapp" /> {{ t('bazaar.waButton') }}
                </a>
                <RouterLink :to="{ name: 'bazaar' }" class="more">{{ t('bazaar.more') }}</RouterLink>
              </div>
            </template>
          </section>
        </div>

        <!-- Lapak lain penjual -->
        <section v-if="item.others?.length" class="others">
          <h3>{{ t('bazaar.othersTitle') }}</h3>
          <div class="ogrid">
            <RouterLink
              v-for="o in item.others"
              :key="o.id"
              :to="{ name: 'bazaar-detail', params: { id: o.id } }"
              class="ocard"
            >
              <img v-if="o.photoUrl" :src="o.photoUrl" class="oemo ophoto" alt="" loading="lazy" />
              <span v-else class="oemo" :style="{ background: produceTint(o.category) }">{{ produceEmoji(o.commodityCode, o.commodityName, o.category) }}</span>
              <div class="obody">
                <span class="otitle">{{ o.title }}</span>
                <span class="oprice">{{ fmtMoney(o.pricePerUnit) }}<small>/{{ o.unit }}</small></span>
              </div>
            </RouterLink>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.bz-page { min-height: 100vh; background: var(--app-bg); }
.bz-main { max-width: 1120px; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
.back {
  display: inline-flex; align-items: center; gap: 0.4rem; margin: 0.3rem 0 1rem;
  color: var(--app-text-muted); text-decoration: none; font-size: 0.85rem; font-weight: 600;
}
.back:hover { color: var(--app-primary); }

.detail { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.2rem; align-items: start; }
@media (max-width: 880px) { .detail { grid-template-columns: 1fr; } }

.left { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 16px; overflow: hidden; }
.tile { height: 220px; display: grid; place-items: center; overflow: hidden; }
.tile .emo { font-size: 5.2rem; filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.2)); }
.tphoto { width: 100%; height: 100%; object-fit: cover; display: block; }
@media (min-width: 881px) { .tile { height: 300px; } }
.thumbs {
  display: flex; gap: 0.45rem; padding: 0.6rem 0.8rem 0.1rem;
  overflow-x: auto; scrollbar-width: thin;
}
.th {
  width: 58px; height: 58px; border-radius: 10px; overflow: hidden; flex-shrink: 0;
  border: 2px solid var(--app-border); background: none; padding: 0; cursor: pointer;
  opacity: 0.75; transition: opacity 0.12s ease, border-color 0.12s ease;
}
.th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.th.on { border-color: var(--app-primary); opacity: 1; }
.th:hover { opacity: 1; }
.info { padding: 1.1rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-start; }
h1 { margin: 0; font-size: 1.45rem; line-height: 1.25; }
.price { font-size: 1.6rem; font-weight: 800; color: var(--app-primary); }
.price small { font-size: 0.9rem; color: var(--app-text-muted); font-weight: 600; }
.meta { font-size: 0.85rem; color: var(--app-text-muted); display: flex; gap: 0.4rem; flex-wrap: wrap; }
.meta .out { color: var(--app-danger); font-weight: 700; }
.desc { margin: 0.3rem 0 0; font-size: 0.92rem; color: var(--app-text); white-space: pre-line; }
.seller-card {
  margin-top: 0.7rem; display: flex; gap: 0.7rem; align-items: center;
  background: var(--app-surface-2); border-radius: 12px; padding: 0.7rem 0.9rem; width: 100%;
}
.avatar { font-size: 1.8rem; }
.s-info { display: flex; flex-direction: column; min-width: 0; }
.s-label { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--app-text-muted); }
.s-info small { color: var(--app-text-muted); font-size: 0.78rem; }

.checkout {
  background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 16px;
  padding: 1.1rem 1.25rem; position: sticky; top: 64px;
}
.checkout h3 { margin: 0 0 0.6rem; }
.total-line {
  margin: 0.6rem 0; padding: 0.55rem 0.75rem; border-radius: 10px;
  background: color-mix(in srgb, var(--app-primary) 10%, transparent); font-size: 0.95rem;
}
.pay-opts { display: flex; flex-direction: column; gap: 0.45rem; }
.pay-opt {
  display: flex; align-items: center; gap: 0.65rem; width: 100%; text-align: left;
  background: var(--app-surface-2); border: 2px solid var(--app-border); border-radius: 12px;
  padding: 0.55rem 0.75rem; cursor: pointer; color: var(--app-text); font: inherit;
  transition: border-color 0.12s ease;
}
.pay-opt .pi { font-size: 1.2rem; color: var(--app-text-muted); }
.pay-opt.on { border-color: var(--app-primary); background: color-mix(in srgb, var(--app-primary) 8%, transparent); }
.pay-opt.on .pi { color: var(--app-primary); }
.pay-opt:disabled { opacity: 0.6; cursor: not-allowed; }
.po-body { display: flex; flex-direction: column; min-width: 0; }
.po-body strong { font-size: 0.88rem; }
.po-body small { color: var(--app-text-muted); font-size: 0.74rem; }

.qris-pay {
  width: 100%; background: var(--app-surface-2); border: 1px solid var(--app-border);
  border-radius: 12px; padding: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
}
.qris-pay h4 { margin: 0; font-size: 0.92rem; display: flex; align-items: center; gap: 0.4rem; }
.qris-img { max-width: 220px; width: 100%; border-radius: 10px; background: #fff; }
.qris-amount { margin: 0; font-size: 0.92rem; }
.qris-amount strong { color: var(--app-primary); font-size: 1.05rem; }
.qris-note { margin: 0; font-size: 0.76rem; color: var(--app-text-muted); }

.success { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.5rem; padding: 0.6rem 0; }
.check {
  width: 56px; height: 56px; border-radius: 50%; background: var(--app-grad); color: #fff;
  display: grid; place-items: center; font-size: 1.5rem;
}
.success p { margin: 0; color: var(--app-text-muted); font-size: 0.9rem; }
.sum {
  width: 100%; display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap;
  background: var(--app-surface-2); border-radius: 10px; padding: 0.6rem 0.8rem; font-size: 0.88rem;
}
.wa-btn {
  display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem;
  background: #25d366; color: #fff; text-decoration: none; font-weight: 700;
  padding: 0.6rem 1.1rem; border-radius: 999px; font-size: 0.9rem;
}
.wa-btn:hover { filter: brightness(1.06); }
.more { margin-top: 0.3rem; color: var(--app-primary); font-weight: 600; text-decoration: none; font-size: 0.85rem; }
.more:hover { text-decoration: underline; }

.others { margin-top: 1.6rem; }
.others h3 { margin: 0 0 0.7rem; }
.ogrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.7rem; }
.ocard {
  display: flex; gap: 0.7rem; align-items: center; text-decoration: none; color: var(--app-text);
  background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 0.6rem 0.7rem;
  transition: border-color 0.12s ease, transform 0.12s ease;
}
.ocard:hover { border-color: var(--app-primary); transform: translateY(-2px); }
.oemo { width: 46px; height: 46px; border-radius: 10px; display: grid; place-items: center; font-size: 1.5rem; flex-shrink: 0; }
.ophoto { object-fit: cover; }
.obody { display: flex; flex-direction: column; min-width: 0; }
.otitle { font-size: 0.82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oprice { font-size: 0.82rem; font-weight: 700; color: var(--app-primary); }
.oprice small { color: var(--app-text-muted); font-weight: 500; }
.empty-note { padding: 1.5rem; color: var(--app-text-muted); }
</style>
