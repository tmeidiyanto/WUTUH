/** Util WhatsApp click-to-chat (wa.me). */
export function waPhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

export function waHref(phone: string, text: string): string {
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
}
