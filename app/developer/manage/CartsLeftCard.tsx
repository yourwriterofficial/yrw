'use client';

import { useEffect, useState } from 'react';
import { formatMoney, type SiteCartLead } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { waLink } from '@/lib/phone';
import type { Site } from './types';

export default function CartsLeftCard({
  site,
  goToPlan,
}: {
  site: Site;
  goToPlan: () => void;
}) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const [carts, setCarts] = useState<SiteCartLead[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!plan.abandonedCarts) return;
    let active = true;
    fetch(`/api/forums/${encodeURIComponent(site.slug)}/carts`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (active) setCarts(Array.isArray(d.carts) ? d.carts : []); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [site.slug, plan.abandonedCarts]);

  if (!plan.abandonedCarts) {
    return (
      <section className="g-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Carts left behind</h3>
            <p className="text-sm text-secondary mt-0.5">Recover unfinished checkouts via WhatsApp and automatic reminders on Pro.</p>
          </div>
          <button type="button" onClick={goToPlan} className="text-xs font-medium px-3.5 h-9 rounded-full border border-theme hover:bg-hover">
            Upgrade to Pro
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="g-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Carts left behind</h3>
        <span className="text-xs text-secondary">{carts.length} open</span>
      </div>
      {!loaded ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : carts.length === 0 ? (
        <p className="text-sm text-secondary">No unfinished carts right now.</p>
      ) : (
        <ul className="divide-y divide-theme">
          {carts.slice(0, 6).map((c) => {
            const first = (c.buyer_name || '').split(' ')[0] || 'there';
            const chat = waLink(
              c.phone,
              `Hi ${first}, thanks for visiting ${site.name}! Ready to finish your order (${formatMoney(c.total, site.currency)})?`
            );
            return (
              <li key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {c.buyer_name || c.email || c.phone || 'Buyer'} · {formatMoney(c.total, site.currency)}
                  </p>
                  <p className="text-xs text-secondary truncate">
                    {[c.email, c.phone].filter(Boolean).join(' · ')} · {(c.items || []).length} {(c.items || []).length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                {chat && (
                  <a
                    href={chat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent hover:underline shrink-0"
                  >
                    Message on WhatsApp
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
