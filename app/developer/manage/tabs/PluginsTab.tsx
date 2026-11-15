'use client';

import { useEffect, useState } from 'react';
import { PLANS, effectiveTier } from '@/lib/plans';
import { PLUGINS, PLUGIN_GROUPS, planIncludes } from '@/lib/plugins';
import { jsonFetch, type Site } from '../types';

const STORE_ONLY = ['coupons', 'variants', 'shipping', 'bookings', 'carts', 'receipts', 'reviews', 'lowstock', 'chat'];
const TIER_LABEL = { free: 'Free', pro: 'Pro', business: 'Business' } as const;

export default function PluginsTab({ site, go }: { site: Site; go: (tab: string) => void }) {
  const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const isOwner = !site.my_role || site.my_role === 'owner';

  useEffect(() => {
    jsonFetch<{ plugins?: Record<string, unknown> }>(`/api/forums/${site.slug}/plugins`).then((r) => { if (r.ok) setSettings(r.data.plugins || {}); });
  }, [site.slug]);

  const toggle = async (id: string, enabled: boolean) => {
    setMsg(null);
    const r = await jsonFetch<{ plugins?: Record<string, unknown> }>(`/api/forums/${site.slug}/plugins`, { method: 'PUT', body: { id, enabled } });
    if (r.ok) setSettings(r.data.plugins || {});
    else setMsg({ ok: false, text: r.data.error || 'Could not save.' });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-secondary max-w-2xl">Plugins are the extra tools for your site. Everything on your {PLANS[tier].name} plan is ready to use. Locked ones show which plan unlocks them.</p>
        {msg && <p role="alert" className="text-sm text-danger mt-3">{msg.text}</p>}
      </div>

      {PLUGIN_GROUPS.map((g) => {
        const items = PLUGINS.filter((p) => p.group === g.key && (site.site_mode !== 'forum' || !STORE_ONLY.includes(p.id)));
        if (items.length === 0) return null;
        return (
          <section key={g.key}>
            <h3 className="font-medium mb-3">{g.label}</h3>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((p) => {
                const included = planIncludes(p, tier);
                const on = included && (!p.toggle || (p.defaultOn === false ? settings[p.id] === true : settings[p.id] !== false));
                return (
                  <div key={p.id} className={`g-card p-5 flex flex-col ${included ? '' : 'opacity-80'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-medium leading-snug">{p.name}</h4>
                      <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${included ? 'g-tonal-strong text-accent' : 'bg-secondary text-secondary'}`}>
                        {included ? 'Included' : `${TIER_LABEL[p.minTier]} plan`}
                      </span>
                    </div>
                    <p className="text-sm text-secondary mt-2 flex-1">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {!included ? (
                        <button onClick={() => go('plan')} className="text-sm font-medium text-accent hover:underline">See plans</button>
                      ) : p.toggle ? (
                        <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer select-none">
                          <input type="checkbox" role="switch" checked={on} disabled={!isOwner} onChange={(e) => toggle(p.id, e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
                          {on ? 'On' : 'Off'}
                        </label>
                      ) : (
                        <span className="text-sm text-secondary">Always on</span>
                      )}
                      {included && p.tab && <button onClick={() => go(p.tab!)} className="text-sm font-medium text-accent hover:underline">Open</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
