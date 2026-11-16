'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import StatusBadge from '@/app/components/ui/StatusBadge';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { DataTable } from '@/app/components/ui/DataTable';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { DashboardSkeleton } from '@/app/components/ui/Skeleton';

const formatNaira = (amount: number) => '₦' + Math.round(amount).toLocaleString('en-NG');

interface Todo { n: number; label: string; hint: string; href: string; icon: typeof lucide.Inbox; tone: 'accent' | 'warning' | 'danger' | 'info' }

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalOrders: 0, pendingBriefs: 0, completedOrders: 0, totalValue: 0, newQuotes: 0, quoteSent: 0, unread: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Counts and the value sum are computed server-side (head counts + the health_dashboard view)
      // instead of downloading every order row just to tally a few numbers.
      const [
        { count: totalOrders },
        { count: pendingBriefs },
        { count: completedOrders },
        { count: quoteSent },
        { count: newQuotes },
        { data: health },
        { data: recent },
        inbox,
      ] = await Promise.all([
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }),
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }).eq('Workflow Status', 'Briefing Received'),
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }).eq('Workflow Status', 'Completed'),
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }).eq('Workflow Status', 'Quote Sent'),
        supabase.from('quote_requests').select('*', { count: 'exact', head: true }).eq('status', 'NEW'),
        supabase.from('health_dashboard').select('total_value').single(),
        supabase.from('admin_orders_view').select('*').order('Timestamp', { ascending: false }).limit(6),
        fetch('/api/admin/inbox/threads?limit=1&status=open').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      setStats({
        totalOrders: totalOrders || 0,
        pendingBriefs: pendingBriefs || 0,
        completedOrders: completedOrders || 0,
        totalValue: Number(health?.total_value) || 0,
        newQuotes: newQuotes || 0,
        quoteSent: quoteSent || 0,
        unread: Number(inbox?.counts?.yourwriter?.unread) || 0,
      });
      setRecentOrders(recent || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <DashboardSkeleton stats={4} rows={5} />;

  const todos: Todo[] = [
    { n: stats.newQuotes, label: 'New quote requests', hint: 'Reply by email or WhatsApp', href: '/admin/quote-requests', icon: lucide.Inbox, tone: 'accent' },
    { n: stats.pendingBriefs, label: 'Orders awaiting a brief', hint: 'Review the brief and send a quote', href: '/admin/orders', icon: lucide.Clock, tone: 'warning' },
    { n: stats.quoteSent, label: 'Quotes waiting for payment', hint: 'Follow up with the client', href: '/admin/orders', icon: lucide.Banknote, tone: 'info' },
    { n: stats.unread, label: 'Unread support messages', hint: 'YourResearchWriter inbox', href: '/admin/inbox', icon: lucide.Mail, tone: 'danger' },
  ];
  const toneClass = (t: Todo['tone'], calm: boolean) =>
    calm ? 'bg-secondary text-secondary'
      : t === 'danger' ? 'bg-danger/10 text-danger'
      : t === 'warning' ? 'bg-warning/10 text-warning'
      : t === 'info' ? 'bg-info/10 text-info'
      : 'bg-accent/10 text-accent';

  const quick = [
    { href: '/admin/orders', label: 'Manage orders', icon: lucide.Database },
    { href: '/admin/invoices', label: 'Invoices', icon: lucide.FileSpreadsheet },
    { href: '/admin/finance', label: 'Finance', icon: lucide.Wallet },
    { href: '/admin/users', label: 'Users', icon: lucide.Users },
    { href: '/admin/email', label: 'Send an email', icon: lucide.Send },
    { href: 'https://developa.me/admin/developa', label: 'Developa admin (separate)', icon: lucide.Globe },
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl space-y-8">
      <PageHeader
        title="Dashboard"
        description="What needs you today, and how the business is doing."
        breadcrumb="Admin / Dashboard"
        icon={<lucide.LayoutDashboard className="w-8 h-8 text-accent" />}
        actions={
          <Button variant="secondary" href="/admin/orders" icon={<lucide.Database className="w-4 h-4" />}>
            Manage Orders
          </Button>
        }
      />

      <section>
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">Needs your attention</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {todos.map((t) => {
            const Icon = t.icon;
            const calm = t.n === 0;
            return (
              <Link key={t.label} href={t.href} className="g-card p-5 flex items-center gap-4 hover:border-accent/50 transition group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${toneClass(t.tone, calm)}`}><Icon className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-black leading-none">{t.n}</p>
                  <p className="text-sm font-semibold mt-1">{t.label}</p>
                  <p className="text-xs text-secondary">{calm ? 'All clear' : t.hint}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total orders', value: String(stats.totalOrders), icon: lucide.Layers },
          { label: 'Completed', value: String(stats.completedOrders), icon: lucide.CheckCircle2 },
          { label: 'Pipeline value', value: formatNaira(stats.totalValue), icon: lucide.Banknote },
          { label: 'Awaiting brief', value: String(stats.pendingBriefs), icon: lucide.Clock },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="g-card p-5">
              <div className="flex items-center gap-2 text-secondary"><Icon className="w-4 h-4" /><p className="text-xs font-semibold">{s.label}</p></div>
              <p className="text-2xl font-black mt-2 tracking-tight">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <Card padding="lg" header={
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-primary">Recent orders</h2>
            <Button variant="ghost" size="sm" href="/admin/orders" icon={<lucide.ArrowRight className="w-4 h-4" />} iconPosition="right">
              View all
            </Button>
          </div>
        }>
          {recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders will appear here once clients begin checkout." />
          ) : (
            <DataTable
              rows={recentOrders}
              rowKey={(order) => order['Order ID']}
              columns={[
                {
                  key: 'id',
                  header: 'Order',
                  cell: (order) => (
                    <div>
                      <span className="font-mono text-sm font-bold text-primary">{order['Order ID']}</span>
                      <div className="text-xs text-secondary mt-0.5">{order['Legal Name']}</div>
                    </div>
                  ),
                },
                { key: 'status', header: 'Status', cell: (order) => <StatusBadge status={order['Workflow Status']} /> },
                { key: 'value', header: 'Quote', align: 'right', cell: (order) => <span className="font-mono text-sm font-bold text-primary">{formatNaira(parseFloat(order['Financial Quote']) || 0)}</span> },
              ]}
            />
          )}
        </Card>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-wider">Quick links</h2>
          {quick.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.href} href={a.href} className="g-card px-4 py-3 flex items-center gap-3 hover:border-accent/50 transition text-sm font-semibold">
                <Icon className="w-4 h-4 text-accent" /> {a.label} <lucide.ArrowRight className="w-4 h-4 ml-auto text-secondary" />
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
