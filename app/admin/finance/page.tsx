'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { ToastContainer, showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');

export default function FinancePage() {
  const [users, setUsers] = useState<any[]>([]);
  const [wallets, setWallets] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Wallet edit modal (set absolute balance)
  const [editingWallet, setEditingWallet] = useState<{ userId: string; balance: number } | null>(null);
  const [newBalance, setNewBalance] = useState(0);
  
  // User edit modal
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ full_name: '', is_admin: false });
  
  // Wallet adjustment modal
  const [adjustingWallet, setAdjustingWallet] = useState<{ userId: string; currentBalance: number } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: usersData } = await supabase.from('profiles').select('id, full_name, email, is_admin').order('full_name');
    if (usersData) setUsers(usersData);

    const { data: walletsData } = await supabase.from('wallets').select('user_id, balance');
    if (walletsData) {
      const walletMap: Record<string, number> = {};
      walletsData.forEach(w => { walletMap[w.user_id] = w.balance; });
      setWallets(walletMap);
    }

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (txData) setTransactions(txData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Update user details
  const updateUser = async () => {
    if (!editingUser) return;
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editingUser.id, full_name: userForm.full_name, is_admin: userForm.is_admin }),
    });
    if (res.ok) {
      showToast('User updated', 'success');
      fetchData();
      setEditingUser(null);
    } else {
      showToast('Update failed', 'error');
    }
  };

  // Adjust wallet (add/subtract with reason)
  const adjustWallet = async () => {
    if (!adjustingWallet) return;
    if (adjustAmount === 0) return showToast('Amount must be non-zero', 'error');
    const res = await fetch('/api/admin/wallet-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: adjustingWallet.userId,
        amount: adjustAmount,
        reason: adjustReason || (adjustAmount > 0 ? 'Manual credit' : 'Manual deduction'),
      }),
    });
    if (res.ok) {
      showToast('Wallet adjusted', 'success');
      fetchData();
      setAdjustingWallet(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } else {
      showToast('Adjustment failed', 'error');
    }
  };

  if (loading) return <LoadingScreen label="Loading finance..." accent="purple" />;

  return (
    <div className="p-6 md:p-10 space-y-10">
      <ToastContainer />

      <PageHeader
        title="Finance"
        description="Manage user wallets, balances, and platform transactions."
        breadcrumb="Admin / Finance"
        icon={<lucide.Wallet className="w-8 h-8 text-purple-500" />}
      />

      {/* ========== MODAL: Edit User ========== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-purple-500/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Edit User</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Full Name</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={e => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[10px] uppercase font-black text-secondary">Admin</label>
                <input
                  type="checkbox"
                  checked={userForm.is_admin}
                  onChange={e => setUserForm({ ...userForm, is_admin: e.target.checked })}
                  className="accent-purple-500 w-5 h-5"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={updateUser} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-black">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Edit Wallet Balance (absolute) ========== */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Set Wallet Balance</h2>
            <p className="text-secondary text-sm mb-2">User ID: {editingWallet.userId}</p>
            <label className="text-[10px] uppercase font-black text-secondary">New Balance (₦)</label>
            <input type="number" value={newBalance} onChange={e => setNewBalance(Number(e.target.value))} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setEditingWallet(null)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={async () => {
                const res = await fetch('/api/admin/wallet', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: editingWallet.userId, balance: newBalance }),
                });
                if (res.ok) {
                  showToast('Balance set', 'success');
                  fetchData();
                  setEditingWallet(null);
                } else {
                  showToast('Failed', 'error');
                }
              }} className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-black">Set Balance</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Wallet Adjustment (add/subtract) ========== */}
      {adjustingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-amber-500/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Adjust Wallet</h2>
            <p className="text-secondary text-sm mb-2">User ID: {adjustingWallet.userId}</p>
            <p className="text-secondary text-sm mb-4">Current Balance: {formatNaira(adjustingWallet.currentBalance)}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Amount (₦) – use negative for deduction</label>
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(Number(e.target.value))} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Reason</label>
                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Optional" className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAdjustingWallet(null)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={adjustWallet} className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-black">Apply Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Users Table ========== */}
      <div>
        <h2 className="text-lg font-black text-primary mb-4">User Wallets</h2>
        <div className="bg-secondary border border-theme rounded-2xl overflow-x-auto table-row-hover">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
              <tr>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Admin</th>
                <th className="px-4 py-4">Balance</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-theme">
                  <td className="px-4 py-4 text-primary">{user.full_name || '—'}</td>
                  <td className="px-4 py-4 text-primary">{user.email}</td>
                  <td className="px-4 py-4">
                    {user.is_admin ? (
                      <span className="text-purple-400">✓</span>
                    ) : (
                      <span className="text-secondary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 font-mono text-primary">{formatNaira(wallets[user.id] || 0)}</td>
                  <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setUserForm({ full_name: user.full_name || '', is_admin: user.is_admin || false });
                      }}
                      className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs"
                    >
                      Edit User
                    </button>
                    <button
                      onClick={() => {
                        setAdjustingWallet({ userId: user.id, currentBalance: wallets[user.id] || 0 });
                        setAdjustAmount(0);
                        setAdjustReason('');
                      }}
                      className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs"
                    >
                      Adjust Wallet
                    </button>
                    <button
                      onClick={() => {
                        setEditingWallet({ userId: user.id, balance: wallets[user.id] || 0 });
                        setNewBalance(wallets[user.id] || 0);
                      }}
                      className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs"
                    >
                      Set Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== Transactions Table ========== */}
      <div>
        <h2 className="text-lg font-black text-primary mb-4">All Transactions</h2>
        <div className="bg-secondary border border-theme rounded-2xl overflow-x-auto table-row-hover">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
              <tr>
                <th className="px-4 py-4">User</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Reference</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Notes</th>
                <th className="px-4 py-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const user = users.find(u => u.id === tx.user_id);
                return (
                  <tr key={tx.id} className="border-b border-theme hover:bg-white/5">
                    <td className="px-4 py-4 text-xs text-primary">{user?.full_name || tx.user_id}</td>
                    <td className="px-4 py-4 capitalize text-primary">{tx.type}</td>
                    <td className="px-4 py-4 font-mono text-primary">{formatNaira(tx.amount)}</td>
                    <td className="px-4 py-4 text-xs text-primary">{tx.reference}</td>
                    <td className="px-4 py-4 capitalize text-primary">{tx.status}</td>
                    <td className="px-4 py-4 text-xs text-secondary">{tx.notes || '—'}</td>
                    <td className="px-4 py-4 text-xs text-primary">{new Date(tx.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-secondary">No transactions recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}