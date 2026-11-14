import { supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier, PRUNE_AFTER_MONTHS, PRUNE_WARN_DAYS } from '@/lib/plans';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

/**
 * Removes sites that were built and then abandoned.
 *
 * A site is abandoned when it is on the free plan, its owner has not signed in for PRUNE_AFTER_MONTHS and
 * it has taken no orders in that time. The owner gets two emails first (30 days and 7 days before), and
 * a site is only deleted after the final warning has been out for at least 3 days. Signing in at any time
 * cancels the countdown. Sites on a paid plan are never removed.
 */

const DAY = 86_400_000;
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PruneStats { warned30: number; warned7: number; deleted: number; skipped: number }

export async function runPrune(now = new Date()): Promise<PruneStats> {
  const stats: PruneStats = { warned30: 0, warned7: 0, deleted: 0, skipped: 0 };
  const pruneMs = PRUNE_AFTER_MONTHS * 30 * DAY;
  const oldestRelevant = new Date(now.getTime() - (pruneMs - PRUNE_WARN_DAYS[0] * DAY)).toISOString();

  // Only sites old enough to be in the warning window are looked at.
  const { data: sites, error } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, owner_id, plan_tier, plan_expires_at, created_at, prune_warned_at, prune_final_warned_at')
    .lt('created_at', oldestRelevant)
    .order('created_at', { ascending: true })
    .limit(200);
  // The columns arrive with the latest database update. Until then nothing is touched.
  if (error || !sites) return stats;

  for (const site of sites) {
    try {
      if (effectiveTier(site.plan_tier, site.plan_expires_at) !== 'free') { stats.skipped++; continue; }

      const { data: ownerRes } = await supabaseAdmin.auth.admin.getUserById(site.owner_id);
      const owner = ownerRes?.user;
      if (!owner) { stats.skipped++; continue; }

      let lastActive = Math.max(
        Date.parse(owner.last_sign_in_at || '') || 0,
        Date.parse(site.created_at) || 0
      );
      // Orders count as activity: a shop that is selling is not abandoned.
      const { data: recentOrder } = await supabaseAdmin
        .from('site_orders')
        .select('created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentOrder?.created_at) lastActive = Math.max(lastActive, Date.parse(recentOrder.created_at) || 0);

      const idleMs = now.getTime() - lastActive;
      const daysToDelete = Math.ceil((pruneMs - idleMs) / DAY);

      // Came back: cancel the countdown.
      if (daysToDelete > PRUNE_WARN_DAYS[0]) {
        if (site.prune_warned_at || site.prune_final_warned_at) {
          await supabaseAdmin.from('forums').update({ prune_warned_at: null, prune_final_warned_at: null }).eq('id', site.id);
        }
        stats.skipped++;
        continue;
      }

      const manage = `${siteUrl()}/developer/manage?site=${encodeURIComponent(site.slug)}`;
      const when = new Date(lastActive + pruneMs).toLocaleDateString('en-GB');

      if (daysToDelete <= 0) {
        const finalAt = site.prune_final_warned_at ? Date.parse(site.prune_final_warned_at) : 0;
        if (finalAt && now.getTime() - finalAt >= 3 * DAY) {
          const { error: delErr } = await supabaseAdmin.from('forums').delete().eq('id', site.id);
          if (!delErr) stats.deleted++;
        } else {
          stats.skipped++;
        }
        continue;
      }

      const stage: 'final' | 'first' | null =
        daysToDelete <= PRUNE_WARN_DAYS[1] && !site.prune_final_warned_at ? 'final'
        : !site.prune_warned_at && !site.prune_final_warned_at ? 'first'
        : null;
      if (!stage || !owner.email) { stats.skipped++; continue; }

      const ok = await sendSystemEmail({
        to: owner.email,
        subject: stage === 'final'
          ? `Last chance: ${site.name} will be deleted in ${daysToDelete} ${daysToDelete === 1 ? 'day' : 'days'}`
          : `${site.name} has been inactive and will be removed on ${when}`,
        html: emailShell(
          `<h2>Your site will be deleted</h2><p><strong>${esc(site.name)}</strong> (${esc(site.slug)}.developa.me) is on the free plan and has had no sign-ins or orders for almost ${PRUNE_AFTER_MONTHS} months.</p><p>Free sites that are not used are removed to keep the platform fast. Yours will be deleted on <strong>${esc(when)}</strong>.</p><p>To keep it, just sign in. That is all it takes. Upgrading to a paid plan also keeps it safe.</p>`,
          'Keep my site',
          manage,
          'developa'
        ),
      }).catch(() => false);
      if (ok) {
        await supabaseAdmin.from('forums').update(stage === 'final'
          ? { prune_final_warned_at: now.toISOString(), prune_warned_at: site.prune_warned_at || now.toISOString() }
          : { prune_warned_at: now.toISOString() }).eq('id', site.id);
        if (stage === 'final') stats.warned7++; else stats.warned30++;
      }
    } catch {
      stats.skipped++;
    }
  }
  return stats;
}
