'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import type { AdminOrderView, WorkflowStatus, CorrectionsStatus } from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { emailTemplates } from '@/lib/emailTemplates';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { ToastContainer, showToast } from '@/app/components/ui/Toast';
import StatusBadge from '@/app/components/ui/StatusBadge';
import PageHeader from '@/app/components/ui/PageHeader';

// ==========================================
// 1. HELPER FUNCTIONS
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

const parseAdditionalInfo = (raw: string | null): { notes?: string; extra_addons?: any[] } => {
  const str = raw || '';
  if (str.trim().startsWith('{') && str.trim().endsWith('}')) {
    try {
      return JSON.parse(str);
    } catch (e) {}
  }
  return { notes: str, extra_addons: [] };
};

const getPipelineDetails = (order: any) => {
  const oid = order?.['Order ID'] || order?.order_id || '';
  const top = order?.['Research Topic'] || order?.topic || '';
  
  if (oid.startsWith('DEV-') || top.startsWith('[DEV]')) {
    return {
      category: 'Software Dev',
      label: 'Full Stack & Custom Software',
    };
  }
  if (oid.startsWith('CT-') || top.startsWith('[CONTENT]')) {
    return {
      category: 'Content Writing',
      label: 'Content & Creative Writing',
    };
  }
  if (oid.startsWith('CUST-') || top.startsWith('[COMPLEX]')) {
    return {
      category: 'Bespoke Fieldwork',
      label: 'Custom Data & Fieldwork',
    };
  }
  if (oid.startsWith('CV-') || top.startsWith('[RESUME]')) {
    return {
      category: 'Resume & CV',
      label: 'Executive CVs & Resumes',
    };
  }
  
  return {
    category: 'Academic Research',
    label: 'Standard Academic Research',
  };
};

const sendStatusEmail = async (order: { orderId: string; email: string; legal_name: string; topic: string; financial_quote: number }, status: string) => {
  const orderEmailData = {
    order_id: order.orderId,
    legal_name: order.legal_name,
    email: order.email,
    topic: order.topic,
    financial_quote: order.financial_quote,
  };
  let template;
  switch (status) {
    case 'Quote Sent':
      template = emailTemplates.quoteSent(orderEmailData);
      break;
    case 'Work Submitted':
      template = emailTemplates.workSubmitted(orderEmailData);
      break;
    case 'Completed':
      template = emailTemplates.orderCompleted(orderEmailData);
      break;
    default: return;
  }
  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: order.email,
      subject: template.subject,
      html: template.html,
      orderId: order.orderId,
    }),
  }).catch(console.error);
};

