'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import StatusBadge from '@/app/components/ui/StatusBadge';
import { DashboardSkeleton } from '@/app/components/ui/Skeleton';

const formatNaira = (amount: number) => '₦' + Math.round(amount).toLocaleString('en-NG');

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingBriefs: 0,
    completedOrders: 0,
    totalValue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Counts and the value sum are computed server-side (head counts +
      // the health_dashboard view) instead of downloading every order row
      // just to tally 4 numbers — recentOrders is the only row data needed.
      const [
        { count: totalOrders },
        { count: pendingBriefs },
        { count: completedOrders },
        { data: health },
        { data: recent },
      ] = await Promise.all([
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }),
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }).eq('Workflow Status', 'Briefing Received'),
        supabase.from('admin_orders_view').select('*', { count: 'exact', head: true }).eq('Workflow Status', 'Completed'),
        supabase.from('health_dashboard').select('total_value').single(),
        supabase.from('admin_orders_view').select('*').order('Timestamp', { ascending: false }).limit(5),
      ]);

      setStats({
        totalOrders: totalOrders || 0,
        pendingBriefs: pendingBriefs || 0,
        completedOrders: completedOrders || 0,
        totalValue: Number(health?.total_value) || 0,
      });
      setRecentOrders(recent || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <DashboardSkeleton stats={4} rows={5} />;

  return (
    <div className="p-6 md:p-10 max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Overview of orders, pipeline value, and recent activity."
        breadcrumb="Admin / Dashboard"
        icon={<lucide.LayoutDashboard className="w-8 h-8 text-purple-500" />}
        actions={
          <Link href="/admin/orders" className="btn-secondary flex items-center gap-2">
            <lucide.Database className="w-4 h-4" /> Manage Orders
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Orders" value={stats.totalOrders} icon={<lucide.Layers className="w-5 h-5" />} />
        <StatCard label="Awaiting Brief" value={stats.pendingBriefs} color="text-purple-400" icon={<lucide.Clock className="w-5 h-5" />} />
        <StatCard label="Completed" value={stats.completedOrders} color="text-emerald-400" icon={<lucide.CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Pipeline Value" value={formatNaira(stats.totalValue)} icon={<lucide.Banknote className="w-5 h-5" />} />
      </div>

      <div className="bg-card border border-theme rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-black text-primary">Recent Orders</h2>
          <Link href="/admin/orders" className="text-purple-400 text-sm font-bold hover:text-purple-300 transition">
            View All →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="empty-state py-8">
            <lucide.Inbox className="w-10 h-10 text-secondary mx-auto mb-3" />
            <p className="text-secondary text-sm">No orders yet.</p>
          </div>
        ) : (
          <div className="space-y-1 table-row-hover">
            {recentOrders.map((order) => (
              <div
                key={order['Order ID']}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme py-4 last:border-0"
              >
                <div>
                  <span className="font-mono text-sm font-bold text-primary">{order['Order ID']}</span>
                  <div className="text-xs text-secondary mt-0.5">{order['Legal Name']}</div>
                </div>
                <StatusBadge status={order['Workflow Status']} />
                <div className="font-mono text-sm font-bold text-primary">
                  {formatNaira(parseFloat(order['Financial Quote']) || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-primary',
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-card border border-theme rounded-2xl p-5">
      <div className={`p-2 rounded-lg bg-secondary border border-theme inline-flex mb-3 ${color}`}>
        {icon}
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-secondary uppercase tracking-widest font-bold mt-1">{label}</div>
    </div>
  );
}
