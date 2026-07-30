'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import StatusBadge from '@/app/components/ui/StatusBadge';
import StatCard from '@/app/components/ui/StatCard';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { DataTable } from '@/app/components/ui/DataTable';
import { EmptyState } from '@/app/components/ui/EmptyState';
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
        icon={<lucide.LayoutDashboard className="w-8 h-8 text-accent" />}
        actions={
          <Button variant="secondary" href="/admin/orders" icon={<lucide.Database className="w-4 h-4" />}>
            Manage Orders
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Orders" value={stats.totalOrders} icon={<lucide.Layers className="w-5 h-5" />} />
        <StatCard label="Awaiting Brief" value={stats.pendingBriefs} color="text-accent" icon={<lucide.Clock className="w-5 h-5" />} />
        <StatCard label="Completed" value={stats.completedOrders} color="text-emerald-400" icon={<lucide.CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Pipeline Value" value={formatNaira(stats.totalValue)} icon={<lucide.Banknote className="w-5 h-5" />} />
      </div>

      <Card padding="lg" header={
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-black text-primary">Recent Orders</h2>
          <Button variant="ghost" size="sm" href="/admin/orders" icon={<lucide.ArrowRight className="w-4 h-4" />} iconPosition="right">
            View All
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
    </div>
  );
}
