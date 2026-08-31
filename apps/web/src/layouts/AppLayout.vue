<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/composables/useTheme';
import { LOCALES, setLocale } from '@/i18n';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();
const { isDark, toggle, theme, themes, setTheme, density, setDensity } = useTheme();

function hasPerm(perm?: string) {
  if (!perm) return true;
  return auth.can(perm);
}

type Item = { name: string; label: string; icon: string; perm?: string };
type Group = { key: string; label: string; icon: string; items: Item[] };

// Menu utama → submenu (10 modul WUTUH).
const GROUPS: Group[] = [
  { key: 'farm', label: 'nav.grpFarm', icon: 'pi-sun', items: [
    { name: 'lands', label: 'nav.lands', icon: 'pi-map', perm: 'master.read' },
    { name: 'cycles', label: 'nav.cycles', icon: 'pi-sync', perm: 'farm.read' },
    { name: 'agenda', label: 'nav.agenda', icon: 'pi-calendar', perm: 'farm.read' },
    { name: 'commodities', label: 'nav.commodities', icon: 'pi-box', perm: 'master.read' },
  ] },
  { key: 'ranch', label: 'nav.grpRanch', icon: 'pi-heart', items: [
    { name: 'livestock', label: 'nav.livestockList', icon: 'pi-tag', perm: 'ranch.read' },
    { name: 'ranch-records', label: 'nav.ranchRecords', icon: 'pi-file-edit', perm: 'ranch.read' },
  ] },
  { key: 'garden', label: 'nav.grpGarden', icon: 'pi-sparkles', items: [
    { name: 'garden', label: 'nav.garden', icon: 'pi-sitemap', perm: 'farm.read' },
  ] },
  { key: 'market', label: 'nav.grpMarket', icon: 'pi-shopping-cart', items: [
    { name: 'prices', label: 'nav.prices', icon: 'pi-chart-line', perm: 'market.read' },
    { name: 'listings', label: 'nav.listings', icon: 'pi-megaphone', perm: 'market.read' },
    { name: 'orders', label: 'nav.orders', icon: 'pi-shopping-bag', perm: 'market.read' },
  ] },
  { key: 'trade', label: 'nav.grpTrade', icon: 'pi-briefcase', items: [
    { name: 'partners', label: 'nav.partners', icon: 'pi-id-card', perm: 'trade.read' },
    { name: 'deals', label: 'nav.deals', icon: 'pi-file-check', perm: 'trade.read' },
  ] },
  { key: 'export', label: 'nav.grpExport', icon: 'pi-globe', items: [
    { name: 'export', label: 'nav.exportShipments', icon: 'pi-send', perm: 'export.read' },
  ] },
  { key: 'supply', label: 'nav.grpSupply', icon: 'pi-warehouse', items: [
    { name: 'stock', label: 'nav.stock', icon: 'pi-inbox', perm: 'supply.read' },
    { name: 'deliveries', label: 'nav.deliveries', icon: 'pi-truck', perm: 'supply.read' },
  ] },
  { key: 'finance', label: 'nav.grpFinance', icon: 'pi-wallet', items: [
    { name: 'finance', label: 'nav.finance', icon: 'pi-money-bill', perm: 'finance.read' },
  ] },
  { key: 'ai', label: 'nav.grpAi', icon: 'pi-microchip-ai', items: [
    { name: 'insights', label: 'nav.insights', icon: 'pi-lightbulb', perm: 'ai.read' },
  ] },
  { key: 'iot', label: 'nav.grpIot', icon: 'pi-wifi', items: [
    { name: 'iot', label: 'nav.iot', icon: 'pi-gauge', perm: 'iot.read' },
  ] },
  { key: 'admin', label: 'nav.grpAdmin', icon: 'pi-cog', items: [
    { name: 'users', label: 'nav.users', icon: 'pi-users', perm: 'iam.read' },
    { name: 'channels', label: 'nav.channels', icon: 'pi-megaphone', perm: 'settings.read' },
    { name: 'payment', label: 'nav.payment', icon: 'pi-qrcode', perm: 'settings.read' },
  ] },
];

