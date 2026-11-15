'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ShareCard from './ShareCard';
import {
  LayoutDashboard, Package, ShoppingBag, Users, CalendarDays, Ticket, Truck, MessagesSquare, Crown, MessageCircle, Puzzle, Megaphone,
  Globe, Gem, Settings as SettingsIcon, ExternalLink, Copy, Check, Menu, X, ChevronRight, Share2, Plus, TrendingUp, Wallet, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import { formatMoney, type ForumThread, type SiteOrder, type SiteProduct } from '@/lib/forums';
import { PLANS, PRUNE_NOTICE, daysLeft, effectiveTier, type PlanTier } from '@/lib/plans';
import { itemLabels } from '@/lib/siteTemplates';
import { jsonFetch, type Site } from './types';
import ProductsTab from './tabs/ProductsTab';
import OrdersTab from './tabs/OrdersTab';
import CustomersTab from './tabs/CustomersTab';
import CommunityTab from './tabs/CommunityTab';
import CouponsTab from './tabs/CouponsTab';
import ShippingTab from './tabs/ShippingTab';
import BookingsTab from './tabs/BookingsTab';
import MembershipsTab from './tabs/MembershipsTab';
import DomainTab from './tabs/DomainTab';
import PlanTab from './tabs/PlanTab';
import AdSpaceTab from './tabs/AdSpaceTab';
import MessagesTab from './tabs/MessagesTab';
import PluginsTab from './tabs/PluginsTab';
import SettingsTab from './tabs/SettingsTab';
import StoreQrCard from './StoreQrCard';
import CartsLeftCard from './CartsLeftCard';
import AnalyticsCard from './AnalyticsCard';

type TabKey = 'overview' | 'products' | 'orders' | 'customers' | 'bookings' | 'community' | 'memberships' | 'coupons' | 'shipping' | 'plugins' | 'messages' | 'adspace' | 'domain' | 'plan' | 'settings';
const TAB_KEYS: TabKey[] = ['overview', 'products', 'orders', 'customers', 'bookings', 'community', 'memberships', 'coupons', 'shipping', 'plugins', 'messages', 'adspace', 'domain', 'plan', 'settings'];
type NavGroup = 'main' | 'sell' | 'community' | 'grow' | 'account';

const GROUPS: { key: NavGroup; label: string }[] = [
  { key: 'main', label: '' },
  { key: 'sell', label: 'Sell' },
  { key: 'community', label: 'Community' },
  { key: 'grow', label: 'Grow' },
  { key: 'account', label: 'Account' },
];

const TABS: { key: TabKey; label: string; group: NavGroup; Icon: typeof Package; storeOnly?: boolean; forumOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview', group: 'main', Icon: LayoutDashboard },
  { key: 'products', label: 'Products', group: 'sell', Icon: Package, storeOnly: true },
  { key: 'orders', label: 'Orders', group: 'sell', Icon: ShoppingBag, storeOnly: true },
  { key: 'customers', label: 'Customers', group: 'sell', Icon: Users, storeOnly: true },
  { key: 'bookings', label: 'Bookings', group: 'sell', Icon: CalendarDays, storeOnly: true },
  { key: 'coupons', label: 'Coupons', group: 'sell', Icon: Ticket, storeOnly: true },
  { key: 'shipping', label: 'Delivery', group: 'sell', Icon: Truck, storeOnly: true },
  { key: 'community', label: 'Community', group: 'community', Icon: MessagesSquare, forumOnly: true },
  { key: 'memberships', label: 'Memberships', group: 'community', Icon: Crown, forumOnly: true },
  { key: 'messages', label: 'Messages', group: 'grow', Icon: MessageCircle, storeOnly: true },
  { key: 'plugins', label: 'Plugins', group: 'grow', Icon: Puzzle },
  { key: 'adspace', label: 'Ad space', group: 'grow', Icon: Megaphone },
  { key: 'domain', label: 'Domain', group: 'grow', Icon: Globe },
  { key: 'plan', label: 'Plan', group: 'account', Icon: Gem },
  { key: 'settings', label: 'Settings', group: 'account', Icon: SettingsIcon },
];

interface OwnerAd { id: string; title: string; body: string; link_url: string; image_url: string; placement: string }
interface Detail { forum: Site; products: SiteProduct[]; threads: ForumThread[]; ads: OwnerAd[] }

export default function ManageView() {
  const [authState, setAuthState] = useState<'checking' | 'out' | 'in'>('checking');
  const [sites, setSites] = useState<Site[]>([]);
  const [slug, setSlug] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [paidNotice, setPaidNotice] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [orders, setOrders] = useState<SiteOrder[]>([]);
  const [loadingSite, setLoadingSite] = useState(false);
  const [origin, setOrigin] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setOrigin(window.location.origin));
  }, []);

  // 1. Who is this, and which sites do they own?
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthState('out'); return; }
      setAuthState('in');
      const r = await jsonFetch<{ forums?: Site[] }>('/api/forums?mine=1');
      const mine = r.data.forums || [];
      setSites(mine);
      const wanted = new URLSearchParams(window.location.search).get('site');
      setSlug(mine.find((s) => s.slug === wanted)?.slug || mine[0]?.slug || '');
      // Coming back from a payment (or a shared link): open the tab named in the address, and say so when paid.
      const q = new URLSearchParams(window.location.search);
      const wantedTab = q.get('tab') as TabKey | null;
      if (wantedTab && TAB_KEYS.includes(wantedTab)) setTab(wantedTab);
      if (q.get('paid') === '1' || q.get('theme_paid') === '1') setPaidNotice(true);
    })();
  }, []);

  // 2. Load everything about the chosen site.
  const loadSite = useCallback(async (s: string) => {
    if (!s) return;
    setLoadingSite(true);
    const [d, o] = await Promise.all([
      jsonFetch<{ forum?: Site; products?: SiteProduct[]; threads?: ForumThread[]; ads?: OwnerAd[] }>(`/api/forums/${s}`),
      jsonFetch<{ orders?: SiteOrder[] }>(`/api/forums/${s}/orders`),
    ]);
    if (d.ok && d.data.forum) {
      setDetail({ forum: d.data.forum, products: d.data.products || [], threads: d.data.threads || [], ads: d.data.ads || [] });
    }
    setOrders(o.data.orders || []);
    setLoadingSite(false);
  }, []);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) await loadSite(slug);
    })();
    return () => { active = false; };
  }, [slug, loadSite]);
  const reload = useCallback(async () => { await loadSite(slug); }, [loadSite, slug]);

  const site = detail?.forum;
  const visibleTabs = useMemo(() => {
    const modeFiltered = TABS.filter(
      (t) => (!t.storeOnly || site?.site_mode !== 'forum') && (!t.forumOnly || site?.site_mode !== 'store')
    );
    const role = site?.my_role;
    if (!role || role === 'owner') return modeFiltered;
    if (role === 'packer') return modeFiltered.filter((t) => t.key === 'overview' || t.key === 'orders');
    if (role === 'support') {
      return modeFiltered.filter(
        (t) =>
          t.key === 'overview' ||
          t.key === 'orders' ||
          t.key === 'customers' ||
          t.key === 'bookings' ||
          t.key === 'community'
      );
    }
    return modeFiltered.filter((t) => t.key !== 'domain' && t.key !== 'plan');
  }, [site?.site_mode, site?.my_role]);
  const activeTab: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : 'overview';

  const shell = (inner: React.ReactNode) => (
    <div className="g-font min-h-screen bg-primary text-primary overflow-x-hidden">
      <DevelopaHeader />
      <main className="g-wrap-wide pt-header-28 sm:pt-header-32 pb-[var(--section-y)]">{inner}</main>
      <DevelopaFooter />
    </div>
  );

  if (authState === 'checking') return shell(<p className="text-secondary text-sm">Loading…</p>);

  if (authState === 'out') {
    return shell(
      <div className="max-w-md mx-auto text-center">
        <h1 className="g-h2">Manage your sites</h1>
        <p className="g-lead mt-3">Sign in to see your stores and communities, add products and check orders.</p>
        <Link href="/login?next=/developer/manage&brand=developa" className="inline-flex mt-6 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium px-7 h-11 items-center rounded-full">Sign in</Link>
      </div>
    );
  }

  if (sites.length === 0) {
    return shell(
      <div className="max-w-md mx-auto text-center">
        <h1 className="g-h2">You do not have a site yet</h1>
        <p className="g-lead mt-3">Pick a template and your store or community is live in minutes.</p>
        <Link href="/developer" className="inline-flex mt-6 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium px-7 h-11 items-center rounded-full">Create a site</Link>
      </div>
    );
  }

  const tier = site ? effectiveTier(site.plan_tier, site.plan_expires_at) : 'free';
  const left = site ? daysLeft(site.plan_expires_at) : null;
  const labelFor = (t: (typeof TABS)[number]) => !site ? t.label
    : t.key === 'products' ? itemLabels(site.template_id)[1]
    : t.key === 'community' && site.template_id === 'blog-magazine' ? 'Posts'
    : t.label;
  const badgeFor = (key: TabKey) => (key === 'orders' ? orders.filter((o) => o.payment_status === 'proof_submitted').length : 0);
  const current = visibleTabs.find((t) => t.key === activeTab);
  const siteLink = site ? (site.custom_domain && site.custom_domain_verified && tier !== 'free' ? `https://${site.custom_domain}` : `/forums/${site.slug}`) : '#';

  const nav = (onPick?: () => void) => (
    <nav aria-label="Admin sections" className="space-y-5">
      {GROUPS.map((g) => {
        const items = visibleTabs.filter((t) => t.group === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key}>
            {g.label && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary">{g.label}</p>}
            <ul className="space-y-0.5">
              {items.map((t) => {
                const on = activeTab === t.key;
                const badge = badgeFor(t.key);
                return (
                  <li key={t.key}>
                    <button
                      onClick={() => { setTab(t.key); onPick?.(); }}
                      aria-current={on ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-colors ${on ? 'bg-accent text-[var(--accent-foreground)] shadow-sm' : 'text-secondary hover:bg-hover hover:text-primary'}`}
                    >
                      <t.Icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="flex-1 text-left truncate">{labelFor(t)}</span>
                      {badge > 0 && <span className="text-[11px] bg-[var(--danger)] text-white rounded-full px-1.5 min-w-5 h-5 inline-flex items-center justify-center">{badge}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return shell(
    <>
      {!site ? (
        <p className="text-secondary text-sm">{loadingSite ? 'Loading your site…' : 'Could not load this site. Try refreshing the page.'}</p>
      ) : (
        <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8 items-start">
          {/* sidebar (desktop) */}
          <aside className="hidden lg:block sticky top-28 space-y-5">
            <SiteSwitcher sites={sites} slug={slug} site={site} tier={tier} left={left} onPick={(s) => { setSlug(s); setTab('overview'); }} />
            <div className="g-card p-3">{nav()}</div>
            <Link href="/developer" className="flex items-center gap-2 px-3 text-sm font-medium text-accent hover:underline"><Plus className="w-4 h-4" /> Create another site</Link>
          </aside>

          <div className="min-w-0">
            {/* top bar */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setMenuOpen(true)} className="lg:hidden w-11 h-11 rounded-full g-tonal-strong flex items-center justify-center shrink-0" aria-label="Open menu"><Menu className="w-5 h-5" /></button>
                <div className="min-w-0">
                  <p className="text-xs text-secondary truncate lg:hidden">{site.name}</p>
                  <h1 className="g-h2 !text-2xl sm:!text-3xl truncate">{current ? labelFor(current) : 'Admin'}</h1>
                </div>
              </div>
              <a href={siteLink} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full border border-theme text-sm font-medium hover:bg-hover"><ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">View site</span></a>
            </div>

            {paidNotice && (
              <div role="status" className="mb-6 flex items-start justify-between gap-3 rounded-2xl g-tonal-strong p-4 text-sm">
                <p><strong className="text-accent">Payment received.</strong> Thank you! Your upgrade is switched on.</p>
                <button type="button" onClick={() => setPaidNotice(false)} className="text-secondary hover:text-primary cursor-pointer" aria-label="Dismiss">Dismiss</button>
              </div>
            )}
            {activeTab === 'overview' && <Overview site={site} detail={detail!} orders={orders} origin={origin} go={setTab} tier={tier} />}
            {activeTab === 'products' && <ProductsTab site={site} products={detail!.products} reload={reload} />}
            {activeTab === 'orders' && <OrdersTab site={site} orders={orders} reload={reload} />}
            {activeTab === 'customers' && <CustomersTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'bookings' && <BookingsTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'community' && <CommunityTab site={site} threads={detail!.threads} reload={reload} />}
            {activeTab === 'memberships' && <MembershipsTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'coupons' && <CouponsTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'shipping' && <ShippingTab site={site} reload={reload} goToPlan={() => setTab('plan')} />}
            {activeTab === 'plugins' && <PluginsTab site={site} go={(t) => setTab(t as TabKey)} />}
            {activeTab === 'messages' && <MessagesTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'adspace' && <AdSpaceTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'domain' && <DomainTab site={site} goToPlan={() => setTab('plan')} />}
            {activeTab === 'plan' && <PlanTab site={site} />}
            {activeTab === 'settings' && <SettingsTab key={site.slug + (site.name || '')} site={site} reload={reload} goToPlan={() => setTab('plan')} />}
          </div>

          {/* mobile menu */}
          {menuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
              <div className="relative w-[84%] max-w-xs h-full bg-primary overflow-y-auto p-4 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between"><p className="font-semibold">Menu</p><button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="w-9 h-9 rounded-full g-tonal-strong flex items-center justify-center"><X className="w-4 h-4" /></button></div>
                <SiteSwitcher sites={sites} slug={slug} site={site} tier={tier} left={left} onPick={(s) => { setSlug(s); setTab('overview'); setMenuOpen(false); }} />
                {nav(() => setMenuOpen(false))}
                <Link href="/developer" className="flex items-center gap-2 px-3 text-sm font-medium text-accent"><Plus className="w-4 h-4" /> Create another site</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SiteSwitcher({ sites, slug, site, tier, left, onPick }: { sites: Site[]; slug: string; site: Site; tier: PlanTier; left: number | null; onPick: (slug: string) => void }) {
  return (
    <div className="g-card p-4 space-y-3">
      <div className="flex items-center gap-3 min-w-0">
        {site.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={site.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
          : <span className="w-11 h-11 rounded-xl text-white font-semibold text-lg flex items-center justify-center shrink-0" style={{ background: site.accent_color || '#1a73e8' }}>{(site.name || '?')[0].toUpperCase()}</span>}
        <div className="min-w-0">
          <p className="font-semibold truncate">{site.name}</p>
          <p className="text-xs font-mono text-secondary truncate">{site.slug}.developa.me</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${tier === 'free' ? 'bg-secondary text-secondary' : 'bg-accent text-[var(--accent-foreground)]'}`}>
          {PLANS[tier].name}{tier !== 'free' && left !== null && left > 0 ? ` · ${left}d left` : ''}
        </span>
        {!site.is_public && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--warning-bg)] text-warning">Hidden</span>}
        {site.my_role && site.my_role !== 'owner' && <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary text-secondary capitalize">{site.my_role}</span>}
      </div>
      {sites.length > 1 && (
        <select aria-label="Choose a site" value={slug} onChange={(e) => onPick(e.target.value)} className="input-box !py-2 text-sm w-full">
          {sites.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      )}
    </div>
  );
}

function Overview({ site, detail, orders, origin, go, tier }: { site: Site; detail: Detail; orders: SiteOrder[]; origin: string; go: (t: TabKey) => void; tier: PlanTier }) {
  const paid = useMemo(() => orders.filter((o) => o.payment_status === 'paid'), [orders]);
  const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
  const needsCheck = orders.filter((o) => o.payment_status === 'proof_submitted').length;
  const awaiting = orders.filter((o) => o.payment_status === 'pending').length;
  const activeProducts = detail.products.filter((p) => p.is_active).length;
  const isStore = site.site_mode !== 'forum';
  const link = `${origin}/forums/${site.slug}`;
  const [copied, setCopied] = useState(false);
  const accent = site.accent_color || '#1a73e8';
  const adsOn = (site as Site & { plugins?: Record<string, unknown> }).plugins?.catalogue === true;

  const top = useMemo(() => {
    const m = new Map<string, { title: string; qty: number; revenue: number }>();
    paid.forEach((o) => o.items.forEach((i) => {
      const cur = m.get(i.product_id) || { title: i.title, qty: 0, revenue: 0 };
      cur.qty += i.qty; cur.revenue += i.qty * Number(i.price);
      m.set(i.product_id, cur);
    }));
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [paid]);

  const steps = [
    { done: !isStore || detail.products.length > 0, label: `Add your first ${itemLabels(site.template_id)[0].toLowerCase()}`, tab: 'products' as TabKey, show: isStore },
    { done: !!site.bank_account_number || !!site.whatsapp_number, label: 'Tell buyers how to reach or pay you', tab: 'settings' as TabKey, show: isStore },
    { done: detail.products.some((p) => !!p.image_url), label: 'Add a photo to a product', tab: 'products' as TabKey, show: isStore },
    { done: !!site.logo_url, label: 'Add your logo', tab: 'settings' as TabKey, show: true },
    { done: !!site.hero_headline && site.hero_headline.trim().length > 3, label: 'Write your own welcome headline', tab: 'settings' as TabKey, show: true },
    { done: site.is_public, label: 'Make your site visible', tab: 'settings' as TabKey, show: true },
  ].filter((s) => s.show);
  const doneCount = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 100;
  const shareText = encodeURIComponent(`Check out ${site.name}: ${link}`);
  const limit = PLANS[tier].maxProducts;
  const shown = link.replace(/^https?:\/\//, '');

  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };

  const actions: { Icon: typeof Package; label: string; tab: TabKey }[] = [
    ...(isStore
      ? [{ Icon: Plus, label: `Add ${itemLabels(site.template_id)[0].toLowerCase()}`, tab: 'products' as TabKey }, { Icon: ShoppingBag, label: 'See orders', tab: 'orders' as TabKey }]
      : [{ Icon: MessagesSquare, label: 'Moderate posts', tab: 'community' as TabKey }]),
    { Icon: Puzzle, label: 'Plugins', tab: 'plugins' as TabKey },
    { Icon: SettingsIcon, label: 'Settings', tab: 'settings' as TabKey },
  ];

  return (
    <div className="space-y-6">
      {detail.ads.filter((a) => a.placement === 'banner').slice(0, 1).map((a) => {
        const body = (
          <div className="g-tonal px-5 py-4 flex items-center gap-4">
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-secondary">Sponsored</p>
              <p className="font-medium truncate">{a.title}</p>
              {a.body && <p className="text-sm text-secondary truncate">{a.body}</p>}
            </div>
          </div>
        );
        return a.link_url
          ? <a key={a.id} href={a.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">{body}</a>
          : <div key={a.id}>{body}</div>;
      })}

      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}c0 60%, ${accent}90)` }}>
        <div className="absolute -right-12 -top-12 w-60 h-60 rounded-full bg-white/10" />
        <div className="absolute right-10 -bottom-16 w-44 h-44 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-white/80 text-sm">Welcome back</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1 truncate">{site.name}</h2>
            <p className="font-mono text-sm text-white/85 mt-2 break-all">{shown}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="h-10 px-4 rounded-full bg-white text-black text-sm font-medium inline-flex items-center gap-2">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy link'}</button>
            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="h-10 px-4 rounded-full bg-black/25 hover:bg-black/35 text-white text-sm font-medium inline-flex items-center gap-2"><Share2 className="w-4 h-4" /> Share on WhatsApp</a>
          </div>
        </div>
      </section>

      {needsCheck > 0 && (
        <button onClick={() => go('orders')} className="w-full text-left g-tonal p-4 flex items-center justify-between gap-3 rounded-2xl">
          <span className="font-medium">{needsCheck} {needsCheck === 1 ? 'payment' : 'payments'} to check</span>
          <span className="text-sm text-accent font-medium inline-flex items-center gap-1">Review orders <ChevronRight className="w-4 h-4" /></span>
        </button>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isStore ? (
          <>
            <Stat Icon={Wallet} label="Money received" value={formatMoney(revenue, site.currency)} tone={accent} />
            <Stat Icon={ShoppingBag} label="Orders" value={String(orders.length)} sub={awaiting > 0 ? `${awaiting} awaiting payment` : undefined} tone={accent} />
            <Stat Icon={Package} label={`${itemLabels(site.template_id)[1]} live`} value={String(activeProducts)} sub={limit ? `${detail.products.length} of ${limit} used` : `${detail.products.length} in total`} tone={accent} />
            <Stat Icon={Users} label="Members" value={String(site.member_count)} tone={accent} />
          </>
        ) : (
          <>
            <Stat Icon={Users} label="Members" value={String(site.member_count)} tone={accent} />
            <Stat Icon={MessagesSquare} label="Discussions" value={String(detail.threads.length)} tone={accent} />
            <Stat Icon={Gem} label="Plan" value={PLANS[tier].name} tone={accent} />
            <Stat Icon={Eye} label="Visibility" value={site.is_public ? 'Public' : 'Hidden'} tone={accent} />
          </>
        )}
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((a) => (
          <button key={a.label} onClick={() => go(a.tab)} className="g-card p-4 flex items-center gap-3 text-left hover:shadow-md transition">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: accent }}><a.Icon className="w-4 h-4" /></span>
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6 min-w-0">
          <AnalyticsCard site={site} goToPlan={() => go('plan')} />
          {isStore && (
            <section className="g-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Latest orders</h3>
                <button onClick={() => go('orders')} className="text-sm text-accent font-medium hover:underline">See all</button>
              </div>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <span className="mx-auto w-12 h-12 rounded-full g-tonal-strong flex items-center justify-center mb-3"><ShoppingBag className="w-5 h-5 text-secondary" /></span>
                  <p className="text-sm text-secondary">No orders yet. Share your link to get started.</p>
                </div>
              ) : (
                <ul className="divide-y divide-theme">
                  {orders.slice(0, 5).map((o) => (
                    <li key={o.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate"><span className="font-medium">{o.order_code}</span> <span className="text-secondary">· {o.buyer_name}</span></span>
                      <span className="shrink-0 text-right"><span className="font-medium">{formatMoney(o.total_amount, site.currency)}</span> <span className="text-secondary">· {o.payment_status.replace('_', ' ')}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {isStore && top.length > 0 && (
            <section className="g-card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" style={{ color: accent }} /> Best sellers</h3>
              <ul className="divide-y divide-theme">
                {top.map((t) => (
                  <li key={t.title} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{t.title}</span>
                    <span className="text-secondary shrink-0">{t.qty} sold · {formatMoney(t.revenue, site.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <section className="g-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Setup</h3>
              <span className="text-sm text-secondary">{doneCount} of {steps.length}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary/60 mt-3 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} /></div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'text-white' : 'border border-theme'}`} style={s.done ? { background: accent } : undefined}>{s.done && <Check className="w-3 h-3" />}</span>
                  {s.done ? <span className="text-secondary line-through">{s.label}</span> : <button onClick={() => go(s.tab)} className="text-left hover:text-accent">{s.label}</button>}
                </li>
              ))}
            </ul>
          </section>

          <ShareCard name={site.name} link={link} accent={accent} />

          {isStore && !adsOn && (
            <section className="g-tonal p-5 rounded-2xl">
              <h3 className="font-semibold">Advertising your business?</h3>
              <p className="text-sm text-secondary mt-1">Switch on Advertise mode and visitors tap to order on WhatsApp instead of using a cart. No payment setup needed.</p>
              <button onClick={() => go('plugins')} className="mt-3 text-sm font-medium text-accent hover:underline">Open plugins</button>
            </section>
          )}

          {isStore && <StoreQrCard site={site} />}
          {isStore && <CartsLeftCard site={site} goToPlan={() => go('plan')} />}

          {isStore && tier === 'free' && (
            <section className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}b0)` }}>
              <h3 className="font-semibold flex items-center gap-2"><Gem className="w-4 h-4" /> Grow with Pro</h3>
              <p className="text-sm text-white/90 mt-2">
                {detail.products.length} of {PLANS.free.maxProducts} free {itemLabels(site.template_id)[1].toLowerCase()} used. Pro gives you unlimited items, a business card with opening hours and a call button, premium themes included, your own domain and no platform ads for {'₦'}{PLANS.pro.priceNgn.toLocaleString('en-NG')} a month.
              </p>
              <p className="text-xs text-white/75 mt-2">{PRUNE_NOTICE}</p>
              <button onClick={() => go('plan')} className="mt-4 text-sm font-medium px-5 h-10 rounded-full bg-white text-black">See plans</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ Icon, label, value, sub, tone }: { Icon: typeof Package; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="g-card p-5">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${tone}1f`, color: tone }}><Icon className="w-[18px] h-[18px]" /></span>
      <p className="text-sm text-secondary">{label}</p>
      <p className="text-2xl font-semibold mt-0.5 break-words">{value}</p>
      {sub && <p className="text-xs text-secondary mt-1">{sub}</p>}
    </div>
  );
}
