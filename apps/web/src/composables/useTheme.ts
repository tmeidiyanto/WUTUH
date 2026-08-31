import { ref } from 'vue';
import { updatePrimaryPalette } from '@primevue/themes';

/** Tema aksen (palette). 'hijau' = default WUTUH. */
export const THEMES = [
  { key: 'hijau', label: 'Hijau', color: '#15803d' },
  { key: 'biru', label: 'Biru', color: '#1d4ed8' },
  { key: 'teal', label: 'Teal', color: '#0f766e' },
  { key: 'sawah', label: 'Sawah', color: '#4d7c0f' },
  { key: 'laut', label: 'Laut', color: '#0e7490' },
] as const;

// Palet (skala Tailwind) — dipakai updatePrimaryPalette untuk komponen PrimeVue.
const PALETTES: Record<string, Record<string, string>> = {
  hijau: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' },
  biru: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
  teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
  sawah: { 50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635', 500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05' },
  laut: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344' },
};

const MODE_KEY = 'wutuh-mode';
const THEME_KEY = 'wutuh-theme';
const DENSITY_KEY = 'wutuh-density';
const isDark = ref(false);
const theme = ref<string>('hijau');
const density = ref<'comfortable' | 'compact'>('comfortable');

function applyMode(dark: boolean) {
  isDark.value = dark;
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(MODE_KEY, dark ? 'dark' : 'light');
}

/** Kepadatan tampilan (comfortable/compact) — memperkecil spacing & font saat compact. */
function applyDensity(d: string) {
  density.value = d === 'compact' ? 'compact' : 'comfortable';
  document.documentElement.classList.toggle('density-compact', density.value === 'compact');
  localStorage.setItem(DENSITY_KEY, density.value);
}

/** Set data-theme (untuk --app-primary di CSS) + palette PrimeVue. */
function applyPalette() {
  const name = PALETTES[theme.value] ? theme.value : 'hijau';
  document.documentElement.setAttribute('data-theme', name);
  updatePrimaryPalette(PALETTES[name]);
}

function setTheme(name: string) {
  theme.value = PALETTES[name] ? name : 'hijau';
  localStorage.setItem(THEME_KEY, theme.value);
  applyPalette();
}

/**
 * Panggil SETELAH app.use(PrimeVue) (updatePrimaryPalette butuh tema terpasang).
 * Membaca preferensi tersimpan / sistem.
 */
export function initTheme() {
  const savedMode = localStorage.getItem(MODE_KEY);
  const dark = savedMode ? savedMode === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyMode(!!dark);
  theme.value = localStorage.getItem(THEME_KEY) || 'hijau';
  applyPalette();
  applyDensity(localStorage.getItem(DENSITY_KEY) || 'comfortable');
}

export function useTheme() {
  return {
    isDark,
    toggle: () => applyMode(!isDark.value),
    theme,
    themes: THEMES,
    setTheme,
    density,
    setDensity: applyDensity,
  };
}
