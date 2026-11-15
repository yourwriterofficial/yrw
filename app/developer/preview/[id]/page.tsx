'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Monitor, Smartphone, ShoppingCart, Search, X, Minus, Plus, Star, MessageSquare, Lock, Check, Menu, Sparkles, Truck, ShieldCheck, Headphones, Mail } from 'lucide-react';
import { SITE_TEMPLATES } from '@/lib/siteTemplates';
import { formatMoney, type ForumSummary, type ForumThread, type SiteProduct } from '@/lib/forums';
import { StoreProductCard, StorefrontHeroAndTrust } from '@/app/components/forums/StorefrontThemes';
import ThreadListThemes, { FORUM_LAYOUTS } from '@/app/components/forums/ThreadListThemes';
import BusinessCard from '@/app/components/forums/BusinessCard';
import { isPremiumTemplate, perksFor, tierForPrice, TIER_LABEL } from '@/lib/premium';
import { PremiumFloaters, PremiumRails, TrendingRail, WishHeart } from '@/app/components/forums/PremiumExtras';
import { artFor, archetypeOf, brandFor, demoProducts, demoReplies, demoTestimonials, demoThreads, heroNavFor } from '@/lib/demoContent';

type View = 'home' | 'shop' | 'community' | 'about';

/**
 * Try a theme the way a customer would use the finished site. It is a working demo: browse, filter, open a
 * product, fill a cart, read discussions. Sample content only; nothing here is saved or sent anywhere.
 */
