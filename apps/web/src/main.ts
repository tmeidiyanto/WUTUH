import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';
import './styles/theme.css';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import { initTheme } from './composables/useTheme';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(VueQueryPlugin);
app.use(PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.dark' } } });
app.use(ToastService);
app.directive('tooltip', Tooltip);

initTheme(); // setelah PrimeVue terpasang (updatePrimaryPalette butuh tema)

app.mount('#app');
