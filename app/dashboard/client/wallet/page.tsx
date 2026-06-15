'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState(5000);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchWallet = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      // Fetch balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      setBalance(wallet?.balance || 0);

      // Fetch transaction history
      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTransactions(txns || []);
      setLoading(false);
    };
    fetchWallet();
  }, [router]);

  const handleTopUp = async () => {
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        amount: topUpAmount,
        callbackUrl: `${window.location.origin}/dashboard/client/wallet?success=true`,
      }),
    });
    const data = await res.json();
    if (data.authorization_url) {
      window.location.href = data.authorization_url;
    } else {
      alert('Failed to initialize payment');
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading wallet...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-black mb-6">My Wallet</h1>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-2xl p-6 text-white mb-8">
        <p className="text-sm opacity-80">Available Balance</p>
        <p className="text-5xl font-black">₦{balance.toLocaleString()}</p>
      </div>

      {/* Top Up Section */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Add Funds to Wallet</h2>
        <div className="flex flex-wrap gap-3 mb-6">
          {[5000, 10000, 20000, 50000, 100000].map(amt => (
            <button
              key={amt}
              onClick={() => setTopUpAmount(amt)}
              className={`px-5 py-2 rounded-xl font-bold transition ${
                topUpAmount === amt
                  ? 'bg-emerald-500 text-black'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              ₦{amt.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <input
            type="number"
            value={topUpAmount}
            onChange={e => setTopUpAmount(Number(e.target.value))}
            className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-white"
            placeholder="Custom amount"
          />
          <button
            onClick={handleTopUp}
            disabled={processing || topUpAmount < 100}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Top Up'}
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {transactions.map(txn => (
              <div key={txn.id} className="flex justify-between items-center border-b border-white/5 py-3">
                <div className="flex-1">
                  <div className="font-mono text-xs text-zinc-400">{txn.reference}</div>
                  <div className="text-xs text-zinc-500">{new Date(txn.created_at).toLocaleString()}</div>
                </div>
                <div className={`font-bold ${txn.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {txn.type === 'deposit' ? '+' : '-'} ₦{txn.amount.toLocaleString()}
                </div>
                <div className="text-xs capitalize px-2 py-1 rounded bg-white/5">
                  {txn.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}