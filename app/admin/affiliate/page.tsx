'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

export default function AdminAffiliatePage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pending' | 'done' | 'all'>('pending');

  // Settings
  const [commission, setCommission] = useState(10);
  const [minWithdrawal, setMinWithdrawal] = useState(1000);
  const [savingSettings, setSavingSettings] = useState(false);

  // Withdrawals list
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalReferred: 0, totalCommissions: 0, pendingPayouts: 0 });

  const fetchAffiliateData = async () => {
    setLoading(true);
    try {
      // 1. Fetch settings
      const { data: settingsData } = await supabase
        .from('affiliate_settings')
        .select('*')
        .eq('key', 'default')
        .maybeSingle();

      if (settingsData) {
        setCommission(Number(settingsData.commission_percent));
        setMinWithdrawal(Number(settingsData.min_withdrawal));
      }

      // 2. Fetch withdrawals list
      const { data: wData, error: wErr } = await supabase
        .from('withdrawals')
        .select('*, profiles(email, full_name)')
        .order('requested_at', { ascending: false });

      if (wErr) throw wErr;
      setWithdrawals(wData || []);

      // 3. Fetch referrals aggregates
      const { data: refData } = await supabase
        .from('referrals')
        .select('commission_earned');
      
      const totalEarned = (refData || []).reduce((acc, r) => acc + Number(r.commission_earned), 0);
      const pendingCount = (wData || []).filter(w => w.status === 'pending').length;

      setStats({
        totalReferred: refData?.length || 0,
        totalCommissions: totalEarned,
        pendingPayouts: pendingCount
      });
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error fetching affiliate details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('affiliate_settings')
        .upsert({
          key: 'default',
          commission_percent: commission,
          min_withdrawal: minWithdrawal,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      showToast('Affiliate configurations updated successfully', 'success');
      fetchAffiliateData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleWithdrawalAction = async (id: number, status: 'approved' | 'rejected') => {
    if (!confirm(`Are you sure you want to ${status} this withdrawal?${status === 'rejected' ? ' The amount will be refunded to the client\'s wallet.' : ''}`)) return;

    try {
      const res = await fetch('/api/admin/process-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      showToast(`Withdrawal successfully marked as ${status}`, 'success');
      fetchAffiliateData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Action failed', 'error');
    }
  };

  const shown = withdrawals.filter((w) => (view === 'all' ? true : view === 'pending' ? w.status === 'pending' : w.status !== 'pending'));
  const naira = (n: number) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');

  return (
    <div className="p-6 md:p-10 max-w-6xl space-y-6">
      <PageHeader
        title="Affiliates and payouts"
        description="Clients earn commission when people they refer pay. Review payout requests here and set the rules."
        icon={<lucide.Coins className="w-7 h-7 text-accent" />}
        actions={
          <button onClick={fetchAffiliateData} className="h-10 px-4 rounded-xl border border-theme hover:bg-hover text-sm font-medium inline-flex items-center gap-2">
            <lucide.RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {loading ? (
        <div className="py-20 text-center text-sm text-secondary flex items-center justify-center gap-2">
          <lucide.Loader2 className="w-5 h-5 animate-spin text-accent" /> Loading details...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Payouts to review', value: String(stats.pendingPayouts), tone: stats.pendingPayouts ? 'text-warning' : '' },
              { label: 'Commission earned', value: naira(stats.totalCommissions), tone: '' },
              { label: 'Referrals', value: String(stats.totalReferred), tone: '' },
            ].map((x) => (
              <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
                <p className="text-xs font-semibold text-secondary truncate">{x.label}</p>
                <p className={`text-xl font-black mt-1 tabular-nums whitespace-nowrap truncate ${x.tone}`}>{x.value}</p>
              </div>
            ))}
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
            {/* Payout requests */}
            <section className="bg-card border border-theme rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-theme flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">Payout requests</h2>
                <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 border border-theme" role="group" aria-label="Show">
                  {([['pending', 'To review'], ['done', 'Done'], ['all', 'All']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={`h-7 px-3 rounded-md text-xs font-semibold ${view === k ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>{label}</button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <div className="py-16 text-center text-secondary">
                  <lucide.CheckCircle2 className="w-9 h-9 mx-auto opacity-40 mb-2" />
                  <p className="text-sm font-medium">{view === 'pending' ? 'Nothing to review' : 'No payout requests here'}</p>
                </div>
              ) : (
                <ul className="divide-y divide-theme">
                  {shown.map((w) => (
                    <li key={w.id} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold shrink-0">{((w.profiles?.full_name || w.profiles?.email || '?')[0] || '?').toUpperCase()}</div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold truncate">{w.profiles?.full_name || 'Client'} <span className="text-xs font-normal text-secondary">{w.profiles?.email}</span></p>
                        <p className="text-xs text-secondary break-words">{w.bank_details?.bank || 'Bank not given'} · <span className="font-mono text-primary">{w.bank_details?.accountNumber || 'N/A'}</span> · {w.bank_details?.accountName || 'N/A'}</p>
                        <p className="text-[11px] text-secondary">Requested {new Date(w.requested_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end">
                        <p className="text-lg font-black tabular-nums text-success whitespace-nowrap">{naira(w.amount)}</p>
                        {w.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleWithdrawalAction(w.id, 'rejected')} className="h-9 px-3 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 text-xs font-semibold">Reject</button>
                            <button onClick={() => handleWithdrawalAction(w.id, 'approved')} className="h-9 px-3 rounded-lg bg-success text-black hover:opacity-90 text-xs font-bold whitespace-nowrap">Approve and pay</button>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${w.status === 'approved' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{w.status}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Rules */}
            <section className="bg-card border border-theme rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-bold">Rules</h2>
                <p className="text-xs text-secondary mt-0.5">Apply to every client from now on.</p>
              </div>
              <div>
                <label htmlFor="af-pct" className="text-xs font-semibold text-secondary block mb-1">Commission (%)</label>
                <input id="af-pct" type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="w-full h-11 bg-primary border border-theme rounded-xl px-3 text-sm font-bold focus:border-accent outline-none" />
                <p className="text-[11px] text-secondary mt-1">Share of a referred client&apos;s payment paid to the referrer.</p>
              </div>
              <div>
                <label htmlFor="af-min" className="text-xs font-semibold text-secondary block mb-1">Smallest payout (₦)</label>
                <input id="af-min" type="number" value={minWithdrawal} onChange={(e) => setMinWithdrawal(Number(e.target.value))} className="w-full h-11 bg-primary border border-theme rounded-xl px-3 text-sm font-bold focus:border-accent outline-none" />
                <p className="text-[11px] text-secondary mt-1">Clients cannot request less than this.</p>
              </div>
              <button onClick={saveSettings} disabled={savingSettings} className="w-full h-11 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50">
                {savingSettings ? <lucide.Loader2 className="w-4 h-4 animate-spin" /> : null} Save rules
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
