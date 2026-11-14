'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import { SITE_TEMPLATES, getTemplateById } from '@/lib/siteTemplates';
import type { ForumSummary, ForumThread, SiteProduct } from '@/lib/forums';
import { StoreProductCard, StorefrontHeroAndTrust } from '@/app/components/forums/StorefrontThemes';
import ThreadListThemes, { FORUM_LAYOUTS } from '@/app/components/forums/ThreadListThemes';

/**
 * Try a theme before choosing it. Shows the real store or forum layout with the theme's own sample
 * content, on a desktop or phone-sized frame. Nothing here is saved.
 */
export default function ThemePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tpl = SITE_TEMPLATES.find((t) => t.id === id);
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [price, setPrice] = useState<{ price: number; owned: boolean } | null>(null);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    let active = true;
    fetch('/api/themes').then((r) => r.json()).then((j) => {
      const t = (j.themes || []).find((x: { id: string }) => x.id === id);
      if (active && t) setPrice({ price: t.price_ngn, owned: !!t.owned });
    }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  const site = useMemo(() => tpl ? ({
    id: 'preview', slug: 'preview', name: 'Your brand', description: tpl.tagline, owner_id: '', is_public: true,
    accent_color: tpl.accent_color, member_count: 128, thread_count: tpl.sample_threads?.length ?? 1, created_at: new Date().toISOString(),
    site_mode: tpl.site_mode, template_id: tpl.id, hero_headline: tpl.hero_headline, hero_subheadline: tpl.hero_subheadline, currency: 'NGN',
  } as ForumSummary) : null, [tpl]);

  const products = useMemo<SiteProduct[]>(() => (tpl?.sample_products || []).map((p, i) => ({
    id: `p${i}`, site_id: 'preview', title: p.title, description: p.description, category: p.category, product_type: p.product_type,
    price: p.price, compare_at_price: p.compare_at_price ?? null, image_url: '', digital_url: '', stock_qty: p.stock_qty ?? null,
    is_active: true, sort_order: i, created_at: new Date().toISOString(),
  })), [tpl]);

  const threads = useMemo<ForumThread[]>(() => {
    const src = tpl?.sample_threads ?? (tpl?.sample_thread ? [tpl.sample_thread] : []);
    return src.map((t, i) => ({
      id: `t${i}`, forum_id: 'preview', author_id: 'a', author_name: ['Adaeze', 'Tunde', 'Zainab', 'Chidi'][i % 4], title: t.title, body: t.body,
      is_pinned: i === 0, is_locked: false, reply_count: [24, 9, 41, 3][i % 4], last_activity_at: new Date(Date.now() - i * 3_600_000).toISOString(), created_at: new Date(Date.now() - i * 7_200_000).toISOString(),
    }));
  }, [tpl]);

  if (!tpl || !site) {
    return (
      <div className="g-font min-h-screen bg-primary text-primary flex items-center justify-center p-6 text-center">
        <div><p className="g-h3">That theme does not exist.</p><Link href="/developer#templates" className="text-accent hover:underline mt-3 inline-block">See all themes</Link></div>
      </div>
    );
  }

  const layout = tpl.layout_style;
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];
  const shown = category === 'All' ? products : products.filter((p) => p.category === category);
  const showStore = tpl.site_mode !== 'forum' && products.length > 0;
  const showForum = tpl.site_mode !== 'store' && threads.length > 0;
  const locked = price && price.price > 0 && !price.owned;

  return (
    <div className="g-font min-h-screen bg-secondary/40 text-primary">
      <div className="sticky top-0 z-40 bg-card border-b border-theme">
        <div className="g-wrap-wide py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/developer#templates" className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary"><ArrowLeft className="w-4 h-4" /> Themes</Link>
            <p className="font-medium truncate">{tpl.label}</p>
            {price && price.price > 0 && <span className="text-xs px-2.5 py-1 rounded-full g-tonal-strong">{price.owned ? 'You own this' : `₦${price.price.toLocaleString('en-NG')}`}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex rounded-full g-tonal-strong p-1">
              {([['desktop', Monitor], ['phone', Smartphone]] as const).map(([k, Icon]) => (
                <button key={k} onClick={() => setWidth(k)} aria-label={`${k} view`} aria-pressed={width === k} className={`w-9 h-8 rounded-full flex items-center justify-center ${width === k ? 'bg-card shadow-sm' : 'text-secondary'}`}><Icon className="w-4 h-4" /></button>
              ))}
            </div>
            <Link href={`/developer?template=${tpl.id}#start`} className="bg-accent text-[var(--accent-foreground)] font-medium text-sm px-6 h-10 inline-flex items-center rounded-full">
              {locked ? `Get this theme` : 'Use this theme'}
            </Link>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6">
        <div className={`mx-auto bg-primary rounded-3xl shadow-lg overflow-hidden transition-all ${width === 'phone' ? 'max-w-[390px]' : 'max-w-6xl'}`}>
          <div className="px-4 sm:px-6 py-4 border-b border-theme flex items-center justify-between">
            <span className="font-semibold text-lg" style={{ color: tpl.accent_color }}>Your brand</span>
            <span className="text-xs text-secondary">Home · Shop · About</span>
          </div>
          <div className="p-4 sm:p-6 space-y-6">
            {showStore && (
              <>
                <StorefrontHeroAndTrust site={site} layoutStyle={layout} categories={categories} selectedCategory={category} onSelectCategory={setCategory} />
                <div className={`grid gap-3.5 ${width === 'phone' ? 'grid-cols-1' : layout === 'temu' ? 'grid-cols-2 lg:grid-cols-4' : layout === 'shopify' ? 'grid-cols-2 lg:grid-cols-4 gap-y-8' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {shown.map((p) => (
                    <StoreProductCard key={p.id} site={site} product={p} currency="NGN" layoutStyle={layout} onAdd={() => {}} onOpen={() => {}} />
                  ))}
                </div>
              </>
            )}
            {!showStore && (
              <div className="rounded-3xl p-6 sm:p-8 g-tonal" style={{ borderLeft: `4px solid ${tpl.accent_color}` }}>
                <h1 className="g-h2">{tpl.hero_headline}</h1>
                <p className="g-lead mt-2">{tpl.hero_subheadline}</p>
              </div>
            )}
            {showForum && (
              FORUM_LAYOUTS.includes(layout)
                ? <ThreadListThemes threads={threads} layout={layout} accent={tpl.accent_color} threadHref={() => '#'} />
                : <ul className="space-y-3">{threads.map((t) => <li key={t.id} className="g-card p-5"><p className="font-bold">{t.title}</p><p className="text-sm text-secondary mt-1">{t.body}</p></li>)}</ul>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-secondary mt-4">Preview with sample content. Everything can be changed after you launch.</p>
      </div>
    </div>
  );
}
