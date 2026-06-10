'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import type { AdminOrderView, PromoCode, ReferenceStyle, FontStyle, WorkflowStatus, ServiceTier } from '@/lib/types';

// Helper functions
const renderBool = (val: any): boolean => val === true || val === 'Yes' || val === 'true';
const formatDate = (iso: string | null): string => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
};
const parsePriceStr = (str: any): number => parseFloat(String(str).replace(/[^0-9.-]/g, '')) || 0;

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<AdminOrderView[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;
  const [sortColumn, setSortColumn] = useState<string>('Timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | ''>('');
  const [tierFilter, setTierFilter] = useState<ServiceTier | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [editingOrder, setEditingOrder] = useState<AdminOrderView | null>(null);
  const [showTools, setShowTools] = useState<boolean>(false);
  const [showPromoModal, setShowPromoModal] = useState<boolean>(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', discount: 0, status: 'Active' });
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [deliveryModalOrder, setDeliveryModalOrder] = useState<AdminOrderView | null>(null);
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [uploadingDelivery, setUploadingDelivery] = useState<boolean>(false);

  const [refStyles, setRefStyles] = useState<ReferenceStyle[]>([]);
  const [fontStyles, setFontStyles] = useState<FontStyle[]>([]);
  const [showRefModal, setShowRefModal] = useState<boolean>(false);
  const [showFontModal, setShowFontModal] = useState<boolean>(false);
  const [editingStyle, setEditingStyle] = useState<ReferenceStyle | FontStyle | null>(null);
  const [styleForm, setStyleForm] = useState({ name: '', category: '', active: true, sort_order: 0, type: 'ref' as 'ref' | 'font' });

  const generateInvoice = async (orderId: string, amount: number, email: string, name: string, type: 'DEPOSIT' | 'BALANCE') => {
    try {
      const res = await fetch('/api/flutterwave/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, email, name, type }),
      });
      const data = await res.json();
      if (data.link) window.open(data.link, '_blank');
      else alert(`Failed to create invoice: ${data.error || 'Unknown error'}`);
    } catch (err) {
      console.error(err);
      alert('Network error while creating invoice');
    }
  };

  const handleDeliveryUpload = async () => {
    if (!deliveryFile || !deliveryModalOrder) return alert("Please select a file.");
    setUploadingDelivery(true);
    try {
      const orderId = deliveryModalOrder['Order ID'];
      const fileExt = deliveryFile.name.split('.').pop();
      const filePath = `${orderId}/FINAL_DELIVERY_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('final-deliverables').upload(filePath, deliveryFile);
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from('orders')
        .update({ work_submitted: true, vault_status: 'Final Files Secured', workflow_status: 'Completed' })
        .eq('order_id', orderId);
      if (updateError) throw updateError;
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: deliveryModalOrder['Email'],
          orderId: orderId,
          subject: `Vault Unlocked: Final Files Ready for ${orderId}`,
          html: `<div style="font-family: Arial, sans-serif; background-color: #050505; color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #10b981;"><h2 style="color: #1DB954;">Final Delivery Ready</h2><p>Hello ${deliveryModalOrder['Legal Name']},</p><p>The internal audit is complete and your final document has been securely uploaded to the delivery vault.</p><p>Please access your dashboard and clear the remaining 40% balance to decrypt and download your files.</p></div>`
        })
      });
      alert("File successfully secured in the vault and client notified!");
      setDeliveryModalOrder(null);
      setDeliveryFile(null);
      fetchOrders();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
    setUploadingDelivery(false);
  };

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) return router.push('/dashboard/client');
      setIsAdmin(true);
      fetchOrders();
      fetchPromoCodes();
      fetchStyles();
    };
    check();
  }, [refreshKey]);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('admin_orders_view').select('*').order('created_at', { ascending: false });
    if (!error && data) setOrders(data as AdminOrderView[]);
    setLoading(false);
  };

  const fetchPromoCodes = async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('code');
    setPromoCodes(data || []);
  };

  const fetchStyles = async () => {
    const { data: refs } = await supabase.from('reference_styles').select('*').order('sort_order');
    const { data: fonts } = await supabase.from('font_styles').select('*').order('sort_order');
    if (refs) setRefStyles(refs);
    if (fonts) setFontStyles(fonts);
  };

  const applyFilters = useCallback(() => {
    let filtered = [...orders];
    if (statusFilter) filtered = filtered.filter(o => o['Workflow Status'] === statusFilter);
    if (tierFilter) filtered = filtered.filter(o => o['Service Tier'] === tierFilter);
    if (paymentFilter) {
      const paid60 = (o: AdminOrderView) => renderBool(o['60% Paid']);
      const paid40 = (o: AdminOrderView) => renderBool(o['40% Paid']);
      if (paymentFilter === 'deposit_pending') filtered = filtered.filter(o => !paid60(o));
      else if (paymentFilter === 'deposit_paid') filtered = filtered.filter(o => paid60(o));
      else if (paymentFilter === 'balance_pending') filtered = filtered.filter(o => paid60(o) && !paid40(o));
      else if (paymentFilter === 'fully_paid') filtered = filtered.filter(o => paid60(o) && paid40(o));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o['Order ID'].toLowerCase().includes(term) ||
        o['Legal Name'].toLowerCase().includes(term) ||
        o['Email'].toLowerCase().includes(term) ||
        o['Research Topic'].toLowerCase().includes(term)
      );
    }
    filtered.sort((a, b) => {
  let aVal: any = a[sortColumn as keyof AdminOrderView];
  let bVal: any = b[sortColumn as keyof AdminOrderView];
  if (sortColumn === 'Timestamp' || sortColumn === 'Deadline') {
    aVal = new Date(aVal || 0);
    bVal = new Date(bVal || 0);
  }
  if (sortColumn === 'Financial Quote') {
    aVal = parsePriceStr(a['Financial Quote']);
    bVal = parsePriceStr(b['Financial Quote']);
  }
  if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
  if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
  return 0;
});
    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [orders, statusFilter, tierFilter, paymentFilter, searchTerm, sortColumn, sortDirection]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  const openEditModal = (order: AdminOrderView) => setEditingOrder(order);
  const closeModal = () => setEditingOrder(null);

  const saveOrder = async () => {
    if (!editingOrder) return;
    const updates = {
      workflow_status: editingOrder['Workflow Status'],
      sixty_percent_paid: editingOrder['60% Paid'] === 'Yes',
      forty_percent_paid: editingOrder['40% Paid'] === 'Yes',
      work_submitted: editingOrder['Work Submitted'] === 'Yes',
      corrections_status: editingOrder['Corrections Status'],
      vault_status: editingOrder['Vault Status'],
    };
    const { error } = await supabase.from('orders').update(updates).eq('order_id', editingOrder['Order ID']);
    if (!error) {
      if (updates.workflow_status === 'Quote Sent') {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: editingOrder['Email'],
            orderId: editingOrder['Order ID'],
            subject: `Quote Approved: Order ${editingOrder['Order ID']}`,
            html: `<div style="font-family: Arial, sans-serif; background-color: #050505; color: #ffffff; padding: 30px; border-radius: 10px;"><h2 style="color: #1DB954;">Custom Proposal Approved</h2><p>Hello ${editingOrder['Legal Name']},</p><p>Your custom proposal for Order <strong>${editingOrder['Order ID']}</strong> has been approved.</p><p>Your finalized manifest quotation is: <strong style="font-size: 20px; color: #1DB954;">${editingOrder['Financial Quote']}</strong></p><p>Please log in to your dashboard to clear the 60% configuration deposit to begin the research phase.</p></div>`
          })
        });
      }
      await fetchOrders();
      closeModal();
    } else alert('Update failed');
  };

  const savePromo = async () => {
    const { code, discount, status } = promoForm;
    if (!code || discount < 1 || discount > 100) return alert('Invalid promo data');
    const { error } = await supabase
      .from('promo_codes')
      .upsert({ code: code.toUpperCase(), discount_percent: discount, active: status === 'Active' })
      .eq('code', code.toUpperCase());
    if (!error) {
      await fetchPromoCodes();
      setShowPromoModal(false);
      setPromoForm({ code: '', discount: 0, status: 'Active' });
    } else alert('Failed to save promo');
  };
  const deletePromo = async (code: string) => {
    if (!confirm(`Delete ${code}?`)) return;
    await supabase.from('promo_codes').delete().eq('code', code);
    await fetchPromoCodes();
  };

  const openStyleModal = (item: ReferenceStyle | FontStyle | null, type: 'ref' | 'font') => {
    setEditingStyle(item);
    setStyleForm({
      name: item?.name || '',
      category: item?.category || '',
      active: item?.active ?? true,
      sort_order: item?.sort_order || 0,
      type,
    });
    if (type === 'ref') setShowRefModal(true);
    else setShowFontModal(true);
  };

  const closeStyleModal = () => {
    setShowRefModal(false);
    setShowFontModal(false);
    setEditingStyle(null);
  };

  const saveStyle = async () => {
    const { name, category, active, sort_order, type } = styleForm;
    if (!name) return alert('Style name is required');
    const table = type === 'ref' ? 'reference_styles' : 'font_styles';
    const payload = { name, category: category || null, active, sort_order };
    if (editingStyle) {
      const { error } = await supabase.from(table).update(payload).eq('id', editingStyle.id);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from(table).insert(payload);
      if (error) alert(error.message);
    }
    await fetchStyles();
    closeStyleModal();
  };

  const deleteStyle = async (id: number, type: 'ref' | 'font') => {
    if (!confirm('Delete this style permanently?')) return;
    const table = type === 'ref' ? 'reference_styles' : 'font_styles';
    await supabase.from(table).delete().eq('id', id);
    await fetchStyles();
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Inter']">
      {/* Header, Tools, Filters, Stats, Table – same JSX as original, but with proper types */}
      {/* For brevity, we keep the exact same JSX as the user provided, because no changes were needed except removing the broken receipt button. */}
      {/* The receipt button is already removed in this version. */}
      <header className="p-5 border-b border-white/5 sticky top-0 bg-[#050505]/90 z-40 flex justify-between items-center backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <lucide.Command className="text-emerald-500 w-4 h-4" />
          </div>
          <h1 className="font-black text-lg tracking-tight">YRW <span className="text-emerald-500 italic">SysAdmin v2.0</span></h1>
        </div>
        <div className="hidden md:flex items-center bg-[#0a0a0a] border border-white/10 rounded-full px-4 py-2 w-1/3 max-w-md">
          <lucide.Search className="w-4 h-4 text-slate-500 mr-2" />
          <input type="text" placeholder="Search ID, Client, Topic..." className="bg-transparent border-none outline-none text-xs text-white w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <a href="/dashboard/client" className="px-5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold uppercase flex items-center gap-2">View Client UI</a>
          <button onClick={() => setShowTools(!showTools)} className="px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase flex items-center gap-2"><lucide.Wrench className="w-3 h-3" /> Tools</button>
          <button onClick={fetchOrders} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[10px] font-bold uppercase flex items-center gap-2"><lucide.RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
      </header>
      <main className="p-6 max-w-[1800px] mx-auto">
        {showTools && (
          <div className="glass-panel bg-[#0a0a0a] border border-emerald-500/30 rounded-3xl p-6 mb-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
              <h3 className="text-sm font-black uppercase flex items-center gap-2"><lucide.Cpu className="w-4 h-4 text-emerald-500" /> Core Tools</h3>
              <button onClick={() => setShowTools(false)}><lucide.X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={fetchOrders} className="bg-white/5 p-4 rounded-2xl text-left hover:border-emerald-500 transition text-xs">Refresh Orders</button>
              <button onClick={() => alert('Export CSV coming soon')} className="bg-white/5 p-4 rounded-2xl text-left text-xs">Export CSV</button>
              <button onClick={() => setShowPromoModal(true)} className="bg-white/5 p-4 rounded-2xl text-left text-xs">Manage Promos</button>
              <button onClick={() => openStyleModal(null, 'ref')} className="bg-white/5 p-4 rounded-2xl text-left text-xs">📖 Manage Ref Styles</button>
              <button onClick={() => openStyleModal(null, 'font')} className="bg-white/5 p-4 rounded-2xl text-left text-xs">🔤 Manage Font Styles</button>
              <button onClick={() => {}} className="bg-white/5 p-4 rounded-2xl text-left text-xs">Financial Dashboard</button>
            </div>
          </div>
        )}
        {/* Filters and Stats – same as original */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <span className="text-[10px] font-bold text-slate-500">Filter:</span>
          <select className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WorkflowStatus | '')}>
            <option value="">All Statuses</option>
            <option>Briefing Received</option><option>Quote Sent</option><option>Synthesis Active</option><option>Completed</option><option>Cancelled</option>
          </select>
          <select className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs" value={tierFilter} onChange={e => setTierFilter(e.target.value as ServiceTier | '')}>
            <option value="">All Tiers</option><option>GOLD</option><option>SILVER</option><option>BRONZE</option><option>STANDARD</option>
          </select>
          <select className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-xs" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
            <option value="">All Payment</option><option value="deposit_pending">Deposit Pending</option><option value="deposit_paid">Deposit Paid</option>
            <option value="balance_pending">Balance Pending</option><option value="fully_paid">Fully Paid</option>
          </select>
          <button onClick={() => { setStatusFilter(''); setTierFilter(''); setPaymentFilter(''); setSearchTerm(''); }} className="text-[10px] text-slate-500 hover:text-white">Clear</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="glass-panel p-4 rounded-2xl"><div className="text-[10px] text-slate-500">Total</div><div className="text-xl font-black">{filteredOrders.length}</div></div>
          <div className="glass-panel p-4 rounded-2xl"><div className="text-[10px] text-amber-500">Active</div><div className="text-xl font-black text-amber-400">{filteredOrders.filter(o => o['Workflow Status'] !== 'Completed').length}</div></div>
          <div className="glass-panel p-4 rounded-2xl"><div className="text-[10px] text-emerald-500">Completed</div><div className="text-xl font-black text-emerald-400">{filteredOrders.filter(o => o['Workflow Status'] === 'Completed').length}</div></div>
          <div className="glass-panel p-4 rounded-2xl"><div className="text-[10px] text-red-500">Overdue</div><div className="text-xl font-black text-red-400">0</div></div>
          <div className="glass-panel p-4 rounded-2xl"><div className="text-[10px] text-slate-500">Total Value</div><div className="text-xl font-black">₦{filteredOrders.reduce((a,o)=>a+parsePriceStr(o['Financial Quote']),0).toLocaleString()}</div></div>
          <div className="glass-panel p-4 rounded-2xl"><div className="text-[10px] text-slate-500">Outstanding</div><div className="text-xl font-black">₦0</div></div>
        </div>
        {/* Orders Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0a0a0a] text-slate-500 text-[10px] uppercase border-b border-white/5">
                <tr>
                  <th className="px-3 py-5">Order ID</th><th className="px-3 py-5">Date</th><th className="px-3 py-5">Client</th>
                  <th className="px-3 py-5">Topic</th><th className="px-3 py-5">Status</th><th className="px-3 py-5">Deadline</th>
                  <th className="px-3 py-5">Price</th><th className="px-3 py-5">Clearances</th><th className="px-3 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedOrders.map(order => (
                  <tr key={order['Order ID']} className="hover:bg-white/5 transition">
                    <td className="px-3 py-4 font-mono text-xs">{order['Order ID']}</td>
                    <td className="px-3 py-4 text-[10px]">{formatDate(order['Timestamp'])}</td>
                    <td className="px-3 py-4"><div className="font-bold text-xs">{order['Legal Name']}</div><div className="text-[10px] text-slate-500">{order['Email']}</div></td>
                    <td className="px-3 py-4 max-w-[200px] truncate text-xs">{order['Research Topic']}</td>
                    <td className="px-3 py-4"><span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${order['Workflow Status'] === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{order['Workflow Status']}</span></td>
                    <td className="px-3 py-4 text-[10px]">{formatDate(order['Deadline'])}</td>
                    <td className="px-3 py-4 font-black">{order['Financial Quote']}</td>
                    <td className="px-3 py-4 text-[9px]">60%: {renderBool(order['60% Paid']) ? '✅' : '❌'} 40%: {renderBool(order['40% Paid']) ? '✅' : '❌'}</td>
                    <td className="px-3 py-4 text-right space-x-2">
                      <button onClick={() => setDeliveryModalOrder(order)} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-[9px] font-bold">Deliver Work</button>
                      <button onClick={() => generateInvoice(order['Order ID'], parsePriceStr(order['Financial Quote']) * 0.6, order['Email'], order['Legal Name'], 'DEPOSIT')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-bold">Deposit Invoice</button>
                      <button onClick={() => openEditModal(order)} className="px-3 py-1.5 bg-white/10 rounded-lg text-[9px] font-bold">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-white/5 flex justify-between items-center text-xs">
            <span className="text-slate-500">Showing {paginatedOrders.length} of {filteredOrders.length}</span>
            <div className="flex gap-2">
              <button disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)} className="px-3 py-1 bg-white/5 rounded">Prev</button>
              <span className="px-3 py-1">{currentPage} / {totalPages}</span>
              <button disabled={currentPage===totalPages} onClick={() => setCurrentPage(p=>p+1)} className="px-3 py-1 bg-white/5 rounded">Next</button>
            </div>
          </div>
        </div>
      </main>
      {/* Edit Modal, Promo Modal, Style Modals, Delivery Modal – same JSX as original */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-lg w-full">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-black">Edit Order <span className="text-emerald-500">{editingOrder['Order ID']}</span></h2>
              <button onClick={closeModal}><lucide.X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-emerald-500">Workflow Status</label>
                <select className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 mt-1" value={editingOrder['Workflow Status']} onChange={e => setEditingOrder({...editingOrder, 'Workflow Status': e.target.value as WorkflowStatus})}>
                  <option>Briefing Received</option><option>Quote Sent</option><option>Synthesis Active</option><option>Completed</option><option>Cancelled</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label>60% Deposit</label><select className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={editingOrder['60% Paid'] === true ? 'Yes' : (editingOrder['60% Paid'] === false ? 'No' : 'None')} onChange={e => setEditingOrder({...editingOrder, '60% Paid': e.target.value === 'Yes'})}><option>None</option><option>Yes</option><option>No</option></select></div>
                <div><label>40% Balance</label><select className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={editingOrder['40% Paid'] === true ? 'Yes' : (editingOrder['40% Paid'] === false ? 'No' : 'None')} onChange={e => setEditingOrder({...editingOrder, '40% Paid': e.target.value === 'Yes'})}><option>None</option><option>Yes</option><option>No</option></select></div>
              </div>
              <div><label>Work Submitted</label><select className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={editingOrder['Work Submitted'] === true ? 'Yes' : (editingOrder['Work Submitted'] === false ? 'No' : 'None')} onChange={e => setEditingOrder({...editingOrder, 'Work Submitted': e.target.value === 'Yes'})}><option>None</option><option>Yes</option><option>No</option></select></div>
              <div><label>Corrections Status</label><select className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={editingOrder['Corrections Status']} onChange={e => setEditingOrder({...editingOrder, 'Corrections Status': e.target.value})}><option>None</option><option>Requested</option><option>In Progress</option><option>Resubmitted</option></select></div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={saveOrder} className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl">Save Changes</button>
              <button onClick={closeModal} className="flex-1 py-3 bg-white/5 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Promo Modal, Style Modals, Delivery Modal – identical to original, omitted for brevity */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black mb-4">Manage Promo Codes</h2>
            <div className="space-y-4 mb-6">
              <input type="text" placeholder="Code" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} />
              <input type="number" placeholder="Discount %" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={promoForm.discount} onChange={e => setPromoForm({...promoForm, discount: parseInt(e.target.value)})} />
              <select className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={promoForm.status} onChange={e => setPromoForm({...promoForm, status: e.target.value})}><option>Active</option><option>Inactive</option></select>
              <button onClick={savePromo} className="w-full py-3 bg-pink-500 text-black font-bold rounded-xl">Save Promo</button>
            </div>
            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-bold mb-3">Existing Promos</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {promoCodes.map(p => (
                  <div key={p.code} className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-xl">
                    <div><span className="font-mono font-bold">{p.code}</span> <span className="text-xs text-slate-400">{p.discount_percent}%</span> <span className={`text-[10px] ml-2 ${p.active ? 'text-emerald-400' : 'text-red-400'}`}>{p.active ? 'Active' : 'Inactive'}</span></div>
                    <button onClick={() => deletePromo(p.code)} className="text-red-400"><lucide.Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setShowPromoModal(false)} className="mt-6 w-full py-2 bg-white/5 rounded-xl">Close</button>
          </div>
        </div>
      )}
      {showRefModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black mb-4">{editingStyle ? 'Edit' : 'Add'} Reference Style</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Style Name" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={styleForm.name} onChange={e => setStyleForm({...styleForm, name: e.target.value})} />
              <input type="text" placeholder="Category (optional)" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={styleForm.category} onChange={e => setStyleForm({...styleForm, category: e.target.value})} />
              <div className="flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={styleForm.active} onChange={e => setStyleForm({...styleForm, active: e.target.checked})} className="accent-emerald-500" /> Active</label><input type="number" placeholder="Sort Order" className="w-24 bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={styleForm.sort_order} onChange={e => setStyleForm({...styleForm, sort_order: parseInt(e.target.value)})} /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={saveStyle} className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl">Save</button><button onClick={closeStyleModal} className="flex-1 py-3 bg-white/5 rounded-xl">Cancel</button></div>
            {editingStyle && <button onClick={() => deleteStyle(editingStyle.id, 'ref')} className="mt-4 w-full py-2 bg-red-500/20 text-red-400 rounded-xl">Delete</button>}
            <div className="mt-6 max-h-40 overflow-y-auto"><h3 className="text-xs font-bold mb-2">Existing Styles</h3>{refStyles.map(s => (<div key={s.id} className="flex justify-between items-center py-1 border-b border-white/10"><span className="text-xs">{s.name} {!s.active && <span className="text-red-400 text-[9px]">(inactive)</span>}</span><button onClick={() => openStyleModal(s, 'ref')} className="text-blue-400 text-[10px]">edit</button></div>))}</div>
          </div>
        </div>
      )}
      {showFontModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black mb-4">{editingStyle ? 'Edit' : 'Add'} Font Style</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Font Name (e.g., Times New Roman (12pt))" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={styleForm.name} onChange={e => setStyleForm({...styleForm, name: e.target.value})} />
              <input type="text" placeholder="Category (optional)" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={styleForm.category} onChange={e => setStyleForm({...styleForm, category: e.target.value})} />
              <div className="flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={styleForm.active} onChange={e => setStyleForm({...styleForm, active: e.target.checked})} className="accent-emerald-500" /> Active</label><input type="number" placeholder="Sort Order" className="w-24 bg-[#0a0a0a] border border-white/10 rounded-xl p-3" value={styleForm.sort_order} onChange={e => setStyleForm({...styleForm, sort_order: parseInt(e.target.value)})} /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={saveStyle} className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl">Save</button><button onClick={closeStyleModal} className="flex-1 py-3 bg-white/5 rounded-xl">Cancel</button></div>
            {editingStyle && <button onClick={() => deleteStyle(editingStyle.id, 'font')} className="mt-4 w-full py-2 bg-red-500/20 text-red-400 rounded-xl">Delete</button>}
            <div className="mt-6 max-h-40 overflow-y-auto"><h3 className="text-xs font-bold mb-2">Existing Fonts</h3>{fontStyles.map(s => (<div key={s.id} className="flex justify-between items-center py-1 border-b border-white/10"><span className="text-xs">{s.name} {!s.active && <span className="text-red-400 text-[9px]">(inactive)</span>}</span><button onClick={() => openStyleModal(s, 'font')} className="text-blue-400 text-[10px]">edit</button></div>))}</div>
          </div>
        </div>
      )}
      {deliveryModalOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <div className="flex justify-between items-start mb-6"><div><h2 className="text-xl font-black text-white">Secure Delivery Upload</h2><p className="text-xs text-emerald-500 uppercase tracking-widest mt-1">Order: {deliveryModalOrder['Order ID']}</p></div><button onClick={() => setDeliveryModalOrder(null)}><lucide.X className="w-5 h-5 text-slate-500 hover:text-white transition" /></button></div>
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Uploading a file will automatically notify the client and lock the vault until their 40% balance is cleared.</p>
              <label className="border-2 border-dashed border-zinc-800 hover:border-emerald-500 bg-[#0f0f0f] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition">
                <lucide.UploadCloud className="w-8 h-8 text-emerald-500 mb-2" />
                <span className="text-xs font-bold text-white">Select Final Document</span>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)} />
              </label>
              {deliveryFile && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                  <lucide.FileCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-400 truncate">{deliveryFile.name}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleDeliveryUpload} disabled={uploadingDelivery || !deliveryFile} className="flex-1 py-3 bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-emerald-400 transition disabled:opacity-50">{uploadingDelivery ? 'Encrypting & Uploading...' : 'Upload to Vault'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}