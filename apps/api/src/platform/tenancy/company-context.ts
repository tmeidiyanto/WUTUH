import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  companyId: string;
  userId?: string;
  roleId?: string | null;
  permissions: string[];
}

/** Konteks per-request disebar lewat AsyncLocalStorage (tanpa "prop drilling"). */
export const companyStorage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext {
  const ctx = companyStorage.getStore();
  if (!ctx) {
    throw new Error('Tidak ada konteks company — request di luar CompanyContextInterceptor?');
  }
  return ctx;
}

export function getContextOrNull(): RequestContext | undefined {
  return companyStorage.getStore();
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return companyStorage.run(ctx, fn);
}
