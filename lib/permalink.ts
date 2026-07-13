// Username/permalink format shared by profile settings, referral capture, and
// referral link generation. Keep in sync with the `assign_profile_permalink`
// Postgres trigger, which uses the same character set.
export const PERMALINK_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

export function isValidPermalink(value: string): boolean {
  return PERMALINK_REGEX.test(value);
}

export function slugifyPermalink(input: string): string {
  const slug = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug || 'user';
}
