/** The two brands that share the support inbox. Safe to use in the browser. */
export type InboxBrand = 'developa' | 'yourwriter';

export const BRANDS: Record<InboxBrand, { label: string; short: string; shell: 'developa' | 'yourresearchwriter'; url: string; badge: string }> = {
  developa: { label: 'Developa', short: 'Developa', shell: 'developa', url: 'https://developa.me', badge: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  yourwriter: { label: 'YourResearchWriter', short: 'YourWriter', shell: 'yourresearchwriter', url: 'https://yourresearchwriter.com.ng', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
};

/** Which brand an address belongs to, from its domain. */
export function brandOfAddress(address: string): InboxBrand {
  return /@([^@]*\.)?developa\.[a-z.]+$/i.test(address.trim()) ? 'developa' : 'yourwriter';
}
