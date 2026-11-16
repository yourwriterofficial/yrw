'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MoreHorizontal,
  Edit2,
  Wallet,
  Coins,
  List,
  ShoppingBag,
  Key,
  Mail,
  X,
  Bell,
} from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { startImpersonation } from '@/lib/impersonate';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';
import Button from '@/app/components/ui/Button';

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');
const formatDate = (iso: string) => new Date(iso).toLocaleString();

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'admins' | 'balance'>('all');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Modal states
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ full_name: '', is_admin: false, whatsapp: '', email: '' });

  const [adjustingWallet, setAdjustingWallet] = useState<{ userId: string; currentBalance: number } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const [editingWallet, setEditingWallet] = useState<{ userId: string; balance: number } | null>(null);
  const [newBalance, setNewBalance] = useState(0);

  // Transaction modal
  const [selectedUserTransactions, setSelectedUserTransactions] = useState<any[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Order modal
  const [selectedUserOrders, setSelectedUserOrders] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{ id: string; email: string; name: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Alert modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertRecipient, setAlertRecipient] = useState<{ id: string; email: string; name: string } | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      } else {
        showToast(data.error || 'Failed to load users', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateUser = async () => {
    if (!editingUser) return;
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editingUser.id,
        full_name: userForm.full_name,
        is_admin: userForm.is_admin,
        whatsapp: userForm.whatsapp,
        email: userForm.email,
      }),
    });
    if (res.ok) {
      showToast('User updated', 'success');
      fetchData();
      setEditingUser(null);
    } else {
      const data = await res.json();
      showToast(data.error || 'Update failed', 'error');
    }
  };

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

  const setWalletBalance = async () => {
    if (!editingWallet) return;
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
  };

  const viewTransactions = async (userId: string) => {
    setTransactionLoading(true);
    setShowTransactionModal(true);
    try {
      const res = await fetch(`/api/admin/user-transactions?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedUserTransactions(data.transactions || []);
      } else {
        showToast(data.error || 'Failed to load transactions', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setTransactionLoading(false);
  };

  const viewOrders = async (userId: string) => {
    setOrderLoading(true);
    setShowOrderModal(true);
    try {
      const res = await fetch(`/api/admin/user-orders?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedUserOrders(data.orders || []);
      } else {
        showToast(data.error || 'Failed to load orders', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setOrderLoading(false);
  };

  const resetPassword = async (userId: string, email: string) => {
    if (!confirm(`Send password reset email to ${email}?`)) return;
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email }),
      });
      if (res.ok) {
        showToast(`Password reset email sent to ${email}`, 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to send reset', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const sendIndividualEmail = async () => {
    if (!emailRecipient) return;
    if (!emailSubject || !emailBody) {
      showToast('Subject and body are required', 'error');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch('/api/admin/send-individual-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailRecipient.email,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, '<br>'),
        }),
      });
      if (res.ok) {
        showToast(`Email sent to ${emailRecipient.email}`, 'success');
        setShowEmailModal(false);
        setEmailSubject('');
        setEmailBody('');
        setEmailRecipient(null);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to send email', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setSendingEmail(false);
  };

  const sendAlert = async () => {
    if (!alertRecipient) return;
    if (!alertMessage.trim()) {
      showToast('Alert message is required', 'error');
      return;
    }
    setSendingAlert(true);
    try {
      const res = await fetch('/api/admin/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [alertRecipient.id],
          message: alertMessage.trim(),
        }),
      });
      if (res.ok) {
        showToast(`In-App Alert sent to ${alertRecipient.email}`, 'success');
        setShowAlertModal(false);
        setAlertMessage('');
        setAlertRecipient(null);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to send alert', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setSendingAlert(false);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'admins' && !u.is_admin) return false;
      if (filter === 'balance' && !(Number(u.balance) > 0)) return false;
      return !q || String(u.full_name || '').toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q);
    });
  }, [users, query, filter]);

  if (loading) return <LoadingScreen label="Loading users..." accent="brand" />;

  return (
    <div className="p-6 md:p-10">

      {/* ========== MODALS ========== */}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-accent/30 rounded-3xl p-8 max-w-md w-full">
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
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Email Address</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">WhatsApp</label>
                <input
                  type="text"
                  value={userForm.whatsapp}
                  onChange={e => setUserForm({ ...userForm, whatsapp: e.target.value })}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1"
                  placeholder="+234..."
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[10px] uppercase font-black text-secondary">Admin</label>
                <input
                  type="checkbox"
                  checked={userForm.is_admin}
                  onChange={e => setUserForm({ ...userForm, is_admin: e.target.checked })}
                  className="accent-accent w-5 h-5"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button fullWidth onClick={updateUser}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Adjustment Modal */}
      {adjustingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-warning/30 rounded-3xl p-8 max-w-md w-full">
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
              <Button variant="secondary" fullWidth onClick={() => setAdjustingWallet(null)}>Cancel</Button>
              <Button fullWidth onClick={adjustWallet}>Apply Adjustment</Button>
            </div>
          </div>
        </div>
      )}

      {/* Set Balance Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-success/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Set Wallet Balance</h2>
            <p className="text-secondary text-sm mb-2">User ID: {editingWallet.userId}</p>
            <label className="text-[10px] uppercase font-black text-secondary">New Balance (₦)</label>
            <input type="number" value={newBalance} onChange={e => setNewBalance(Number(e.target.value))} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 mb-4" />
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setEditingWallet(null)}>Cancel</Button>
              <Button fullWidth onClick={setWalletBalance}>Set Balance</Button>
            </div>
          </div>
        </div>
      )}

      {/* Send In-App Alert Modal */}
      {showAlertModal && alertRecipient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-accent/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-2">Send In-App Alert</h2>
            <p className="text-secondary text-sm mb-4">Recipient: <span className="text-primary font-bold">{alertRecipient.name} ({alertRecipient.email})</span></p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Alert Message</label>
                <textarea
                  value={alertMessage}
                  onChange={e => setAlertMessage(e.target.value)}
                  rows={4}
                  maxLength={280}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 focus:border-accent outline-none resize-none text-sm font-semibold"
                  placeholder="Enter message (this will pop up on their notification bell)..."
                />
                <p className="text-[10px] text-secondary text-right mt-1">{alertMessage.length}/280</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => {
                setShowAlertModal(false);
                setAlertRecipient(null);
                setAlertMessage('');
              }}>Cancel</Button>
              <Button fullWidth onClick={sendAlert} disabled={sendingAlert || !alertMessage.trim()}>{sendingAlert ? 'Sending...' : 'Send Alert'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-theme rounded-3xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-primary">Transaction History</h2>
              <button onClick={() => setShowTransactionModal(false)} className="text-secondary hover:text-primary"><X className="w-6 h-6" /></button>
            </div>
            {transactionLoading ? (
              <div className="text-center py-8 text-secondary">Loading...</div>
            ) : selectedUserTransactions.length === 0 ? (
              <div className="text-center py-8 text-secondary">No transactions found.</div>
            ) : (
              <div className="space-y-2">
                {selectedUserTransactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center border-b border-theme py-3">
                    <div>
                      <div className="font-mono text-xs text-secondary">{tx.reference}</div>
                      <div className="text-xs text-secondary">{formatDate(tx.created_at)}</div>
                      {tx.notes && <div className="text-xs text-secondary italic">{tx.notes}</div>}
                    </div>
                    <div className={`font-bold ${tx.type === 'deposit' ? 'text-success' : 'text-warning'}`}>
                      {tx.type === 'deposit' ? '+' : '-'} {formatNaira(tx.amount)}
                    </div>
                    <div className="text-xs capitalize px-2 py-1 rounded bg-secondary border border-theme text-secondary">{tx.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-theme rounded-3xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-primary">Order History</h2>
              <button onClick={() => setShowOrderModal(false)} className="text-secondary hover:text-primary"><X className="w-6 h-6" /></button>
            </div>
            {orderLoading ? (
              <div className="text-center py-8 text-secondary">Loading...</div>
            ) : selectedUserOrders.length === 0 ? (
              <div className="text-center py-8 text-secondary">No orders found.</div>
            ) : (
              <div className="space-y-2">
                {selectedUserOrders.map(order => (
                  <div key={order.order_id} className="border-b border-theme py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-sm font-bold text-primary">{order.order_id}</div>
                        <div className="text-xs text-secondary">{order.topic}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold border ${
                        order.workflow_status === 'Completed' ? 'bg-success/10 text-success border-success/20' :
                        order.workflow_status === 'Briefing Received' ? 'bg-accent/10 text-accent border-accent/20' :
                        'bg-warning/10 text-warning border-warning/20'
                      }`}>
                        {order.workflow_status}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-secondary">
                      <span>Deadline: {formatDate(order.deadline)}</span>
                      <span>Quote: {formatNaira(order.financial_quote || 0)}</span>
                      <span>Paid: {order.sixty_percent_paid ? '60%' : ''} {order.forty_percent_paid ? '40%' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && emailRecipient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-info/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Send Email to {emailRecipient.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Subject</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Body (HTML supported)</label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" fullWidth onClick={() => { setShowEmailModal(false); setEmailRecipient(null); }}>Cancel</Button>
              <Button fullWidth onClick={sendIndividualEmail} disabled={sendingEmail}>{sendingEmail ? 'Sending...' : 'Send Email'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== PEOPLE ========== */}
      <PageHeader
        title="Users"
        description="Everyone with an account: clients, admins and site owners. Wallets, emails and alerts are one tap away."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Accounts', value: String(users.length) },
          { label: 'Admins', value: String(users.filter((u) => u.is_admin).length) },
          { label: 'In wallets', value: formatNaira(users.reduce((n, u) => n + (Number(u.balance) || 0), 0)) },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-secondary">{x.label}</p>
            <p className="text-xl font-black mt-1 tabular-nums whitespace-nowrap truncate">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search users" className="w-full h-10 rounded-xl border border-theme bg-card pl-9 pr-3 text-sm" />
        </div>
        {([['all', 'Everyone'], ['admins', 'Admins'], ['balance', 'With a balance']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`h-10 px-4 rounded-xl text-sm font-medium border ${filter === k ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>{label}</button>
        ))}
      </div>

      <div className="bg-card border border-theme rounded-2xl">
        <ul className="divide-y divide-theme">
          {shown.map((user) => (
            <li key={user.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold shrink-0">{((user.full_name || user.email || '?')[0] || '?').toUpperCase()}</div>
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-semibold truncate flex items-center gap-2">
                  {user.full_name || '—'}
                  {user.is_admin && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">Admin</span>}
                </p>
                <p className="text-xs text-secondary truncate">{user.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-secondary">Wallet</p>
                <p className="text-sm font-bold tabular-nums">{formatNaira(user.balance)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 relative">
                <button
                  onClick={() => {
                    setEditingUser(user);
                    setUserForm({ full_name: user.full_name || '', is_admin: user.is_admin || false, whatsapp: user.whatsapp || '', email: user.email || '' });
                  }}
                  className="h-9 px-3 rounded-lg border border-theme hover:bg-hover text-xs font-semibold inline-flex items-center gap-1.5"
                ><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => viewOrders(user.id)} className="h-9 px-3 rounded-lg border border-theme hover:bg-hover text-xs font-semibold inline-flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Orders</button>
                <button onClick={() => setMenuFor(menuFor === user.id ? null : user.id)} aria-label={`More actions for ${user.email}`} aria-expanded={menuFor === user.id} className="h-9 w-9 rounded-lg border border-theme hover:bg-hover inline-flex items-center justify-center"><MoreHorizontal className="w-4 h-4" /></button>
                {menuFor === user.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-0 top-11 z-20 w-56 bg-card border border-theme rounded-xl shadow-elevation-3 p-1.5 text-sm">
                      {[
                        { icon: Wallet, label: 'Adjust wallet (add or take)', run: () => { setAdjustingWallet({ userId: user.id, currentBalance: user.balance }); setAdjustAmount(0); setAdjustReason(''); } },
                        { icon: Coins, label: 'Set wallet balance', run: () => { setEditingWallet({ userId: user.id, balance: user.balance }); setNewBalance(user.balance); } },
                        { icon: List, label: 'Transactions', run: () => viewTransactions(user.id) },
                        { icon: Mail, label: 'Send an email', run: () => { setEmailRecipient({ id: user.id, email: user.email, name: user.full_name || user.email }); setShowEmailModal(true); setEmailSubject(''); setEmailBody(''); } },
                        { icon: Bell, label: 'Send an alert', run: () => { setAlertRecipient({ id: user.id, email: user.email, name: user.full_name || user.email }); setShowAlertModal(true); setAlertMessage(''); } },
                        { icon: Key, label: 'Reset password', run: () => resetPassword(user.id, user.email), danger: true },
                        { icon: Edit2, label: 'Impersonate this user', run: () => { if (confirm(`Impersonate ${user.full_name || user.email}?`)) { startImpersonation(user.id, user.email, user.full_name || user.email); window.open('/dashboard/client', '_blank'); } }, danger: true },
                      ].map((m) => {
                        const Icon = m.icon;
                        return (
                          <button key={m.label} onClick={() => { setMenuFor(null); m.run(); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-hover ${m.danger ? 'text-danger' : ''}`}>
                            <Icon className="w-4 h-4 shrink-0" /> {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-12 text-center text-secondary text-sm">{users.length === 0 ? 'No users found.' : 'No one matches that search.'}</li>}
        </ul>
      </div>
    </div>
  );
}