'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import { isValidPermalink, slugifyPermalink } from '@/lib/permalink';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

type Withdrawal = {
  id: number;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
};

export default function AffiliateTab({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [permalink, setPermalink] = useState('');
  const [permalinkInput, setPermalinkInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalReferred, setTotalReferred] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [minWithdrawal, setMinWithdrawal] = useState(1000);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [copied, setCopied] = useState(false);

  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: profile }, { data: wallet }, { data: referrals }, { data: settings }, { data: wd }] = await Promise.all([
      supabase.from('profiles').select('permalink').eq('id', user.id).maybeSingle(),
      supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('referrals').select('commission_earned').eq('referrer_id', user.id),
      supabase.from('affiliate_settings').select('min_withdrawal').eq('key', 'default').maybeSingle(),
      supabase.from('withdrawals').select('id, amount, status, requested_at, processed_at').eq('user_id', user.id).order('requested_at', { ascending: false }),
    ]);

    setPermalink(profile?.permalink || '');
    setPermalinkInput(profile?.permalink || '');
    setWalletBalance(Number(wallet?.balance) || 0);
    setTotalReferred(referrals?.length || 0);
    setTotalEarned((referrals || []).reduce((acc: number, r: any) => acc + Number(r.commission_earned), 0));
    setMinWithdrawal(Number(settings?.min_withdrawal) || 1000);
    setWithdrawals((wd as Withdrawal[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const referralLink = permalink && typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${permalink}` : '';

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveUsername = async () => {
    const clean = slugifyPermalink(permalinkInput);
    if (!isValidPermalink(clean)) {
      showToast('Username must be 3-30 letters, numbers, or hyphens.', 'error');
      return;
    }
    setSavingUsername(true);
    const { error } = await supabase.from('profiles').update({ permalink: clean }).eq('id', user.id);
    setSavingUsername(false);
    if (error) {
      showToast(error.code === '23505' ? 'That username is already taken.' : error.message, 'error');
      return;
    }
    setPermalink(clean);
    setPermalinkInput(clean);
    showToast('Username updated!', 'success');
  };

  const requestWithdrawal = async () => {
    const numericAmount = Number(amount);
    if (!(numericAmount > 0)) {
      showToast('Enter a valid amount.', 'error');
      return;
    }
    if (numericAmount < minWithdrawal) {
      showToast(`Minimum withdrawal is ${naira(minWithdrawal)}.`, 'error');
      return;
    }
    if (numericAmount > walletBalance) {
      showToast('Insufficient wallet balance.', 'error');
      return;
    }
    if (!bank.trim() || !accountNumber.trim() || !accountName.trim()) {
      showToast('Fill in your bank name, account number, and account name.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/client/request-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, bank, accountNumber, accountName }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Withdrawal request failed.', 'error');
      } else {
        showToast('Withdrawal requested! We\'ll process it shortly.', 'success');
        setAmount(''); setBank(''); setAccountNumber(''); setAccountName('');
        load();
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-primary flex items-center gap-3">
          <lucide.Coins className="text-purple-500 w-8 h-8" /> Affiliate Program
        </h2>
        <p className="text-secondary mt-1 text-sm">Share your link, earn commission on every order your referrals pay for.</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Wallet Balance</span>
          <h3 className="text-2xl font-black text-primary mt-1">{naira(walletBalance)}</h3>
        </Card>
        <Card padding="sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Total Earned</span>
          <h3 className="text-2xl font-black text-emerald-500 mt-1">{naira(totalEarned)}</h3>
        </Card>
        <Card padding="sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-secondary">People Referred</span>
          <h3 className="text-2xl font-black text-primary mt-1">{totalReferred}</h3>
        </Card>
      </div>

      {/* Referral link + username */}
      <Card padding="lg" className="space-y-5">
        <h3 className="text-sm font-black text-primary uppercase tracking-wider border-b border-theme pb-3">Your Referral Link</h3>

        <div>
          <label className="text-[10px] uppercase font-black text-secondary block mb-1.5">Username (also your referral code)</label>
          <div className="flex gap-2">
            <input
              value={permalinkInput}
              onChange={e => setPermalinkInput(e.target.value.toLowerCase())}
              className="flex-1 bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-bold focus:border-purple-500 outline-none"
              placeholder="yourname"
            />
            <button
              onClick={saveUsername}
              disabled={savingUsername || slugifyPermalink(permalinkInput) === permalink}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-40"
            >
              {savingUsername ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {referralLink && (
          <div>
            <label className="text-[10px] uppercase font-black text-secondary block mb-1.5">Share this link</label>
            <div className="flex gap-2">
              <input readOnly value={referralLink} className="flex-1 bg-secondary border border-theme rounded-xl p-3 text-xs text-primary font-mono" />
              <Button variant="secondary" size="sm" className="shrink-0" onClick={copyLink} icon={copied ? <lucide.Check className="w-3.5 h-3.5 text-emerald-500" /> : <lucide.Copy className="w-3.5 h-3.5" />}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Withdraw */}
      <Card padding="lg" className="space-y-4">
        <h3 className="text-sm font-black text-primary uppercase tracking-wider border-b border-theme pb-3">Request a Payout</h3>
        <p className="text-xs text-secondary">Minimum withdrawal is {naira(minWithdrawal)}. Funds are deducted from your wallet immediately once requested.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Amount (min ${naira(minWithdrawal)})`}
            className="bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none"
          />
          <input
            value={bank}
            onChange={e => setBank(e.target.value)}
            placeholder="Bank name"
            className="bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none"
          />
          <input
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            placeholder="Account number"
            className="bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none"
          />
          <input
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="Account name"
            className="bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none"
          />
        </div>
        <button
          onClick={requestWithdrawal}
          disabled={submitting}
          className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-black uppercase text-xs tracking-wider rounded-xl transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Request Withdrawal'}
        </button>
      </Card>

      {/* History */}
      <Card padding="lg" className="space-y-4">
        <h3 className="text-sm font-black text-primary uppercase tracking-wider border-b border-theme pb-3">Payout History</h3>
        {withdrawals.length === 0 ? (
          <div className="empty-state">
            <lucide.Wallet className="w-10 h-10 text-secondary mx-auto mb-3" />
            <p className="text-secondary text-sm">No payout requests yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {withdrawals.map(w => (
              <div key={w.id} className="flex justify-between items-center border-b border-theme py-3 last:border-0">
                <div>
                  <div className="font-black text-primary">{naira(w.amount)}</div>
                  <div className="text-[10px] text-secondary">{new Date(w.requested_at).toLocaleString()}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                  w.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400'
                  : w.status === 'rejected' ? 'bg-red-500/10 text-red-400'
                  : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