const visibleGroups = computed(() =>
  GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => hasPerm(it.perm)) })).filter((g) => g.items.length),
);

const curName = computed(() => route.name as string);
const isActiveItem = (name: string) => curName.value === name;
const activeGroup = computed(() => visibleGroups.value.find((g) => g.items.some((it) => it.name === curName.value)));

const open = ref<Record<string, boolean>>({});
watch(activeGroup, (g) => { if (g) open.value[g.key] = true; }, { immediate: true });
const isOpen = (k: string) => !!open.value[k];

// ===== Responsif: mobile (<= 920px) memakai drawer, desktop memakai sidebar collapsible =====
const isMobile = ref(false);
const drawerOpen = ref(false);
let mq: MediaQueryList | null = null;
const onMq = (e: MediaQueryListEvent | MediaQueryList) => {
  isMobile.value = e.matches;
  if (!e.matches) drawerOpen.value = false;
};
onMounted(() => {
  mq = window.matchMedia('(max-width: 920px)');
  onMq(mq);
  mq.addEventListener('change', onMq);
});
onBeforeUnmount(() => mq?.removeEventListener('change', onMq));
// Tutup drawer setiap pindah halaman.
watch(() => route.fullPath, () => { drawerOpen.value = false; });

const collapsed = ref(localStorage.getItem('wutuh-sidebar-collapsed') === '1');
function toggleCollapse() {
  collapsed.value = !collapsed.value;
  localStorage.setItem('wutuh-sidebar-collapsed', collapsed.value ? '1' : '0');
}
function toggleGroup(k: string) {
  if (!isMobile.value && collapsed.value) {
    collapsed.value = false;
    localStorage.setItem('wutuh-sidebar-collapsed', '0');
    open.value[k] = true;
  } else open.value[k] = !open.value[k];
}

const crumb = computed(() => {
  if (route.name === 'dashboard') return { groupLabel: null as string | null, pageLabel: 'nav.dashboard' as string | null };
  const g = activeGroup.value;
  const it = g?.items.find((x) => x.name === curName.value);
  return { groupLabel: g?.label ?? null, pageLabel: it?.label ?? null };
});

// Header dropdowns
const settingsOpen = ref(false);
const accountOpen = ref(false);
function toggleSettings() { accountOpen.value = false; settingsOpen.value = !settingsOpen.value; }
function toggleAccount() { settingsOpen.value = false; accountOpen.value = !accountOpen.value; }
function closeMenus() { settingsOpen.value = false; accountOpen.value = false; }

