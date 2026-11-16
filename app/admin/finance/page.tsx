'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');

export default function FinancePage() {
  const [users, setUsers] = useState<any[]>([]);
  const [wallets, setWallets] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'wallets' | 'transactions' | 'invoice'>('pending');
  
  // Wallet edit modal (set absolute balance)
  const [editingWallet, setEditingWallet] = useState<{ userId: string; balance: number } | null>(null);
  const [newBalance, setNewBalance] = useState(0);
  
  // User edit modal
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    is_admin: false,
    assigned_bank_name: '',
    assigned_account_number: '',
    assigned_account_name: '',
    assigned_bank_notes: '',
  });
  const [userBanks, setUserBanks] = useState<Record<string, any>>({});
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  
  // Wallet adjustment modal
  const [adjustingWallet, setAdjustingWallet] = useState<{ userId: string; currentBalance: number } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Payment link generator form
  const [payLinkForm, setPayLinkForm] = useState({
    email: '',
    topic: '',
    department: 'Computer Science',
    level: 'BSc',
    price: 3000,
  });
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const generatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payLinkForm.email || !payLinkForm.topic) {
      return showToast('Please fill email and topic', 'error');
    }
    setGeneratingLink(true);
    setGeneratedLink('');
    try {
      const res = await fetch('/api/admin/generate-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payLinkForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedLink(data.authorization_url);
        showToast('Bank transfer invoice generated & emailed successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to generate link', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleApproveTransfer = async (reference: string) => {
    setProcessingAction(reference);
    try {
      const res = await fetch('/api/admin/manual-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reference }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Payment approved and credited successfully!', 'success');
        fetchData();
      } else {
        showToast(data.error || 'Failed to approve payment', 'error');
      }
    } catch {
      showToast('Network error approving payment', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRejectTransfer = async (reference: string) => {
    const reason = prompt('Please enter a reason for rejecting this transfer:');
    if (reason === null) return;
    setProcessingAction(reference);
    try {
      const res = await fetch('/api/admin/manual-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reference, reason }),
      });
      if (res.ok) {
        showToast('Transfer rejected.', 'success');
        fetchData();
      } else {
        showToast('Failed to reject transfer', 'error');
      }
    } catch {
      showToast('Network error rejecting payment', 'error');
    } finally {
      setProcessingAction(null);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: usersData } = await supabase.from('profiles').select('id, full_name, email, is_admin, created_at').order('created_at', { ascending: false });
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

    // Fetch user assigned bank accounts
    try {
      const banksRes = await fetch('/api/admin/manual-payments?action=get_all_banks');
      const banksData = await banksRes.json();
      if (banksData?.banks) setUserBanks(banksData.banks);
    } catch {}

    // Fetch pending manual transfers
    try {
      const transfersRes = await fetch('/api/admin/manual-payments');
      const transfersData = await transfersRes.json();
      if (transfersData?.payments) setPendingTransfers(transfersData.payments);
    } catch {}

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Update user details & bank assignment
  const updateUser = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingUser.id, full_name: userForm.full_name, is_admin: userForm.is_admin }),
      });

      // Save custom assigned bank details if provided
      if (userForm.assigned_account_number) {
        await fetch('/api/admin/manual-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign_bank',
            userId: editingUser.id,
            bankDetails: {
              bank_name: userForm.assigned_bank_name || 'Opay',
              account_number: userForm.assigned_account_number,
              account_name: userForm.assigned_account_name,
              instructions: userForm.assigned_bank_notes,
            },
          }),
        });
      }

      if (res.ok) {
        showToast('User and bank settings updated successfully', 'success');
        fetchData();
        setEditingUser(null);
      } else {
        showToast('Update failed', 'error');
      }
    } catch {
      showToast('Network error updating user', 'error');
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

      <PageHeader
        title="Finance"
        description="Approve bank transfers, manage client wallets, review every transaction, and send bank invoices."
        icon={<lucide.Wallet className="w-7 h-7 text-accent" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Transfers to review', value: String(pendingTransfers.length), tone: pendingTransfers.length ? 'text-warning' : '' },
          { label: 'Held in client wallets', value: '₦' + Math.round(Object.values(wallets).reduce((n, v) => n + (Number(v) || 0), 0)).toLocaleString('en-NG'), tone: '' },
          { label: 'Transactions recorded', value: String(transactions.length), tone: '' },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-secondary">{x.label}</p>
            <p className={`text-xl font-black mt-1 tabular-nums whitespace-nowrap truncate ${x.tone}`}>{x.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-secondary/60 border border-theme w-fit max-w-full" role="tablist">
        {([['pending', 'Pending transfers'], ['wallets', 'Wallets'], ['transactions', 'Transactions'], ['invoice', 'New bank invoice']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${tab === k ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>
            {label}{k === 'pending' && pendingTransfers.length > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-warning text-black text-[11px] font-bold flex items-center justify-center">{pendingTransfers.length}</span>}
          </button>
        ))}
      </div>

      {/* ========== SECTION: Bank Transfer Invoice Generator ========== */}
      {tab === 'invoice' && <div className="bg-card border border-theme rounded-3xl p-6 md:p-8 space-y-6 max-w-4xl">
        <div>
          <h2 className="text-lg font-black text-primary flex items-center gap-2">
            <lucide.Link2 className="w-5 h-5 text-accent" /> Generate Client Bank Invoice
          </h2>
          <p className="text-xs text-secondary mt-1">Generate an invoice with designated bank transfer details for any custom topic, email the receipt/onboarding credentials, and track client delivery seamlessly.</p>
        </div>

        <form onSubmit={generatePaymentLink} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-black text-secondary">Client Email</label>
            <input
              type="email"
              required
              placeholder="client@example.com"
              value={payLinkForm.email}
              onChange={e => setPayLinkForm({ ...payLinkForm, email: e.target.value })}
              className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary mt-1 focus:border-accent outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-black text-secondary">Project Topic</label>
            <input
              type="text"
              required
              placeholder="e.g. Design of an E-commerce system..."
              value={payLinkForm.topic}
              onChange={e => setPayLinkForm({ ...payLinkForm, topic: e.target.value })}
              className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary mt-1 focus:border-accent outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-black text-secondary">Department</label>
            <select
              value={payLinkForm.department}
              onChange={e => setPayLinkForm({ ...payLinkForm, department: e.target.value })}
              className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary mt-1 focus:border-accent outline-none font-bold"
            >
              <option value="Computer Science">Computer Science</option>
              <option value="Accounting">Accountancy / Accounting</option>
              <option value="Business Administration">Business Administration</option>
              <option value="Economics">Economics</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="Electrical Engineering">Electrical / Electronic Engineering</option>
              <option value="Nursing Science">Nursing Science</option>
              <option value="Mass Communication">Mass Communication</option>
              <option value="Political Science">Political Science</option>
              <option value="Biochemistry">Biochemistry</option>
              <option value="Microbiology">Microbiology</option>
              <option value="Banking and Finance">Banking and Finance</option>
              <option value="Public Health">Public Health</option>
              <option value="Civil Engineering">Civil Engineering</option>
              <option value="Other">Other / General</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-black text-secondary">Academic Level</label>
              <select
                value={payLinkForm.level}
                onChange={e => setPayLinkForm({ ...payLinkForm, level: e.target.value })}
                className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary mt-1 focus:border-accent outline-none font-bold"
              >
                <option value="BSc">BSc / Undergraduate</option>
                <option value="MSc">MSc / Postgrad</option>
                <option value="PhD">PhD / Doctorate</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-black text-secondary">Quote Amount (₦)</label>
              <input
                type="number"
                min="500"
                value={payLinkForm.price}
                onChange={e => setPayLinkForm({ ...payLinkForm, price: Number(e.target.value) })}
                className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary mt-1 focus:border-accent outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2 pt-2">
            <button
              type="submit"
              disabled={generatingLink}
              className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-[var(--accent-foreground)] rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer"
            >
              {generatingLink ? 'Generating Invoice...' : 'Generate & Email Bank Invoice'}
            </button>
          </div>
        </form>

        {generatedLink && (
          <div className="bg-accent/10 border border-accent/20 p-4 rounded-2xl space-y-2 mt-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-1.5 text-xs text-accent font-bold">
              <lucide.CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Invoice link successfully generated and emailed to user!</span>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 bg-secondary border border-theme rounded-xl px-3 py-2 text-xs text-primary font-mono outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  showToast('Link copied to clipboard!', 'success');
                }}
                className="px-4 py-2 bg-accent text-[var(--accent-foreground)] rounded-xl text-xs font-bold hover:bg-accent-hover transition"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* ========== SECTION: Pending Bank Transfers Review ========== */}
      {tab === 'pending' && <div className="bg-card border border-theme rounded-3xl p-6 md:p-8 space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-primary flex items-center gap-2">
              <lucide.Clock className="w-5 h-5 text-amber-500" /> Pending Bank Transfers
              {pendingTransfers.length > 0 && (
                <span className="bg-amber-500/20 text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {pendingTransfers.length} Pending
                </span>
              )}
            </h2>
            <p className="text-xs text-secondary mt-1">
              Review and approve manual bank transfers submitted by clients. Approving activates the project milestone, credits the client wallet, or marks invoices paid.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-white/5 border border-theme text-primary text-xs font-bold rounded-xl transition self-start sm:self-auto"
          >
            <lucide.RefreshCw className="w-3.5 h-3.5 text-secondary" /> Refresh List
          </button>
        </div>

        {pendingTransfers.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-theme rounded-2xl">
            <lucide.CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-sm font-bold text-primary">All caught up!</p>
            <p className="text-xs text-secondary mt-1">No pending manual bank transfers require review at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTransfers.map((payment) => (
              <div
                key={payment.reference || payment.id}
                className="bg-secondary/60 border border-theme rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:border-purple-500/30 transition"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-base text-primary">
                      {formatNaira(payment.amount || 0)}
                    </span>
                    <span className="bg-accent/10 text-accent text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                      {payment.payment_type || 'Transfer'}
                    </span>
                    <span className="font-mono text-xs text-secondary">
                      Ref: {payment.reference}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-xs text-secondary">
                    <div>
                      <span className="font-medium text-primary">Client:</span>{' '}
                      {payment.user_email || payment.user_id}
                    </div>
                    {payment.sender_name && (
                      <div>
                        <span className="font-medium text-primary">Sender Account:</span>{' '}
                        {payment.sender_name}
                      </div>
                    )}
                    {payment.sender_bank && (
                      <div>
                        <span className="font-medium text-primary">Bank Sent From:</span>{' '}
                        {payment.sender_bank}
                      </div>
                    )}
                    {payment.assigned_bank && (
                      <div>
                        <span className="font-medium text-primary">Paid Into:</span>{' '}
                        {payment.assigned_bank.bank_name} ({payment.assigned_bank.account_number})
                      </div>
                    )}
                    {payment.notes && (
                      <div className="sm:col-span-2">
                        <span className="font-medium text-primary">Notes:</span> {payment.notes}
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-primary">Date:</span>{' '}
                      {new Date(payment.created_at).toLocaleString()}
                    </div>
                  </div>

                  {payment.proof_url && (
                    <div className="pt-1">
                      <a
                        href={payment.proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-purple-300 underline font-semibold"
                      >
                        <lucide.ExternalLink className="w-3.5 h-3.5" /> View Payment Proof Receipt
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                  <button
                    onClick={() => handleRejectTransfer(payment.reference)}
                    disabled={processingAction === payment.reference}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveTransfer(payment.reference)}
                    disabled={processingAction === payment.reference}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {processingAction === payment.reference ? (
                      <>
                        <lucide.Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving...
                      </>
                    ) : (
                      <>
                        <lucide.Check className="w-3.5 h-3.5" /> Approve & Credit
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* ========== MODAL: Edit User & Bank Assignment ========== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-purple-500/30 rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-6">
            <h2 className="text-xl font-black text-primary">Edit User & Bank Assignment</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-secondary">Full Name</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={e => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mt-1 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[10px] uppercase font-black text-secondary">Admin Role</label>
                <input
                  type="checkbox"
                  checked={userForm.is_admin}
                  onChange={e => setUserForm({ ...userForm, is_admin: e.target.checked })}
                  className="accent-purple-500 w-5 h-5 cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-theme space-y-4">
                <div className="flex items-center gap-2 text-sm font-black text-primary">
                  <lucide.Building2 className="w-4 h-4 text-accent" />
                  <span>Custom Assigned Bank Account</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  Designate a dedicated bank account for this client. If left blank, the platform default business account (Opay) is used.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-black text-secondary">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Opay, GTBank, Kuda"
                      value={userForm.assigned_bank_name}
                      onChange={e => setUserForm({ ...userForm, assigned_bank_name: e.target.value })}
                      className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary mt-1 outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black text-secondary">Account Number</label>
                    <input
                      type="text"
                      placeholder="10-digit Account No"
                      value={userForm.assigned_account_number}
                      onChange={e => setUserForm({ ...userForm, assigned_account_number: e.target.value })}
                      className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary mt-1 font-mono outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-secondary">Account Name</label>
                  <input
                    type="text"
                    placeholder="Beneficiary / Account Name"
                    value={userForm.assigned_account_name}
                    onChange={e => setUserForm({ ...userForm, assigned_account_name: e.target.value })}
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary mt-1 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-secondary">Special Instructions / Narration Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Include student name in transfer narration"
                    value={userForm.assigned_bank_notes}
                    onChange={e => setUserForm({ ...userForm, assigned_bank_notes: e.target.value })}
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary mt-1 outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl text-xs font-bold transition hover:bg-white/10">Cancel</button>
              <button onClick={updateUser} className="flex-1 py-3 bg-purple-500 hover:bg-accent-hover text-white rounded-xl text-xs font-black transition">Save Changes</button>
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
      {tab === 'wallets' && <div>
        <h2 className="text-lg font-black text-primary mb-4">User Wallets</h2>
        <div className="bg-secondary border border-theme rounded-2xl overflow-x-auto table-row-hover">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
              <tr>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Admin</th>
                <th className="px-4 py-4">Assigned Bank</th>
                <th className="px-4 py-4">Balance</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const assigned = userBanks[user.id];
                return (
                  <tr key={user.id} className="border-b border-theme">
                    <td className="px-4 py-4 text-primary">{user.full_name || '—'}</td>
                    <td className="px-4 py-4 text-primary">{user.email}</td>
                    <td className="px-4 py-4">
                      {user.is_admin ? (
                        <span className="text-accent">✓</span>
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {assigned?.bank_name ? (
                        <span className="text-primary font-medium">
                          {assigned.bank_name} <span className="font-mono text-secondary">({assigned.account_number})</span>
                        </span>
                      ) : (
                        <span className="text-secondary italic">Default (Opay)</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono text-primary">{formatNaira(wallets[user.id] || 0)}</td>
                    <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setUserForm({
                            full_name: user.full_name || '',
                            is_admin: user.is_admin || false,
                            assigned_bank_name: assigned?.bank_name || '',
                            assigned_account_number: assigned?.account_number || '',
                            assigned_account_name: assigned?.account_name || '',
                            assigned_bank_notes: assigned?.instructions || '',
                          });
                        }}
                        className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition"
                      >
                        Edit User & Bank
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
                      className="px-3 py-1 bg-purple-500/20 text-accent rounded-lg text-xs"
                    >
                      Set Balance
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>}

      {/* ========== Transactions Table ========== */}
      {tab === 'transactions' && <div>
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
      </div>}
    </div>
  );
}