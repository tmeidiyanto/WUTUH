/** Bahasa untuk teks yang dibuat backend (wawasan AI). Default Indonesia. */
export type Lang = 'id' | 'en';

/** Baca header Accept-Language → 'en' bila diawali "en", selain itu 'id'. */
export function langFromHeader(header?: string): Lang {
  return (header ?? '').trim().toLowerCase().startsWith('en') ? 'en' : 'id';
}

export const intlOf = (lang: Lang) => (lang === 'en' ? 'en-US' : 'id-ID');
