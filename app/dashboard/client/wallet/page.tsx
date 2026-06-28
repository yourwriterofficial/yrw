'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';

type WalletPageProps = {
  embedded?: boolean;
};

export default function WalletPage({ embedded = false }: WalletPageProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState(5000);
  const [processing, setProcessing] = useState(false);

  const fetchWallet = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletError) {
      setBalance(0);
    } else {
      setBalance(wallet?.balance || 0);
    }

    const { data: txns, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!txError) {
      setTransactions(txns || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWallet();

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      window.history.replaceState({}, '', embedded ? window.location.pathname : '/dashboard/client/wallet');
      fetchWallet();
      showToast('Wallet funded successfully!', 'success');
    }
  }, [embedded]);

  const handleTopUp = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    if (topUpAmount < 100) {
      showToast('Minimum top-up is ₦100', 'error');
      return;
    }

    setProcessing(true);
    try {
      const callbackPath = embedded ? '/dashboard/client?tab=wallet&success=true' : '/dashboard/client/wallet?success=true';
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: topUpAmount,
          callbackUrl: `${window.location.origin}${callbackPath}`,
        }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        showToast(data.error || 'Failed to initialize payment', 'error');
        setProcessing(false);
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading wallet..." fullScreen={!embedded} />;
  }

  return (
    <div className={`max-w-4xl mx-auto ${embedded ? '' : 'p-6 md:p-10'}`}>
      {!embedded && (
        <header className="mb-8">
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Wallet className="w-8 h-8 text-emerald-500" />
            My Wallet
          </h1>
          <p className="text-secondary text-sm mt-2">Fund your wallet for faster checkout on future orders.</p>
        </header>
      )}

      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 rounded-2xl p-6 md:p-8 text-black mb-8 shadow-lg shadow-emerald-500/10">
        <p className="text-sm font-bold opacity-80 uppercase tracking-widest">Available Balance</p>
        <p className="text-4xl md:text-5xl font-black mt-1">₦{balance.toLocaleString('en-NG')}</p>
      </div>

      <div className="bg-card border border-theme rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-black text-primary mb-1">Add Funds</h2>
        <p className="text-secondary text-xs mb-4">Select a preset amount or enter a custom value.</p>
        <div className="flex flex-wrap gap-3 mb-6">
          {[5000, 10000, 20000, 50000, 100000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setTopUpAmount(amt)}
              className={`px-5 py-2 rounded-xl font-bold transition ${
                topUpAmount === amt
                  ? 'bg-emerald-500 text-black'
                  : 'bg-secondary border border-theme text-primary hover:border-emerald-500/50'
              }`}
            >
              ₦{amt.toLocaleString('en-NG')}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            min={100}
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(Number(e.target.value))}
            className="flex-1 bg-secondary border border-theme rounded-xl px-4 py-3 text-primary focus:border-emerald-500 outline-none"
            placeholder="Custom amount (min ₦100)"
            aria-label="Top-up amount"
          />
          <button
            type="button"
            onClick={handleTopUp}
            disabled={processing || topUpAmount < 100}
            className="btn-primary disabled:opacity-50 whitespace-nowrap"
          >
            {processing ? 'Processing...' : 'Top Up via Paystack'}
          </button>
        </div>
      </div>

      <div className="bg-card border border-theme rounded-2xl p-6">
        <h2 className="text-lg font-black text-primary mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <Wallet className="w-10 h-10 text-secondary mx-auto mb-3" />
            <p className="text-secondary text-sm">No transactions yet. Top up your wallet to get started.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.map((txn) => (
              <div
                key={txn.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme py-4 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${txn.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {txn.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-mono text-xs text-secondary">{txn.reference}</div>
                    <div className="text-xs text-secondary">{new Date(txn.created_at).toLocaleString('en-GB')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:text-right">
                  <div className={`font-black ${txn.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {txn.type === 'deposit' ? '+' : '-'} ₦{txn.amount.toLocaleString('en-NG')}
                  </div>
                  <span className="text-[10px] capitalize px-2 py-1 rounded-md bg-secondary border border-theme text-secondary font-bold">
                    {txn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