// ==========================================
// 2. MAIN COMPONENT
// ==========================================
export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading system orders..." />}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<AdminOrderView[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | ''>('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [sortField, setSortField] = useState<keyof AdminOrderView>('Timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingOrder, setEditingOrder] = useState<AdminOrderView | null>(null);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<AdminOrderView | null>(null);
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [uploadingDelivery, setUploadingDelivery] = useState(false);
  const [deleteMathAnswer, setDeleteMathAnswer] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<AdminOrderView | null>(null);
  const [quotingAddonId, setQuotingAddonId] = useState<string | null>(null);
  const [addonQuotes, setAddonQuotes] = useState<{[addonId: string]: number}>({});
  const [savingAddonQuote, setSavingAddonQuote] = useState<string | null>(null);
  const [newAddonDesc, setNewAddonDesc] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [creatingAddonCharge, setCreatingAddonCharge] = useState(false);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase.from('admin_orders_view').select('*').order('Timestamp', { ascending: false });
    if (error) showToast(`Fetch error: ${error.message}`, 'error');
    if (data) setOrders(data as AdminOrderView[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('admin-order-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
        showToast('Orders refreshed', 'info');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

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
    filtered.sort((a, b) => {
      let aVal = a[sortField] ?? '';
      let bVal = b[sortField] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [orders, statusFilter, paymentFilter, searchTerm, sortField, sortDirection]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && orders.length > 0) {
      const match = orders.find(o => o['Order ID'] === openId);
      if (match) setEditingOrder(match);
    }
  }, [searchParams, orders]);

  const handleSort = (field: keyof AdminOrderView) => {
    if (field === sortField) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  // Guided Workflow Actions
  const handleStatusAction = async (action: string) => {
    if (!editingOrder) return;
    let updates: any = {};
    let newStatus = '';

    switch (action) {
      case 'MARK_DEPOSIT_PAID':
        updates = { sixty_percent_paid: true, workflow_status: 'Synthesis Active' };
        newStatus = 'Synthesis Active';
        break;
      case 'UPLOAD_DRAFT':
        setDeliveryModalOrder(editingOrder);
        setEditingOrder(null);
        return;
      case 'REQUEST_BALANCE':
        await generateInvoice(editingOrder['Order ID'], (editingOrder['Financial Quote'] ?? 0) * 0.4, editingOrder['Email'], editingOrder['Legal Name'], 'BALANCE');
        showToast('Balance invoice sent to client.', 'success');
        return;
      case 'MARK_COMPLETED':
        updates = { forty_percent_paid: true, workflow_status: 'Completed' };
        newStatus = 'Completed';
        break;
      default: return;
    }

    try {
      const res = await fetch('/api/admin/update-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: editingOrder['Order ID'], updates }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('Order updated successfully', 'success');
      if (newStatus) {
        await sendStatusEmail({
          orderId: editingOrder['Order ID'],
          email: editingOrder['Email'],
          legal_name: editingOrder['Legal Name'],
          topic: editingOrder['Research Topic'],
          financial_quote: editingOrder['Financial Quote'] ?? 0,
        }, newStatus);
      }
      await fetchOrders();
      setEditingOrder(null);
    } catch (err: any) {
      showToast(`Update failed: ${err.message}`, 'error');
    }
  };

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
    try {
      const res = await fetch('/api/admin/update-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: editingOrder['Order ID'], updates }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('Order updated successfully', 'success');
      if (updates.workflow_status === 'Quote Sent') {
        await sendStatusEmail({
          orderId: editingOrder['Order ID'],
          email: editingOrder['Email'],
          legal_name: editingOrder['Legal Name'],
          topic: editingOrder['Research Topic'],
          financial_quote: editingOrder['Financial Quote'] ?? 0,
        }, 'Quote Sent');
      }
      await fetchOrders();
      setEditingOrder(null);
    } catch (err: any) {
      showToast(`Failed to update order: ${err.message}`, 'error');
    }
  };

  const handleSaveAddonQuote = async (orderId: string, addonId: string) => {
    const price = addonQuotes[addonId];
    if (price === undefined || price < 0) {
      showToast('Please enter a valid price.', 'error');
      return;
    }
    setSavingAddonQuote(addonId);
    try {
      const res = await fetch('/api/admin/quote-addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, addonId, price }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Add-on charge set and approved successfully!', 'success');
        setQuotingAddonId(null);
        // Refresh editing order local state
        if (editingOrder) {
          const rawInfo = editingOrder['Additional Info'] || '';
          let payload = { notes: '', extra_addons: [] as any[] };
          try {
            payload = JSON.parse(rawInfo);
          } catch {}
          const idx = payload.extra_addons.findIndex((a: any) => a.id === addonId);
          if (idx !== -1) {
            payload.extra_addons[idx].price = price;
            payload.extra_addons[idx].status = price > 0 ? 'AWAITING_PAYMENT' : 'PENDING_QUOTE';
            setEditingOrder({
              ...editingOrder,
              ['Additional Info']: JSON.stringify(payload)
            });
          }
        }
        await fetchOrders();
      } else {
        showToast(`Quoting failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error saving addon quote.', 'error');
    }
    setSavingAddonQuote(null);
  };

  const handleAdminCreateAddon = async (orderId: string) => {
    if (!newAddonDesc.trim()) {
      showToast('Please enter an add-on description.', 'error');
      return;
    }
    const price = parseFloat(newAddonPrice);
    if (isNaN(price) || price < 0) {
      showToast('Please enter a valid positive charge.', 'error');
      return;
    }

    setCreatingAddonCharge(true);
    try {
      // 1. Fetch current order info
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('additional_info, email')
        .eq('order_id', orderId)
        .single();

      if (fetchError || !order) {
        throw new Error('Order not found');
      }

      // 2. Parse payload
      let payload = parseAdditionalInfo(order.additional_info);
      if (!payload.extra_addons) payload.extra_addons = [];

      const newAddon = {
        id: 'addon_' + Math.floor(100000 + Math.random() * 900000).toString(),
        name: newAddonDesc.trim(),
        price,
        status: price > 0 ? 'AWAITING_PAYMENT' : 'PENDING_QUOTE',
        created_at: new Date().toISOString(),
      };

      payload.extra_addons.push(newAddon);

      // 3. Update orders table
      const { error: updateError } = await supabase
        .from('orders')
        .update({ additional_info: JSON.stringify(payload) })
        .eq('order_id', orderId);

      if (updateError) throw updateError;

      // 4. Update editing local state
      if (editingOrder) {
        setEditingOrder({
          ...editingOrder,
          ['Additional Info']: JSON.stringify(payload)
        });
      }

      showToast('Extra add-on requirement added and quoted successfully!', 'success');
      setNewAddonDesc('');
      setNewAddonPrice('');

      // 5. Send notification email to user
      try {
        const { sendSystemEmail } = await import('@/lib/emailService');
        sendSystemEmail({
          to: order.email,
          subject: `💰 Extra Requirement Charge Added: Order #${orderId}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="color: #10b981;">Extra Requirement Added</h2>
              <p>An extra charge has been tagged to your order <strong>Order #${orderId}</strong> for additional requests not in the initial brief.</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
                <strong>Requirement:</strong> ${newAddon.name}<br/><br/>
                <strong>Price Tagged:</strong> <span style="font-size: 16px; color: #10b981; font-weight: bold;">${formatNaira(price)}</span>
              </div>
              <p>You can pay for this addon from your client dashboard wallet or via debit/credit card to authorize implementation.</p>
              <p style="margin-top: 30px;"><a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Pay & Activate Now</a></p>
            </div>
          `,
          orderId: orderId,
        }).catch(err => console.warn('Notification email failed:', err));
      } catch (emailErr) {
        console.warn('Failed to send email to user:', emailErr);
      }

      await fetchOrders();
    } catch (err: any) {
      showToast(`Failed to create add-on charge: ${err.message}`, 'error');
    }
    setCreatingAddonCharge(false);
  };

  const generateInvoice = async (orderId: string, amount: number, email: string, name: string, type: 'DEPOSIT' | 'BALANCE') => {
    try {
      const res = await fetch('/api/paystack/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, email, name, type }),
      });
      const data = await res.json();
      if (data.link) window.open(data.link, '_blank');
      else showToast(`Failed: ${data.error}`, 'error');
    } catch (err) {
      showToast('Network error triggering invoice.', 'error');
    }
  };

  const handleDeliveryUpload = async () => {
  if (!deliveryFile || !deliveryModalOrder) return showToast("Select a file.", "error");
  setUploadingDelivery(true);
  try {
    const orderId = deliveryModalOrder['Order ID'];
    const fileExt = deliveryFile.name.split('.').pop();
    const filePath = `${orderId}/FINAL_DELIVERY_${Date.now()}.${fileExt}`;
    
    // 1. Upload to storage
    const { error: uploadError } = await supabase.storage.from('final-deliverables').upload(filePath, deliveryFile);
    if (uploadError) throw uploadError;

    // 2. Insert record into final_deliverables table
    const { error: insertError } = await supabase
      .from('final_deliverables')
      .insert({
        order_id: orderId,
        file_path: filePath,
        file_name: deliveryFile.name,
        uploaded_at: new Date().toISOString(),
      });
    if (insertError) throw insertError;

    // 3. Update order status
    const res = await fetch('/api/admin/update-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        orderId, 
        updates: { work_submitted: true, vault_status: 'Final Files Secured' } 
      }),
    });
    if (!res.ok) throw new Error(await res.text());

    // 4. Send email notification
    await sendStatusEmail({
      orderId: deliveryModalOrder['Order ID'],
      email: deliveryModalOrder['Email'],
      legal_name: deliveryModalOrder['Legal Name'],
      topic: deliveryModalOrder['Research Topic'],
      financial_quote: deliveryModalOrder['Financial Quote'] ?? 0,
    }, 'Work Submitted');

    showToast("Uploaded securely to the vault.", "success");
    setDeliveryModalOrder(null);
    setDeliveryFile(null);
    fetchOrders(); // refresh the order list
  } catch (err: any) {
    showToast(`Upload failed: ${err.message}`, "error");
  }
  setUploadingDelivery(false);
};

  const initiateDeleteOrder = (order: AdminOrderView) => {
    setOrderToDelete(order);
    setDeleteMathAnswer('');
    setShowDeleteConfirm(true);
  };

  const confirmDeleteOrder = async () => {
    if (deleteMathAnswer !== '4') {
      showToast('Incorrect answer. Order not deleted.', 'error');
      setShowDeleteConfirm(false);
      return;
    }
    if (!orderToDelete) return;
    try {
      const res = await fetch('/api/admin/delete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderToDelete['Order ID'] }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast(`Order ${orderToDelete['Order ID']} permanently deleted.`, 'success');
      await fetchOrders();
      setShowDeleteConfirm(false);
      setOrderToDelete(null);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const SortIcon = ({ field }: { field: keyof AdminOrderView }) => {
    if (sortField !== field) return <lucide.ArrowUpDown className="w-3 h-3 ml-1 inline" />;
    return sortDirection === 'asc' ? <lucide.ArrowUp className="w-3 h-3 ml-1 inline" /> : <lucide.ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

  if (loading) return <LoadingScreen label="Loading orders..." accent="purple" />;

  return (
    <div className="p-6 md:p-10 overflow-y-auto relative max-w-[1600px]">
      <ToastContainer />

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-red-500/30 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-xl font-black text-primary mb-4">⚠️ Permanently Delete Order</h2>
            <p className="text-secondary text-sm mb-4">This action cannot be undone. All files and data related to <strong className="text-primary">{orderToDelete?.['Order ID']}</strong> will be removed.</p>
            <p className="text-primary font-bold mb-2">Confirm: What is 2 + 2?</p>
            <input
              type="text"
              value={deleteMathAnswer}
              onChange={e => setDeleteMathAnswer(e.target.value)}
              className="w-full bg-secondary border border-theme rounded-xl p-3 text-primary mb-4"
              placeholder="Type your answer"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-white/5 text-primary rounded-xl">Cancel</button>
              <button onClick={confirmDeleteOrder} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black">Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      <div className="animate-in fade-in duration-300">
        <PageHeader
          title="Order Management"
          description="Manage, update, and fulfill active research projects."
          breadcrumb="Admin / Orders"
          icon={<lucide.Database className="w-8 h-8 text-purple-500" />}
          actions={
            <button type="button" onClick={fetchOrders} className="btn-secondary flex items-center gap-2">
              <lucide.RefreshCw className="w-3 h-3" /> Sync Data
            </button>
          }
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Orders" value={filteredOrders.length} />
          <StatCard label="Active Projects" value={filteredOrders.filter(o => o['Workflow Status'] !== 'Completed' && o['Workflow Status'] !== 'Cancelled').length} color="text-amber-400" />
          <StatCard label="Awaiting Brief" value={filteredOrders.filter(o => o['Workflow Status'] === 'Briefing Received').length} color="text-purple-400" />
          <StatCard label="Pipeline Value" value={`₦${Math.round(filteredOrders.reduce((a,o)=>a+parsePriceStr(o['Financial Quote']),0)).toLocaleString()}`} />
          <StatCard label="Completed" value={filteredOrders.filter(o => o['Workflow Status'] === 'Completed').length} color="text-emerald-400" />
        </div>

        {/* Filter Bar */}
        <div className="bg-secondary border border-theme rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <lucide.Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search ID, email, topic..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-primary border border-theme rounded-xl pl-10 pr-4 py-2 text-xs focus:border-purple-500 outline-none text-primary" />
          </div>
          <select className="bg-primary border border-theme rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500 text-primary" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WorkflowStatus | '')}>
            <option value="">All Statuses</option><option>Briefing Received</option><option>Quote Sent</option><option>Synthesis Active</option><option>Completed</option><option>Cancelled</option>
          </select>
          <select className="bg-primary border border-theme rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500 text-primary" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
            <option value="">All Payments</option><option value="deposit_pending">Deposit Pending</option><option value="deposit_paid">Deposit Paid</option><option value="balance_pending">Balance Pending</option><option value="fully_paid">Fully Paid</option>
          </select>
          <button onClick={() => { setStatusFilter(''); setPaymentFilter(''); setSearchTerm(''); }} className="text-xs font-bold text-secondary hover:text-primary transition px-2">Clear</button>
        </div>

        {/* Data Grid */}
        <div className="bg-secondary border border-theme rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap table-row-hover">
              <thead className="bg-primary border-b border-theme text-[10px] uppercase tracking-widest text-secondary">
                <tr>
                  <th className="px-6 py-4 font-black cursor-pointer hover:text-primary" onClick={() => handleSort('Order ID')}>
                    Order ID <SortIcon field="Order ID" />
                  </th>
                  <th className="px-6 py-4 font-black cursor-pointer hover:text-primary" onClick={() => handleSort('Legal Name')}>
                    Client Info <SortIcon field="Legal Name" />
                  </th>
                  <th className="px-6 py-4 font-black cursor-pointer hover:text-primary" onClick={() => handleSort('Research Topic')}>
                    Topic <SortIcon field="Research Topic" />
                  </th>
                  <th className="px-6 py-4 font-black cursor-pointer hover:text-primary" onClick={() => handleSort('Workflow Status')}>
                    Status <SortIcon field="Workflow Status" />
                  </th>
                  <th className="px-6 py-4 font-black cursor-pointer hover:text-primary" onClick={() => handleSort('Financial Quote')}>
                    Financials <SortIcon field="Financial Quote" />
                  </th>
                  <th className="px-6 py-4 font-black text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {paginatedOrders.map(order => {
                  const total = parsePriceStr(order['Financial Quote']);
                  const needsQuote = total <= 0 || order['Workflow Status'] === 'Briefing Received';
                  return (
                    <tr key={order['Order ID']} className="hover:bg-white/5 transition group">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-primary">{order['Order ID']}</div>
                        <div className="text-[10px] text-secondary mt-1">{formatDate(order['Timestamp'])}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-xs truncate max-w-[150px] text-primary">{order['Legal Name']}</div>
                        <div className="text-[10px] text-secondary truncate max-w-[150px]">{order['Email']}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs truncate max-w-[200px] text-primary" title={order['Research Topic']}>{order['Research Topic']}</div>
                        <div className="text-[9px] text-secondary mt-1 uppercase">Tier: {order['Service Tier']}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={order['Workflow Status']} />
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-black text-xs ${needsQuote ? 'text-secondary' : 'text-emerald-400'}`}>{needsQuote ? 'Awaiting Quote' : formatNaira(total)}</div>
                        <div className="text-[9px] text-secondary mt-1">
                          60%: {renderBool(order['60% Paid']) ? '✅' : '❌'} | 40%: {renderBool(order['40% Paid']) ? '✅' : '❌'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => window.open(`/dashboard/client?preview=${order['Order ID']}`, '_blank')} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-secondary transition" title="Preview as Client"><lucide.Eye className="w-4 h-4" /></button>
                        <button onClick={() => setDeliveryModalOrder(order)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition" title="Upload to Vault"><lucide.UploadCloud className="w-4 h-4" /></button>
                        <button onClick={() => setEditingOrder(order)} className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-bold rounded-lg transition">Manage Order</button>
                        <button onClick={() => initiateDeleteOrder(order)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition" title="Delete Order"><lucide.Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
                {paginatedOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="empty-state border-0 bg-transparent py-4">
                        <lucide.Search className="w-10 h-10 text-secondary mx-auto mb-3" />
                        <p className="text-secondary text-sm">No orders match your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-theme flex justify-between items-center text-xs bg-primary">
            <span className="text-secondary font-bold uppercase tracking-widest text-[10px]">Showing {paginatedOrders.length} of {filteredOrders.length}</span>
            <div className="flex gap-2">
              <button disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)} className="px-4 py-2 bg-white/5 rounded-lg font-bold disabled:opacity-30 text-primary">Prev</button>
              <span className="px-4 py-2 text-secondary">Page {currentPage} of {totalPages || 1}</span>
              <button disabled={currentPage===totalPages || totalPages===0} onClick={() => setCurrentPage(p=>p+1)} className="px-4 py-2 bg-white/5 rounded-lg font-bold disabled:opacity-30 text-primary">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Manage Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-theme rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-theme flex justify-between items-center bg-secondary rounded-t-3xl">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2 text-primary">
                  Manage Order <span className="text-purple-500">{editingOrder['Order ID']}</span>
                </h2>
                <p className="text-xs text-secondary mt-1">Client: {editingOrder['Legal Name']} ({editingOrder['Email']})</p>
              </div>
              <button type="button" onClick={() => setEditingOrder(null)} className="p-2 bg-secondary hover:bg-white/10 rounded-full transition" aria-label="Close">
                <lucide.X className="w-5 h-5 text-secondary" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2"><lucide.Zap className="w-4 h-4" /> Workflow Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {editingOrder['Workflow Status'] === 'Briefing Received' && (
                    <button type="button" onClick={() => showToast('Set quote and status to "Quote Sent" manually', 'info')} className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl text-xs">Generate Quote</button>
                  )}
                  {editingOrder['Workflow Status'] === 'Quote Sent' && !renderBool(editingOrder['60% Paid']) && (
                    <button type="button" onClick={() => handleStatusAction('MARK_DEPOSIT_PAID')} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs">Mark Deposit Paid (60%)</button>
                  )}
                  {renderBool(editingOrder['60% Paid']) && !renderBool(editingOrder['Work Submitted']) && (
                    <button type="button" onClick={() => handleStatusAction('UPLOAD_DRAFT')} className="px-4 py-2 bg-blue-500 text-white font-bold rounded-xl text-xs">Upload Draft / Work</button>
                  )}
                  {renderBool(editingOrder['Work Submitted']) && !renderBool(editingOrder['40% Paid']) && (
                    <button type="button" onClick={() => handleStatusAction('REQUEST_BALANCE')} className="px-4 py-2 bg-amber-500 text-black font-bold rounded-xl text-xs">Request Balance Payment</button>
                  )}
                  {renderBool(editingOrder['40% Paid']) && editingOrder['Workflow Status'] !== 'Completed' && (
                    <button type="button" onClick={() => handleStatusAction('MARK_COMPLETED')} className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs">Mark as Completed</button>
                  )}
                </div>
              </div>
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2"><lucide.Banknote className="w-4 h-4" /> Financial Assessment (Quote)</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Final Financial Quote (₦)</label>
                    <input type="number" className="w-full bg-secondary border border-theme rounded-xl p-4 font-black text-lg focus:border-purple-500 outline-none text-primary" value={editingOrder['Financial Quote'] ?? ''} onChange={e => setEditingOrder({...editingOrder, 'Financial Quote': parseFloat(e.target.value)})} />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Workflow State</label>
                    <select className="w-full bg-secondary border border-theme rounded-xl p-4 font-bold focus:border-purple-500 outline-none text-primary" value={editingOrder['Workflow Status']} onChange={e => setEditingOrder({...editingOrder, 'Workflow Status': e.target.value as WorkflowStatus})}>
                      <option>Briefing Received</option><option>Quote Sent</option><option>Synthesis Active</option><option>Completed</option><option>Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-4 border-b border-theme pb-2">Fulfillment Tracking</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">60% Deposit Cleared</label><select className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm focus:border-purple-500 outline-none text-primary" value={renderBool(editingOrder['60% Paid']) ? 'Yes' : 'No'} onChange={e => setEditingOrder({...editingOrder, '60% Paid': e.target.value === 'Yes'})}><option>No</option><option>Yes</option></select></div>
                  <div><label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">40% Balance Cleared</label><select className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm focus:border-purple-500 outline-none text-primary" value={renderBool(editingOrder['40% Paid']) ? 'Yes' : 'No'} onChange={e => setEditingOrder({...editingOrder, '40% Paid': e.target.value === 'Yes'})}><option>No</option><option>Yes</option></select></div>
                  <div><label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Work Submitted to Vault</label><select className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm focus:border-purple-500 outline-none text-primary" value={renderBool(editingOrder['Work Submitted']) ? 'Yes' : 'No'} onChange={e => setEditingOrder({...editingOrder, 'Work Submitted': e.target.value === 'Yes'})}><option>No</option><option>Yes</option></select></div>
                  <div><label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Corrections Phase</label><select className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm focus:border-purple-500 outline-none text-primary" value={editingOrder['Corrections Status'] || 'None'} onChange={e => setEditingOrder({...editingOrder, 'Corrections Status': e.target.value as CorrectionsStatus})}><option>None</option><option>Requested</option><option>In Progress</option><option>Resubmitted</option></select></div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-4 border-b border-theme pb-2">Client Brief Details</h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-secondary block mb-1 font-bold">Research Topic / Briefing Objective</span>
                    <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Research Topic']}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Word Count Limit</span>
                      <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Word Count'] ? `${editingOrder['Word Count'].toLocaleString()} Words` : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Estimated Pages</span>
                      <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Word Count'] ? `${Math.ceil(editingOrder['Word Count'] / 275)} Pages` : 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Reference Style</span>
                      <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Reference Style'] || 'Standard'}</p>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Font Preference</span>
                      <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Font Specification'] || 'Standard'}</p>
                    </div>
                  </div>

                  {editingOrder['Media Sync'] && (
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Media / External Resource Link</span>
                      <a href={editingOrder['Media Sync']} target="_blank" rel="noopener noreferrer" className="p-3 bg-secondary border border-theme rounded-xl text-blue-450 font-bold block truncate hover:underline">
                        🔗 {editingOrder['Media Sync']}
                      </a>
                    </div>
                  )}

                  {(() => {
                    const addonInfo = parseAdditionalInfo(editingOrder['Additional Info']);
                    return addonInfo.notes ? (
                      <div>
                        <span className="text-secondary block mb-1 font-bold">Client Instructions & Notes</span>
                        <p className="bg-secondary p-4 rounded-xl border border-theme text-primary whitespace-pre-wrap leading-relaxed font-medium">{addonInfo.notes}</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-4 border-b border-theme pb-2">Custom Add-on Requests</h3>
                {(() => {
                  const addonInfo = parseAdditionalInfo(editingOrder['Additional Info']);
                  if (!addonInfo.extra_addons || addonInfo.extra_addons.length === 0) {
                    return <p className="text-xs text-secondary font-medium">No custom add-ons requested by client.</p>;
                  }
                  return (
                    <div className="space-y-3">
                      {addonInfo.extra_addons.map((a: any) => (
                        <div key={a.id} className="p-4 bg-secondary border border-theme rounded-2xl text-xs space-y-3">
                          <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                              <p className="font-bold text-primary">{a.name}</p>
                              <p className="text-[10px] text-secondary mt-1">Requested: {new Date(a.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              a.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                              a.status === 'AWAITING_PAYMENT' ? 'bg-amber-500/10 text-amber-455 border border-amber-500/20' :
                              'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}>
                              {a.status === 'PENDING_QUOTE' ? 'Needs Quote' : a.status === 'AWAITING_PAYMENT' ? 'Awaiting Payment' : 'Paid & Active'}
                            </span>
                          </div>

                          {a.status === 'PENDING_QUOTE' ? (
                            <div className="space-y-2">
                              <label className="text-[10px] text-secondary uppercase font-bold block">Define Addon Charge (₦)</label>
                              <div className="flex gap-2">
                                <input 
                                  type="number" 
                                  placeholder="Enter Price in Naira" 
                                  value={addonQuotes[a.id] ?? ''} 
                                  onChange={e => setAddonQuotes({...addonQuotes, [a.id]: parseFloat(e.target.value)})}
                                  className="flex-1 bg-primary border border-theme rounded-xl px-3 py-2 text-xs text-primary focus:border-purple-500 outline-none"
                                />
                                <button 
                                  onClick={() => handleSaveAddonQuote(editingOrder['Order ID'], a.id)}
                                  disabled={savingAddonQuote === a.id}
                                  className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl text-xs hover:bg-purple-400 transition cursor-pointer"
                                >
                                  {savingAddonQuote === a.id ? 'Saving...' : 'Set Quote'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center bg-primary p-3 rounded-xl border border-theme">
                              <span className="text-secondary font-bold">Charge Set:</span>
                              <span className="font-black text-primary text-xs">{formatNaira(a.price)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* Admin Proactive Addon Creation form */}
                <div className="bg-card border border-theme p-4 rounded-2xl space-y-3 mt-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary ml-1 font-bold">Add Custom Requirement & Price Tag</label>
                  <input 
                    type="text"
                    placeholder="E.g. Extra 5 slides presentation deck, or Custom modules" 
                    value={newAddonDesc} 
                    onChange={e => setNewAddonDesc(e.target.value)} 
                    className="w-full bg-secondary border border-theme p-3 rounded-xl text-xs text-primary focus:border-purple-500 outline-none transition font-bold"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      placeholder="Price in Naira (e.g. 15000)" 
                      value={newAddonPrice} 
                      onChange={e => setNewAddonPrice(e.target.value)} 
                      className="flex-1 bg-secondary border border-theme p-3 rounded-xl text-xs text-primary focus:border-purple-500 outline-none transition font-black"
                    />
                    <button 
                      onClick={() => handleAdminCreateAddon(editingOrder['Order ID'])}
                      disabled={creatingAddonCharge || !newAddonDesc.trim() || !newAddonPrice}
                      className="px-6 bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-purple-400 transition cursor-pointer disabled:opacity-50"
                    >
                      {creatingAddonCharge ? 'Creating...' : 'Add & Tag Price'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-4 border-b border-theme pb-2">Manual Actions</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => generateInvoice(editingOrder['Order ID'], (editingOrder['Financial Quote'] ?? 0) * 0.6, editingOrder['Email'], editingOrder['Legal Name'], 'DEPOSIT')} className="flex-1 py-3 bg-secondary hover:bg-white/5 text-primary rounded-xl text-xs font-bold transition border border-theme flex items-center justify-center gap-2"><lucide.Send className="w-4 h-4" /> Force 60% Invoice Link</button>
                  <button type="button" onClick={() => generateInvoice(editingOrder['Order ID'], (editingOrder['Financial Quote'] ?? 0) * 0.4, editingOrder['Email'], editingOrder['Legal Name'], 'BALANCE')} className="flex-1 py-3 bg-secondary hover:bg-white/5 text-primary rounded-xl text-xs font-bold transition border border-theme flex items-center justify-center gap-2"><lucide.Send className="w-4 h-4" /> Force 40% Invoice Link</button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-theme bg-secondary rounded-b-3xl flex flex-col sm:flex-row gap-4">
              <button type="button" onClick={() => setEditingOrder(null)} className="px-6 py-4 bg-secondary border border-theme text-primary font-bold rounded-xl hover:bg-white/5 transition">Cancel</button>
              <button type="button" onClick={saveOrderUpdates} className="flex-1 py-4 bg-purple-500 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-purple-400 transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Upload Modal */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-blue-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_40px_rgba(59,130,246,0.15)]">
            <div className="flex justify-between items-start mb-6">
              <div><h2 className="text-xl font-black text-primary flex items-center gap-2"><lucide.ShieldCheck className="text-blue-500" /> Vault Upload</h2><p className="text-xs text-blue-500 uppercase tracking-widest mt-1 font-bold">Order: {deliveryModalOrder['Order ID']}</p></div>
              <button onClick={() => setDeliveryModalOrder(null)}><lucide.X className="w-5 h-5 text-slate-500 hover:text-primary transition" /></button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-secondary leading-relaxed">Uploading the final deliverable will automatically mark the project as "Work Submitted" and trigger an email prompting the client to pay their 40% balance to unlock the file.</p>
              <label className="border-2 border-dashed border-theme hover:border-blue-500 bg-primary rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition group">
                <lucide.UploadCloud className="w-10 h-10 text-secondary group-hover:text-blue-500 mb-3 transition" />
                <span className="text-sm font-bold text-primary mb-1">Select Encrypted File</span>
                <span className="text-[10px] text-secondary uppercase">.PDF, .DOCX, .ZIP</span>
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
    </div>
  );
}

function StatCard({ label, value, color = "text-white" }: any) {
  return (
    <div className="bg-card border border-theme rounded-2xl p-5 flex flex-col justify-center">
      <div className={`text-2xl font-black ${color} truncate`}>{value}</div>
      <div className="text-[10px] text-secondary uppercase tracking-widest font-bold mt-1">{label}</div>
    </div>
  );
}