import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  roleCode: string | null;
  permissions: string[];
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('accessToken'));
  const user = ref<AuthUser | null>(
    JSON.parse(localStorage.getItem('user') ?? 'null') as AuthUser | null,
  );

  function setSession(data: { accessToken: string; user: AuthUser }) {
    token.value = data.accessToken;
    user.value = data.user;
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    setSession(data);
  }

  async function register(payload: {
    businessName: string;
    businessType: string;
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    province?: string;
    regency?: string;
  }) {
    const { data } = await api.post('/auth/register', payload);
    setSession(data);
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }

  const isAuthenticated = () => !!token.value;

  /** Cek permission granular ('farm.write'): '*' & 'farm.*' juga lolos. */
  function can(perm: string) {
    const g = user.value?.permissions ?? [];
    return g.includes('*') || g.includes(perm) || g.includes(`${perm.split('.')[0]}.*`);
  }

  return { token, user, login, register, logout, isAuthenticated, can };
});
