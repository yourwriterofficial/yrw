'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import type { AdminOrderView, PromoCode, WorkflowStatus, ServiceTier, CorrectionsStatus } from '@/lib/types';

// ==========================================
// 1. BULLETPROOF HELPER FUNCTIONS
// ==========================================
const renderBool = (val: any): boolean => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    return ['yes', 'true', '1', 't', 'y'].includes(s);
  }
  return false;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

const parsePriceStr = (str: any): number => parseFloat(String(str).replace(/[^0-9.-]/g, '')) || 0;
const formatNaira = (amount: number): string => '₦' + Math.round(amount).toLocaleString('en-NG');

// ==========================================
// 2. MAIN COMPONENT EXPORT
// ==========================================
export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-purple-500 text-xs font-black uppercase tracking-widest animate-pulse">Authenticating Admin...</span>
      </div>
    </div>
  );
}

// ==========================================
// 3. DASHBOARD LOGIC & UI
// ==========================================
function AdminDashboardContent() {
  const router = useRouter();
  
  // App State
  const [loading, setLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'orders' | 'logs'>('orders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Data State
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<AdminOrderView[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);

  // Filtering & Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');

  // Modals & Action States
  const [editingOrder, setEditingOrder] = useState<AdminOrderView | null>(null);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<AdminOrderView | null>(null);
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [uploadingDelivery, setUploadingDelivery] = useState<boolean>(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) return router.push('/dashboard/client');
      
      await Promise.all([fetchOrders(), fetchEmailLogs()]);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // --- DATA FETCHING ---
  const fetchOrders = async () => {
    const { data, error } = await supabase.from('admin_orders_view').select('*').order('Timestamp', { ascending: false });
    if (error) console.error("Fetch error:", error.message);
    if (data) setOrders(data as AdminOrderView[]);
  };
  
  const fetchEmailLogs = async () => {
    const { data } = await supabase.from('email_logs').select('*').order('sent_at', { ascending: false }).limit(200);
    if (data) setEmailLogs(data);
  };

  // --- FILTERING LOGIC ---
  const applyFilters = useCallback(() => {
    let filtered = [...orders];
    if (statusFilter) filtered = filtered.filter(o => o['Workflow Status'] === statusFilter);
    if (paymentFilter) {
      if (paymentFilter === 'deposit_pending') filtered = filtered.filter(o => !renderBool(o['60% Paid']));
      else if (paymentFilter === 'deposit_paid') filtered = filtered.filter(o => renderBool(o['60% Paid']));
      else if (paymentFilter === 'balance_pending') filtered = filtered.filter(o => renderBool(o['60% Paid']) && !renderBool(o['40% Paid']));
      else if (paymentFilter === 'fully_paid') filtered = filtered.filter(o => renderBool(o['60% Paid']) && renderBool(o['40% Paid']));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(o => 
        (o['Order ID'] || '').toLowerCase().includes(term) || 
        (o['Legal Name'] || '').toLowerCase().includes(term) || 
        (o['Email'] || '').toLowerCase().includes(term) || 
        (o['Research Topic'] || '').toLowerCase().includes(term)
      );
    }
    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [orders, statusFilter, paymentFilter, searchTerm]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  // --- ACTIONS ---
  const saveOrderUpdates = async () => {
    if (!editingOrder) return;
    const updates = {
      financial_quote: editingOrder['Financial Quote'],
      workflow_status: editingOrder['Workflow Status'],
      sixty_percent_paid: renderBool(editingOrder['60% Paid']),
      forty_percent_paid: renderBool(editingOrder['40% Paid']),
      work_submitted: renderBool(editingOrder['Work Submitted']),
      corrections_status: editingOrder['Corrections Status'],
    };
    
    // Target the core 'orders' table directly when saving changes
    const { error } = await supabase.from('orders').update(updates).eq('order_id', editingOrder['Order ID']);
    
    if (!error) {
      if (updates.workflow_status === 'Quote Sent') {
        await fetch('/api/send-email', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: editingOrder['Email'], orderId: editingOrder['Order ID'], subject: `Quote Approved`, html: `<div>Your quote is ready.</div>` }) 
        });
      }
      await fetchOrders();
      setEditingOrder(null);
    } else alert('Failed to update order database.');
  };

  const generateInvoice = async (orderId: string, amount: number, email: string, name: string, type: 'DEPOSIT' | 'BALANCE') => {
  try {
    const res = await fetch('/api/paystack/create-invoice', { // <-- Changed URL
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, email, name, type }),
    });
    const data = await res.json();
    if (data.link) window.open(data.link, '_blank');
    else alert(`Failed: ${data.error}`);
  } catch (err) { alert('Network error triggering invoice.'); }
};

  const handleDeliveryUpload = async () => {
    if (!deliveryFile || !deliveryModalOrder) return alert("Select a file.");
    setUploadingDelivery(true);
    try {
      const orderId = deliveryModalOrder['Order ID'];
      const fileExt = deliveryFile.name.split('.').pop();
      const filePath = `${orderId}/FINAL_DELIVERY_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('final-deliverables').upload(filePath, deliveryFile);
      if (uploadError) throw uploadError;
      
      await supabase.from('orders').update({ work_submitted: true, vault_status: 'Final Files Secured' }).eq('order_id', orderId);
      
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: deliveryModalOrder['Email'], orderId, subject: `Files Ready for ${orderId}`, html: `<div>Files uploaded</div>` })
      });
      
      alert("Uploaded securely to the vault.");
      setDeliveryModalOrder(null);
      setDeliveryFile(null);
      fetchOrders();
    } catch (err: any) { alert(`Upload failed: ${err.message}`); }
    setUploadingDelivery(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-['Inter'] selection:bg-purple-500/30">
      
      {/* ================= SIDEBAR (DESKTOP) ================= */}
      <aside className="hidden md:flex flex-col w-64 bg-black border-r border-white/5 h-screen sticky top-0 p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl"><lucide.Shield className="w-5 h-5" /></div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-purple-500 uppercase tracking-widest font-bold">SysAdmin</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarBtn active={activeView === 'orders'} onClick={() => setActiveView('orders')} icon={<lucide.Database />} label="Order Management" />
          <SidebarBtn active={activeView === 'logs'} onClick={() => setActiveView('logs')} icon={<lucide.Activity />} label="System Logs" />
          <div className="my-4 border-t border-white/5"></div>
          <SidebarBtn active={false} onClick={() => router.push('/admin/settings')} icon={<lucide.Settings />} label="Platform Settings" />
          <SidebarBtn active={false} onClick={() => window.open('/dashboard/client', '_blank')} icon={<lucide.ExternalLink />} label="View Client UI" />
        </nav>

        <div className="border-t border-white/10 pt-6 mt-6">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition text-sm font-bold p-2 rounded-lg hover:bg-red-500/10">
            <lucide.LogOut className="w-4 h-4" /> Terminate Session
          </button>
        </div>
      </aside>

      {/* ================= MOBILE TOPBAR ================= */}
      <div className="md:hidden bg-black border-b border-white/5 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-black"><lucide.Shield className="w-4 h-4" /></div>
          <span className="font-bold text-sm uppercase tracking-widest text-purple-500">Admin</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white">
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black border-b border-white/5 p-4 flex flex-col gap-2 absolute w-full z-40 top-[73px]">
          <SidebarBtn active={activeView === 'orders'} onClick={() => {setActiveView('orders'); setMobileMenuOpen(false);}} icon={<lucide.Database />} label="Order Management" />
          <SidebarBtn active={activeView === 'logs'} onClick={() => {setActiveView('logs'); setMobileMenuOpen(false);}} icon={<lucide.Activity />} label="System Logs" />
          <button onClick={() => router.push('/admin/settings')} className="mt-2 p-3 text-zinc-400 font-bold text-left flex items-center gap-2"><lucide.Settings className="w-4 h-4"/> Platform Settings</button>
          <button onClick={() => window.open('/dashboard/client', '_blank')} className="mt-2 p-3 text-zinc-400 font-bold text-left flex items-center gap-2"><lucide.ExternalLink className="w-4 h-4"/> View Client UI</button>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto relative max-w-[1600px]">
        
        {/* ================= VIEW: ORDERS ================= */}
        {activeView === 'orders' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-black text-white">Pipeline Overview</h2>
                <p className="text-zinc-400 mt-1">Manage, update, and fulfill active research projects.</p>
              </div>
              <button onClick={fetchOrders} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition flex items-center gap-2">
                <lucide.RefreshCw className="w-3 h-3" /> Sync Data
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <StatCard label="Total Orders" value={filteredOrders.length} />
              <StatCard label="Active Projects" value={filteredOrders.filter(o => o['Workflow Status'] !== 'Completed' && o['Workflow Status'] !== 'Cancelled').length} color="text-amber-400" />
              <StatCard label="Awaiting Brief" value={filteredOrders.filter(o => o['Workflow Status'] === 'Briefing Received').length} color="text-purple-400" />
              <StatCard label="Pipeline Value" value={`₦${Math.round(filteredOrders.reduce((a,o)=>a+parsePriceStr(o['Financial Quote']),0)).toLocaleString()}`} />
              <StatCard label="Completed" value={filteredOrders.filter(o => o['Workflow Status'] === 'Completed').length} color="text-emerald-400" />
            </div>

            {/* Filter Bar */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <lucide.Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search ID, email, topic..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:border-purple-500 outline-none text-white" />
              </div>
              <select className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WorkflowStatus | '')}>
                <option value="">All Statuses</option><option>Briefing Received</option><option>Quote Sent</option><option>Synthesis Active</option><option>Completed</option><option>Cancelled</option>
              </select>
              <select className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
                <option value="">All Payments</option><option value="deposit_pending">Deposit Pending</option><option value="deposit_paid">Deposit Paid</option><option value="balance_pending">Balance Pending</option><option value="fully_paid">Fully Paid</option>
              </select>
              <button onClick={() => { setStatusFilter(''); setPaymentFilter(''); setSearchTerm(''); }} className="text-xs font-bold text-zinc-500 hover:text-white transition px-2">Clear</button>
            </div>

            {/* Data Grid */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-black border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="px-6 py-4 font-black">Order ID</th>
                      <th className="px-6 py-4 font-black">Client Info</th>
                      <th className="px-6 py-4 font-black">Topic</th>
                      <th className="px-6 py-4 font-black">Status</th>
                      <th className="px-6 py-4 font-black">Financials</th>
                      <th className="px-6 py-4 font-black text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paginatedOrders.map(order => {
                      const total = parsePriceStr(order['Financial Quote']);
                      const needsQuote = total <= 0 || order['Workflow Status'] === 'Briefing Received';
                      
                      return (
                        <tr key={order['Order ID']} className="hover:bg-white/5 transition group">
                          <td className="px-6 py-4">
                            <div className="font-mono text-xs font-bold">{order['Order ID']}</div>
                            <div className="text-[10px] text-zinc-500 mt-1">{formatDate(order['Timestamp'])}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-xs truncate max-w-[150px]">{order['Legal Name']}</div>
                            <div className="text-[10px] text-zinc-500 truncate max-w-[150px]">{order['Email']}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs truncate max-w-[200px] text-zinc-300" title={order['Research Topic']}>{order['Research Topic']}</div>
                            <div className="text-[9px] text-zinc-500 mt-1 uppercase">Tier: {order['Service Tier']}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                              order['Workflow Status'] === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              needsQuote ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                              'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {order['Workflow Status']}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`font-black text-xs ${needsQuote ? 'text-zinc-500' : 'text-emerald-400'}`}>{needsQuote ? 'Awaiting Quote' : formatNaira(total)}</div>
                            <div className="text-[9px] text-zinc-500 mt-1">
                              60%: {renderBool(order['60% Paid']) ? '✅' : '❌'} | 40%: {renderBool(order['40% Paid']) ? '✅' : '❌'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => window.open(`/dashboard/client?preview=${order['Order ID']}`, '_blank')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 transition" title="Preview as Client"><lucide.Eye className="w-4 h-4" /></button>
                            <button onClick={() => setDeliveryModalOrder(order)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition" title="Upload to Vault"><lucide.UploadCloud className="w-4 h-4" /></button>
                            <button onClick={() => setEditingOrder(order)} className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-bold rounded-lg transition">Manage Order</button>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedOrders.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500">No orders match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-white/5 flex justify-between items-center text-xs bg-black">
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Showing {paginatedOrders.length} of {filteredOrders.length}</span>
                <div className="flex gap-2">
                  <button disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)} className="px-4 py-2 bg-white/5 rounded-lg font-bold disabled:opacity-30">Prev</button>
                  <span className="px-4 py-2 text-zinc-400">Page {currentPage} of {totalPages || 1}</span>
                  <button disabled={currentPage===totalPages || totalPages===0} onClick={() => setCurrentPage(p=>p+1)} className="px-4 py-2 bg-white/5 rounded-lg font-bold disabled:opacity-30">Next</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW: LOGS ================= */}
        {activeView === 'logs' && (
          <div className="animate-in fade-in duration-300">
            <header className="mb-8">
              <h2 className="text-3xl font-black text-white">System Logs</h2>
              <p className="text-zinc-400 mt-1">Real-time tracking of automated email dispatch and system alerts.</p>
            </header>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-black border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500">
                  <tr><th className="px-6 py-4">Timestamp</th><th className="px-6 py-4">Recipient</th><th className="px-6 py-4">Subject Trigger</th><th className="px-6 py-4">Delivery Status</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {emailLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-xs font-mono text-zinc-400">{new Date(log.sent_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs font-bold">{log.recipient}</td>
                      <td className="px-6 py-4 text-xs">{log.subject}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${log.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {emailLogs.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">No logs recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= MODAL: MANAGE ORDER (ADMIN APPROVAL FLOW) ================= */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#050505] border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
              
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/50 rounded-t-3xl">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">Manage Order <span className="text-purple-500">{editingOrder['Order ID']}</span></h2>
                  <p className="text-xs text-zinc-500 mt-1">Client: {editingOrder['Legal Name']} ({editingOrder['Email']})</p>
                </div>
                <button onClick={() => setEditingOrder(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition"><lucide.X className="w-5 h-5 text-zinc-400" /></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8 flex-1">
                {/* Section 1: Financials & Admin Approval */}
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2"><lucide.Banknote className="w-4 h-4" /> Financial Assessment (Quote)</h3>
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-bold ml-1 block mb-2">Final Financial Quote (₦)</label>
                      <input type="number" className="w-full bg-black border border-white/10 rounded-xl p-4 font-black text-lg focus:border-purple-500 outline-none text-white" value={editingOrder['Financial Quote']} onChange={e => setEditingOrder({...editingOrder, 'Financial Quote': parseFloat(e.target.value)})} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-bold ml-1 block mb-2">Workflow State</label>
                      <select className="w-full bg-black border border-white/10 rounded-xl p-4 font-bold focus:border-purple-500 outline-none text-white" value={editingOrder['Workflow Status']} onChange={e => setEditingOrder({...editingOrder, 'Workflow Status': e.target.value as WorkflowStatus})}>
                        <option>Briefing Received</option><option>Quote Sent</option><option>Synthesis Active</option><option>Completed</option><option>Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-purple-400 mt-3 font-medium">Notice: Changing status to "Quote Sent" will automatically unlock the payment button on the client's dashboard and send an email notification.</p>
                </div>

                {/* Section 2: Fulfillment Status */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 border-b border-white/5 pb-2">Fulfillment Tracking</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold ml-1 block mb-2">60% Deposit Cleared</label>
                      <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" value={renderBool(editingOrder['60% Paid']) ? 'Yes' : 'No'} onChange={e => setEditingOrder({...editingOrder, '60% Paid': e.target.value === 'Yes'})}><option>No</option><option>Yes</option></select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold ml-1 block mb-2">40% Balance Cleared</label>
                      <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" value={renderBool(editingOrder['40% Paid']) ? 'Yes' : 'No'} onChange={e => setEditingOrder({...editingOrder, '40% Paid': e.target.value === 'Yes'})}><option>No</option><option>Yes</option></select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold ml-1 block mb-2">Work Submitted to Vault</label>
                      <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" value={renderBool(editingOrder['Work Submitted']) ? 'Yes' : 'No'} onChange={e => setEditingOrder({...editingOrder, 'Work Submitted': e.target.value === 'Yes'})}><option>No</option><option>Yes</option></select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-bold ml-1 block mb-2">Corrections Phase</label>
                      <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 outline-none" value={editingOrder['Corrections Status'] || 'None'} onChange={e => setEditingOrder({...editingOrder, 'Corrections Status': e.target.value as CorrectionsStatus})}><option>None</option><option>Requested</option><option>In Progress</option><option>Resubmitted</option></select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Manual Invoicing overrides */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 border-b border-white/5 pb-2">Manual Actions</h3>
                  <div className="flex gap-3">
                    <button onClick={() => generateInvoice(editingOrder['Order ID'], editingOrder['Financial Quote'] * 0.6, editingOrder['Email'], editingOrder['Legal Name'], 'DEPOSIT')} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition border border-white/5 flex items-center justify-center gap-2"><lucide.Send className="w-4 h-4" /> Force 60% Invoice Link</button>
                    <button onClick={() => generateInvoice(editingOrder['Order ID'], editingOrder['Financial Quote'] * 0.4, editingOrder['Email'], editingOrder['Legal Name'], 'BALANCE')} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition border border-white/5 flex items-center justify-center gap-2"><lucide.Send className="w-4 h-4" /> Force 40% Invoice Link</button>
                  </div>
                </div>

              </div>

              <div className="p-6 border-t border-white/10 bg-black/50 rounded-b-3xl flex gap-4">
                <button onClick={() => setEditingOrder(null)} className="px-6 py-4 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition">Cancel</button>
                <button onClick={saveOrderUpdates} className="flex-1 py-4 bg-purple-500 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-purple-400 transition shadow-[0_0_20px_rgba(168,85,247,0.3)]">Approve Brief & Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: VAULT DELIVERY UPLOAD ================= */}
        {deliveryModalOrder && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#050505] border border-blue-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_40px_rgba(59,130,246,0.15)]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2"><lucide.ShieldCheck className="text-blue-500" /> Vault Upload</h2>
                  <p className="text-xs text-blue-500 uppercase tracking-widest mt-1 font-bold">Order: {deliveryModalOrder['Order ID']}</p>
                </div>
                <button onClick={() => setDeliveryModalOrder(null)}><lucide.X className="w-5 h-5 text-slate-500 hover:text-white transition" /></button>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">Uploading the final deliverable will automatically mark the project as "Work Submitted" and trigger an email prompting the client to pay their 40% balance to unlock the file.</p>
                <label className="border-2 border-dashed border-zinc-800 hover:border-blue-500 bg-black rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition group">
                  <lucide.UploadCloud className="w-10 h-10 text-zinc-600 group-hover:text-blue-500 mb-3 transition" />
                  <span className="text-sm font-bold text-white mb-1">Select Encrypted File</span>
                  <span className="text-[10px] text-zinc-500 uppercase">.PDF, .DOCX, .ZIP</span>
                  <input type="file" className="hidden" onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)} />
                </label>
                {deliveryFile && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                    <lucide.FileCheck className="w-5 h-5 text-blue-500" />
                    <span className="text-xs font-bold text-blue-400 truncate">{deliveryFile.name}</span>
                  </div>
                )}
              </div>
              <div className="mt-8">
                <button onClick={handleDeliveryUpload} disabled={uploadingDelivery || !deliveryFile} className="w-full py-4 bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-blue-400 transition disabled:opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  {uploadingDelivery ? 'Encrypting & Storing...' : 'Lock in Vault & Notify Client'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================
function SidebarBtn({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center p-3 rounded-xl transition font-bold text-sm ${active ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
      <div className="flex items-center gap-3">
        {icon} <span>{label}</span>
      </div>
    </button>
  );
}

function StatCard({ label, value, color = "text-white" }: any) {
  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 flex flex-col justify-center">
      <div className={`text-2xl font-black ${color} truncate`}>{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">{label}</div>
    </div>
  );
}