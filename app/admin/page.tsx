'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import * as lucide from 'lucide-react';

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');

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
      const { data: orders } = await supabase.from('admin_orders_view').select('*');
      if (!orders) return;
      const totalOrders = orders.length;
      const pendingBriefs = orders.filter(o => o['Workflow Status'] === 'Briefing Received').length;
      const completedOrders = orders.filter(o => o['Workflow Status'] === 'Completed').length;
      const totalValue = orders.reduce((sum, o) => sum + (parseFloat(o['Financial Quote']) || 0), 0);
      setStats({ totalOrders, pendingBriefs, completedOrders, totalValue });
      setRecentOrders(orders.slice(0, 5));
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-10 text-center text-primary">Loading dashboard...</div>;

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-3xl font-black text-primary mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-theme rounded-2xl p-6"><div className="text-2xl font-black text-primary">{stats.totalOrders}</div><div className="text-xs text-secondary">Total Orders</div></div>
        <div className="bg-card border border-theme rounded-2xl p-6"><div className="text-2xl font-black text-purple-400">{stats.pendingBriefs}</div><div className="text-xs text-secondary">Awaiting Brief</div></div>
        <div className="bg-card border border-theme rounded-2xl p-6"><div className="text-2xl font-black text-emerald-400">{stats.completedOrders}</div><div className="text-xs text-secondary">Completed</div></div>
        <div className="bg-card border border-theme rounded-2xl p-6"><div className="text-2xl font-black text-primary">{formatNaira(stats.totalValue)}</div><div className="text-xs text-secondary">Pipeline Value</div></div>
      </div>

      <div className="bg-card border border-theme rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-black text-primary">Recent Orders</h2><Link href="/admin/orders" className="text-purple-400 text-sm">View All</Link></div>
        <div className="space-y-2">
          {recentOrders.map(order => (
            <div key={order['Order ID']} className="flex justify-between items-center border-b border-theme py-3">
              <div><span className="font-mono text-sm text-primary">{order['Order ID']}</span><div className="text-xs text-secondary">{order['Legal Name']}</div></div>
              <div><span className={`text-xs px-2 py-1 rounded ${order['Workflow Status'] === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{order['Workflow Status']}</span></div>
              <div className="font-mono text-sm text-primary">{formatNaira(parseFloat(order['Financial Quote']) || 0)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}