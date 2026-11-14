'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import { formatMoney, type ForumThread, type SiteOrder, type SiteProduct } from '@/lib/forums';
import { PLANS, daysLeft, effectiveTier } from '@/lib/plans';
import { jsonFetch, type Site } from './types';
import ProductsTab from './tabs/ProductsTab';
import OrdersTab from './tabs/OrdersTab';
import CustomersTab from './tabs/CustomersTab';
import CommunityTab from './tabs/CommunityTab';
import CouponsTab from './tabs/CouponsTab';
import ShippingTab from './tabs/ShippingTab';
import DomainTab from './tabs/DomainTab';
import PlanTab from './tabs/PlanTab';
import SettingsTab from './tabs/SettingsTab';
import StoreQrCard from './StoreQrCard';
import CartsLeftCard from './CartsLeftCard';

type TabKey = 'overview' | 'products' | 'orders' | 'customers' | 'community' | 'coupons' | 'shipping' | 'domain' | 'plan' | 'settings';

const TABS: { key: TabKey; label: string; storeOnly?: boolean; forumOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products', storeOnly: true },
  { key: 'orders', label: 'Orders', storeOnly: true },
  { key: 'customers', label: 'Customers', storeOnly: true },
  { key: 'community', label: 'Community', forumOnly: true },
  { key: 'coupons', label: 'Coupons', storeOnly: true },
  { key: 'shipping', label: 'Delivery', storeOnly: true },
  { key: 'domain', label: 'Domain' },
  { key: 'plan', label: 'Plan' },
  { key: 'settings', label: 'Settings' },
];

interface Detail { forum: Site; products: SiteProduct[]; threads: ForumThread[] }

