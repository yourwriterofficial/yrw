'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import type { AdminOrderView, WorkflowStatus, CorrectionsStatus } from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { emailTemplates } from '@/lib/emailTemplates';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';
import StatusBadge from '@/app/components/ui/StatusBadge';
import PageHeader from '@/app/components/ui/PageHeader';
import StatCard from '@/app/components/ui/StatCard';

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
  if (oid.startsWith('CUST-') || oid.startsWith('STAT-') || top.startsWith('[COMPLEX]') || top.startsWith('[CUSTOM]')) {
    return {
      category: 'Bespoke Fieldwork',
      label: 'Statistics, Maths, Financial & Fieldwork',
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

const sendStatusEmail = async (order: { 
  orderId: string; 
  email: string; 
  legal_name: string; 
  topic: string; 
  financial_quote: number; 
  payment_milestones?: any[];
  sixty_percent_paid?: boolean;
  forty_percent_paid?: boolean;
}, status: string) => {
  const orderEmailData = {
    order_id: order.orderId,
    legal_name: order.legal_name,
    email: order.email,
    topic: order.topic,
    financial_quote: order.financial_quote,
    payment_milestones: order.payment_milestones,
    sixty_percent_paid: order.sixty_percent_paid,
    forty_percent_paid: order.forty_percent_paid,
  };
  let template;
  switch (status) {
    case 'Quote Sent':
      template = emailTemplates.quoteSent(orderEmailData);
      break;
    case 'Work Submitted':
      // If the client has already paid the 40% balance or the topic is a pre-packaged project topic
      if (order.forty_percent_paid || order.topic.startsWith('[PROJECT]')) {
        template = emailTemplates.orderCompleted(orderEmailData);
      } else {
        template = emailTemplates.workSubmitted(orderEmailData);
      }
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
  const [scheduledAt, setScheduledAt] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  const openDeliveryModal = (order: AdminOrderView) => {
    setDeliveryModalOrder(order);
    setDeliveryFile(null);
    setScheduledAt('');
    setNotifyEmail(true);
    setNotifyInApp(true);
  };

  const [deleteMathAnswer, setDeleteMathAnswer] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<AdminOrderView | null>(null);
  const [quotingAddonId, setQuotingAddonId] = useState<string | null>(null);
  const [addonQuotes, setAddonQuotes] = useState<{[addonId: string]: number}>({});
  const [savingAddonQuote, setSavingAddonQuote] = useState<string | null>(null);
  const [newAddonDesc, setNewAddonDesc] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [sendingInvoiceVia, setSendingInvoiceVia] = useState<'EMAIL' | 'WHATSAPP' | null>(null);
  // Full order row (payment_milestones etc.) for the currently-open modal
  const [fullOrder, setFullOrder] = useState<any>(null);
  const [milestoneBusy, setMilestoneBusy] = useState<string | null>(null);

  // Create-order-for-client modal states
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({
    name: '', email: '', whatsapp: '', company: '', address: '',
    topic: '', serviceTier: 'CUSTOM', quote: '', deadline: '', wordCount: '',
    paymentStructure: '60/40', additionalInfo: '',
    isCatalogOrder: false,
    markPaid: false,
    triggerNotification: true,
  });
  const [newOrderMilestones, setNewOrderMilestones] = useState<Array<{ name: string; percentage: number; trigger: string }>>([
    { name: 'Initial Deposit', percentage: 40, trigger: 'Upon signing this agreement' },
    { name: 'Second Payment', percentage: 30, trigger: 'Completion of core project phase' },
    { name: 'Final Payment', percentage: 30, trigger: 'Final delivery and client sign off' },
  ]);

  const [orderCategory, setOrderCategory] = useState<'CATALOG' | 'ACADEMIC' | 'DEV' | 'CONTENT' | 'CV'>('ACADEMIC');
  const [deadlineType, setDeadlineType] = useState<'offset' | 'date'>('offset');
  const [deadlineValue, setDeadlineValue] = useState('30');
  const [deadlineUnit, setDeadlineUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [customDeadlineDate, setCustomDeadlineDate] = useState('');
  const [catalogTopics, setCatalogTopics] = useState<any[]>([]);

  // Fetch catalog topics
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('project_topics')
        .select('id, title, department, level, price')
        .eq('is_active', true)
        .order('title', { ascending: true });
      if (data) setCatalogTopics(data);
    })();
  }, []);

  // Sync category defaults
  useEffect(() => {
    if (orderCategory === 'CATALOG') {
      setNewOrder(prev => ({
        ...prev,
        isCatalogOrder: true,
        serviceTier: 'STANDARD',
        paymentStructure: '60/40',
        markPaid: true,
      }));
      setDeadlineType('offset');
    } else {
      setNewOrder(prev => ({
        ...prev,
        isCatalogOrder: false,
        serviceTier: 'CUSTOM',
        paymentStructure: '60/40',
        markPaid: false,
      }));
      setDeadlineType('date');
    }
  }, [orderCategory]);

  // Compute deadline
  useEffect(() => {
    if (deadlineType === 'offset') {
      const val = parseInt(deadlineValue) || 0;
      let ms = 0;
      if (deadlineUnit === 'minutes') ms = val * 60 * 1000;
      else if (deadlineUnit === 'hours') ms = val * 60 * 60 * 1000;
      else if (deadlineUnit === 'days') ms = val * 24 * 60 * 60 * 1000;

      if (ms > 0) {
        const computed = new Date(Date.now() + ms).toISOString();
        setNewOrder(prev => ({ ...prev, deadline: computed }));
      } else {
        setNewOrder(prev => ({ ...prev, deadline: '' }));
      }
    } else {
      setNewOrder(prev => ({ ...prev, deadline: customDeadlineDate }));
    }
  }, [deadlineType, deadlineValue, deadlineUnit, customDeadlineDate]);

  const submitCreateOrder = async () => {
    if (!newOrder.name || !newOrder.email || !newOrder.topic || !newOrder.deadline || !newOrder.quote) {
      return showToast('Fill in name, email, topic, deadline, and quote.', 'error');
    }
    if (newOrder.paymentStructure === 'CUSTOM') {
      const sum = newOrderMilestones.reduce((s, m) => s + Number(m.percentage || 0), 0);
      if (sum !== 100) return showToast(`Milestone percentages must sum to 100% (currently ${sum}%).`, 'error');
    }
    setCreatingOrder(true);
    try {
      const res = await fetch('/api/admin/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newOrder,
          quote: Number(newOrder.quote),
          wordCount: newOrder.wordCount ? Number(newOrder.wordCount) : undefined,
          milestones: newOrder.paymentStructure === 'CUSTOM' ? newOrderMilestones : [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Order ${data.orderId} created${data.isNewUser ? ' — client invited by email' : ' & client notified'}.`, 'success');
        setShowCreateOrder(false);
        setNewOrder({ name: '', email: '', whatsapp: '', company: '', address: '', topic: '', serviceTier: 'CUSTOM', quote: '', deadline: '', wordCount: '', paymentStructure: '60/40', additionalInfo: '', isCatalogOrder: false, markPaid: false, triggerNotification: true });
        setOrderCategory('ACADEMIC');
        setDeadlineValue('30');
        setDeadlineUnit('minutes');
        setCustomDeadlineDate('');
        await fetchOrders();
      } else {
        showToast(data.error || 'Failed to create order', 'error');
      }
    } catch {
      showToast('Network error creating order', 'error');
    }
    setCreatingOrder(false);
  };

  useEffect(() => {
    if (!editingOrder) { setFullOrder(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_id, client_id, payment_structure_type, payment_milestones, financial_quote')
        .eq('order_id', editingOrder['Order ID'])
        .single();
      if (!cancelled) setFullOrder(data || null);
    })();
    return () => { cancelled = true; };
  }, [editingOrder]);

  const toggleMilestone = async (index: number, field: 'paid' | 'delivered', value: boolean) => {
    if (!fullOrder) return;
    setMilestoneBusy(`${index}-${field}`);
    try {
      const res = await fetch('/api/admin/update-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: fullOrder.order_id, milestoneIndex: index, field, value }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFullOrder({ ...fullOrder, payment_milestones: data.milestones });
        showToast(`Milestone ${field === 'paid' ? (value ? 'marked paid' : 'marked unpaid') : (value ? 'marked delivered' : 'unmarked')}${fullOrder.client_id ? ' — client notified' : ''}`, 'success');
        await fetchOrders();
      } else {
        showToast(data.error || 'Update failed', 'error');
      }
    } catch {
      showToast('Network error updating milestone', 'error');
    }
    setMilestoneBusy(null);
  };

  const [invoiceSendFormat, setInvoiceSendFormat] = useState<'link' | 'image' | 'pdf'>('link');
  const sendOrderAsInvoice = async (orderId: string, via: 'EMAIL' | 'WHATSAPP') => {
    setSendingInvoiceVia(via);
    try {
      const res = await fetch('/api/admin/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, via, format: invoiceSendFormat === 'link' ? undefined : invoiceSendFormat }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to send invoice', 'error'); return; }
      if (via === 'WHATSAPP' && data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
        showToast('Opening WhatsApp — invoice marked as sent', 'success');
      } else {
        showToast(invoiceSendFormat === 'link' ? 'Invoice emailed to client' : `Invoice emailed with ${invoiceSendFormat.toUpperCase()} attached`, 'success');
      }
    } catch {
      showToast('Network error sending invoice', 'error');
    } finally {
      setSendingInvoiceVia(null);
    }
  };
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
        openDeliveryModal(editingOrder);
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
          sixty_percent_paid: updates.sixty_percent_paid !== undefined ? updates.sixty_percent_paid : editingOrder['60% Paid'],
          forty_percent_paid: updates.forty_percent_paid !== undefined ? updates.forty_percent_paid : editingOrder['40% Paid'],
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
          payment_milestones: fullOrder?.payment_milestones,
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
      const payload = parseAdditionalInfo(order.additional_info);
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

  const toLocalISO = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const getScheduleSummary = () => {
    if (!scheduledAt) return '⚡ Deliver Instantly (Immediate release)';
    const diff = new Date(scheduledAt).getTime() - Date.now();
    if (diff <= 0) return '⚡ Deliver Instantly (Scheduled time is in the past)';
    const hours = Math.round(diff / (60 * 60 * 1000) * 10) / 10;
    if (hours < 24) {
      return `⏰ Locked in Vault for ${hours} hour(s) (Releases today/tomorrow at ${new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    }
    const days = Math.round(hours / 24 * 10) / 10;
    return `📅 Locked in Vault for ${days} day(s) (Releases on ${new Date(scheduledAt).toLocaleDateString()} at ${new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
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
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
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

      // 4. Send email notification if enabled
      if (notifyEmail) {
        await sendStatusEmail({
          orderId: deliveryModalOrder['Order ID'],
          email: deliveryModalOrder['Email'],
          legal_name: deliveryModalOrder['Legal Name'],
          topic: deliveryModalOrder['Research Topic'],
          financial_quote: deliveryModalOrder['Financial Quote'] ?? 0,
        }, 'Work Submitted');
      }

      // 5. Send in-app notification if enabled
      if (notifyInApp) {
        try {
          const { data: dbOrder } = await supabase
            .from('orders')
            .select('client_id, id, topic')
            .eq('order_id', orderId)
            .single();

          if (dbOrder?.client_id) {
            const { error: notifErr } = await supabase
              .from('notifications')
              .insert({
                user_id: dbOrder.client_id,
                title: 'Material uploaded to Vault',
                message: `Chapters 1-5 for "${dbOrder.topic || 'your project'}" has been successfully uploaded to your Secure Vault.`,
                type: 'vault_delivery',
                link: '/dashboard/client?tab=vault',
                send_email: false,
                send_in_app: true,
                order_id: dbOrder.id,
              });
            if (notifErr) console.warn('Failed to insert in-app notification:', notifErr);
          }
        } catch (e) {
          console.warn('In-app notification failed:', e);
        }
      }

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
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowCreateOrder(true)} className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2">
                <lucide.Plus className="w-4 h-4" /> New Order
              </button>
              <button type="button" onClick={fetchOrders} className="btn-secondary flex items-center gap-2">
                <lucide.RefreshCw className="w-3 h-3" /> Sync Data
              </button>
            </div>
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
                        <button onClick={() => openDeliveryModal(order)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition" title="Upload to Vault"><lucide.UploadCloud className="w-4 h-4" /></button>
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

              {/* Custom milestone management (paid / delivered per milestone) */}
              {fullOrder?.payment_structure_type === 'CUSTOM' && Array.isArray(fullOrder?.payment_milestones) && fullOrder.payment_milestones.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-2 border-b border-theme pb-2">Custom Payment Milestones</h3>
                  <p className="text-[11px] text-secondary mb-4">Mark each milestone paid or delivered. The client is notified (in-app + email + push). Final files unlock only when <strong>all</strong> milestones are paid.</p>
                  <div className="space-y-3">
                    {fullOrder.payment_milestones.map((m: any, idx: number) => (
                      <div key={idx} className="bg-secondary border border-theme rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-secondary">{idx + 1} · {m.percentage}%</span>
                            <span className="text-sm font-bold text-primary">{m.name}</span>
                            {m.paid && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Paid</span>}
                            {m.delivered && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Delivered</span>}
                          </div>
                          <span className="text-sm font-black text-primary">{formatNaira(m.amount)}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" disabled={milestoneBusy === `${idx}-paid`} onClick={() => toggleMilestone(idx, 'paid', !m.paid)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 ${m.paid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-secondary border border-theme hover:bg-white/10'}`}>
                            {milestoneBusy === `${idx}-paid` ? '…' : m.paid ? 'Paid ✓ (undo)' : 'Mark Paid'}
                          </button>
                          <button type="button" disabled={milestoneBusy === `${idx}-delivered`} onClick={() => toggleMilestone(idx, 'delivered', !m.delivered)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50 ${m.delivered ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-secondary border border-theme hover:bg-white/10'}`}>
                            {milestoneBusy === `${idx}-delivered` ? '…' : m.delivered ? 'Delivered ✓ (undo)' : 'Mark Delivered'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-4 border-b border-theme pb-2">Client Brief Details</h3>
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-secondary block mb-1 font-bold">Research Topic / Briefing Objective</span>
                    <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Research Topic']}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Word Count Limit</span>
                      <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Word Count'] ? `${editingOrder['Word Count'].toLocaleString()} Words` : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-secondary block mb-1 font-bold">Estimated Pages</span>
                      <p className="p-3 bg-secondary border border-theme rounded-xl text-primary font-bold">{editingOrder['Word Count'] ? `${Math.ceil(editingOrder['Word Count'] / 275)} Pages` : 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-4 border-b border-theme pb-2">Send as Invoice</h3>
                <p className="text-[11px] text-secondary mb-3">Generates (or refreshes) this order's invoice and delivers it to the client. Every send is recorded.</p>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-[10px] uppercase font-black text-secondary">Send as:</label>
                  <select value={invoiceSendFormat} onChange={e => setInvoiceSendFormat(e.target.value as 'link' | 'image' | 'pdf')} className="bg-secondary border border-theme rounded-lg text-xs font-bold text-primary px-2 py-1.5 outline-none">
                    <option value="link">Link Only</option>
                    <option value="image">Image (attached to email / linked on WhatsApp)</option>
                    <option value="pdf">PDF (attached to email / linked on WhatsApp)</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" disabled={sendingInvoiceVia !== null} onClick={() => sendOrderAsInvoice(editingOrder['Order ID'], 'EMAIL')} className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"><lucide.Mail className="w-4 h-4" /> {sendingInvoiceVia === 'EMAIL' ? 'Sending…' : 'Send Invoice by Email'}</button>
                  <button type="button" disabled={sendingInvoiceVia !== null} onClick={() => sendOrderAsInvoice(editingOrder['Order ID'], 'WHATSAPP')} className="flex-1 py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"><lucide.MessageCircle className="w-4 h-4" /> {sendingInvoiceVia === 'WHATSAPP' ? 'Opening…' : 'Send Invoice by WhatsApp'}</button>
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
          <div className="bg-primary border border-blue-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_40px_rgba(59,130,246,0.15)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-primary flex items-center gap-2"><lucide.ShieldCheck className="text-blue-500" /> Vault Upload</h2>
                <p className="text-xs text-blue-500 uppercase tracking-widest mt-1 font-bold">Order: {deliveryModalOrder['Order ID']}</p>
              </div>
              <button onClick={() => setDeliveryModalOrder(null)}><lucide.X className="w-5 h-5 text-slate-500 hover:text-primary transition" /></button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-secondary leading-relaxed">Uploading the final deliverable marks the project as "Work Submitted". The file will appear in the client's vault according to the schedule set below.</p>
              
              <label className="border-2 border-dashed border-theme hover:border-blue-500 bg-primary rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition group">
                <lucide.UploadCloud className="w-8 h-8 text-secondary group-hover:text-blue-500 mb-2 transition" />
                <span className="text-sm font-bold text-primary mb-0.5">Select Encrypted File</span>
                <span className="text-[10px] text-secondary uppercase">.PDF, .DOCX, .ZIP</span>
                <input type="file" className="hidden" onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)} />
              </label>
              
              {deliveryFile && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                  <lucide.FileCheck className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-bold text-blue-400 truncate">{deliveryFile.name}</span>
                </div>
              )}

              {/* REBUILT EASY-TO-USE SCHEDULER */}
              <div className="mt-4">
                <label className="text-[10px] uppercase font-black text-secondary block mb-1.5">Schedule Vault Release Time</label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setScheduledAt('')}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition border text-center cursor-pointer ${!scheduledAt ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/10' : 'bg-secondary hover:bg-white/5 text-primary border-theme'}`}
                  >
                    ⚡ Instantly
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(toLocalISO(new Date(Date.now() + 60 * 60 * 1000)))}
                    className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition border text-center bg-secondary hover:bg-white/5 text-primary border-theme cursor-pointer"
                  >
                    ⏰ In 1 Hr
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(toLocalISO(new Date(Date.now() + 4 * 60 * 60 * 1000)))}
                    className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition border text-center bg-secondary hover:bg-white/5 text-primary border-theme cursor-pointer"
                  >
                    🕒 In 4 Hrs
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(toLocalISO(new Date(Date.now() + 12 * 60 * 60 * 1000)))}
                    className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition border text-center bg-secondary hover:bg-white/5 text-primary border-theme cursor-pointer"
                  >
                    🕕 In 12 Hrs
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledAt(toLocalISO(new Date(Date.now() + 24 * 60 * 60 * 1000)))}
                    className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition border text-center bg-secondary hover:bg-white/5 text-primary border-theme cursor-pointer"
                  >
                    📅 In 24 Hrs
                  </button>
                  {deliveryModalOrder?.['Deadline'] && (
                    <button
                      type="button"
                      onClick={() => setScheduledAt(toLocalISO(new Date(deliveryModalOrder['Deadline']!)))}
                      className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition border text-center bg-secondary hover:bg-white/5 text-primary border-theme cursor-pointer truncate"
                      title="Match Order Deadline"
                    >
                      🏁 Deadline
                    </button>
                  )}
                </div>

                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary outline-none focus:border-blue-500 transition font-bold"
                />

                <p className="text-[10px] text-blue-400 font-bold mt-2 bg-blue-500/10 border border-blue-500/20 p-2 rounded-lg leading-normal">
                  {getScheduleSummary()}
                </p>
              </div>

              {/* SMART NOTIFICATION SETTINGS */}
              <div className="mt-4">
                <label className="text-[10px] uppercase font-black text-secondary block mb-1">Notification Options</label>
                <div className="flex flex-col gap-2.5 bg-secondary/50 p-4 rounded-xl border border-theme">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={e => setNotifyEmail(e.target.checked)}
                      className="accent-blue-500 rounded"
                    />
                    <span className="text-xs font-bold text-primary">Send Email Notification</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifyInApp}
                      onChange={e => setNotifyInApp(e.target.checked)}
                      className="accent-blue-500 rounded"
                    />
                    <span className="text-xs font-bold text-primary">Send In-App Notification</span>
                  </label>
                </div>
              </div>

            </div>
            <div className="mt-6">
              <button onClick={handleDeliveryUpload} disabled={uploadingDelivery || !deliveryFile} className="w-full py-3.5 bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-blue-400 transition disabled:opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-pointer">
                {uploadingDelivery ? 'Encrypting & Storing...' : 'Lock in Vault & Notify Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create order for client */}
      {showCreateOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-primary border border-theme rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-primary flex items-center gap-2"><lucide.PlusCircle className="text-purple-500" /> New Order for Client</h2>
                <p className="text-xs text-secondary mt-1">Create an order on behalf of a client. New clients are auto-invited by email; the order appears in their dashboard.</p>
              </div>
              <button onClick={() => setShowCreateOrder(false)}><lucide.X className="w-5 h-5 text-secondary hover:text-primary transition" /></button>
            </div>

            <div className="space-y-4">
              {/* Order Category Selector */}
              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Order Category *</label>
                <select 
                  value={orderCategory} 
                  onChange={e => setOrderCategory(e.target.value as any)}
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-bold cursor-pointer focus:border-purple-500 outline-none"
                >
                  <option value="ACADEMIC">✍️ Standard Academic Research (Custom writing)</option>
                  <option value="CATALOG">🎓 Ready-Made Catalog Project Topic (PRJ-)</option>
                  <option value="DEV">💻 Custom Software Development (CUST-)</option>
                  <option value="CONTENT">📝 Content / Article Writing (CT-)</option>
                  <option value="CV">📄 Resume & Executive CV (CV-)</option>
                </select>
              </div>

              {/* Client Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Client Name *</label>
                  <input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none" value={newOrder.name} onChange={e => setNewOrder({ ...newOrder, name: e.target.value })} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Client Email *</label>
                  <input type="email" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none" value={newOrder.email} onChange={e => setNewOrder({ ...newOrder, email: e.target.value })} placeholder="client@example.com" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">WhatsApp</label>
                  <input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none" value={newOrder.whatsapp} onChange={e => setNewOrder({ ...newOrder, whatsapp: e.target.value })} placeholder="+234..." />
                </div>
                {orderCategory !== 'CATALOG' && (
                  <div>
                    <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Company (optional)</label>
                    <input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none" value={newOrder.company} onChange={e => setNewOrder({ ...newOrder, company: e.target.value })} placeholder="Company Name" />
                  </div>
                )}
              </div>

              {/* Project Title / Topic Selection */}
              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">
                  {orderCategory === 'CATALOG' ? 'Select Packaged Project Topic *' : 'Project Title / Topic *'}
                </label>
                {orderCategory === 'CATALOG' ? (
                  <div className="relative">
                    <input
                      list="catalog-topics-list"
                      className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-bold focus:border-purple-500 outline-none"
                      value={newOrder.topic}
                      onChange={e => {
                        const val = e.target.value;
                        setNewOrder(prev => ({ ...prev, topic: val }));
                        // Auto-fill price quote if it matches a catalog topic
                        const matched = catalogTopics.find(t => t.title.toLowerCase() === val.toLowerCase().trim());
                        if (matched) {
                          setNewOrder(prev => ({ ...prev, quote: String(matched.price || 3999) }));
                        }
                      }}
                      placeholder="Start typing to search ready-made project topic catalog..."
                    />
                    <datalist id="catalog-topics-list">
                      {catalogTopics.map(t => (
                        <option key={t.id} value={t.title}>
                          {t.level} · {t.department} · ₦{Number(t.price).toLocaleString()}
                        </option>
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <input 
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none font-bold" 
                    value={newOrder.topic} 
                    onChange={e => setNewOrder({ ...newOrder, topic: e.target.value })} 
                    placeholder={
                      orderCategory === 'DEV' ? "e.g. E-Commerce Platform using Next.js & Supabase" :
                      orderCategory === 'CV' ? "e.g. Executive Resume Redesign & LinkedIn Optimization" :
                      orderCategory === 'CONTENT' ? "e.g. SEO Copywriting & Weekly Blog Campaign" :
                      "e.g. Challenges and prospects of local government financial autonomy..."
                    } 
                  />
                )}
              </div>

              {/* Category-peculiar Fields (Pricing, Word Count, Deadline) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {orderCategory === 'ACADEMIC' && (
                  <div>
                    <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Service Tier</label>
                    <select className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary focus:border-purple-500 outline-none" value={newOrder.serviceTier} onChange={e => setNewOrder({ ...newOrder, serviceTier: e.target.value })}><option value="CUSTOM">Custom</option><option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="BRONZE">Bronze</option><option value="STANDARD">Standard</option></select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Total Quote (₦) *</label>
                  <input type="number" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-mono focus:border-purple-500 outline-none" value={newOrder.quote} onChange={e => setNewOrder({ ...newOrder, quote: e.target.value })} />
                </div>

                {orderCategory === 'ACADEMIC' && (
                  <div>
                    <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Word Count (optional)</label>
                    <input type="number" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-mono focus:border-purple-500 outline-none" value={newOrder.wordCount} onChange={e => setNewOrder({ ...newOrder, wordCount: e.target.value })} placeholder="e.g. 5000" />
                  </div>
                )}

                {/* Smarter Deadline inputs */}
                <div className={orderCategory === 'CATALOG' ? 'col-span-1 md:col-span-2' : 'col-span-1'}>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Deadline *</label>
                  {orderCategory === 'CATALOG' ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={deadlineType}
                          onChange={e => setDeadlineType(e.target.value as 'offset' | 'date')}
                          className="bg-secondary border border-theme rounded-xl text-xs font-bold text-primary p-2 outline-none focus:border-purple-500"
                        >
                          <option value="offset">⏱ Time Offset</option>
                          <option value="date">📅 Specific Date</option>
                        </select>

                        {deadlineType === 'offset' ? (
                          <div className="flex gap-2 flex-1">
                            <input
                              type="number"
                              min={1}
                              value={deadlineValue}
                              onChange={e => setDeadlineValue(e.target.value)}
                              className="w-20 bg-secondary border border-theme rounded-xl p-2 text-sm text-primary font-mono text-center focus:border-purple-500 outline-none"
                            />
                            <select
                              value={deadlineUnit}
                              onChange={e => setDeadlineUnit(e.target.value as any)}
                              className="bg-secondary border border-theme rounded-xl text-xs font-bold text-primary p-2 outline-none flex-1 focus:border-purple-500"
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                            </select>
                          </div>
                        ) : (
                          <input
                            type="datetime-local"
                            className="bg-secondary border border-theme rounded-xl p-2 text-xs text-primary outline-none flex-1 focus:border-purple-500"
                            value={customDeadlineDate}
                            onChange={e => setCustomDeadlineDate(e.target.value)}
                          />
                        )}
                      </div>
                      
                      {newOrder.deadline && (
                        <p className="text-[10px] text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 p-2 rounded-lg leading-normal">
                          Computed release time: {new Date(newOrder.deadline).toLocaleString()} ({Math.max(0, Math.round((new Date(newOrder.deadline).getTime() - Date.now()) / 60000))} mins from now)
                        </p>
                      )}
                    </div>
                  ) : (
                    <input type="date" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary dark:[color-scheme:dark] focus:border-purple-500 outline-none" value={newOrder.deadline} onChange={e => setNewOrder({ ...newOrder, deadline: e.target.value })} />
                  )}
                </div>
              </div>

              {/* Payment Structure (Academic / Custom category specific) */}
              {orderCategory !== 'CATALOG' && (
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-2">Payment Structure</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 text-sm text-primary font-bold cursor-pointer"><input type="radio" checked={newOrder.paymentStructure === '60/40'} onChange={() => setNewOrder({ ...newOrder, paymentStructure: '60/40' })} className="accent-purple-500" /> Standard 60/40</label>
                    <label className="flex items-center gap-2 text-sm text-primary font-bold cursor-pointer"><input type="radio" checked={newOrder.paymentStructure === 'CUSTOM'} onChange={() => setNewOrder({ ...newOrder, paymentStructure: 'CUSTOM' })} className="accent-purple-500" /> Custom Milestones</label>
                  </div>
                  {newOrder.paymentStructure === 'CUSTOM' && (
                    <div className="space-y-2 bg-secondary/50 border border-theme rounded-xl p-3">
                      {newOrderMilestones.map((m, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <input className="col-span-4 bg-primary border border-theme rounded-lg p-2 text-xs text-primary focus:border-purple-500 outline-none" value={m.name} onChange={e => { const u = [...newOrderMilestones]; u[idx].name = e.target.value; setNewOrderMilestones(u); }} placeholder="Name" />
                          <input className="col-span-5 bg-primary border border-theme rounded-lg p-2 text-xs text-primary focus:border-purple-500 outline-none" value={m.trigger} onChange={e => { const u = [...newOrderMilestones]; u[idx].trigger = e.target.value; setNewOrderMilestones(u); }} placeholder="Trigger" />
                          <div className="col-span-2 flex items-center gap-1"><input type="number" className="w-full bg-primary border border-theme rounded-lg p-2 text-xs text-primary focus:border-purple-500 outline-none" value={m.percentage} onChange={e => { const u = [...newOrderMilestones]; u[idx].percentage = parseInt(e.target.value) || 0; setNewOrderMilestones(u); }} /><span className="text-xs text-secondary">%</span></div>
                          <button type="button" onClick={() => setNewOrderMilestones(newOrderMilestones.filter((_, i) => i !== idx))} className="col-span-1 text-secondary hover:text-red-400"><lucide.Trash2 className="w-4 h-4 mx-auto" /></button>
                        </div>
                      ))}
                      <div className="flex justify-between items-center">
                        <button type="button" onClick={() => setNewOrderMilestones([...newOrderMilestones, { name: 'Milestone', percentage: 10, trigger: 'On phase completion' }])} className="text-[10px] text-purple-400 font-black uppercase flex items-center gap-1"><lucide.Plus className="w-3 h-3" /> Add Milestone</button>
                        <span className={`text-xs font-black ${newOrderMilestones.reduce((s, m) => s + Number(m.percentage), 0) === 100 ? 'text-emerald-400' : 'text-red-400'}`}>Sum: {newOrderMilestones.reduce((s, m) => s + Number(m.percentage), 0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-secondary/40 border border-theme rounded-2xl p-4 space-y-3">
                {orderCategory === 'CATALOG' ? (
                  <div className="p-2 border border-purple-500/20 bg-purple-500/5 rounded-xl">
                    <p className="text-xs font-bold text-purple-400 flex items-center gap-1.5"><lucide.CheckCircle2 className="w-4 h-4" /> Ready-Made Catalog Project configuration auto-applied.</p>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 text-xs text-primary font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newOrder.isCatalogOrder}
                      onChange={e => setNewOrder({ ...newOrder, isCatalogOrder: e.target.checked })}
                      className="w-4 h-4 rounded border-theme text-purple-600 focus:ring-purple-500 accent-purple-500 cursor-pointer"
                    />
                    <div>
                      <span>Prepaid Catalog Project Topic Order (PRJ- prefix)</span>
                      <span className="block text-[10px] text-secondary font-normal mt-0.5">Links automatically to matching ready-made topics and prefixes topic with [PROJECT]</span>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-3 text-xs text-primary font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newOrder.markPaid}
                    onChange={e => setNewOrder({ ...newOrder, markPaid: e.target.checked })}
                    className="w-4 h-4 rounded border-theme text-purple-600 focus:ring-purple-500 accent-purple-500 cursor-pointer"
                  />
                  <div>
                    <span>Mark Order as Fully Paid Instantly (Prepaid)</span>
                    <span className="block text-[10px] text-secondary font-normal mt-0.5">Flags milestones as 100% paid and unlocks deliverables in user vault</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 text-xs text-primary font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newOrder.triggerNotification}
                    onChange={e => setNewOrder({ ...newOrder, triggerNotification: e.target.checked })}
                    className="w-4 h-4 rounded border-theme text-purple-600 focus:ring-purple-500 accent-purple-500 cursor-pointer"
                  />
                  <div>
                    <span>Trigger System Notifications / Email Alerts</span>
                    <span className="block text-[10px] text-secondary font-normal mt-0.5">Sends automated onboarding recovery links and receipt emails to the client</span>
                  </div>
                </label>
              </div>

              <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Notes / Brief (optional)</label><textarea className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary resize-y" rows={3} value={newOrder.additionalInfo} onChange={e => setNewOrder({ ...newOrder, additionalInfo: e.target.value })} /></div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateOrder(false)} className="flex-1 py-3 bg-secondary border border-theme text-primary rounded-xl font-bold text-sm">Cancel</button>
                <button onClick={submitCreateOrder} disabled={creatingOrder} className="flex-1 py-3 bg-purple-500 hover:bg-purple-400 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {creatingOrder ? 'Creating…' : <><lucide.Check className="w-4 h-4" /> Create Order</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}