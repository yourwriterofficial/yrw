/**
 * The parts of a store's home page that the owner can drag into a different order (or hide).
 * Saved as one short text in the site's settings (_cfg_layout), for example "hero,contact,shop,~rails".
 * A leading ~ means hidden. Anything missing is added back in the default position, so adding a new
 * part later never breaks a saved layout.
 */
export type SectionKey = 'hero' | 'contact' | 'shop' | 'flash' | 'rails' | 'trust';

export interface SectionDef {
  key: SectionKey;
  label: string;
  hint: string;
  /** Cannot be hidden (the store needs it). It can still be moved. */
  locked?: boolean;
}

export const SECTION_DEFS: SectionDef[] = [
  { key: 'hero', label: 'Top banner', hint: 'Your headline and welcome message' },
  { key: 'contact', label: 'Contact card', hint: 'Call, WhatsApp and directions buttons' },
  { key: 'flash', label: 'Flash sale banner', hint: 'Shows only when you run a sale' },
  { key: 'shop', label: 'Products and search', hint: 'Your items, categories and the cart', locked: true },
  { key: 'rails', label: 'Best sellers and new arrivals', hint: 'Scrolling shelves under your products' },
  { key: 'trust', label: 'Trust badges and questions', hint: 'Delivery promises, FAQ and safety links' },
];

export const DEFAULT_ORDER: SectionKey[] = SECTION_DEFS.map((s) => s.key);
const VALID = new Set<string>(DEFAULT_ORDER);

export function parseLayout(raw: unknown): { order: SectionKey[]; hidden: Set<SectionKey> } {
  const order: SectionKey[] = [];
  const hidden = new Set<SectionKey>();
  if (typeof raw === 'string') {
    for (const tokenRaw of raw.split(',')) {
      const token = tokenRaw.trim();
      const isHidden = token.startsWith('~');
      const key = (isHidden ? token.slice(1) : token) as SectionKey;
      if (!VALID.has(key) || order.includes(key)) continue;
      order.push(key);
      if (isHidden && !SECTION_DEFS.find((d) => d.key === key)?.locked) hidden.add(key);
    }
  }
  for (const key of DEFAULT_ORDER) if (!order.includes(key)) order.push(key);
  return { order, hidden };
}

export function serializeLayout(order: SectionKey[], hidden: Set<SectionKey>): string {
  return order.map((k) => (hidden.has(k) ? `~${k}` : k)).join(',');
}