export default function ThemePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tpl = SITE_TEMPLATES.find((t) => t.id === id);
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [price, setPrice] = useState<{ price: number; owned: boolean } | null>(null);
  const [view, setView] = useState<View>('home');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [openProduct, setOpenProduct] = useState<SiteProduct | null>(null);
  const [openThread, setOpenThread] = useState<ForumThread | null>(null);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [advertise, setAdvertise] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/themes').then((r) => r.json()).then((j) => {
      const t = (j.themes || []).find((x: { id: string }) => x.id === id);
      if (active && t) setPrice({ price: t.price_ngn, owned: !!t.owned });
    }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  const brand = useMemo(() => (tpl ? brandFor(tpl) : ''), [tpl]);
  const nav = useMemo(() => (tpl ? heroNavFor(tpl) : null), [tpl]);
  const products = useMemo(() => (tpl ? demoProducts(tpl) : []), [tpl]);
  const threads = useMemo(() => (tpl ? demoThreads(tpl) : []), [tpl]);

  const site = useMemo(() => tpl ? ({
    id: 'preview', slug: 'preview', name: brand, description: tpl.tagline, owner_id: '', is_public: true,
    accent_color: tpl.accent_color, member_count: 1280, thread_count: threads.length, created_at: new Date().toISOString(),
    site_mode: tpl.site_mode, template_id: tpl.id, hero_headline: tpl.hero_headline, hero_subheadline: tpl.hero_subheadline, currency: 'NGN',
    whatsapp_number: '2348012345678', pickup_address: '12 Admiralty Way, Lekki Phase 1, Lagos', page_contact_note: 'Open Mon to Sat, 9am to 6pm',
  } as ForumSummary) : null, [tpl, brand, threads.length]);

  if (!tpl || !site || !nav) {
    return (
      <div className="g-font min-h-screen bg-primary text-primary flex items-center justify-center p-6 text-center">
        <div><p className="g-h3">That theme does not exist.</p><Link href="/developer/templates" className="text-accent hover:underline mt-3 inline-block">See all themes</Link></div>
      </div>
    );
  }

  const layout = tpl.layout_style;
  const accent = tpl.accent_color;
  const arch = archetypeOf(tpl);
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];
  const q = query.trim().toLowerCase();
  const shown = products.filter((p) => (category === 'All' || p.category === category) && (!q || p.title.toLowerCase().includes(q)));
  const premium = isPremiumTemplate(tpl.id);
  const tier = tierForPrice(price?.price ?? tpl.price_ngn ?? 0);
  const perks = perksFor(tpl);
  const locked = price && price.price > 0 && !price.owned;
  const cartItems = products.filter((p) => cart[p.id]);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = cartItems.reduce((a, p) => a + Number(p.price) * cart[p.id], 0);
  const tabs: { key: View; label: string }[] = [
    { key: 'home', label: 'Home' },
    ...(nav.store ? [{ key: 'shop' as View, label: nav.shopLabel }] : []),
    ...(nav.forum ? [{ key: 'community' as View, label: nav.forumLabel }] : []),
    { key: 'about', label: 'About' },
  ];
  const go = (v: View) => { setView(v); setOpenThread(null); setMenu(false); };
  const add = (p: SiteProduct) => {
    if (advertise) { setNotice('Advertise mode: on a live site this opens WhatsApp with the item pre-filled.'); return; }
    setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 })); setCartOpen(true); };
  const phone = width === 'phone';
  const openItem = (p: SiteProduct) => { setOpenProduct(p); };
  const rails = premium && nav.store ? <PremiumRails site={site} products={products} currency="NGN" accent={accent} onOpen={openItem} recentId={openProduct?.id} /> : null;

  const grid = `grid gap-3.5 ${phone ? 'grid-cols-1' : layout === 'temu' ? 'grid-cols-2 lg:grid-cols-4' : layout === 'shopify' ? 'grid-cols-2 lg:grid-cols-4 gap-y-8' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`;
  const products4 = shown.slice(0, phone ? 4 : 6);

  const forumList = (list: ForumThread[]) => FORUM_LAYOUTS.includes(layout)
    ? (
      <div onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest('a[href^="#t"]');
        if (!a) return;
        e.preventDefault();
        const t = threads.find((x) => `#${x.id}` === a.getAttribute('href'));
        if (t) setOpenThread(t);
      }}>
        <ThreadListThemes threads={list} layout={layout} accent={accent} threadHref={(tid) => `#${tid}`} coverFor={(t) => artFor(t.title, 'video', 'digital', accent, 360, 560)} />
      </div>
    )
    : (
      <ul className="space-y-3">
        {list.map((t) => (
          <li key={t.id}>
            <button onClick={() => setOpenThread(t)} className="g-card p-5 w-full text-left hover:shadow-md transition block">
              <p className="font-bold leading-snug">{t.is_pinned && <span className="mr-2 text-[10px] uppercase px-1.5 py-0.5 rounded text-white align-middle" style={{ background: accent }}>Pinned</span>}{t.title}</p>
              <p className="text-sm text-secondary mt-1 line-clamp-2">{t.body}</p>
              <p className="text-xs text-secondary mt-2.5 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {t.reply_count} replies · by {t.author_name}</p>
            </button>
          </li>
        ))}
      </ul>
    );

  const Section = ({ title, action, children }: { title: string; action?: { label: string; to: View }; children: React.ReactNode }) => (
    <section className="space-y-3.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
        {action && <button onClick={() => go(action.to)} className="text-sm font-medium hover:underline" style={{ color: accent }}>{action.label} →</button>}
      </div>
      {children}
    </section>
  );

  const productGrid = (list: SiteProduct[]) => list.length === 0
    ? <p className="text-center text-secondary py-12">No matches. Try another word or category.</p>
    : <div className={grid}>{list.map((p) => premium
      ? <div key={p.id} className="relative premium-card"><WishHeart slug="preview" productId={p.id} accent={accent} /><StoreProductCard site={site} product={p} currency="NGN" layoutStyle={layout} onAdd={add} onOpen={openItem} catalogue={advertise} /></div>
      : <StoreProductCard key={p.id} site={site} product={p} currency="NGN" layoutStyle={layout} onAdd={add} onOpen={openItem} catalogue={advertise} />)}</div>;

  const filters = (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${category === c ? 'text-white' : 'g-tonal-strong text-secondary hover:text-primary'}`} style={category === c ? { background: accent } : undefined}>{c}</button>
        ))}
      </div>
      <label className="relative sm:w-64">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full h-10 pl-9 pr-3 rounded-full g-tonal-strong text-sm outline-none" />
      </label>
    </div>
  );

  const testimonials = (
    <Section title="What customers say">
      <div className={`grid gap-3.5 ${phone ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
        {demoTestimonials.map((t) => (
          <figure key={t.name} className="g-card p-5">
            <div className="flex gap-0.5 mb-2">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
            <blockquote className="text-sm">“{t.text}”</blockquote>
            <figcaption className="text-xs text-secondary mt-3 flex items-center gap-2"><span className="w-7 h-7 rounded-full text-white flex items-center justify-center font-semibold" style={{ background: accent }}>{t.name[0]}</span>{t.name} · {t.role}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );

  const trust = (
    <div className={`grid gap-3 ${phone ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
      {[[Truck, 'Fast delivery', 'Nationwide, tracked to your door'], [ShieldCheck, 'Secure ordering', 'Pay by transfer or on delivery'], [Headphones, 'Real support', 'Chat with us on WhatsApp']].map(([Icon, t, d]) => {
        const I = Icon as typeof Truck;
        return <div key={t as string} className="g-card p-4 flex items-center gap-3"><span className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: accent }}><I className="w-5 h-5" /></span><div><p className="text-sm font-semibold">{t as string}</p><p className="text-xs text-secondary">{d as string}</p></div></div>;
      })}
    </div>
  );

  const newsletter = (
    <div className="rounded-3xl p-6 sm:p-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
      <Mail className="w-6 h-6 mx-auto mb-2 opacity-90" />
      <p className="text-lg font-semibold">Get updates and offers</p>
      <p className="text-sm opacity-90 mt-1">Join {site.member_count.toLocaleString()} others. No spam, unsubscribe anytime.</p>
      <form onSubmit={(e) => { e.preventDefault(); setNotice('Subscribed. This is a demo, so nothing was sent.'); }} className="mt-4 flex gap-2 max-w-sm mx-auto">
        <input type="email" required placeholder="you@email.com" className="flex-1 h-11 px-4 rounded-full text-black text-sm outline-none" />
        <button className="h-11 px-5 rounded-full bg-black/80 text-white text-sm font-medium">Join</button>
      </form>
    </div>
  );

  return (
    <div className="g-font min-h-screen bg-secondary/40 text-primary">
      <div className="sticky top-0 z-40 bg-card border-b border-theme">
        <div className="g-wrap-wide py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/developer/templates" className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary"><ArrowLeft className="w-4 h-4" /> All themes</Link>
            <p className="font-medium truncate">{tpl.label}</p>
            {premium && <span className="text-xs px-2.5 py-1 rounded-full text-white font-medium inline-flex items-center gap-1" style={{ background: accent }}><Sparkles className="w-3 h-3" />{TIER_LABEL[tier]}</span>}
            {price && price.price > 0 && <span className="text-xs px-2.5 py-1 rounded-full g-tonal-strong">{price.owned ? 'You own this' : `₦${price.price.toLocaleString('en-NG')} once`}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex rounded-full g-tonal-strong p-1">
              {([['desktop', Monitor], ['phone', Smartphone]] as const).map(([k, Icon]) => (
                <button key={k} onClick={() => setWidth(k)} aria-label={`${k} view`} aria-pressed={width === k} className={`w-9 h-8 rounded-full flex items-center justify-center ${width === k ? 'bg-card shadow-sm' : 'text-secondary'}`}><Icon className="w-4 h-4" /></button>
              ))}
            </div>
            {nav.store && (
              <label className="hidden md:inline-flex items-center gap-2 text-sm text-secondary cursor-pointer select-none" title="Visitors tap to order on WhatsApp instead of using a cart">
                <input type="checkbox" role="switch" checked={advertise} onChange={(e) => setAdvertise(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" /> Advertise mode
              </label>
            )}
            <Link href={`/developer?template=${tpl.id}#start`} className="bg-accent text-[var(--accent-foreground)] font-medium text-sm px-6 h-10 inline-flex items-center rounded-full">
              {locked ? 'Get this theme' : 'Use this theme'}
            </Link>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6">
        <div className={`mx-auto transition-all ${phone ? 'max-w-[400px]' : 'max-w-6xl'}`}>
          {/* browser / phone chrome */}
          <div className={`bg-card shadow-xl overflow-hidden border border-theme ${phone ? 'rounded-[2.5rem] p-2' : 'rounded-2xl'}`}>
            {!phone && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary/50 border-b border-theme">
                <span className="flex gap-1.5"><i className="w-3 h-3 rounded-full bg-red-400" /><i className="w-3 h-3 rounded-full bg-amber-400" /><i className="w-3 h-3 rounded-full bg-green-400" /></span>
                <span className="flex-1 max-w-md mx-auto text-center text-xs text-secondary bg-card rounded-full py-1 truncate">🔒 {brand.toLowerCase().replace(/[^a-z0-9]+/g, '')}.developa.me</span>
              </div>
            )}

            <div className={`relative bg-primary overflow-hidden ${phone ? 'rounded-[2rem]' : ''}`} style={{ minHeight: phone ? 700 : 640 }}>
              {/* site header */}
              <header className="sticky top-0 z-20 bg-primary/95 backdrop-blur border-b border-theme">
                <div className="px-4 sm:px-6 h-16 flex items-center gap-4">
                  <button className={phone ? 'p-1' : 'hidden'} onClick={() => setMenu((m) => !m)} aria-label="Menu"><Menu className="w-5 h-5" /></button>
                  <button onClick={() => go('home')} className="flex items-center gap-2 font-semibold text-lg" style={{ color: accent }}>
                    <span className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-sm" style={{ background: accent }}>{brand[0]}</span>{brand}
                  </button>
                  {!phone && (
                    <nav className="flex items-center gap-1 ml-4">
                      {tabs.map((t) => (
                        <button key={t.key} onClick={() => go(t.key)} className={`px-3.5 py-2 rounded-full text-sm font-medium transition ${view === t.key ? 'g-tonal-strong text-primary' : 'text-secondary hover:text-primary'}`}>{t.label}</button>
                      ))}
                    </nav>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {nav.store && !advertise && (
                      <button onClick={() => setCartOpen(true)} className="relative w-10 h-10 rounded-full g-tonal-strong flex items-center justify-center" aria-label="Cart">
                        <ShoppingCart className="w-5 h-5" />
                        {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: accent }}>{cartCount}</span>}
                      </button>
                    )}
                    {nav.forum && !nav.store && <button onClick={() => setNotice('Joining is live on your own site. This is a demo.')} className="h-10 px-5 rounded-full text-white text-sm font-medium" style={{ background: accent }}>Join</button>}
                  </div>
                </div>
                {phone && menu && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2">{tabs.map((t) => <button key={t.key} onClick={() => go(t.key)} className={`px-3.5 py-1.5 rounded-full text-sm ${view === t.key ? 'g-tonal-strong font-medium' : 'text-secondary'}`}>{t.label}</button>)}</div>
                )}
              </header>

              {notice && (
                <div className="px-4 sm:px-6 pt-4"><div className="rounded-xl g-tonal-strong px-4 py-2.5 text-sm flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" />{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X className="w-4 h-4" /></button></div></div>
              )}

              <main className={`p-4 sm:p-6 space-y-8 ${premium ? 'premium-skin' : ''}`} style={premium ? ({ '--skin-accent': accent } as React.CSSProperties) : undefined}>
                {openThread ? (
                  <div className="max-w-3xl mx-auto space-y-4">
                    <button onClick={() => setOpenThread(null)} className="text-sm text-secondary hover:text-primary flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to {nav.forumLabel.toLowerCase()}</button>
                    <article className="g-card p-5 sm:p-7">
                      <h1 className="text-xl sm:text-2xl font-bold leading-snug">{openThread.title}</h1>
                      <p className="text-xs text-secondary mt-2">by {openThread.author_name} · {openThread.reply_count} replies</p>
                      <p className="mt-4 leading-relaxed">{openThread.body}</p>
                    </article>
                    {demoReplies(openThread.id).map((r) => (
                      <div key={r.id} className="g-card p-4 flex gap-3">
                        <span className="w-9 h-9 rounded-full text-white flex items-center justify-center font-semibold shrink-0" style={{ background: accent }}>{r.name[0]}</span>
                        <div><p className="text-sm font-semibold">{r.name} <span className="font-normal text-xs text-secondary">· {r.ago}</span></p><p className="text-sm mt-0.5">{r.body}</p></div>
                      </div>
                    ))}
                    <form onSubmit={(e) => { e.preventDefault(); setNotice('Replies are live on your own site. This is a demo.'); }} className="g-card p-4 space-y-3">
                      <textarea rows={3} placeholder="Write a reply" className="w-full g-tonal-strong rounded-xl p-3 text-sm outline-none" />
                      <button className="h-10 px-6 rounded-full text-white text-sm font-medium" style={{ background: accent }}>Post reply</button>
                    </form>
                  </div>
                ) : view === 'home' ? (
                  <>
                    {nav.store ? (
                      <StorefrontHeroAndTrust site={site} layoutStyle={layout} categories={categories} selectedCategory={category} onSelectCategory={(c) => { setCategory(c); setView('shop'); }} />
                    ) : (
                      <div className="rounded-3xl p-7 sm:p-12 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}b0)` }}>
                        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10" />
                        <h1 className="text-2xl sm:text-4xl font-bold max-w-2xl relative">{tpl.hero_headline}</h1>
                        <p className="mt-3 opacity-90 max-w-xl relative">{tpl.hero_subheadline}</p>
                        <button onClick={() => go('community')} className="mt-6 h-11 px-7 rounded-full bg-white text-black text-sm font-semibold relative">{arch === 'news' || arch === 'blog' ? 'Start reading' : 'Join the conversation'}</button>
                      </div>
                    )}
                    {nav.store && <BusinessCard site={site} accent={accent} />}
                    {nav.store && <Section title={arch === 'service' || arch === 'creative' || arch === 'beauty' ? 'Popular services' : arch === 'course' ? 'Featured courses' : 'Featured'} action={{ label: `View all ${nav.shopLabel.toLowerCase()}`, to: 'shop' }}>{productGrid(products4)}</Section>}
                    {nav.forum && threads.length > 0 && <Section title={arch === 'news' ? 'Top stories' : arch === 'blog' ? 'Latest articles' : 'Recent discussions'} action={{ label: 'See all', to: 'community' }}>{forumList(threads.slice(0, 5))}</Section>}
                    {rails}
                    {nav.store && trust}
                    {testimonials}
                    {newsletter}
                  </>
                ) : view === 'shop' ? (
                  <>
                    <div><h1 className="text-2xl font-bold">{nav.shopLabel}</h1><p className="text-sm text-secondary mt-1">{products.length} items · tap anything to see details</p></div>
                    {filters}
                    {productGrid(shown)}
                    {rails}
                  </>
                ) : view === 'community' ? (
                  <>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div><h1 className="text-2xl font-bold">{nav.forumLabel}</h1><p className="text-sm text-secondary mt-1">{site.member_count.toLocaleString()} members · {threads.length} recent posts</p></div>
                      <button onClick={() => setNotice('Posting is live on your own site. This is a demo.')} className="h-10 px-5 rounded-full text-white text-sm font-medium" style={{ background: accent }}>{arch === 'news' || arch === 'blog' ? 'Write a post' : 'New topic'}</button>
                    </div>
                    {premium && <TrendingRail threads={threads} accent={accent} onOpen={setOpenThread} />}
                    {forumList(threads)}
                  </>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <h1 className="text-2xl font-bold">About {brand}</h1>
                    <p className="leading-relaxed text-secondary">{tpl.tagline} We are a small team that cares about doing things properly: honest descriptions, fair prices and quick replies. Everything you see here can be changed from your own dashboard, in minutes, from your phone.</p>
                    <div className={`grid gap-3 ${phone ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>{[['5,000+', 'Happy customers'], ['4.8 / 5', 'Average rating'], ['24 hrs', 'Typical reply time']].map(([n, l]) => <div key={l} className="g-card p-5 text-center"><p className="text-2xl font-bold" style={{ color: accent }}>{n}</p><p className="text-xs text-secondary mt-1">{l}</p></div>)}</div>
                    <form onSubmit={(e) => { e.preventDefault(); setNotice('Message received. This is a demo, so nothing was sent.'); }} className="g-card p-5 sm:p-6 space-y-3">
                      <p className="font-semibold">Contact us</p>
                      <input required placeholder="Your name" className="w-full h-11 px-4 rounded-xl g-tonal-strong text-sm outline-none" />
                      <textarea required rows={4} placeholder="How can we help?" className="w-full p-4 rounded-xl g-tonal-strong text-sm outline-none" />
                      <button className="h-11 px-7 rounded-full text-white text-sm font-medium" style={{ background: accent }}>Send message</button>
                    </form>
                  </div>
                )}
              </main>

              <footer className="mt-4 border-t border-theme px-4 sm:px-6 py-8 text-sm">
                <div className={`grid gap-6 ${phone ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  <div><p className="font-semibold text-base" style={{ color: accent }}>{brand}</p><p className="text-secondary mt-2 max-w-xs">{tpl.tagline}</p></div>
                  <div><p className="font-semibold mb-2">Explore</p><ul className="space-y-1.5 text-secondary">{tabs.map((t) => <li key={t.key}><button onClick={() => go(t.key)} className="hover:text-primary">{t.label}</button></li>)}</ul></div>
                  <div><p className="font-semibold mb-2">Contact</p><ul className="space-y-1.5 text-secondary"><li>WhatsApp chat</li><li>hello@{brand.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com</li><li>Lagos, Nigeria</li></ul></div>
                </div>
                <p className="text-xs text-secondary mt-6 pt-4 border-t border-theme">© 2026 {brand}. All rights reserved.</p>
              </footer>

              {/* product detail */}
              {openProduct && (
                <div className="absolute inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setOpenProduct(null)}>
                  <div onClick={(e) => e.stopPropagation()} className={`bg-primary w-full max-w-3xl max-h-full overflow-auto sm:rounded-3xl rounded-t-3xl ${phone ? '' : 'grid sm:grid-cols-2'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openProduct.image_url} alt={openProduct.title} className="w-full aspect-[4/3] sm:h-full object-cover" />
                    <div className="p-5 sm:p-7 space-y-3 relative">
                      <button onClick={() => setOpenProduct(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full g-tonal-strong flex items-center justify-center" aria-label="Close"><X className="w-4 h-4" /></button>
                      <p className="text-xs uppercase tracking-wide text-secondary">{openProduct.category}</p>
                      <h3 className="text-xl font-bold pr-10">{openProduct.title}</h3>
                      <p className="flex items-center gap-1 text-sm"><Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {(openProduct.rating_avg ?? 4.5).toFixed(1)} <span className="text-secondary">({openProduct.rating_count ?? 20} reviews)</span></p>
                      <p className="text-2xl font-bold" style={{ color: accent }}>{formatMoney(Number(openProduct.price), 'NGN')} {openProduct.compare_at_price && <span className="text-sm font-normal text-secondary line-through ml-1">{formatMoney(Number(openProduct.compare_at_price), 'NGN')}</span>}</p>
                      <p className="text-sm text-secondary leading-relaxed">{openProduct.description}</p>
                      <button onClick={() => { add(openProduct); setOpenProduct(null); }} className="w-full h-12 rounded-full text-white font-medium flex items-center justify-center gap-2" style={{ background: accent }}><ShoppingCart className="w-4 h-4" />{openProduct.product_type === 'service' ? 'Book now' : 'Add to cart'}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* cart drawer */}
              {cartOpen && (
                <div className="absolute inset-0 z-30 bg-black/40 flex justify-end" onClick={() => setCartOpen(false)}>
                  <aside onClick={(e) => e.stopPropagation()} className="bg-primary w-full max-w-sm h-full flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-theme flex items-center justify-between"><p className="font-semibold">Your cart ({cartCount})</p><button onClick={() => setCartOpen(false)} aria-label="Close cart"><X className="w-5 h-5" /></button></div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                      {cartItems.length === 0 && <p className="text-center text-secondary py-16">Your cart is empty.</p>}
                      {cartItems.map((p) => (
                        <div key={p.id} className="flex gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{p.title}</p><p className="text-sm text-secondary">{formatMoney(Number(p.price), 'NGN')}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button onClick={() => setCart((c) => { const n = { ...c, [p.id]: c[p.id] - 1 }; if (n[p.id] <= 0) delete n[p.id]; return n; })} className="w-7 h-7 rounded-full g-tonal-strong flex items-center justify-center" aria-label="Less"><Minus className="w-3.5 h-3.5" /></button>
                              <span className="text-sm w-5 text-center">{cart[p.id]}</span>
                              <button onClick={() => setCart((c) => ({ ...c, [p.id]: c[p.id] + 1 }))} className="w-7 h-7 rounded-full g-tonal-strong flex items-center justify-center" aria-label="More"><Plus className="w-3.5 h-3.5" /></button>
                            </div></div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-theme space-y-3">
                      <p className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(cartTotal, 'NGN')}</span></p>
                      <button disabled={cartItems.length === 0} onClick={() => { setCartOpen(false); setNotice('Checkout works on your own site: bank transfer, pay on delivery and WhatsApp orders. This is a demo.'); }} className="w-full h-12 rounded-full text-white font-medium disabled:opacity-40" style={{ background: accent }}>Checkout</button>
                      <p className="text-[11px] text-center text-secondary flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> Demo store, no real orders</p>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </div>
        </div>
        {premium && <PremiumFloaters site={site} accent={accent} currency="NGN" cart={nav.store ? { count: cartCount, total: cartTotal } : undefined} onCart={() => setCartOpen(true)} />}

        <section className="max-w-6xl mx-auto mt-8 g-card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">{premium ? <><Sparkles className="w-5 h-5" style={{ color: accent }} /> Premium features in this theme</> : 'Want more? Premium themes add these'}</h2>
              <p className="text-sm text-secondary mt-1">{premium ? 'Everything below is switched on from day one. Try the hearts, rails and floating buttons in the preview above.' : 'This theme is free. Premium themes switch these features on automatically.'}</p>
            </div>
            {!premium && <Link href="/developer/templates?premium=1" className="h-10 px-5 rounded-full g-tonal-strong text-sm font-medium inline-flex items-center">See premium themes</Link>}
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {perks.map((p) => (
              <li key={p.id} className="flex gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${premium ? 'text-white' : 'g-tonal-strong text-secondary'}`} style={premium ? { background: accent } : undefined}>{premium ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}</span>
                <div><p className="text-sm font-medium">{p.label}</p><p className="text-xs text-secondary mt-0.5">{p.detail}</p></div>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-center text-xs text-secondary mt-4">This is a working demo with sample content. Everything can be changed after you launch.</p>
      </div>
    </div>
  );
}
