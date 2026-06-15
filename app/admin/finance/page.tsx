'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');

let toastId = 0;
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  const event = new CustomEvent('app:toast', { detail: { id: toastId++, message, type } });
  window.dispatchEvent(event);
};

export default function FinancePage() {
  const [users, setUsers] = useState<any[]>([]);
  const [wallets, setWallets] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWallet, setEditingWallet] = useState<{ userId: string; balance: number } | null>(null);
  const [newBalance, setNewBalance] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch users
    const { data: usersData } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
    if (usersData) setUsers(usersData);

    // Fetch wallets separately
    const { data: walletsData } = await supabase.from('wallets').select('user_id, balance');
    if (walletsData) {
      const walletMap: Record<string, number> = {};
      walletsData.forEach(w => { walletMap[w.user_id] = w.balance; });
      setWallets(walletMap);
    }

    // Fetch transactions (no nested select)
    const { data: txData } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(500);
    if (txData) setTransactions(txData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateWallet = async () => {
    if (!editingWallet) return;
    const res = await fetch('/api/admin/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editingWallet.userId, balance: newBalance }),
    });
    if (res.ok) {
      showToast('Wallet updated', 'success');
      fetchData();
      setEditingWallet(null);
    } else {
      showToast('Update failed', 'error');
    }
  };

  if (loading) return <div className="p-10 text-center text-primary">Loading...</div>;

  return (
    <div className="p-6 md:p-10 space-y-10">
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold ${t.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Wallet edit modal – using CSS variables */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-purple-500/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Edit Wallet Balance</h2>
            <p className="text-secondary text-sm mb-2">User ID: {editingWallet.userId}</p>
            <label className="text-[10px] uppercase font-black text-secondary">New Balance (₦)</label>
            <input type="number" value={newBalance} onChange={e => setNewBalance(Number(e.target.value))} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setEditingWallet(null)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={updateWallet} className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-black">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Users & Wallets table */}
      <div>
        <h2 className="text-2xl font-black text-primary mb-4">User Wallets</h2>
        <div className="bg-secondary border border-theme rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
              <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Balance</th><th className="px-6 py-4">Actions</th></tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-theme">
                  <td className="px-6 py-4 text-primary">{user.full_name || '—'}</td>
                  <td className="px-6 py-4 text-primary">{user.email}</td>
                  <td className="px-6 py-4 font-mono text-primary">{formatNaira(wallets[user.id] || 0)}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setEditingWallet({ userId: user.id, balance: wallets[user.id] || 0 }); setNewBalance(wallets[user.id] || 0); }} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs">Edit Balance</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions table */}
      <div>
        <h2 className="text-2xl font-black text-primary mb-4">All Transactions</h2>
        <div className="bg-secondary border border-theme rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
              <tr><th className="px-6 py-4">User ID</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Reference</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Date</th></tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-theme">
                  <td className="px-6 py-4 text-xs text-primary">{tx.user_id}</td>
                  <td className="px-6 py-4 capitalize text-primary">{tx.type}</td>
                  <td className="px-6 py-4 font-mono text-primary">{formatNaira(tx.amount)}</td>
                  <td className="px-6 py-4 text-xs text-primary">{tx.reference}</td>
                  <td className="px-6 py-4 capitalize text-primary">{tx.status}</td>
                  <td className="px-6 py-4 text-xs text-primary">{new Date(tx.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}