const initials = computed(() => {
  const p = (auth.user?.fullName || '').trim().split(/\s+/);
  return (((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()) || (auth.user?.fullName?.[0] || 'U').toUpperCase();
});

function logout() { closeMenus(); auth.logout(); router.push({ name: 'login' }); }
</script>

<template>
  <div class="layout">
    <!-- Sidebar desktop / drawer mobile -->
    <aside
      class="sidebar"
      :class="{ collapsed: !isMobile && collapsed, 'mobile-drawer': isMobile, open: isMobile && drawerOpen }"
    >
      <div class="brand-row">
        <template v-if="isMobile || !collapsed">
          <span class="brand">WUTUH</span>
          <span class="brand-dot" />
        </template>
        <span v-else class="brand-mini">W</span>
        <button v-if="isMobile" class="drawer-close" @click="drawerOpen = false"><i class="pi pi-times" /></button>
      </div>
      <div v-if="isMobile || !collapsed" class="brand-sub">{{ t('app.tagline') }}</div>

      <nav class="nav">
        <RouterLink
          :to="{ name: 'dashboard' }"
          class="nav-item"
          :class="{ active: route.name === 'dashboard' }"
          :title="!isMobile && collapsed ? t('nav.dashboard') : undefined"
        >
          <i class="pi pi-home" /><span v-if="isMobile || !collapsed">{{ t('nav.dashboard') }}</span>
        </RouterLink>

        <div
          v-for="g in visibleGroups"
          :key="g.key"
          class="grp"
          :class="{ open: isOpen(g.key), activeGrp: activeGroup?.key === g.key }"
        >
          <button class="grp-head" @click="toggleGroup(g.key)" :title="!isMobile && collapsed ? t(g.label) : undefined">
            <i class="pi grp-icon" :class="g.icon" />
            <span v-if="isMobile || !collapsed" class="grp-label">{{ t(g.label) }}</span>
            <i v-if="isMobile || !collapsed" class="pi chev" :class="isOpen(g.key) ? 'pi-chevron-down' : 'pi-chevron-right'" />
          </button>

          <!-- Submenu (expanded / mobile) -->
          <div v-if="isMobile || !collapsed" v-show="isOpen(g.key)" class="sub">
            <RouterLink
              v-for="it in g.items"
              :key="it.name"
              :to="{ name: it.name }"
              class="sub-item"
              :class="{ active: isActiveItem(it.name) }"
            >
              <i class="pi" :class="it.icon" /><span>{{ t(it.label) }}</span>
            </RouterLink>
          </div>

          <!-- Flyout (desktop collapsed, hover) -->
          <div v-else class="flyout">
            <div class="flyout-title">{{ t(g.label) }}</div>
            <RouterLink
              v-for="it in g.items"
              :key="it.name"
              :to="{ name: it.name }"
              class="sub-item"
              :class="{ active: isActiveItem(it.name) }"
            >
              <i class="pi" :class="it.icon" /><span>{{ t(it.label) }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>

      <button v-if="!isMobile" class="collapse-btn" @click="toggleCollapse" :title="collapsed ? t('top.expand') : t('top.collapse')">
        <i class="pi" :class="collapsed ? 'pi-angle-double-right' : 'pi-angle-double-left'" />
        <span v-if="!collapsed">{{ t('top.collapse') }}</span>
      </button>
    </aside>
    <div v-if="isMobile && drawerOpen" class="drawer-backdrop" @click="drawerOpen = false" />

    <div class="main">
      <header class="topbar">
        <button v-if="isMobile" class="icon-btn burger" :title="t('top.menu')" @click="drawerOpen = true">
          <i class="pi pi-bars" />
        </button>

        <span v-if="!isMobile" class="philosophy-top">🌾 {{ t('app.philosophy') }}</span>

        <nav class="crumbs">
          <RouterLink :to="{ name: 'dashboard' }" class="crumb company">{{ auth.user?.companyName ?? auth.user?.companyCode }}</RouterLink>
          <template v-if="crumb.groupLabel && !isMobile"><i class="pi pi-angle-right sep" /><span class="crumb">{{ t(crumb.groupLabel) }}</span></template>
          <template v-if="crumb.pageLabel"><i class="pi pi-angle-right sep" /><span class="crumb cur">{{ t(crumb.pageLabel) }}</span></template>
        </nav>

        <div class="spacer" />

        <div class="hbtns">
          <!-- Pasar WUTUH (etalase jual-beli) -->
          <RouterLink :to="{ name: 'bazaar' }" class="bazaar-btn" :title="t('top.bazaar')">
            <i class="pi pi-shopping-cart" /><span class="bz-label">{{ t('top.bazaar') }}</span>
          </RouterLink>

          <!-- Settings -->
          <div class="dd">
            <button class="icon-btn" :class="{ on: settingsOpen }" :title="t('top.settings')" @click.stop="toggleSettings"><i class="pi pi-cog" /></button>
            <div v-if="settingsOpen" class="menu settings-menu" @click.stop>
              <div class="menu-sec">{{ t('top.appearance') }}</div>
              <div class="menu-row">
                <span class="rlabel">{{ t('top.theme') }}</span>
                <div class="themes">
                  <button v-for="th in themes" :key="th.key" class="dot" :class="{ active: theme === th.key }" :style="{ background: th.color }" :title="th.label" @click="setTheme(th.key)" />
                </div>
              </div>
              <div class="menu-row">
                <span class="rlabel">{{ isDark ? t('top.darkMode') : t('top.lightMode') }}</span>
                <button class="mode-btn" @click="toggle">
                  <i class="pi" :class="isDark ? 'pi-sun' : 'pi-moon'" /> {{ isDark ? t('top.lightMode') : t('top.darkMode') }}
                </button>
              </div>
              <div class="menu-row">
                <span class="rlabel">{{ t('top.density') }}</span>
                <div class="seg">
                  <button :class="{ on: density === 'comfortable' }" @click="setDensity('comfortable')">{{ t('top.comfortable') }}</button>
                  <button :class="{ on: density === 'compact' }" @click="setDensity('compact')">{{ t('top.compact') }}</button>
                </div>
              </div>
              <div class="menu-sec">{{ t('top.language') }}</div>
              <select class="lang-native" :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value)">
                <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.label }}</option>
              </select>
            </div>
          </div>

          <!-- Account -->
          <div class="dd">
            <button class="avatar" :class="{ on: accountOpen }" :title="t('top.account')" @click.stop="toggleAccount"><span>{{ initials }}</span></button>
            <div v-if="accountOpen" class="menu account-menu" @click.stop>
              <div class="acct-head">
                <span class="avatar big"><span>{{ initials }}</span></span>
                <div class="acct-info">
                  <div class="acct-name">{{ auth.user?.fullName }}</div>
                  <div class="acct-co"><i class="pi pi-building" /> {{ auth.user?.companyName }}</div>
                </div>
              </div>
              <div class="menu-div" />
              <button class="signout" @click="logout"><i class="pi pi-sign-out" /> {{ t('top.logout') }}</button>
            </div>
          </div>
        </div>
      </header>

      <main class="content"><RouterView /></main>
    </div>

    <div v-if="settingsOpen || accountOpen" class="backdrop" @click="closeMenus" />
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }

