'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowUp, Flame, Heart, MessageCircle, ShoppingCart, Sparkles, Clock, TrendingUp } from 'lucide-react';
import { formatMoney, type ForumSummary, type ForumThread, type SiteProduct } from '@/lib/forums';
import { waLink } from '@/lib/phone';

/**
 * Extras that only premium themes get. Everything here lives in the visitor's browser (saved items, recently
 * viewed) or is worked out from the site's own products and posts, so nothing needs setting up and nothing
 * extra is stored on the server.
 */

/* ---------- small per-site browser store ---------- */

function useLocalList(key: string): [string[], (next: string[]) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener('storage', cb);
    window.addEventListener(`dv:${key}`, cb);
    return () => { window.removeEventListener('storage', cb); window.removeEventListener(`dv:${key}`, cb); };
  }, [key]);
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) || '[]'; } catch { return '[]'; } }, () => '[]');
  let list: string[] = [];
  try { const v = JSON.parse(raw); if (Array.isArray(v)) list = v.filter((x) => typeof x === 'string'); } catch { /* ignore */ }
  const set = useCallback((next: string[]) => {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage blocked: stay in memory only */ }
    window.dispatchEvent(new Event(`dv:${key}`));
  }, [key]);
  return [list, set];
}

export function useWishlist(slug: string) {
  const [ids, set] = useLocalList(`dv-wish-${slug}`);
  const toggle = (id: string) => set(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 60));
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}

export function useRecentlyViewed(slug: string) {
  const [ids, set] = useLocalList(`dv-recent-${slug}`);
  const push = (id: string) => { if (ids[0] !== id) set([id, ...ids.filter((x) => x !== id)].slice(0, 12)); };
  return { ids, push };
}

/* ---------- heart on a product card ---------- */

export function WishHeart({ slug, productId, accent }: { slug: string; productId: string; accent: string }) {
  const { has, toggle } = useWishlist(slug);
  const on = has(productId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(productId); }}
      aria-label={on ? 'Remove from saved' : 'Save for later'}
      aria-pressed={on}
      className="absolute top-2.5 left-2.5 z-10 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center backdrop-blur hover:scale-105 transition"
    >
      <Heart className="w-[18px] h-[18px]" style={on ? { fill: accent, color: accent } : { color: '#555' }} />
    </button>
  );
}

/* ---------- fade-in on scroll ---------- */

export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`transition-all duration-700 ease-out motion-reduce:transition-none ${seen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 motion-reduce:opacity-100 motion-reduce:translate-y-0'} ${className}`}>{children}</div>;
}

/* ---------- product rails ---------- */

function MiniCard({ p, currency, accent, onOpen }: { p: SiteProduct; currency: string; accent: string; onOpen: (p: SiteProduct) => void }) {
  return (
    <button type="button" onClick={() => onOpen(p)} className="shrink-0 w-40 sm:w-44 text-left group">
      <div className="aspect-square rounded-2xl overflow-hidden bg-secondary/30 border border-theme">
        {p.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={p.image_url} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: `${accent}18` }}><Sparkles className="w-6 h-6" style={{ color: accent }} /></div>}
      </div>
      <p className="text-sm font-medium mt-2 line-clamp-1">{p.title}</p>
      <p className="text-sm font-semibold" style={{ color: accent }}>{formatMoney(Number(p.price), currency)}</p>
    </button>
  );
}

function Rail({ title, icon, items, currency, accent, onOpen }: { title: string; icon: ReactNode; items: SiteProduct[]; currency: string; accent: string; onOpen: (p: SiteProduct) => void }) {
  if (items.length === 0) return null;
  return (
    <Reveal>
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold" style={{ fontFamily: 'var(--premium-heading, inherit)' }}><span style={{ color: accent }}>{icon}</span>{title}</h3>
        <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {items.map((p) => <div key={p.id} className="snap-start"><MiniCard p={p} currency={currency} accent={accent} onOpen={onOpen} /></div>)}
        </div>
      </section>
    </Reveal>
  );
}

