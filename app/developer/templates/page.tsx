'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Store, MessageSquare, ArrowRight, Eye, Gem, Check } from 'lucide-react';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import { PICKABLE_TEMPLATES, PICKABLE_GROUPS, type SiteTemplate } from '@/lib/siteTemplates';
import { archetypeOf } from '@/lib/demoContent';
import Thumb from '@/app/developer/TemplateThumb';
import { PREMIUM_PERKS, TIER_LABEL, tierForPrice } from '@/lib/premium';

type Kind = 'all' | 'store' | 'community';
type Cost = 'any' | 'free' | 'premium';
const KINDS: { key: Kind; label: string }[] = [{ key: 'all', label: 'All themes' }, { key: 'store', label: 'Online stores' }, { key: 'community', label: 'Communities & media' }];

export default function TemplatesGalleryPage() {
  const [kind, setKind] = useState<Kind>('all');
  const [group, setGroup] = useState<string>('all');
  const [q, setQ] = useState('');
  const [cost, setCost] = useState<Cost>('any');
  useEffect(() => { if (new URLSearchParams(window.location.search).get('premium') === '1') setCost('premium'); }, []);
  const [prices, setPrices] = useState<Record<string, { price: number; owned: boolean }>>({});

  useEffect(() => {
    let active = true;
    fetch('/api/themes').then((r) => r.json()).then((j) => {
      if (!active) return;
      const m: Record<string, { price: number; owned: boolean }> = {};
      for (const t of j.themes || []) m[t.id] = { price: t.price_ngn, owned: !!t.owned };
      setPrices(m);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const groupKey = (t: SiteTemplate) => t.group ?? 'core';
  const filtered = PICKABLE_TEMPLATES.filter((t) => {
    if (kind === 'store' && t.site_mode === 'forum') return false;
    if (kind === 'community' && t.site_mode === 'store') return false;
    if (group !== 'all' && groupKey(t) !== group) return false;
    const price = prices[t.id]?.price ?? t.price_ngn ?? 0;
    if (cost === 'free' && price > 0) return false;
    if (cost === 'premium' && price <= 0) return false;
    const s = q.trim().toLowerCase();
    return !s || `${t.label} ${t.tagline} ${archetypeOf(t)}`.toLowerCase().includes(s);
  });
  const chips = [{ key: 'all', label: 'Every style' }, { key: 'core', label: 'Popular' }, ...PICKABLE_GROUPS];

  return (
    <div className="g-font min-h-screen bg-primary text-primary">
      <DevelopaHeader />
      <main>
        <section className="g-wrap pt-10 sm:pt-16 pb-6 text-center">
          <p className="inline-flex px-3.5 py-1.5 rounded-full g-tonal-strong text-xs sm:text-sm font-medium text-accent mb-5">{PICKABLE_TEMPLATES.length} themes · every one fully working</p>
          <h1 className="g-h1 max-w-3xl mx-auto">Find a theme that fits your business</h1>
          <p className="g-lead max-w-xl mx-auto mt-4">Open any theme to try it like a real site: browse, search, fill a cart and read the discussions. Then make it yours in minutes.</p>
        </section>

        <section className="g-wrap pb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex rounded-full g-tonal-strong p-1 w-fit max-w-full overflow-x-auto">
              {KINDS.map((k) => (
                <button key={k.key} onClick={() => setKind(k.key)} aria-pressed={kind === k.key} className={`px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap ${kind === k.key ? 'bg-card shadow-sm' : 'text-secondary'}`}>{k.label}</button>
              ))}
            </div>
            <div className="flex rounded-full g-tonal-strong p-1 w-fit">
              {([['any', 'Any price'], ['free', 'Free'], ['premium', 'Premium']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setCost(k)} aria-pressed={cost === k} className={`px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap ${cost === k ? 'bg-card shadow-sm' : 'text-secondary'}`}>{l}</button>
              ))}
            </div>
            <label className="relative md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: restaurant, photography, news…" className="w-full h-11 pl-10 pr-4 rounded-full g-tonal-strong text-sm outline-none" />
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => (
              <button key={c.key} onClick={() => setGroup(c.key)} className={`px-3.5 h-8 rounded-full text-sm whitespace-nowrap border ${group === c.key ? 'border-transparent bg-accent text-[var(--accent-foreground)] font-medium' : 'border-theme text-secondary hover:text-primary'}`}>{c.label}</button>
            ))}
          </div>
        </section>

        <section className="g-wrap pb-6">
          <div className="rounded-3xl g-tonal p-5 sm:p-7">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Gem className="w-5 h-5 text-accent" /> Why go premium?</h2>
            <p className="text-sm text-secondary mt-1">One small payment, yours to keep. Premium themes turn on extra features for every visitor, with nothing to set up.</p>
            <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5">
              {PREMIUM_PERKS.slice(0, 8).map((p) => <li key={p.id} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>{p.label}</span></li>)}
            </ul>
          </div>
        </section>

        <section className="g-wrap pb-16">
          <p className="text-sm text-secondary mb-4">{filtered.length} {filtered.length === 1 ? 'theme' : 'themes'}</p>
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-secondary">
              <p className="g-h3 text-primary">No theme matches that.</p>
              <button onClick={() => { setQ(''); setKind('all'); setGroup('all'); }} className="mt-3 text-accent hover:underline">Clear filters</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((t) => {
                const p = prices[t.id] ?? { price: t.price_ngn ?? 0, owned: false };
                return (
                  <article key={t.id} className="g-card overflow-hidden group flex flex-col hover:shadow-lg transition-shadow">
                    <Link href={`/developer/preview/${t.id}`} className="block relative" aria-label={`Preview ${t.label}`}>
                      <Thumb t={t} />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition bg-white text-black text-sm font-medium rounded-full px-5 h-10 inline-flex items-center gap-2"><Eye className="w-4 h-4" /> Live preview</span>
                      </span>
                    </Link>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-semibold leading-snug">{t.label}</h2>
                        <span className="shrink-0 text-xs px-2.5 py-1 rounded-full g-tonal-strong font-medium">{p.owned && p.price > 0 ? 'Owned' : p.price > 0 ? `₦${p.price.toLocaleString('en-NG')}` : 'Free'}</span>
                      </div>
                      <p className="text-sm text-secondary mt-1.5 line-clamp-2">{t.tagline}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-secondary">
                        {t.site_mode !== 'forum' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-theme"><Store className="w-3 h-3" /> Store</span>}
                        {t.site_mode !== 'store' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-theme"><MessageSquare className="w-3 h-3" /> Community</span>}
                        {p.price > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-medium" style={{ background: t.accent_color }}><Gem className="w-3 h-3" /> {TIER_LABEL[tierForPrice(p.price)]}</span>}
                        <span className="px-2 py-0.5 rounded-full border border-theme">Mobile ready</span>
                      </div>
                      <div className="mt-4 pt-4 flex gap-2 mt-auto">
                        <Link href={`/developer/preview/${t.id}`} className="flex-1 h-10 rounded-full g-tonal-strong text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:brightness-95">Preview</Link>
                        <Link href={`/developer?template=${t.id}#start`} className="flex-1 h-10 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium inline-flex items-center justify-center gap-1.5">{p.price > 0 && !p.owned ? 'Get theme' : 'Use theme'} <ArrowRight className="w-4 h-4" /></Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <DevelopaFooter />
    </div>
  );
}
