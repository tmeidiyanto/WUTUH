import axios from 'axios';
import { tg } from '@/i18n';

export const api = axios.create({ baseURL: '/api' });

// Sisipkan JWT + bahasa UI (untuk teks yang dibuat backend, mis. wawasan AI) di setiap request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = localStorage.getItem('wutuh-locale') === 'en' ? 'en' : 'id';
  return config;
});

// 401 → bersihkan sesi & arahkan ke login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Ambil pesan error API untuk toast (API sudah menerjemahkan sesuai Accept-Language). */
export function apiError(e: unknown): string {
  const err = e as { response?: { data?: { message?: string | string[] } }; request?: unknown };
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (msg) return msg;
  return err?.request && !err?.response ? tg('common.network') : tg('common.error');
}