export function PremiumRails({ site, products, currency, accent, onOpen, recentId }: {
  site: ForumSummary; products: SiteProduct[]; currency: string; accent: string; onOpen: (p: SiteProduct) => void; recentId?: string;
}) {
  const wish = useWishlist(site.slug);
  const recent = useRecentlyViewed(site.slug);
  const byId = new Map(products.map((p) => [p.id, p]));
  const best = [...products].sort((a, b) => ((b.rating_count ?? 0) * (b.rating_avg ?? 0)) - ((a.rating_count ?? 0) * (a.rating_avg ?? 0))).slice(0, 8);
  const fresh = [...products].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8);
  const hasRatings = products.some((p) => (p.rating_count ?? 0) > 0);
  const saved = wish.ids.map((i) => byId.get(i)).filter(Boolean) as SiteProduct[];
  const seen = recent.ids.filter((i) => i !== recentId).map((i) => byId.get(i)).filter(Boolean) as SiteProduct[];
  if (products.length < 4) return null;
  return (
    <div className="space-y-7">
      <Rail title="Saved for later" icon={<Heart className="w-4 h-4" />} items={saved} currency={currency} accent={accent} onOpen={onOpen} />
      {hasRatings && <Rail title="Best sellers" icon={<Flame className="w-4 h-4" />} items={best} currency={currency} accent={accent} onOpen={onOpen} />}
      <Rail title="New arrivals" icon={<Sparkles className="w-4 h-4" />} items={fresh} currency={currency} accent={accent} onOpen={onOpen} />
      <Rail title="Recently viewed" icon={<Clock className="w-4 h-4" />} items={seen} currency={currency} accent={accent} onOpen={onOpen} />
    </div>
  );
}

/* ---------- forum: trending ---------- */

export function TrendingRail({ threads, accent, onOpen }: { threads: ForumThread[]; accent: string; onOpen?: (t: ForumThread) => void }) {
  const top = [...threads].filter((t) => t.reply_count > 0).sort((a, b) => b.reply_count - a.reply_count).slice(0, 3);
  if (top.length < 2) return null;
  return (
    <Reveal>
      <section className="rounded-2xl border border-theme bg-card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3"><TrendingUp className="w-4 h-4" style={{ color: accent }} /> Trending now</h3>
        <ol className="space-y-2.5">
          {top.map((t, i) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpen?.(t)} className="flex items-start gap-3 text-left w-full group">
                <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ background: accent }}>{i + 1}</span>
                <span className="min-w-0"><span className="block text-sm font-medium leading-snug group-hover:underline">{t.title}</span><span className="text-xs text-secondary">{t.reply_count} replies</span></span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </Reveal>
  );
}

/* ---------- floating bits: cart bar, WhatsApp, back to top ---------- */

export function PremiumFloaters({ site, accent, cart, onCart, currency, inline = false }: {
  site: ForumSummary; accent: string; currency: string; inline?: boolean;
  cart?: { count: number; total: number }; onCart?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (inline) return;
    const on = () => setScrolled(window.scrollY > 600);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [inline]);
  const wa = site.whatsapp_number ? waLink(site.whatsapp_number, `Hi ${site.name}, I have a question.`) : null;
  const pos = inline ? 'absolute' : 'fixed';
  const showTop = inline || scrolled;
  return (
    <>
      {cart && cart.count > 0 && onCart && (
        <div className={`${pos} inset-x-3 bottom-3 z-30 sm:inset-x-auto sm:right-24 sm:bottom-5 sm:w-80 pointer-events-none`}>
          <button type="button" onClick={onCart} className="pointer-events-auto w-full rounded-full text-white shadow-xl px-5 h-12 flex items-center justify-between font-medium" style={{ background: accent }}>
            <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> {cart.count} {cart.count === 1 ? 'item' : 'items'}</span>
            <span>{formatMoney(cart.total, currency)} · View cart</span>
          </button>
        </div>
      )}
      <div className={`${pos} right-3 bottom-3 sm:right-5 sm:bottom-5 z-30 flex flex-col gap-2.5 items-end ${cart && cart.count > 0 ? 'max-sm:bottom-20' : ''}`}>
        {showTop && (
          <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="w-11 h-11 rounded-full bg-card border border-theme shadow-lg flex items-center justify-center"><ArrowUp className="w-5 h-5" /></button>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className="w-12 h-12 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center"><MessageCircle className="w-6 h-6" /></a>
        )}
      </div>
    </>
  );
}
