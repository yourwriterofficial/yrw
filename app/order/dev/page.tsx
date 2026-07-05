'use client';
import { BillingDetailsFields, PaymentStructureFields, compileMilestones } from '@/app/components/OrderMilestonesPayment';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { Upload, Paperclip, CheckCircle2, Terminal, Calendar } from 'lucide-react';
import type { CreateOrderServerActionResponse } from '@/lib/types';
import OrderCategoryNav from '@/app/components/OrderCategoryNav';

type OrderAddon = {
  id: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
};

// Helper function to decode escaped HTML entities
function decodeHtml(str: string) {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export default function DevOrderForm() {
  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [paymentStructure, setPaymentStructure] = useState<'60/40' | 'CUSTOM'>('60/40');
  const [milestones, setMilestones] = useState<any[]>([
    { name: 'Initial Deposit', percentage: 40, trigger: 'Upon signing this agreement' },
    { name: 'Second Payment', percentage: 30, trigger: 'Completion of Web & Backend' },
    { name: 'Final Payment', percentage: 30, trigger: 'Final delivery and client sign off' }
  ]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  const [baseBudget, setBaseBudget] = useState<number>(100000); // Default dev base budget
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [topic, setTopic] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: addons } = await supabase
        .from('order_addons')
        .select('*')
        .eq('service_category', 'DEV')
        .eq('is_active', true);
      if (addons) setAvailableAddons(addons as OrderAddon[]);

      const { data: terms } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('content_key', 'dev_tos')
        .single();
      if (terms) setTermsText(terms.content_text);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const calculateTotal = useCallback(() => {
    let total = isNaN(baseBudget) ? 0 : baseBudget;
    let flatFees = 0;
    let percentIncrease = 0;

    selectedAddons.forEach(id => {
      const addon = availableAddons.find(a => a.id === id);
      if (addon) {
        if (addon.price_type === 'FLAT_FEE') flatFees += addon.price_value;
        if (addon.price_type === 'PERCENT_INCREASE') percentIncrease += addon.price_value / 100;
      }
    });
    total = (total + flatFees) * (1 + percentIncrease);
    return Math.round(total);
  }, [baseBudget, selectedAddons, availableAddons]);

  const toggleAddon = (id: string) => {
    const newSelected = new Set(selectedAddons);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedAddons(newSelected);
  };

  const submitOrder = async () => {
    if (!name || !email || !whatsapp || !topic || !deadline) {
      return alert("Please fill out all mandatory fields (Name, Email, WhatsApp, Project Objective, and Target Deadline).");
    }
    if (!acceptTerms) return alert("You must accept the Terms of Service.");
    if (baseBudget < 20000) return alert("Software projects require a minimum base budget of ₦20,000.");

    setSubmitting(true);
    const orderStringId = `DEV-${Math.floor(100000 + Math.random() * 900000)}`;
    const selectedNames = Array.from(selectedAddons)
      .map(id => availableAddons.find(a => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    const compiledInstructions = `
      [CLIENT NOTES]: ${instructions}
      [REQUESTED ADD-ONS]: ${selectedNames || 'None'}
    `.trim();

    const payload = {
      order_id: orderStringId,
      guest_name: name,
      guest_email: email,
      guest_whatsapp: whatsapp,
      legal_name: name,
      email: email,
      whatsapp_sync: whatsapp,
      topic: `[DEV] ${topic}`,
      service_tier: 'CUSTOM',
      financial_quote: calculateTotal(),
      client_company: clientCompany || null,
      client_address: clientAddress || null,
      client_phone: whatsapp || null,
      payment_structure_type: paymentStructure,
      payment_milestones: compileMilestones(paymentStructure, milestones, calculateTotal()),
      deadline,
      workflow_status: 'Briefing Received',
      additional_info: compiledInstructions,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      vault_status: 'Pending Tech Analysis'
    };

    const serverResponse = (await createSecureOrder(payload as any, '')) as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      alert(`Submission failed: ${serverResponse?.error}`);
      setSubmitting(false);
      return;
    }

    if (briefFile) {
      const ext = briefFile.name.split('.').pop();
      const storagePath = `${orderStringId}/brief_${Date.now()}.${ext}`;
      await supabase.storage.from('order-files').upload(storagePath, briefFile);
      await supabase.from('order_files').insert({
        order_id: serverResponse.orderDbId,
        file_path: storagePath,
        file_name: briefFile.name,
        file_type: 'brief',
      });
    }

    router.push(`/complete-registration?email=${encodeURIComponent(email)}&orderId=${orderStringId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary py-12 px-6 font-['Inter']">
      <OrderCategoryNav />
      <div className="max-w-3xl mx-auto space-y-12 mt-6">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Development Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight flex items-center justify-center gap-3">
            <Terminal className="w-8 h-8 text-cyan-400" /> Full Stack & Custom Software
          </h1>
          <p className="text-secondary text-sm">For web apps, API integrations, database setup, scripts, or prototype MVP builds.</p>
        </div>

        <div className="space-y-8 bg-secondary p-8 rounded-[32px] border border-theme">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block ml-1">Proposed Project Budget (₦)</label>
            <input
              type="number"
              className="w-full bg-black border border-cyan-500/30 p-5 rounded-2xl text-cyan-400 font-black text-2xl outline-none focus:border-cyan-500 transition"
              value={baseBudget || ''}
              onChange={e => setBaseBudget(parseInt(e.target.value) || 0)}
            />
            <p className="text-[10px] text-zinc-500 mt-2 ml-1">Enter the budget for base system development. Add-ons are selected below.</p>
          </div>

          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Select Custom Add-ons</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-cyan-500 bg-cyan-500/5' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-600'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-cyan-400' : 'text-zinc-300'}`}>{addon.name}</h4>
                          <span className="text-xs font-black text-zinc-500">
                            {addon.price_type === 'FLAT_FEE' ? `+₦${addon.price_value.toLocaleString()}` : `+${addon.price_value}%`}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500">{addon.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Full Name</label>
                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-cyan-500 outline-none text-white font-bold hover:border-zinc-750" required />
                <p className="text-[9px] text-zinc-500 ml-1">Please enter your legal name as it appears on official files.</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Email Address</label>
                <input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-cyan-500 outline-none text-white font-bold hover:border-zinc-750" required />
                <p className="text-[9px] text-zinc-500 ml-1">Your credentials and secure work deliverables will be sent here.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">WhatsApp Number</label>
                <input type="tel" placeholder="+234..." value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-cyan-500 outline-none text-white font-bold hover:border-zinc-750" required />
                <p className="text-[9px] text-zinc-500 ml-1">For emergency support and prompt status updates.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Target Delivery Deadline</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-focus-within:text-cyan-500 transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <input 
                    type="date" 
                    className="w-full bg-card border border-theme p-4 pl-12 rounded-xl text-sm text-primary focus:border-cyan-500 outline-none dark:[color-scheme:dark] transition-all font-bold hover:border-theme cursor-pointer" 
                    value={deadline} 
                    onChange={e => setDeadline(e.target.value)} 
                    min={new Date().toISOString().split('T')[0]} 
                    required 
                  />
                </div>
                <p className="text-[9px] text-zinc-500 ml-1">Choose target date. Software builds generally require at least 5–7 days minimum.</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Project Title / Objective</label>
              <input type="text" placeholder="E.g., Real Estate Management Portal" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-cyan-500 outline-none text-white font-bold hover:border-zinc-700" required />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">System Instructions & Features</label>
              <textarea
                placeholder="List core features, tech stack requirements, user roles, API integrations..."
                className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-cyan-500 outline-none resize-none h-32 text-white font-medium hover:border-zinc-700"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Database Schema or Wireframes</label>
              <label className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/50 bg-[#0f0f0f] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
                <Upload className="w-6 h-6 text-zinc-600 mb-2" />
                <span className="text-xs font-bold text-zinc-400">Attach Brief, Database Diagram, or Wireframe</span>
                <input type="file" className="hidden" onChange={e => setBriefFile(e.target.files?.[0] || null)} />
              </label>
              {briefFile && (
                <div className="flex items-center gap-2 text-xs bg-cyan-500/10 text-cyan-400 p-3 rounded-xl border border-cyan-500/20 w-full break-words">
                  <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{briefFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Terms of Service */}
          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Terms of Service</label>
            <div className="h-32 overflow-y-auto bg-black border border-zinc-800 rounded-xl p-4 leading-relaxed custom-scrollbar prose prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: decodeHtml(termsText || "<h3>Terms & Conditions</h3><p>Loading developer terms of service...</p>") }} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-cyan-500 bg-black border-zinc-800 rounded"
              />
              <span className="text-xs text-zinc-300 font-bold leading-relaxed">
                I agree to the terms above. I understand this project plan and quote is subject to alignment review by the dev lead.
              </span>
            </label>
          </div>

          <div className="bg-cyan-500/10 p-6 rounded-2xl border border-cyan-500/20 text-center">
            <div className="text-4xl font-black text-cyan-400 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-zinc-500 mt-2 tracking-widest">Calculated Development Quote</p>
          </div>

          <button
            onClick={submitOrder}
            disabled={!acceptTerms || submitting}
            className="w-full bg-cyan-600 text-black font-black uppercase text-xs tracking-[1px] py-5 rounded-2xl shadow-xl shadow-cyan-500/20 hover:bg-cyan-500 transition disabled:opacity-50"
          >
            {submitting ? 'Initializing Project Space...' : 'Initialize Software Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
