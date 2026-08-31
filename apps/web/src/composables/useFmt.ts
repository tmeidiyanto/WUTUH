import { intlLocale } from '@/i18n';

/** Format angka/uang/tanggal — mengikuti bahasa UI (id-ID / en-US). */
const cache = new Map<string, Intl.NumberFormat>();
function nf(maxFraction: number) {
  const loc = intlLocale();
  const key = `${loc}:${maxFraction}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(loc, { maximumFractionDigits: maxFraction });
    cache.set(key, f);
  }
  return f;
}

export function useFmt() {
  const fmtQty = (v: unknown) => (v == null || v === '' ? '-' : nf(2).format(Number(v)));
  const fmtMoney = (v: unknown) => (v == null || v === '' ? '-' : `Rp ${nf(0).format(Number(v))}`);
  const fmtMoneyRaw = (v: unknown) => (v == null || v === '' ? '-' : nf(0).format(Number(v)));
  const fmtDate = (v: unknown) => {
    if (!v) return '-';
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtDateTime = (v: unknown) => {
    if (!v) return '-';
    const d = new Date(String(v));
    return Number.isNaN(d.getTime())
      ? '-'
      : d.toLocaleString(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  /** Tanggal hari ini yyyy-mm-dd (untuk default field tanggal). */
  const today = () => new Date().toISOString().slice(0, 10);
  return { fmtQty, fmtMoney, fmtMoneyRaw, fmtDate, fmtDateTime, today };
}
