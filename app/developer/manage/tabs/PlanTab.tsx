'use client';

import { PLANS, daysLeft, effectiveTier, type PlanTier } from '@/lib/plans';
import { waLink } from '@/lib/phone';
import { FOUNDER_WA, type Site } from '../types';

const naira = (n: number) => '₦' + n.toLocaleString('en-NG');

export default function PlanTab({ site }: { site: Site }) {
  const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
  const left = daysLeft(site.plan_expires_at);
  const lapsed = site.plan_tier !== 'free' && tier === 'free';

  const upgrade = (to: PlanTier) =>
    waLink(FOUNDER_WA, `Hello, I want to upgrade my developa site "${site.name}" (${site.slug}.developa.me) to the ${PLANS[to].name} plan (${naira(PLANS[to].priceNgn)} per month).`);

  return (
    <div className="space-y-6">
      <div className="g-card p-5">
        <p className="text-sm text-secondary">Your plan</p>
        <p className="text-2xl font-medium mt-1">{PLANS[tier].name}</p>
        {tier !== 'free' && left !== null && (
          <p className="text-sm text-secondary mt-1">
            {left > 0 ? `Renews or ends in ${left} ${left === 1 ? 'day' : 'days'} (${new Date(site.plan_expires_at!).toLocaleDateString('en-GB')})` : 'Ends today'}
            {left !== null && left <= 7 && left > 0 && <span className="text-warning"> · message us to renew</span>}
          </p>
        )}
        {lapsed && <p className="text-sm text-warning mt-1">Your {PLANS[site.plan_tier].name} plan has ended, so the site is back on Starter. Renew to bring your domain and Pro features back.</p>}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {(['free', 'pro', 'business'] as PlanTier[]).map((t) => {
          const p = PLANS[t];
          const current = t === tier;
          const link = t === 'free' ? null : upgrade(t);
          return (
            <div key={t} className={`g-card p-5 flex flex-col ${current ? 'ring-2 ring-[var(--accent)]' : ''}`}>
              <p className="font-medium">{p.name} {current && <span className="text-xs text-accent font-medium ml-1">Current</span>}</p>
              <p className="text-2xl font-medium mt-2">{p.priceNgn === 0 ? 'Free' : naira(p.priceNgn)}{p.priceNgn > 0 && <span className="text-sm text-secondary font-normal"> / month</span>}</p>
              <ul className="mt-4 space-y-2 text-sm text-secondary flex-1">
                {p.highlights.map((h) => <li key={h}>· {h}</li>)}
              </ul>
              {link && !current && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="mt-5 text-center bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-5 h-11 leading-[2.75rem] rounded-full">
                  {tier === 'free' ? 'Upgrade on WhatsApp' : t === 'pro' && tier === 'business' ? 'Switch on WhatsApp' : 'Upgrade on WhatsApp'}
                </a>
              )}
              {link && current && tier !== 'free' && (
                <a href={upgrade(t) || '#'} target="_blank" rel="noopener noreferrer" className="mt-5 text-center border border-theme font-medium text-sm px-5 h-11 leading-[2.75rem] rounded-full">Renew on WhatsApp</a>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-secondary">Upgrades are confirmed by us after your payment, usually within a few hours. Your plan switches on as soon as we record it.</p>
    </div>
  );
}