export default function ManageView() {
  const [authState, setAuthState] = useState<'checking' | 'out' | 'in'>('checking');
  const [sites, setSites] = useState<Site[]>([]);
  const [slug, setSlug] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [orders, setOrders] = useState<SiteOrder[]>([]);
  const [loadingSite, setLoadingSite] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

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
    })();
  }, []);

  // 2. Load everything about the chosen site.
  const loadSite = useCallback(async (s: string) => {
    if (!s) return;
    setLoadingSite(true);
    const [d, o] = await Promise.all([
      jsonFetch<{ forum?: Site; products?: SiteProduct[]; threads?: ForumThread[] }>(`/api/forums/${s}`),
      jsonFetch<{ orders?: SiteOrder[] }>(`/api/forums/${s}/orders`),
    ]);
    if (d.ok && d.data.forum) {
      setDetail({ forum: d.data.forum, products: d.data.products || [], threads: d.data.threads || [] });
    }
    setOrders(o.data.orders || []);
    setLoadingSite(false);
  }, []);

  useEffect(() => { if (slug) loadSite(slug); }, [slug, loadSite]);
  const reload = useCallback(async () => { await loadSite(slug); }, [loadSite, slug]);

  const site = detail?.forum;
  const visibleTabs = useMemo(
    () => TABS.filter((t) => (!t.storeOnly || site?.site_mode !== 'forum') && (!t.forumOnly || site?.site_mode !== 'store')),
    [site?.site_mode]
  );
  useEffect(() => { if (site && !visibleTabs.some((t) => t.key === tab)) setTab('overview'); }, [site, visibleTabs, tab]);

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

  return shell(
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="g-h2">Manage</h1>
          <p className="text-secondary text-sm mt-1">Your stores and communities on developa.me</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sites.length > 1 && (
            <select aria-label="Choose a site" value={slug} onChange={(e) => { setSlug(e.target.value); setTab('overview'); }} className="input-box !py-2.5 text-sm">
              {sites.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          )}
          <Link href="/developer" className="text-sm font-medium text-accent hover:underline">Create another site</Link>
        </div>
      </div>

      {!site ? (
        <p className="text-secondary text-sm">{loadingSite ? 'Loading your site…' : 'Could not load this site. Try refreshing the page.'}</p>
      ) : (
        <>
          <div className="g-card p-5 flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="font-medium text-lg truncate">{site.name}</p>
              <a href={`/forums/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-accent hover:underline break-all">
                {site.custom_domain && site.custom_domain_verified && tier !== 'free' ? site.custom_domain : `${site.slug}.developa.me`}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${tier === 'free' ? 'bg-secondary text-secondary' : 'bg-accent text-[var(--accent-foreground)]'}`}>
                {PLANS[tier].name}{tier !== 'free' && left !== null && left > 0 ? ` · ${left}d left` : ''}
              </span>
              {!site.is_public && <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--warning-bg)] text-warning">Hidden</span>}
              <a href={`/forums/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium px-4 h-9 inline-flex items-center rounded-full border border-theme hover:bg-hover">View site</a>
            </div>
          </div>

          <div role="tablist" className="flex gap-1 overflow-x-auto g-scroll-x pb-2 mb-6 border-b border-theme">
            {visibleTabs.map((t) => {
              const badge = t.key === 'orders' ? orders.filter((o) => o.payment_status === 'proof_submitted').length : 0;
              return (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                  className={`shrink-0 px-4 h-10 rounded-full text-sm font-medium transition-colors ${tab === t.key ? 'bg-accent text-[var(--accent-foreground)]' : 'text-secondary hover:bg-hover hover:text-primary'}`}>
                  {t.label}{badge > 0 && <span className="ml-2 text-xs bg-[var(--danger)] text-white rounded-full px-1.5 py-0.5">{badge}</span>}
                </button>
              );
            })}
          </div>

          {tab === 'overview' && <Overview site={site} detail={detail!} orders={orders} origin={origin} go={setTab} />}
          {tab === 'products' && <ProductsTab site={site} products={detail!.products} reload={reload} />}
          {tab === 'orders' && <OrdersTab site={site} orders={orders} reload={reload} />}
          {tab === 'customers' && <CustomersTab site={site} goToPlan={() => setTab('plan')} />}
          {tab === 'community' && <CommunityTab site={site} threads={detail!.threads} reload={reload} />}
          {tab === 'coupons' && <CouponsTab site={site} goToPlan={() => setTab('plan')} />}
          {tab === 'shipping' && <ShippingTab site={site} reload={reload} goToPlan={() => setTab('plan')} />}
          {tab === 'domain' && <DomainTab site={site} goToPlan={() => setTab('plan')} />}
          {tab === 'plan' && <PlanTab site={site} />}
          {tab === 'settings' && <SettingsTab key={site.slug + (site.name || '')} site={site} reload={reload} goToPlan={() => setTab('plan')} />}
        </>
      )}
    </>
  );
}

function Overview({ site, detail, orders, origin, go }: { site: Site; detail: Detail; orders: SiteOrder[]; origin: string; go: (t: TabKey) => void }) {
  const paid = orders.filter((o) => o.payment_status === 'paid');
  const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
  const needsCheck = orders.filter((o) => o.payment_status === 'proof_submitted').length;
  const awaiting = orders.filter((o) => o.payment_status === 'pending').length;
  const activeProducts = detail.products.filter((p) => p.is_active).length;
  const isStore = site.site_mode !== 'forum';
  const link = `${origin}/forums/${site.slug}`;
  const [copied, setCopied] = useState(false);

  // Top sellers from paid orders
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
    { done: !isStore || detail.products.length > 0, label: 'Add your first product', tab: 'products' as TabKey, show: isStore },
    { done: !!site.bank_account_number || !!site.whatsapp_number, label: 'Tell buyers how to pay you', tab: 'settings' as TabKey, show: isStore },
    { done: !!site.logo_url, label: 'Add your logo', tab: 'settings' as TabKey, show: true },
    { done: site.is_public, label: 'Make your site visible', tab: 'settings' as TabKey, show: true },
  ].filter((s) => s.show);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      {(needsCheck > 0) && (
        <button onClick={() => go('orders')} className="w-full text-left g-tonal p-4 flex items-center justify-between gap-3">
          <span className="font-medium">{needsCheck} {needsCheck === 1 ? 'payment' : 'payments'} to check</span>
          <span className="text-sm text-accent font-medium">Review orders</span>
        </button>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isStore ? (
          <>
            <Stat label="Money received" value={formatMoney(revenue, site.currency)} />
            <Stat label="Orders" value={String(orders.length)} sub={awaiting > 0 ? `${awaiting} awaiting payment` : undefined} />
            <Stat label="Products live" value={String(activeProducts)} sub={`${detail.products.length} in total`} />
            <Stat label="Members" value={String(site.member_count)} />
          </>
        ) : (
          <>
            <Stat label="Members" value={String(site.member_count)} />
            <Stat label="Discussions" value={String(detail.threads.length)} />
            <Stat label="Plan" value={PLANS[effectiveTier(site.plan_tier, site.plan_expires_at)].name} />
            <Stat label="Visibility" value={site.is_public ? 'Public' : 'Hidden'} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isStore && (
            <section className="g-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Latest orders</h3>
                <button onClick={() => go('orders')} className="text-sm text-accent font-medium hover:underline">See all</button>
              </div>
              {orders.length === 0 ? (
                <p className="text-sm text-secondary">No orders yet. Share your link to get started.</p>
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
              <h3 className="font-medium mb-3">Best sellers</h3>
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

        <div className="space-y-6">
          <section className="g-card p-5">
            <h3 className="font-medium">Share your {isStore ? 'store' : 'community'}</h3>
            <p className="text-sm font-mono break-all text-accent mt-2">{link}</p>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
              className="mt-3 text-sm font-medium px-4 h-9 rounded-full border border-theme hover:bg-hover"
            >{copied ? 'Copied' : 'Copy link'}</button>
          </section>
          {isStore && <StoreQrCard site={site} />}
          {isStore && <CartsLeftCard site={site} goToPlan={() => go('plan')} />}
          <section className="g-card p-5">
            <h3 className="font-medium">Getting started <span className="text-secondary font-normal text-sm">{doneCount}/{steps.length}</span></h3>
            <ul className="mt-3 space-y-2 text-sm">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${s.done ? 'bg-accent text-[var(--accent-foreground)]' : 'border border-theme text-transparent'}`}>✓</span>
                  {s.done ? <span className="text-secondary line-through">{s.label}</span> : <button onClick={() => go(s.tab)} className="text-left hover:text-accent">{s.label}</button>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="g-card p-5">
      <p className="text-sm text-secondary">{label}</p>
      <p className="text-2xl font-medium mt-1 break-words">{value}</p>
      {sub && <p className="text-xs text-secondary mt-1">{sub}</p>}
    </div>
  );
}