/* ===== Sidebar ===== */
.sidebar {
  width: 236px; background: var(--app-sidebar); color: var(--app-sidebar-text);
  border-right: 1px solid var(--app-sidebar-border); padding: 0.6rem 0.55rem;
  flex-shrink: 0; height: 100vh; position: sticky; top: 0; z-index: 40;
  display: flex; flex-direction: column; transition: width 0.18s ease, transform 0.22s ease;
}
.sidebar.collapsed { width: 60px; }
.brand-row { display: flex; align-items: center; height: 38px; padding: 0 0.55rem 0; flex-shrink: 0; gap: 0.3rem; }
.brand {
  font-size: 1.35rem; font-weight: 800; letter-spacing: 0.04em;
  background: var(--app-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--app-accent); margin-top: 6px; }
.brand-mini {
  font-size: 1.15rem; font-weight: 800; margin: 0 auto;
  background: var(--app-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.brand-sub { font-size: 0.62rem; color: var(--app-sidebar-muted); padding: 0 0.6rem 0.5rem; letter-spacing: 0.03em; }
.drawer-close { margin-left: auto; border: none; background: transparent; color: var(--app-sidebar-text); cursor: pointer; font-size: 1rem; padding: 0.3rem; }

.nav { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--app-sidebar-hover) transparent; }
.sidebar.collapsed .nav { overflow: visible; }
.nav::-webkit-scrollbar { width: 7px; }
.nav::-webkit-scrollbar-thumb { background: var(--app-sidebar-hover); border-radius: 4px; }

.nav-item, .grp-head {
  display: flex; align-items: center; gap: 0.6rem; width: 100%;
  padding: 0.48rem 0.6rem; border-radius: 8px; color: var(--app-sidebar-text);
  text-decoration: none; font-size: 0.88rem; border: none; background: transparent;
  cursor: pointer; font-family: inherit; margin-bottom: 0.1rem;
}
.nav-item > .pi, .grp-icon { font-size: 1rem; width: 1.15rem; text-align: center; flex-shrink: 0; }
.nav-item:hover, .grp-head:hover { background: var(--app-sidebar-hover); }
.nav-item.active { background: var(--app-primary); color: #fff; }
.grp-label { flex: 1; text-align: left; font-weight: 600; white-space: nowrap; }
.chev { font-size: 0.7rem; opacity: 0.7; }
.grp.activeGrp > .grp-head { color: var(--app-primary); }

.sub { margin: 0.1rem 0 0.35rem; padding-left: 0.55rem; border-left: 1px solid var(--app-sidebar-border); margin-left: 0.85rem; }
.sub-item {
  display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.55rem;
  border-radius: 7px; color: var(--app-sidebar-text); text-decoration: none;
  font-size: 0.85rem; margin-bottom: 0.08rem;
}
.sub-item > .pi { font-size: 0.85rem; width: 1rem; text-align: center; flex-shrink: 0; opacity: 0.85; }
.sub-item:hover { background: var(--app-sidebar-hover); }
.sub-item.active { background: var(--app-primary); color: #fff; }
.sub-item.active > .pi { opacity: 1; }

/* Collapsed (desktop): center icons, flyout on hover */
.sidebar.collapsed .grp-head { justify-content: center; padding: 0.5rem 0; }
.sidebar.collapsed .nav-item { justify-content: center; padding: 0.5rem 0; }
.grp { position: relative; }
.flyout {
  display: none; position: absolute; left: calc(100% + 6px); top: 0; z-index: 50;
  min-width: 210px; background: var(--app-surface); color: var(--app-text);
  border: 1px solid var(--app-border); border-radius: 10px; padding: 0.4rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}
/* Jembatan transparan menutup celah ikon↔flyout agar hover tidak putus */
.flyout::before { content: ''; position: absolute; top: 0; left: -12px; width: 12px; height: 100%; }
.sidebar.collapsed .grp:hover .flyout { display: block; }
.flyout-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--app-text-muted); padding: 0.25rem 0.5rem 0.4rem; }
.flyout .sub-item { color: var(--app-text); }
.flyout .sub-item:hover { background: var(--app-row-hover); }

.collapse-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  margin-top: 0.2rem; padding: 0.5rem; border-radius: 8px; border: none;
  background: transparent; color: var(--app-sidebar-text); cursor: pointer;
  font-size: 0.82rem; font-family: inherit; flex-shrink: 0;
}
.collapse-btn:hover { background: var(--app-sidebar-hover); }

