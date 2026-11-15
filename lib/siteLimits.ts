import { supabaseAdmin, isMissingRelationError } from '@/lib/forumServer';
import { PLANS, effectiveTier, type PlanTier } from '@/lib/plans';

/**
 * How many sites an account may run: the highest plan among the sites it has paid for.
 * A site only counts as paid if the founder recorded a payment for it, so the free trial
 * cannot be used to open several sites.
 */
export async function maxSitesFor(userId: string): Promise<{ limit: number; tier: PlanTier }> {
  const { data: sites } = await supabaseAdmin
    .from('forums')
    .select('id, plan_tier, plan_expires_at')
    .eq('owner_id', userId);
  let best: PlanTier = 'free';
  const rank: Record<PlanTier, number> = { free: 0, lite: 1, pro: 2, business: 3, corporate: 4 };
  for (const s of sites || []) {
    const tier = effectiveTier(s.plan_tier, s.plan_expires_at);
    if (tier === 'free' || rank[tier] <= rank[best]) continue;
    const { count, error } = await supabaseAdmin
      .from('site_plan_payments')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', s.id)
      .eq('status', 'paid');
    // Until the payments table exists, any running paid plan counts.
    const paid = error ? isMissingRelationError(error) : (count ?? 0) > 0;
    if (paid) best = tier;
  }
  return { limit: PLANS[best].maxSites, tier: best };
}
