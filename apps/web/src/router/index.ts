import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    // Pasar WUTUH — etalase publik, bisa dibuka tanpa login.
    { path: '/pasar', name: 'bazaar', component: () => import('@/views/bazaar/BazaarView.vue') },
    { path: '/pasar/:id', name: 'bazaar-detail', component: () => import('@/views/bazaar/BazaarDetailView.vue') },
    // Halaman lacak publik dari QR laporan traceability — tanpa login.
    { path: '/lacak/:code', name: 'public-trace', component: () => import('@/views/publictrace/PublicTraceView.vue') },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        // WUTUH Farm
        { path: 'farm/lands', name: 'lands', component: () => import('@/views/farm/LandsView.vue') },
        { path: 'farm/cycles', name: 'cycles', component: () => import('@/views/farm/CyclesView.vue') },
        { path: 'farm/cycles/:id/trace', name: 'cycle-trace', component: () => import('@/views/farm/TraceReportView.vue') },
        { path: 'farm/agenda', name: 'agenda', component: () => import('@/views/farm/AgendaView.vue') },
        { path: 'farm/commodities', name: 'commodities', component: () => import('@/views/farm/CommoditiesView.vue') },
        // WUTUH Ranch
        { path: 'ranch/livestock', name: 'livestock', component: () => import('@/views/ranch/LivestockView.vue') },
        { path: 'ranch/records', name: 'ranch-records', component: () => import('@/views/ranch/RanchRecordsView.vue') },
        // WUTUH Garden
        { path: 'garden', name: 'garden', component: () => import('@/views/garden/GardenView.vue') },
        // WUTUH Market
        { path: 'market/prices', name: 'prices', component: () => import('@/views/market/PricesView.vue') },
        { path: 'market/listings', name: 'listings', component: () => import('@/views/market/ListingsView.vue') },
        { path: 'market/orders', name: 'orders', component: () => import('@/views/market/OrdersView.vue') },
        // WUTUH Trade
        { path: 'trade/partners', name: 'partners', component: () => import('@/views/trade/PartnersView.vue') },
        { path: 'trade/deals', name: 'deals', component: () => import('@/views/trade/DealsView.vue') },
        // WUTUH Export
        { path: 'export', name: 'export', component: () => import('@/views/export/ExportView.vue') },
        // WUTUH Supply
        { path: 'supply/stock', name: 'stock', component: () => import('@/views/supply/StockView.vue') },
        { path: 'supply/deliveries', name: 'deliveries', component: () => import('@/views/supply/DeliveriesView.vue') },
        // WUTUH Finance
        { path: 'finance', name: 'finance', component: () => import('@/views/finance/FinanceView.vue') },
        // WUTUH AI
        { path: 'ai/insights', name: 'insights', component: () => import('@/views/ai/InsightsView.vue') },
        // WUTUH IoT
        { path: 'iot', name: 'iot', component: () => import('@/views/iot/IotView.vue') },
        // Pengaturan
        { path: 'admin/users', name: 'users', component: () => import('@/views/admin/UsersView.vue') },
        { path: 'admin/channels', name: 'channels', component: () => import('@/views/admin/ChannelsView.vue') },
        { path: 'admin/payment', name: 'payment', component: () => import('@/views/admin/PaymentSettingsView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated()) return { name: 'login' };
  if (to.name === 'login' && auth.isAuthenticated()) return { name: 'dashboard' };
  return true;
});

export default router;
