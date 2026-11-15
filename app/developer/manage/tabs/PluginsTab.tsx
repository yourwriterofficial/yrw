'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Lock, Search,ShoppingBag, Megaphone, MessageCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { PLANS, effectiveTier, type PlanTier } from '@/lib/plans';
import { PLUGINS, PLUGIN_GROUPS, planIncludes, type PluginGroup } from '@/lib/plugins';
import { jsonFetch, type Site } from '../types';

const STORE_ONLY = ['coupons', 'variants', 'shipping', 'bookings', 'carts', 'receipts', 'reviews', 'lowstock', 'chat'];
const GROUP_ICON: Record<PluginGroup, typeof ShoppingBag> = { sell: ShoppingBag, grow: Megaphone, talk: MessageCircle, protect: ShieldCheck };
type Filter = 'all' | 'active' | 'available' | 'locked';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Installed' },
  { key: 'available', label: 'Not installed' },
  { key: 'locked', label: 'Needs a bigger plan' },
];

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export default function PluginsTab({ site, go }: { site: Site; go: (tab: string) => void }) {
  const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<PluginGroup | 'all'>('all');
  const isOwner = !site.my_role || site.my_role === 'owner';

  useEffect(() => {
    jsonFetch<{ plugins?: Record<string, unknown> }>(`/api/forums/${site.slug}/plugins`).then((r) => { if (r.ok) setSettings(r.data.plugins || {}); });
  }, [site.slug]);

  const toggle = async (id: string, enabled: boolean) => {
    setMsg(null);
    setBusy(id);
    const r = await jsonFetch<{ plugins?: Record<string, unknown> }>(`/api/forums/${site.slug}/plugins`, { method: 'PUT', body: { id, enabled } });
    if (r.ok) setSettings(r.data.plugins || {});
    else setMsg(r.data.error || 'Could not save.');
    setBusy(null);
  };

  const visible = useMemo(() => PLUGINS.filter((p) => site.site_mode !== 'forum' || !STORE_ONLY.includes(p.id)), [site.site_mode]);

  const state = (p: (typeof PLUGINS)[number]) => {
    const included = planIncludes(p, tier);
    const on = included && (!p.toggle || (p.defaultOn === false ? settings[p.id] === true : settings[p.id] !== false));
    return { included, on };
  };

  const counts = useMemo(() => {
    let active = 0, available = 0, locked = 0;
    for (const p of visible) {
      const s = state(p);
      if (!s.included) locked++;
      else if (s.on) active++;
      else available++;
    }
    return { active, available, locked };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, settings, tier]);

  const q = query.trim().toLowerCase();
  const matches = (p: (typeof PLUGINS)[number]) => {
    const s = state(p);
    if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q)) return false;
    if (filter === 'active') return s.on;
    if (filter === 'available') return s.included && !s.on;
    if (filter === 'locked') return !s.included;
    return true;
  };

  const sections = PLUGIN_GROUPS
    .filter((g) => group === 'all' || group === g.key)
    .map((g) => ({ ...g, items: visible.filter((p) => p.group === g.key && matches(p)) }))
    .filter((g) => g.items.length > 0);

  const chip = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-sm border transition cursor-pointer ${active ? 'bg-[var(--accent)] text-white border-transparent' : 'border-theme text-secondary hover:text-primary hover:bg-secondary'}`;

  return (
    <div className="space-y-6">
      <div className="g-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h3 className="text-lg font-medium">Plugins</h3>
            <p className="text-sm text-secondary mt-1">Add extra tools to your shop with one tap. You are on the <strong className="text-primary">{PLANS[tier].name}</strong> plan, so anything marked Available can be installed right now. You can remove it any time.</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center min-w-[17rem]">
            <div className="rounded-xl g-tonal-strong px-3 py-2"><dt className="text-[11px] text-secondary">Installed</dt><dd className="text-xl font-semibold text-accent">{counts.active}</dd></div>
            <div className="rounded-xl bg-secondary px-3 py-2"><dt className="text-[11px] text-secondary">Available</dt><dd className="text-xl font-semibold">{counts.available}</dd></div>
            <div className="rounded-xl bg-secondary px-3 py-2"><dt className="text-[11px] text-secondary">Locked</dt><dd className="text-xl font-semibold">{counts.locked}</dd></div>
          </dl>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[12rem] max-w-md">
            <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins"
              aria-label="Search plugins"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-primary border border-theme text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={chip(filter === f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button type="button" onClick={() => setGroup('all')} aria-pressed={group === 'all'} className={chip(group === 'all')}>Every category</button>
          {PLUGIN_GROUPS.map((g) => (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)} aria-pressed={group === g.key} className={chip(group === g.key)}>{g.label}</button>
          ))}
        </div>
        {msg && <p role="alert" className="text-sm text-danger mt-3">{msg}</p>}
      </div>

      {sections.length === 0 && (
        <div className="g-card p-10 text-center text-sm text-secondary">No plugins match. Try a different word or clear the filters.</div>
      )}

      {sections.map((g) => {
        const Icon = GROUP_ICON[g.key];
        return (
          <section key={g.key} aria-labelledby={`plg-${g.key}`}>
            <h3 id={`plg-${g.key}`} className="flex items-center gap-2 font-medium mb-3">
              <Icon className="w-4 h-4 text-accent" aria-hidden /> {g.label}
              <span className="text-xs font-normal text-secondary">{g.items.length}</span>
            </h3>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {g.items.map((p) => {
                const { included, on } = state(p);
                const need = PLANS[p.minTier as PlanTier];
                return (
                  <div key={p.id} data-plugin={p.id} data-state={!included ? 'locked' : on ? 'on' : 'off'} className={`g-card p-5 flex flex-col transition ${on ? 'ring-1 ring-[var(--accent)]' : ''} ${included ? '' : 'bg-secondary/40'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-medium leading-snug">{p.name}</h4>
                      {included ? (
                        <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${on ? 'g-tonal-strong text-accent' : 'bg-secondary text-secondary'}`}>{on ? 'Installed' : 'Available'}</span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary"><Lock className="w-3 h-3" aria-hidden /> {need.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-secondary mt-2 flex-1">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {!included ? (
                        <button type="button" onClick={() => go('plan')} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline cursor-pointer">
                          Unlock with {need.name} · {naira(need.priceNgn)}/mo <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      ) : p.toggle ? (
                        on ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"><Check className="w-4 h-4" aria-hidden /> Installed</span>
                            {isOwner && (
                              <button type="button" disabled={busy === p.id} onClick={() => toggle(p.id, false)} aria-label={`Remove ${p.name}`} className="text-sm text-secondary hover:text-danger hover:underline disabled:opacity-50 cursor-pointer">
                                {busy === p.id ? 'Removing…' : 'Remove'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button type="button" disabled={!isOwner || busy === p.id} onClick={() => toggle(p.id, true)} aria-label={`Install ${p.name}`} className="inline-flex items-center justify-center gap-1.5 min-h-10 px-5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition cursor-pointer">
                            <Plus className="w-4 h-4" aria-hidden /> {busy === p.id ? 'Installing…' : 'Install'}
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-secondary"><Check className="w-4 h-4" aria-hidden /> Included with your plan</span>
                      )}
                      {included && p.tab && <button type="button" onClick={() => go(p.tab!)} className="text-sm font-medium text-accent hover:underline cursor-pointer">Open</button>}
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
