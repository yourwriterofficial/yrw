/** Nigerian numbers are often typed as 080..., and wa.me needs the country code with digits only. */
export function waNumber(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return '234' + digits.slice(1);
  return digits;
}

export function waLink(raw: string, text: string): string | null {
  const n = waNumber(raw);
  return n.length >= 10 ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}
