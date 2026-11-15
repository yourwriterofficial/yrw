/** Wording for the admin's restriction switches. Safe to use in the browser (no server code). */
export interface Restrictions {
  no_online_payments?: boolean;
  no_newsletters?: boolean;
  no_custom_domain?: boolean;
  no_new_products?: boolean;
  hide_from_directory?: boolean;
  product_cap?: number | null;
}

export const RESTRICTION_LABELS: { key: keyof Omit<Restrictions, 'product_cap'>; label: string; hint: string }[] = [
  { key: 'no_online_payments', label: 'No online payments', hint: 'Buyers cannot pay by card or transfer through the site' },
  { key: 'no_newsletters', label: 'No customer emails', hint: 'The owner cannot send newsletters' },
  { key: 'no_custom_domain', label: 'No custom domain', hint: 'Blocks connecting or using their own domain' },
  { key: 'no_new_products', label: 'No new products', hint: 'Existing items stay, but nothing can be added' },
  { key: 'hide_from_directory', label: 'Hide from the public list', hint: 'Not shown on the developa.me stores page' },
];
