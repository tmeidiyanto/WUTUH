<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const auth = useAuthStore();
</script>

<template>
  <header class="bz-head">
    <RouterLink :to="{ name: 'bazaar' }" class="bz-brand">
      <span class="logo">WUTUH</span><span class="dot" />
      <span class="sub">{{ t('bazaar.brand') }}</span>
    </RouterLink>
    <div class="sp" />
    <RouterLink :to="{ name: auth.isAuthenticated() ? 'listings' : 'login' }" class="sell">
      🧺 <span>{{ t('bazaar.sellHere') }}</span>
    </RouterLink>
    <RouterLink v-if="auth.isAuthenticated()" :to="{ name: 'dashboard' }" class="appbtn">
      <i class="pi pi-home" /> {{ t('bazaar.toApp') }}
    </RouterLink>
    <RouterLink v-else :to="{ name: 'login' }" class="appbtn">
      <i class="pi pi-sign-in" /> {{ t('bazaar.login') }}
    </RouterLink>
  </header>
</template>

<style scoped>
.bz-head {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.6rem 1.1rem; background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
}
.bz-brand { display: inline-flex; align-items: baseline; gap: 0.3rem; text-decoration: none; min-width: 0; }
.logo {
  font-size: 1.2rem; font-weight: 800; letter-spacing: 0.04em;
  background: var(--app-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--app-accent); align-self: center; margin-top: 4px; }
.sub { font-size: 0.85rem; font-weight: 700; color: var(--app-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp { flex: 1; }
.sell {
  font-size: 0.8rem; font-weight: 600; color: var(--app-text-muted); text-decoration: none;
  display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap;
}
.sell:hover { color: var(--app-primary); }
.appbtn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--app-grad); color: #fff; text-decoration: none;
  font-weight: 700; font-size: 0.8rem; padding: 0.4rem 0.85rem; border-radius: 999px; white-space: nowrap;
}
.appbtn:hover { filter: brightness(1.07); }
@media (max-width: 640px) {
  .sub { display: none; }
  .sell span { display: none; }
}
</style>