/* ===== Mobile drawer ===== */
.sidebar.mobile-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; height: 100dvh; width: min(300px, 86vw);
  transform: translateX(-104%); box-shadow: 0 0 40px rgba(0, 0, 0, 0.25); z-index: 90;
}
.sidebar.mobile-drawer.open { transform: translateX(0); }
.drawer-backdrop { position: fixed; inset: 0; background: rgba(10, 20, 14, 0.45); z-index: 80; }

/* ===== Main + Topbar ===== */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar {
  display: flex; align-items: center; gap: 0.6rem; padding: 0 1rem; height: 52px;
  background: var(--app-surface); border-bottom: 1px solid var(--app-border);
  position: sticky; top: 0; z-index: 60;
}
.burger { font-size: 1.15rem; }
.philosophy-top {
  font-size: 0.78rem; font-style: italic; white-space: nowrap; flex-shrink: 0;
  background: var(--app-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
  border-right: 1px solid var(--app-border); padding-right: 0.75rem;
}
.crumbs { display: flex; align-items: center; gap: 0.35rem; min-width: 0; overflow: hidden; }
.crumb { font-size: 0.9rem; color: var(--app-text-muted); text-decoration: none; white-space: nowrap; }
.crumb.company { font-weight: 700; color: var(--app-primary); overflow: hidden; text-overflow: ellipsis; max-width: 40vw; }
.crumb.cur { color: var(--app-text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.sep { font-size: 0.7rem; color: var(--app-text-muted); opacity: 0.7; flex-shrink: 0; }
.spacer { flex: 1; }
.hbtns { display: flex; align-items: center; gap: 0.5rem; }

.bazaar-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--app-grad); color: #fff; text-decoration: none;
  font-weight: 700; font-size: 0.82rem; padding: 0.42rem 0.85rem; border-radius: 999px;
  white-space: nowrap; box-shadow: 0 2px 10px color-mix(in srgb, var(--app-primary) 35%, transparent);
}
.bazaar-btn:hover { filter: brightness(1.07); }
.bazaar-btn .pi { font-size: 0.9rem; }
@media (max-width: 560px) {
  .bz-label { display: none; }
  .bazaar-btn { padding: 0.42rem 0.55rem; }
}

.icon-btn {
  border: none; background: transparent; cursor: pointer; font-size: 1.05rem;
  color: var(--app-text-muted); padding: 0.4rem; border-radius: 8px; display: inline-flex;
}
.icon-btn:hover, .icon-btn.on { background: var(--app-surface-2); color: var(--app-text); }

.avatar {
  width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--app-grad); color: #fff; font-weight: 700; font-size: 0.8rem;
  display: inline-flex; align-items: center; justify-content: center;
}
.avatar.on { box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-primary) 30%, transparent); }

