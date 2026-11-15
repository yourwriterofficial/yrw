import { supabaseAdmin } from '@/lib/forumServer';

/**
 * Extra customer emails a site has bought on top of its plan's monthly allowance. Kept inside the site's
 * settings (forums.plugins) so no database change is needed:
 *   _email_credits : number of bought emails left
 *   _email_refs    : the last payment references already credited, so a payment is never credited twice
 * Changes use a compare-and-set on updated_at, so two things happening at once cannot lose an update.
 * Server only.
 */

const CREDITS_KEY = '_email_credits';
const REFS_KEY = '_email_refs';

interface Row { plugins: Record<string, unknown> | null; updated_at: string | null }

export function creditsOf(plugins: Record<string, unknown> | null | undefined): number {
  const n = Number(plugins?.[CREDITS_KEY]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function readRow(siteId: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin.from('forums').select('plugins, updated_at').eq('id', siteId).maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

/** Applies a change to the settings, retrying if someone else saved in between. Returns the new settings or null. */
async function mutate(siteId: string, change: (current: Record<string, unknown>) => Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await readRow(siteId);
    if (!row) return null;
    const next = change({ ...(row.plugins || {}) });
    if (!next) return row.plugins || {}; // nothing to change
    const stamp = new Date().toISOString();
    let q = supabaseAdmin.from('forums').update({ plugins: next, updated_at: stamp }).eq('id', siteId);
    q = row.updated_at ? q.eq('updated_at', row.updated_at) : q.is('updated_at', null);
    const { data, error } = await q.select('id').maybeSingle();
    if (!error && data) return next;
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
  return null;
}

/** Adds bought emails once per payment reference. Returns true if this call added them. */
export async function addEmailCredits(siteId: string, reference: string, emails: number): Promise<boolean> {
  let added = false;
  const result = await mutate(siteId, (cur) => {
    const refs = Array.isArray(cur[REFS_KEY]) ? (cur[REFS_KEY] as string[]) : [];
    if (refs.includes(reference)) return null;
    added = true;
    return { ...cur, [CREDITS_KEY]: creditsOf(cur) + emails, [REFS_KEY]: [...refs, reference].slice(-60) };
  });
  return result !== null && added;
}

/** Uses up to n bought emails. Never goes below zero. */
export async function spendEmailCredits(siteId: string, n: number): Promise<void> {
  if (n <= 0) return;
  await mutate(siteId, (cur) => ({ ...cur, [CREDITS_KEY]: Math.max(0, creditsOf(cur) - n) }));
}
