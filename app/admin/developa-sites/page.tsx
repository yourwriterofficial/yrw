'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Check, Store } from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { formatMoney, type ForumSummary } from '@/lib/forums';

interface AdminSiteRow extends ForumSummary {
  owner_name: string;
  total_products: number;
  total_orders: number;
  total_gmv: number;
}

export default function AdminDevelopaSitesPage() {
  const [sites, setSites] = useState<AdminSiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/developa-sites');
      const data = await res.json();
      if (res.ok) setSites(data.sites || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      await loadSites();
    })();
    return () => { active = false; };
  }, [loadSites]);

  const handleToggleActive = async (site: AdminSiteRow) => {
    const res = await fetch('/api/admin/developa-sites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: site.id, is_public: !site.is_public }),
    });
    if (res.ok) {
      setFeedback(`Updated ${site.name}`);
      loadSites();
    }
  };

  const handleSetPlan = async (site: AdminSiteRow, plan_tier: 'free' | 'pro') => {
    const res = await fetch('/api/admin/developa-sites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: site.id, plan_tier }),
    });
    if (res.ok) {
      setFeedback(`Updated plan for ${site.name} to ${plan_tier.toUpperCase()}`);
      loadSites();
    }
  };

  const totalGmv = sites.reduce((sum, s) => sum + s.total_gmv, 0);
  const totalOrders = sites.reduce((sum, s) => sum + s.total_orders, 0);
  const totalProducts = sites.reduce((sum, s) => sum + s.total_products, 0);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Developa SaaS Sites"
        description="Oversee all user stores, community forums, orders, and custom domains."
        breadcrumb="Admin / Developa Sites"
        icon={<Store className="w-8 h-8 text-cyan-400" />}
      />

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4" /> {feedback}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-xs text-secondary font-semibold">Total Sites</p>
          <p className="text-2xl font-black text-primary mt-1">{sites.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-secondary font-semibold">Total Listed Products</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{totalProducts}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-secondary font-semibold">Platform Orders Placed</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{totalOrders}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-secondary font-semibold">Total Platform GMV</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{formatMoney(totalGmv)}</p>
        </Card>
      </div>

      {/* Sites Table */}
      <div className="bg-card border border-theme rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-theme flex items-center justify-between">
          <h2 className="font-bold text-sm text-primary">All Active Sites</h2>
          <Button variant="secondary" onClick={loadSites}>Refresh</Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-secondary">Loading sites...</div>
        ) : sites.length === 0 ? (
          <div className="p-8 text-center text-xs text-secondary">No sites created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-primary/60 border-b border-theme text-secondary font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Site & Handle</th>
                  <th className="p-3.5">Owner</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5">Custom Domain</th>
                  <th className="p-3.5">Products</th>
                  <th className="p-3.5">Orders</th>
                  <th className="p-3.5">GMV</th>
                  <th className="p-3.5">Plan</th>
                  <th className="p-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {sites.map((s) => (
                  <tr key={s.id} className="hover:bg-primary/40 transition">
                    <td className="p-3.5">
                      <p className="font-bold text-primary">{s.name}</p>
                      <a
                        href={`https://${s.slug}.developa.me`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        {s.slug}.developa.me <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                    <td className="p-3.5 text-secondary">{s.owner_name}</td>
                    <td className="p-3.5">
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary/30">
                        {s.site_mode || 'forum'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-secondary">
                      {s.custom_domain ? (
                        <span className="text-emerald-400 font-semibold">{s.custom_domain}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3.5 font-bold">{s.total_products}</td>
                    <td className="p-3.5 font-bold">{s.total_orders}</td>
                    <td className="p-3.5 font-black text-amber-400">{formatMoney(s.total_gmv, s.currency || 'NGN')}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        s.plan_tier === 'pro' ? 'bg-amber-500/20 text-amber-400' : 'bg-secondary/30 text-secondary'
                      }`}>
                        {s.plan_tier || 'free'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => handleSetPlan(s, s.plan_tier === 'pro' ? 'free' : 'pro')}
                        >
                          {s.plan_tier === 'pro' ? 'Downgrade' : 'Set Pro'}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleToggleActive(s)}
                        >
                          {s.is_public ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
