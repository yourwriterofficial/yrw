'use client';

import { useEffect, useState } from 'react';
import {
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

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');
const formatDate = (iso: string) => new Date(iso).toLocaleString();

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingScreen label="Loading users..." accent="purple" />;

  return (
    <div className="p-6 md:p-10">

      {/* ========== MODALS ========== */}

      {/* Edit User Modal */}
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

      {/* Wallet Adjustment Modal */}
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

      {/* Set Balance Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">Set Wallet Balance</h2>
            <p className="text-secondary text-sm mb-2">User ID: {editingWallet.userId}</p>
            <label className="text-[10px] uppercase font-black text-secondary">New Balance (₦)</label>
            <input type="number" value={newBalance} onChange={e => setNewBalance(Number(e.target.value))} className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setEditingWallet(null)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={setWalletBalance} className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-black">Set Balance</button>
            </div>
          </div>
        </div>
      )}

      {/* Send In-App Alert Modal */}
      {showAlertModal && alertRecipient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-purple-500/30 rounded-3xl p-8 max-w-md w-full">
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
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 focus:border-purple-500 outline-none resize-none text-sm font-semibold"
                  placeholder="Enter message (this will pop up on their notification bell)..."
                />
                <p className="text-[10px] text-secondary text-right mt-1">{alertMessage.length}/280</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => {
                  setShowAlertModal(false);
                  setAlertRecipient(null);
                  setAlertMessage('');
                }} 
                className="flex-1 py-3 bg-white/5 text-primary rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={sendAlert} 
                disabled={sendingAlert || !alertMessage.trim()}
                className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-black hover:bg-purple-400 disabled:opacity-50 transition"
              >
                {sendingAlert ? 'Sending...' : 'Send Alert'}
              </button>
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
                    <div className={`font-bold ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'} {formatNaira(tx.amount)}
                    </div>
                    <div className="text-xs capitalize px-2 py-1 rounded bg-white/5 text-secondary">{tx.status}</div>
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
                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                        order.workflow_status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        order.workflow_status === 'Briefing Received' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-amber-500/20 text-amber-400'
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
          <div className="bg-primary border border-blue-500/30 rounded-3xl p-8 max-w-md w-full">
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
              <button onClick={() => { setShowEmailModal(false); setEmailRecipient(null); }} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={sendIndividualEmail} disabled={sendingEmail} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-black">
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== TABLE ========== */}
      <PageHeader
        title="User Management"
        description="Manage client accounts, wallets, and communications."
        breadcrumb="Admin / Users"
      />
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
              <tr key={user.id} className="border-b border-theme hover:bg-white/5 transition">
                <td className="px-4 py-4 text-primary">{user.full_name || '—'}</td>
                <td className="px-4 py-4 text-primary">{user.email}</td>
                <td className="px-4 py-4">
                  {user.is_admin ? <span className="text-purple-400">✓</span> : <span className="text-secondary">—</span>}
                </td>
                <td className="px-4 py-4 font-mono text-primary">{formatNaira(user.balance)}</td>
                <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setUserForm({
                        full_name: user.full_name || '',
                        is_admin: user.is_admin || false,
                        whatsapp: user.whatsapp || '',
                        email: user.email || '',
                      });
                    }}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition"
                  >
                    <Edit2 className="w-3 h-3 inline mr-1" /> Edit
                  </button>

                  <button
                    onClick={() => {
                      setAdjustingWallet({ userId: user.id, currentBalance: user.balance });
                      setAdjustAmount(0);
                      setAdjustReason('');
                    }}
                    className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs hover:bg-amber-500/30 transition"
                  >
                    <Wallet className="w-3 h-3 inline mr-1" /> Adjust
                  </button>

                  <button
                    onClick={() => {
                      setEditingWallet({ userId: user.id, balance: user.balance });
                      setNewBalance(user.balance);
                    }}
                    className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs hover:bg-purple-500/30 transition"
                  >
                    <Coins className="w-3 h-3 inline mr-1" /> Set
                  </button>

                  <button
                    onClick={() => viewTransactions(user.id)}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition"
                  >
                    <List className="w-3 h-3 inline mr-1" /> Txns
                  </button>

                  <button
                    onClick={() => viewOrders(user.id)}
                    className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs hover:bg-indigo-500/30 transition"
                  >
                    <ShoppingBag className="w-3 h-3 inline mr-1" /> Orders
                  </button>

                  <button
                    onClick={() => resetPassword(user.id, user.email)}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition"
                  >
                    <Key className="w-3 h-3 inline mr-1" /> Reset
                  </button>

                  <button
                    onClick={() => {
                      setEmailRecipient({ id: user.id, email: user.email, name: user.full_name || user.email });
                      setShowEmailModal(true);
                      setEmailSubject('');
                      setEmailBody('');
                    }}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition"
                  >
                    <Mail className="w-3 h-3 inline mr-1" /> Email
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Impersonate ${user.full_name || user.email}?`)) {
                        startImpersonation(user.id, user.email, user.full_name || user.email);
                        window.open('/dashboard/client', '_blank');
                      }
                    }}
                    className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs hover:bg-amber-500/30 transition"
                  >
                    🎭 Impersonate
                  </button>

                  <button
                    onClick={() => {
                      setAlertRecipient({ id: user.id, email: user.email, name: user.full_name || user.email });
                      setShowAlertModal(true);
                      setAlertMessage('');
                    }}
                    className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs hover:bg-purple-500/30 transition"
                  >
                    <Bell className="w-3 h-3 inline mr-1" /> Alert
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-secondary">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}