/* ===== Dropdown menus ===== */
.dd { position: relative; }
.menu {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: 70;
  background: var(--app-surface); color: var(--app-text);
  border: 1px solid var(--app-border); border-radius: 12px; padding: 0.5rem;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.2);
}
.settings-menu { width: min(268px, 88vw); }
.account-menu { width: min(240px, 88vw); }
.menu-sec { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--app-text-muted); padding: 0.35rem 0.4rem 0.25rem; }
.menu-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.35rem 0.4rem; }
.rlabel { font-size: 0.85rem; }
.themes { display: flex; gap: 0.3rem; }
.dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
.dot.active { border-color: var(--app-text); box-shadow: 0 0 0 1px var(--app-surface); }
.mode-btn {
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.32rem 0.6rem;
  border: 1px solid var(--app-border); background: var(--app-surface-2); color: var(--app-text);
  border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-family: inherit;
}
.mode-btn:hover { border-color: var(--app-primary); }
.seg { display: inline-flex; border: 1px solid var(--app-border); border-radius: 8px; overflow: hidden; }
.seg button { border: none; background: var(--app-surface); color: var(--app-text-muted); padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.8rem; font-family: inherit; }
.seg button.on { background: var(--app-primary); color: #fff; }
.lang-native {
  width: 100%; margin-top: 0.2rem; padding: 0.45rem 0.55rem; border-radius: 8px;
  border: 1px solid var(--app-border); background: var(--app-surface); color: var(--app-text);
  font-size: 0.85rem; font-family: inherit; cursor: pointer;
}

.acct-head { display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0.4rem 0.5rem; }
.avatar.big { width: 40px; height: 40px; font-size: 0.9rem; cursor: default; flex-shrink: 0; }
.acct-info { min-width: 0; }
.acct-name { font-weight: 600; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acct-co { font-size: 0.78rem; color: var(--app-text-muted); display: flex; align-items: center; gap: 0.3rem; }
.menu-div { height: 1px; background: var(--app-border); margin: 0.2rem 0; }
.signout {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.4rem;
  border: none; background: transparent; color: var(--app-danger);
  border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-family: inherit;
}
.signout:hover { background: color-mix(in srgb, var(--app-danger) 12%, transparent); }

/* Harus DI BAWAH .topbar (z-index 60) — topbar adalah stacking context tempat menu berada;
   bila backdrop di atasnya, semua klik pada menu jatuh ke backdrop. */
.backdrop { position: fixed; inset: 0; z-index: 55; background: transparent; }

.content { padding: 1.25rem; }
@media (max-width: 560px) {
  .content { padding: 0.8rem; }
}
</style>
