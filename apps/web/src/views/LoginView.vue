<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { useAuthStore } from '@/stores/auth';
import { apiError } from '@/lib/api';
import { STAGES, STAGE_ICONS } from '@/lib/stages';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const mode = ref<'login' | 'register'>('login');
const loading = ref(false);

const email = ref('petani@demo.com');
const password = ref('petani123');

const reg = ref({
  businessName: '',
  businessType: 'petani',
  fullName: '',
  email: '',
  password: '',
  phone: '',
  province: '',
  regency: '',
});
const typeOptions = computed(() =>
  ['petani', 'kelompok_tani', 'koperasi', 'perusahaan'].map((v) => ({ value: v, label: t(`login.types.${v}`) })),
);

async function submitLogin() {
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push({ name: 'dashboard' });
  } catch {
    toast.add({ severity: 'error', summary: t('login.failed'), detail: t('login.wrongCred'), life: 3000 });
  } finally {
    loading.value = false;
  }
}

async function submitRegister() {
  loading.value = true;
  try {
    await auth.register({
      businessName: reg.value.businessName,
      businessType: reg.value.businessType,
      fullName: reg.value.fullName,
      email: reg.value.email,
      password: reg.value.password,
      phone: reg.value.phone || undefined,
      province: reg.value.province || undefined,
      regency: reg.value.regency || undefined,
    });
    router.push({ name: 'dashboard' });
  } catch (e) {
    toast.add({ severity: 'error', summary: t('login.registerFailed'), detail: apiError(e), life: 4000 });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <!-- Panel hero (kiri di desktop, atas di mobile) -->
    <section class="hero">
      <div class="hero-inner">
        <div class="logo-row">
          <span class="logo">WUTUH</span>
        </div>
        <p class="tagline">{{ t('app.tagline') }}</p>
        <p class="philosophy">🌾 {{ t('app.philosophy') }}</p>

        <div class="chain-preview">
          <div class="chain-title">{{ t('app.chainTitle') }}</div>
          <div class="chain-sub">{{ t('app.chainSub') }}</div>
          <div class="mini-chain">
            <template v-for="(s, i) in STAGES" :key="s">
              <span class="mini-node" :title="t(`stage.${s}`)"><i class="pi" :class="STAGE_ICONS[s]" /></span>
              <span v-if="i < STAGES.length - 1" class="mini-sep" />
            </template>
          </div>
          <div class="modules">
            <span v-for="m in ['Farm', 'Ranch', 'Garden', 'Market', 'Trade', 'Export', 'Supply', 'Finance', 'AI', 'IoT']" :key="m" class="module-chip">
              WUTUH {{ m }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Panel form -->
    <section class="pane">
      <form v-if="mode === 'login'" class="card" @submit.prevent="submitLogin">
        <h1>{{ t('login.welcome') }}</h1>
        <p class="sub">{{ t('login.subtitle') }}</p>
        <label>{{ t('login.email') }}</label>
        <InputText v-model="email" type="email" autocomplete="email" placeholder="nama@contoh.com" fluid />
        <label>{{ t('login.password') }}</label>
        <Password v-model="password" :feedback="false" toggleMask fluid autocomplete="current-password" />
        <Button type="submit" :label="t('login.submit')" :loading="loading" class="submit" />
        <p class="alt">
          {{ t('login.noAccount') }}
          <a href="#" @click.prevent="mode = 'register'">{{ t('login.registerLink') }}</a>
        </p>
        <p class="demo-hint"><i class="pi pi-info-circle" /> {{ t('login.demoHint') }}</p>
        <RouterLink class="bazaar-link" :to="{ name: 'bazaar' }">🧺 {{ t('login.browseBazaar') }}</RouterLink>
      </form>

      <form v-else class="card" @submit.prevent="submitRegister">
        <h1>{{ t('login.registerTitle') }}</h1>
        <p class="sub">{{ t('login.registerSub') }}</p>
        <label>{{ t('login.businessName') }}</label>
        <InputText v-model="reg.businessName" maxlength="80" placeholder="Tani Makmur Jaya" fluid />
        <div class="row2">
          <div>
            <label>{{ t('login.businessType') }}</label>
            <Select v-model="reg.businessType" :options="typeOptions" optionValue="value" optionLabel="label" fluid />
          </div>
          <div>
            <label>{{ t('login.phone') }} <small>({{ t('common.optional') }})</small></label>
            <InputText v-model="reg.phone" maxlength="30" placeholder="08xx-xxxx-xxxx" fluid />
          </div>
        </div>
        <label>{{ t('login.fullName') }}</label>
        <InputText v-model="reg.fullName" maxlength="80" fluid />
        <div class="row2">
          <div>
            <label>{{ t('login.province') }} <small>({{ t('common.optional') }})</small></label>
            <InputText v-model="reg.province" maxlength="60" fluid />
          </div>
          <div>
            <label>{{ t('login.regency') }} <small>({{ t('common.optional') }})</small></label>
            <InputText v-model="reg.regency" maxlength="60" fluid />
          </div>
        </div>
        <label>{{ t('login.email') }}</label>
        <InputText v-model="reg.email" type="email" autocomplete="email" fluid />
        <label>{{ t('login.password') }}</label>
        <Password v-model="reg.password" toggleMask fluid :feedback="false" autocomplete="new-password" />
        <Button
          type="submit"
          :label="t('login.registerSubmit')"
          :loading="loading"
          class="submit"
          :disabled="!reg.businessName || !reg.fullName || !reg.email || reg.password.length < 6"
        />
        <p class="alt">
          {{ t('login.haveAccount') }}
          <a href="#" @click.prevent="mode = 'login'">{{ t('login.loginLink') }}</a>
        </p>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
}
.hero {
  background:
    radial-gradient(1000px 500px at 15% -10%, rgba(255, 255, 255, 0.16), transparent 60%),
    linear-gradient(140deg, #14532d 0%, #15803d 42%, #0e7490 82%, #0369a1 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
}
.hero-inner { max-width: 560px; width: 100%; }
.logo { font-size: 3.2rem; font-weight: 800; letter-spacing: 0.06em; }
.tagline { font-size: 1.05rem; opacity: 0.92; margin: 0.2rem 0 0.1rem; }
.philosophy { font-style: italic; opacity: 0.8; margin: 0 0 1.8rem; }

.chain-preview {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 16px;
  padding: 1.1rem 1.2rem;
  backdrop-filter: blur(4px);
}
.chain-title { font-weight: 700; font-size: 0.95rem; }
.chain-sub { font-size: 0.78rem; opacity: 0.85; margin-bottom: 0.8rem; }
.mini-chain { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.9rem; }
.mini-node {
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.75rem;
}
.mini-sep { width: 10px; height: 2px; background: rgba(255, 255, 255, 0.35); border-radius: 2px; }
.modules { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.module-chip {
  font-size: 0.7rem; font-weight: 600;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.22rem 0.55rem; border-radius: 999px;
}

.pane {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem;
  background: var(--app-bg);
}
.card {
  width: 100%;
  max-width: 420px;
  background: var(--app-surface);
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid var(--app-border);
  box-shadow: 0 14px 40px rgba(10, 40, 20, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
h1 {
  margin: 0;
  font-size: 1.45rem;
  background: var(--app-grad);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sub { margin: 0 0 0.9rem; color: var(--app-text-muted); }
label { font-size: 0.85rem; font-weight: 600; margin-top: 0.5rem; }
label small { color: var(--app-text-muted); font-weight: 400; }
.submit { margin-top: 1.1rem; }
.alt { text-align: center; font-size: 0.85rem; color: var(--app-text-muted); margin: 0.8rem 0 0; }
.alt a { color: var(--app-primary); font-weight: 600; text-decoration: none; }
.demo-hint {
  margin: 0.7rem 0 0; font-size: 0.76rem; color: var(--app-text-muted);
  background: var(--app-surface-2); border-radius: 8px; padding: 0.5rem 0.6rem;
  display: flex; align-items: center; gap: 0.4rem;
}
.bazaar-link {
  margin-top: 0.7rem; text-align: center; font-size: 0.85rem; font-weight: 600;
  color: var(--app-primary); text-decoration: none;
}
.bazaar-link:hover { text-decoration: underline; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }

@media (max-width: 860px) {
  .login-page { grid-template-columns: 1fr; }
  .hero { padding: 1.6rem 1.25rem; }
  .hero-inner { max-width: 460px; }
  .logo { font-size: 2.2rem; }
  .chain-preview { display: none; }
  .pane { padding: 1.5rem 1rem 2.5rem; margin-top: -14px; }
  .card { border-radius: 16px; }
}
@media (max-width: 560px) {
  .row2 { grid-template-columns: 1fr; }
  .card { padding: 1.4rem; }
}
</style>
