'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { ToastContainer, showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';
import Link from 'next/link';

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(1000000);
  const [currency, setCurrency] = useState('₦');

  // Dynamic deliverables
  const [deliverables, setDeliverables] = useState<Array<{ category: string; items: string[] }>>([
    {
      category: 'Web Application',
      items: [
        'Fully responsive React-based web app',
        'TypeScript & Tailwind CSS',
        'Integration with backend API services'
      ]
    },
    {
      category: 'Mobile Applications (iOS & Android)',
      items: [
        'Native apps built with React Native (Expo)',
        'Full feature parity with web application',
        'App Store & Play Store deployment preparation'
      ]
    },
    {
      category: 'Backend Infrastructure',
      items: [
        'PostgreSQL database architecture',
        'RESTful API & Real-time data sync',
        'User authentication & Email automation'
      ]
    },
    {
      category: 'Core Technologies',
      items: [
        'Frontend: React, Vite, Tailwind, React Query',
        'Backend: Supabase, PostgreSQL, Resend',
        'Hosting: Vercel, Expo EAS'
      ]
    }
  ]);

  // Additional Services & Exclusions
  const [additionalServices, setAdditionalServices] = useState<string[]>([
    'Domain Registration & Management',
    'SSL Certificate Configuration',
    'Deployment Support & API Documentation',
    'Basic System Administration Training'
  ]);
  
  const [exclusions, setExclusions] = useState<string[]>([
    'App Store Registration Fees (Apple: $99/yr, Google: $25)',
    'Third-party Service Costs (beyond free tiers)',
    'Ongoing Maintenance (post-warranty period)'
  ]);

  // Timeline
  const [timeline, setTimeline] = useState<Array<{ weeks: string; phase: string; deliverables: string }>>([
    { weeks: '1-2', phase: 'Planning & Design', deliverables: 'Requirement analysis, database schema design, UI/UX wireframes, API architecture, Supabase project setup' },
    { weeks: '3-5', phase: 'Web & Backend', deliverables: 'Web app development, backend API, Supabase integration, auth, email setup' },
    { weeks: '6-7', phase: 'Mobile Development', deliverables: 'Android & iOS app development, feature parity, mobile API integration' },
    { weeks: '8-9', phase: 'Testing & Refinement', deliverables: 'Quality assurance, bug fixing, UI polish, performance optimization' },
    { weeks: '10', phase: 'Deployment & Handover', deliverables: 'Production deployment, app store submissions, documentation, client training' }
  ]);

  // Milestones
  const [milestones, setMilestones] = useState<Array<{ name: string; percentage: number; trigger: string }>>([
    { name: 'Initial Deposit', percentage: 40, trigger: 'Upon signing this agreement' },
    { name: 'Second Payment', percentage: 30, trigger: 'Completion of Web & Backend (End of Week 5)' },
    { name: 'Final Payment', percentage: 30, trigger: 'Final delivery and client sign off (End of Week 10)' }
  ]);

  // Bank & Signatures
  const [bankName, setBankName] = useState('Opay');
  const [accountName, setAccountName] = useState('Richlord Jude');
  const [accountNumber, setAccountNumber] = useState('8121443666');
  
  const [terms, setTerms] = useState<string[]>([
    'Payments made in Nigerian Naira (₦).',
    'Invoices due immediately upon receipt.',
    'Full IP rights transfer upon final payment.',
    '365 days of support and bug fixes post delivery.'
  ]);

  const [devSignatureName, setDevSignatureName] = useState('Richlord Jude');

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setOrders(data);
      setInvoiceNumber(Math.floor(100 + Math.random() * 900).toString()); // random 3 digit number
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const handlePrefillOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId) return;

    const order = orders.find(o => o.order_id === orderId);
    if (order) {
      setClientName(order.legal_name || order.guest_name || '');
      setEmail(order.email || order.guest_email || '');
      setPhone(order.client_phone || order.guest_whatsapp || '');
      setCompanyName(order.client_company || '');
      setAddress(order.client_address || '');
      setProjectTitle(order.topic || '');
      setTotalAmount(order.financial_quote || 0);

      // If order already has custom milestones, prefill them
      if (order.payment_milestones && Array.isArray(order.payment_milestones) && order.payment_milestones.length > 0) {
        setMilestones(order.payment_milestones.map((m: any) => ({
          name: m.name,
          percentage: m.percentage,
          trigger: m.trigger || ''
        })));
      }
    }
  };

  // Deliverables helpers
  const addDeliverableCategory = () => {
    setDeliverables([...deliverables, { category: 'New Category', items: ['New Item'] }]);
  };
  const removeDeliverableCategory = (catIdx: number) => {
    setDeliverables(deliverables.filter((_, idx) => idx !== catIdx));
  };
  const updateCategoryName = (catIdx: number, newName: string) => {
    const updated = [...deliverables];
    updated[catIdx].category = newName;
    setDeliverables(updated);
  };
  const addDeliverableItem = (catIdx: number) => {
    const updated = [...deliverables];
    updated[catIdx].items.push('New Item');
    setDeliverables(updated);
  };
  const removeDeliverableItem = (catIdx: number, itemIdx: number) => {
    const updated = [...deliverables];
    updated[catIdx].items = updated[catIdx].items.filter((_, idx) => idx !== itemIdx);
    setDeliverables(updated);
  };
  const updateDeliverableItemText = (catIdx: number, itemIdx: number, newText: string) => {
    const updated = [...deliverables];
    updated[catIdx].items[itemIdx] = newText;
    setDeliverables(updated);
  };

  // Generic list helpers (Additional services, Exclusions, Terms)
  const addListItem = (setter: any, list: any[]) => setter([...list, 'New Item']);
  const removeListItem = (setter: any, list: any[], idx: number) => setter(list.filter((_, i) => i !== idx));
  const updateListItem = (setter: any, list: any[], idx: number, val: string) => {
    const updated = [...list];
    updated[idx] = val;
    setter(updated);
  };

  // Timeline helpers
  const addTimelinePhase = () => {
    setTimeline([...timeline, { weeks: 'Week X', phase: 'New Phase', deliverables: 'Deliverables info' }]);
  };
  const removeTimelinePhase = (idx: number) => {
    setTimeline(timeline.filter((_, i) => i !== idx));
  };
  const updateTimelineField = (idx: number, field: string, val: string) => {
    const updated = [...timeline];
    updated[idx] = { ...updated[idx], [field]: val };
    setTimeline(updated);
  };

  // Milestones helpers
  const addMilestone = () => {
    setMilestones([...milestones, { name: 'New Payment Milestone', percentage: 10, trigger: 'On trigger event' }]);
  };
  const removeMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };
  const updateMilestone = (idx: number, field: string, val: any) => {
    const updated = [...milestones];
    updated[idx] = { ...updated[idx], [field]: val };
    setMilestones(updated);
  };

  const handleSave = async () => {
    if (!invoiceNumber || !clientName || !email || !projectTitle || !totalAmount) {
      return showToast('Please fill out all mandatory fields.', 'error');
    }

    const percentageSum = milestones.reduce((sum, m) => sum + Number(m.percentage), 0);
    if (percentageSum !== 100) {
      return showToast(`Milestone percentages must sum to 100%. Currently they sum to ${percentageSum}%.`, 'error');
    }

    setSaving(true);

    // Calculate Naira amounts for milestones
    const compiledMilestones = milestones.map(m => ({
      name: m.name,
      percentage: m.percentage,
      amount: Math.round((Number(m.percentage) / 100) * totalAmount),
      paid: false,
      delivered: false,
      paid_at: null,
      tx_ref: null,
      trigger: m.trigger
    }));

    const paymentDetails = {
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber
    };

    const payload = {
      invoice_number: invoiceNumber,
      client_name: clientName,
      company_name: companyName || null,
      address: address || null,
      email: email,
      phone: phone || null,
      project_title: projectTitle,
      project_description: projectDescription || null,
      deliverables,
      additional_services: additionalServices,
      exclusions,
      timeline,
      milestones: compiledMilestones,
      payment_details: paymentDetails,
      terms,
      developer_signature_name: devSignatureName,
      developer_signature_date: new Date().toISOString(),
      client_signature_name: clientName,
      status: 'PENDING',
      total_amount: totalAmount,
      currency
    };

    const { error } = await supabase
      .from('custom_invoices')
      .insert(payload);

    if (error) {
      showToast(`Database error: ${error.message}`, 'error');
      setSaving(false);
    } else {
      showToast('Invoice created successfully!', 'success');
      // If we linked an existing order, update its milestones
      if (selectedOrderId) {
        await supabase
          .from('orders')
          .update({
            client_company: companyName || null,
            client_address: address || null,
            client_phone: phone || null,
            payment_structure_type: 'CUSTOM',
            payment_milestones: compiledMilestones,
            financial_quote: totalAmount
          })
          .eq('order_id', selectedOrderId);
      }
      setTimeout(() => {
        router.push('/admin/invoices');
      }, 1000);
    }
  };

  if (loading) return <LoadingScreen label="Loading data..." accent="purple" />;

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-5xl">
      <ToastContainer />
      <PageHeader
        title="Generate Invoice Contract"
        description="Create a dynamic milestone-based invoice contract matching premium styling rules."
        breadcrumb="Admin / Invoices / New"
        icon={<lucide.FileText className="w-8 h-8 text-purple-500" />}
      />

      <div className="space-y-8 bg-secondary border border-theme rounded-[32px] p-6 md:p-10">
        
        {/* Step 1: Link Order */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 border-b border-theme pb-2">
            1. Prefill From Existing Order (Optional)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Select Order</label>
              <select
                className="w-full bg-primary border border-theme rounded-xl p-4 font-bold outline-none focus:border-purple-500 text-primary"
                value={selectedOrderId}
                onChange={e => handlePrefillOrder(e.target.value)}
              >
                <option value="">-- No Order Selected (Manual Prefill) --</option>
                {orders.map(o => (
                  <option key={o.id} value={o.order_id}>
                    {o.order_id} — {o.legal_name || o.guest_name} ({o.topic})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Invoice Number</label>
              <input
                type="text"
                placeholder="233"
                className="w-full bg-primary border border-theme rounded-xl p-4 font-bold outline-none focus:border-purple-500 text-primary font-mono text-lg"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Client details */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 border-b border-theme pb-2">
            2. Bill To (Client Details)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Client Name *</label>
              <input type="text" placeholder="Obosa Osemwengie" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Company Name</label>
              <input type="text" placeholder="JAMAJAMA SERVICES LTD" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Email Address *</label>
              <input type="email" placeholder="client@example.com" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Phone Number</label>
              <input type="text" placeholder="08121443666" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Billing Address</label>
              <input type="text" placeholder="5, Edo Street, Benin City, Nigeria" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Step 3: Project Title, Description & Budget */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 border-b border-theme pb-2">
            3. Project & Financial Quote
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Project Title *</label>
              <input type="text" placeholder="SAAS PLATFORM DEVELOPMENT - WEB, ANDROID & IOS" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Total Project Cost *</label>
              <div className="flex gap-2">
                <input type="text" className="w-16 bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold text-center" value={currency} onChange={e => setCurrency(e.target.value)} title="Currency Symbol" />
                <input type="number" className="flex-1 bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-mono font-black" value={totalAmount} onChange={e => setTotalAmount(Number(e.target.value))} />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Project Description</label>
              <textarea placeholder="Provide detailed project context, goals, and timeline parameters." rows={3} className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-medium" value={projectDescription} onChange={e => setProjectDescription(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Step 4: Deliverables list */}
        <div>
          <div className="flex justify-between items-center mb-4 border-b border-theme pb-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-purple-400">4. Deliverables & Tools</h2>
            <button type="button" onClick={addDeliverableCategory} className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold flex items-center gap-1"><lucide.Plus className="w-3.5 h-3.5" /> Add Category</button>
          </div>
          <div className="space-y-6">
            {deliverables.map((cat, catIdx) => (
              <div key={catIdx} className="bg-primary/45 border border-theme rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    className="flex-1 bg-secondary border border-theme rounded-xl p-3 text-primary text-sm font-black"
                    value={cat.category}
                    onChange={e => updateCategoryName(catIdx, e.target.value)}
                  />
                  <button type="button" onClick={() => removeDeliverableCategory(catIdx)} className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 border border-red-500/20 transition"><lucide.Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2 ml-4">
                  {cat.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-center gap-2">
                      <lucide.CircleDot className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <input
                        type="text"
                        className="flex-1 bg-secondary/50 border border-theme rounded-xl p-2.5 text-primary text-xs"
                        value={item}
                        onChange={e => updateDeliverableItemText(catIdx, itemIdx, e.target.value)}
                      />
                      <button type="button" onClick={() => removeDeliverableItem(catIdx, itemIdx)} className="text-secondary hover:text-red-400 transition"><lucide.X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addDeliverableItem(catIdx)} className="text-xs text-purple-400 font-bold ml-6 flex items-center gap-1 mt-2"><lucide.Plus className="w-3 h-3" /> Add Item</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 5: Timeline phases */}
        <div>
          <div className="flex justify-between items-center mb-4 border-b border-theme pb-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-purple-400">5. Project Timeline</h2>
            <button type="button" onClick={addTimelinePhase} className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold flex items-center gap-1"><lucide.Plus className="w-3.5 h-3.5" /> Add Phase</button>
          </div>
          <div className="space-y-3">
            {timeline.map((t, idx) => (
              <div key={idx} className="bg-primary/30 border border-theme rounded-2xl p-4 grid grid-cols-12 gap-3 items-center">
                <input type="text" className="col-span-2 bg-secondary border border-theme rounded-xl p-2 text-primary font-bold text-xs" value={t.weeks} onChange={e => updateTimelineField(idx, 'weeks', e.target.value)} placeholder="Weeks" />
                <input type="text" className="col-span-3 bg-secondary border border-theme rounded-xl p-2 text-primary font-bold text-xs" value={t.phase} onChange={e => updateTimelineField(idx, 'phase', e.target.value)} placeholder="Phase Name" />
                <input type="text" className="col-span-6 bg-secondary border border-theme rounded-xl p-2 text-primary text-xs" value={t.deliverables} onChange={e => updateTimelineField(idx, 'deliverables', e.target.value)} placeholder="Deliverables Description" />
                <button type="button" onClick={() => removeTimelinePhase(idx)} className="col-span-1 text-center text-secondary hover:text-red-400 transition"><lucide.Trash2 className="w-4 h-4 mx-auto" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Step 6: Milestones payments */}
        <div>
          <div className="flex justify-between items-center mb-4 border-b border-theme pb-2">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-purple-400">6. Payment Milestones</h2>
              <p className="text-[10px] text-secondary lowercase">Ensure percentages sum to 100% (currently: {milestones.reduce((s, m) => s + Number(m.percentage || 0), 0)}%)</p>
            </div>
            <button type="button" onClick={addMilestone} className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold flex items-center gap-1"><lucide.Plus className="w-3.5 h-3.5" /> Add Milestone</button>
          </div>
          <div className="space-y-4">
            {milestones.map((m, idx) => (
              <div key={idx} className="bg-primary/30 border border-theme rounded-2xl p-6 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4">
                  <label className="text-[9px] uppercase text-secondary font-black block mb-1">Milestone Name</label>
                  <input type="text" className="w-full bg-secondary border border-theme rounded-xl p-2 text-primary font-bold text-xs" value={m.name} onChange={e => updateMilestone(idx, 'name', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] uppercase text-secondary font-black block mb-1">Share (%)</label>
                  <input type="number" className="w-full bg-secondary border border-theme rounded-xl p-2 text-primary font-bold text-xs" value={m.percentage} onChange={e => updateMilestone(idx, 'percentage', parseInt(e.target.value) || 0)} />
                </div>
                <div className="col-span-5">
                  <label className="text-[9px] uppercase text-secondary font-black block mb-1">Trigger Event</label>
                  <input type="text" className="w-full bg-secondary border border-theme rounded-xl p-2 text-primary text-xs" value={m.trigger} onChange={e => updateMilestone(idx, 'trigger', e.target.value)} />
                </div>
                <div className="col-span-1 text-center">
                  <label className="text-[9px] uppercase text-secondary font-black block mb-1">Del</label>
                  <button type="button" onClick={() => removeMilestone(idx)} className="text-secondary hover:text-red-400 transition block mx-auto mt-2"><lucide.Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="col-span-12 text-right text-xs font-mono font-black text-purple-400">
                  Calculated Share: {currency}{(Math.round((Number(m.percentage) / 100) * totalAmount)).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 7: Exclusions & Additional services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-theme pb-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">Included Services</h2>
              <button type="button" onClick={() => addListItem(setAdditionalServices, additionalServices)} className="text-[10px] text-purple-400 font-bold flex items-center gap-0.5"><lucide.Plus className="w-3 h-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {additionalServices.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" className="flex-1 bg-primary border border-theme rounded-xl p-2 text-primary text-xs" value={item} onChange={e => updateListItem(setAdditionalServices, additionalServices, idx, e.target.value)} />
                  <button type="button" onClick={() => removeListItem(setAdditionalServices, additionalServices, idx)} className="text-secondary hover:text-red-400 transition"><lucide.Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-theme pb-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">Exclusions</h2>
              <button type="button" onClick={() => addListItem(setExclusions, exclusions)} className="text-[10px] text-purple-400 font-bold flex items-center gap-0.5"><lucide.Plus className="w-3 h-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {exclusions.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" className="flex-1 bg-primary border border-theme rounded-xl p-2 text-primary text-xs" value={item} onChange={e => updateListItem(setExclusions, exclusions, idx, e.target.value)} />
                  <button type="button" onClick={() => removeListItem(setExclusions, exclusions, idx)} className="text-secondary hover:text-red-400 transition"><lucide.Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 8: Payment details & banker info */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-4 border-b border-theme pb-2">
            7. Payment Details & Bank Info
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Bank Name</label>
              <input type="text" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={bankName} onChange={e => setBankName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Account Name</label>
              <input type="text" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={accountName} onChange={e => setAccountName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Account Number</label>
              <input type="text" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Step 9: Terms & Signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-theme pb-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-purple-400">Terms & Conditions</h2>
              <button type="button" onClick={() => addListItem(setTerms, terms)} className="text-[10px] text-purple-400 font-bold flex items-center gap-0.5"><lucide.Plus className="w-3 h-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {terms.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" className="flex-1 bg-primary border border-theme rounded-xl p-2 text-primary text-xs" value={item} onChange={e => updateListItem(setTerms, terms, idx, e.target.value)} />
                  <button type="button" onClick={() => removeListItem(setTerms, terms, idx)} className="text-secondary hover:text-red-400 transition"><lucide.Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 border-b border-theme pb-2">Developer Signature</h2>
            <div>
              <label className="text-[10px] text-secondary uppercase font-bold ml-1 block mb-2">Developer Name</label>
              <input type="text" className="w-full bg-primary border border-theme rounded-xl p-3 text-primary text-sm font-bold" value={devSignatureName} onChange={e => setDevSignatureName(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 border-t border-theme pt-8">
          <Link
            href="/admin/invoices"
            className="flex-1 py-4 bg-white/5 border border-theme text-primary rounded-2xl font-bold transition text-center hover:bg-white/10 flex items-center justify-center"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-black transition flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <lucide.FilePlus className="w-5 h-5" /> Generate Invoice Contract
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
