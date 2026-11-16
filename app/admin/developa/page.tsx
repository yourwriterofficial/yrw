'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Globe, Flag, Inbox, Clock, Megaphone, Tag, ShoppingBag, Users, ArrowRight, Store, TrendingUp, Wallet } from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import { formatMoney, type ForumSummary } from '@/lib/forums';
import { PLANS, daysLeft, effectiveTier } from '@/lib/plans';

interface SiteRow extends ForumSummary { owner_name: string; total_products: number; total_orders: number; total_gmv: number; plan_expires_at?: string | null }

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export default function DevelopaOverviewPage() {
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [openReports, setOpenReports] = useState(0);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(0);
  const [received, setReceived] = useState(0);

  useEffect(() => {
    (async () => {
      const [s, r, i, p] = await Promise.all([
        get<{ sites?: SiteRow[] }>('/api/admin/developa-sites'),
        get<{ open_count?: number }>('/api/admin/developa-reports'),
        get<{ counts?: { unread: number; developa: { open: number } } }>('/api/admin/inbox/threads?limit=1&status=open'),
        get<{ payments?: { amount: number }[] }>('/api/admin/developa-sites/payments'),
      ]);
      setSites(s?.sites || []);
      setOpenReports(Number(r?.open_count) || 0);
      setUnread(Number(i?.counts?.unread) || 0);
      setOpen(Number(i?.counts?.developa?.open) || 0);
      setReceived((p?.payments || []).reduce((n, x) => n + Number(x.amount), 0));
    })();
  }, []);

  const k = useMemo(() => {
    const list = sites || [];
    const paid = list.filter((s) => effectiveTier(s.plan_tier, s.plan_expires_at) !== 'free');
    return {
      total: list.length,
      paid: paid.length,
      mrr: paid.reduce((n, s) => n + PLANS[effectiveTier(s.plan_tier, s.plan_expires_at)].priceNgn, 0),
      ending: paid.filter((s) => { const d = daysLeft(s.plan_expires_at); return d !== null && d <= 7; }).length,
      gmv: list.reduce((n, s) => n + s.total_gmv, 0),
      orders: list.reduce((n, s) => n + s.total_orders, 0),
      newest: [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6),
    };
  }, [sites]);

  const attention = [
    { n: openReports, label: 'Open reports to review', hint: 'Abuse reports from visitors', href: '/admin/developa-sites?tab=reports', icon: Flag, tone: 'danger' },
    { n: unread, label: 'Unread support messages', hint: `${open} conversations open`, href: '/admin/inbox', icon: Inbox, tone: 'accent' },
    { n: k.ending, label: 'Plans ending within 7 days', hint: 'Remind owners to renew', href: '/admin/developa-sites?tab=payments', icon: Clock, tone: 'warning' },
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <PageHeader title="Developa overview" description="How the platform is doing today, and what needs you." breadcrumb="Admin / Developa" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Store} label="Sites" value={sites ? String(k.total) : '…'} sub={`${k.paid} on a paid plan`} />
        <Stat icon={TrendingUp} label="Plan income / month" value={sites ? naira(k.mrr) : '…'} sub="from active paid plans" />
        <Stat icon={Wallet} label="Plan payments received" value={sites ? naira(received) : '…'} sub="all time" />
        <Stat icon={Globe} label="Sales across stores" value={sites ? formatMoney(k.gmv) : '…'} sub={`${k.orders} orders`} />
      </div>

      <section>
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">Needs your attention</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {attention.map((a) => {
            const Icon = a.icon;
            const calm = a.n === 0;
            return (
              <Link key={a.label} href={a.href} className="g-card p-5 flex items-center gap-4 hover:border-accent/50 transition group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${calm ? 'bg-secondary text-secondary' : a.tone === 'danger' ? 'bg-danger/10 text-danger' : a.tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'}`}><Icon className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-black leading-none">{a.n}</p>
                  <p className="text-sm font-semibold mt-1 truncate">{a.label}</p>
                  <p className="text-xs text-secondary truncate">{calm ? 'All clear' : a.hint}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-secondary group-hover:text-accent shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section className="g-card overflow-hidden">
          <div className="px-5 py-4 border-b border-theme flex items-center justify-between">
            <h2 className="font-bold">Newest sites</h2>
            <Link href="/admin/developa-sites?tab=sites" className="text-sm text-accent font-semibold hover:underline">See all</Link>
          </div>
          {!sites ? <p className="p-6 text-sm text-secondary">Loading…</p> : k.newest.length === 0 ? <p className="p-6 text-sm text-secondary">No sites yet.</p> : (
            <ul className="divide-y divide-theme">
              {k.newest.map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: /^#[0-9a-fA-F]{6}$/.test(s.accent_color || '') ? s.accent_color : '#2563eb' }}>{(s.name[0] || '?').toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-secondary truncate">{s.slug}.developa.me · {s.owner_name || 'owner'}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-theme text-secondary capitalize">{effectiveTier(s.plan_tier, s.plan_expires_at)}</span>
                  <span className="text-[11px] text-secondary hidden sm:block w-24 text-right">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-wider">Quick actions</h2>
          {[
            { href: '/admin/developa-sites?tab=announce', label: 'Send an announcement', icon: Megaphone },
            { href: '/admin/developa-sites?tab=ads', label: 'Run an ad on free sites', icon: Tag },
            { href: '/admin/inbox', label: 'Open the support inbox', icon: Inbox },
            { href: '/admin/users', label: 'Find a user', icon: Users },
            { href: '/admin/dev-shop', label: 'Manage the Script Shop', icon: ShoppingBag },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.href + a.label} href={a.href} className="g-card px-4 py-3 flex items-center gap-3 hover:border-accent/50 transition text-sm font-semibold">
                <Icon className="w-4 h-4 text-accent" /> {a.label} <ArrowRight className="w-4 h-4 ml-auto text-secondary" />
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Store; label: string; value: string; sub: string }) {
  return (
    <div className="g-card p-5">
      <div className="flex items-center gap-2 text-secondary"><Icon className="w-4 h-4" /><p className="text-xs font-semibold">{label}</p></div>
      <p className="text-2xl font-black mt-2 tracking-tight">{value}</p>
      <p className="text-xs text-secondary mt-0.5">{sub}</p>
    </div>
  );
}
