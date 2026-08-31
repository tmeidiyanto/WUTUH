/** Visual produk tanpa foto: emoji per komoditas + gradasi warna per kategori. */
const BY_KEYWORD: Array<[RegExp, string]> = [
  [/PADI|GABAH/i, '🌾'],
  [/BERAS/i, '🍚'],
  [/JAGUNG/i, '🌽'],
  [/CABAI|CABE|RAWIT/i, '🌶️'],
  [/BAWANG/i, '🧅'],
  [/KOPI/i, '☕'],
  [/KAKAO|COKELAT|COKLAT/i, '🍫'],
  [/TEH/i, '🍵'],
  [/KELAPA/i, '🥥'],
  [/SAWIT/i, '🌴'],
  [/PISANG/i, '🍌'],
  [/TOMAT/i, '🍅'],
  [/SAPI/i, '🐄'],
  [/KAMBING|DOMBA/i, '🐐'],
  [/AYAM/i, '🐔'],
  [/TELUR/i, '🥚'],
  [/SUSU/i, '🥛'],
  [/IKAN|LELE|NILA|GURAME|UDANG|BANDENG/i, '🐟'],
  [/MADU/i, '🍯'],
];

const BY_CATEGORY: Record<string, string> = {
  pangan: '🌾',
  hortikultura: '🥬',
  perkebunan: '🌱',
  ternak: '🐄',
  perikanan: '🐟',
  olahan: '🧺',
};

export function produceEmoji(code?: string | null, name?: string | null, category?: string | null): string {
  const hay = `${code ?? ''} ${name ?? ''}`;
  for (const [re, emo] of BY_KEYWORD) if (re.test(hay)) return emo;
  return BY_CATEGORY[category ?? ''] ?? '🌿';
}

/** Gradasi latar tile per kategori (aman di tema terang & gelap). */
export function produceTint(category?: string | null): string {
  const map: Record<string, [string, string]> = {
    pangan: ['#f59e0b', '#84cc16'],
    hortikultura: ['#22c55e', '#ef4444'],
    perkebunan: ['#166534', '#a16207'],
    ternak: ['#0ea5e9', '#84cc16'],
    perikanan: ['#0891b2', '#2563eb'],
    olahan: ['#a855f7', '#f59e0b'],
  };
  const [a, b] = map[category ?? ''] ?? ['#16a34a', '#0369a1'];
  return `linear-gradient(135deg, color-mix(in srgb, ${a} 26%, transparent), color-mix(in srgb, ${b} 26%, transparent))`;
}
