import { createI18n } from 'vue-i18n';
import id from './id';
import en from './en';

export const LOCALES = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

const saved = localStorage.getItem('wutuh-locale');
const initial: LocaleCode = saved === 'en' ? 'en' : 'id';

/** Bahasa Indonesia = default (platform untuk produsen Indonesia). */
export const i18n = createI18n({
  legacy: false,
  locale: initial,
  fallbackLocale: 'id',
  messages: { id, en },
});

document.documentElement.setAttribute('lang', initial);

export function setLocale(code: string) {
  if (code !== 'id' && code !== 'en') return;
  i18n.global.locale.value = code;
  localStorage.setItem('wutuh-locale', code);
  document.documentElement.setAttribute('lang', code);
}

/** Locale Intl untuk format angka/tanggal — mengikuti bahasa UI. */
export function intlLocale(): string {
  return i18n.global.locale.value === 'en' ? 'en-US' : 'id-ID';
}

/** Terjemahan di luar komponen (helper lib/composable). */
export const tg = (key: string, params?: Record<string, unknown>) =>
  params ? i18n.global.t(key, params) : i18n.global.t(key);
