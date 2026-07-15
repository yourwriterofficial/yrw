'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';
import StatCard from '@/app/components/ui/StatCard';
import Card from '@/app/components/ui/Card';

export default function AdminAffiliatePage() {
  const [loading, setLoading] = useState(true);
  
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

  return (
    <div className="p-6 md:p-10 space-y-8">

      <PageHeader
        title="Affiliate System & Payouts"
        description="Configure referral commission rates and process client payout requests."
        breadcrumb="Admin / Affiliates"
        icon={<lucide.Coins className="w-8 h-8 text-purple-500" />}
        actions={
          <button
            onClick={fetchAffiliateData}
            className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <lucide.RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {loading ? (
        <div className="py-20 text-center text-sm text-secondary flex items-center justify-center gap-2">
          <lucide.Loader2 className="w-5 h-5 animate-spin text-purple-500" /> Loading details...
        </div>
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Commissions Handled" value={`₦${stats.totalCommissions.toLocaleString()}`} icon={<lucide.Banknote />} />
            <StatCard label="Total Referral Conversions" value={`${stats.totalReferred} referrals`} icon={<lucide.Users />} />
            <StatCard label="Pending Payout Requests" value={`${stats.pendingPayouts} pending`} color="text-purple-400" icon={<lucide.Clock />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* SETTINGS CARD */}
            <Card padding="lg" className="space-y-6 h-fit">
              <h3 className="text-sm font-black text-primary uppercase tracking-wider border-b border-theme pb-3">Affiliate Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary block mb-1">Referral Commission (%)</label>
                  <input
                    type="number"
                    value={commission}
                    onChange={e => setCommission(Number(e.target.value))}
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-bold focus:border-purple-500 outline-none"
                  />
                  <p className="text-[10px] text-secondary mt-1">Percentage of order payment paid as commission to the referrer.</p>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-secondary block mb-1">Min Withdrawal Limit (₦)</label>
                  <input
                    type="number"
                    value={minWithdrawal}
                    onChange={e => setMinWithdrawal(Number(e.target.value))}
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-bold focus:border-purple-500 outline-none"
                  />
                  <p className="text-[10px] text-secondary mt-1">Minimum wallet/affiliate payout limit required to request withdrawals.</p>
                </div>

                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-black uppercase text-xs tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingSettings ? <lucide.Loader2 className="w-4 h-4 animate-spin" /> : null} Save Config
                </button>
              </div>
            </Card>

            {/* WITHDRAWALS LIST */}
            <Card padding="lg" className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black text-primary uppercase tracking-wider border-b border-theme pb-3">Payout Requests</h3>
              
              {withdrawals.length === 0 ? (
                <div className="py-20 text-center text-xs text-secondary">No payout requests submitted yet.</div>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map(w => (
                    <div key={w.id} className="bg-secondary/40 border border-theme rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{w.profiles?.full_name || 'Client'}</span>
                          <span className="text-xs text-secondary">({w.profiles?.email})</span>
                        </div>
                        
                        <div className="text-xs space-y-1">
                          <div>Amount: <span className="font-bold text-emerald-500 font-mono">₦{Number(w.amount).toLocaleString()}</span></div>
                          <div>
                            Bank Info: <span className="font-bold text-primary">{w.bank_details?.bank || 'N/A'}</span> &middot; Acct: <span className="font-mono font-bold text-primary">{w.bank_details?.accountNumber || 'N/A'}</span> ({w.bank_details?.accountName || 'N/A'})
                          </div>
                          <div className="text-[10px] text-secondary">Submitted: {new Date(w.requested_at).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {w.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleWithdrawalAction(w.id, 'rejected')}
                              className="px-3.5 py-2 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleWithdrawalAction(w.id, 'approved')}
                              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl transition cursor-pointer"
                            >
                              Approve & Payout
                            </button>
                          </>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${w.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {w.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
