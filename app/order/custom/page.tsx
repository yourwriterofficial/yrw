'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { Upload, Paperclip, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { CreateOrderServerActionResponse } from '@/lib/types';

// Type for the dynamic addons from Supabase
type OrderAddon = {
  id: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
};

export default function CustomOrderForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dynamic Data States
  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  // Form States
  const [baseBudget, setBaseBudget] = useState<number>(50000);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [topic, setTopic] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Fetch dynamic configurations from Supabase on load
  useEffect(() => {
    const fetchConfig = async () => {
      // Fetch Academic Addons
      const { data: addons } = await supabase
        .from('order_addons')
        .select('*')
        .eq('service_category', 'ACADEMIC')
        .eq('is_active', true);
      
      if (addons) setAvailableAddons(addons as OrderAddon[]);

      // Fetch Terms of Service
      const { data: terms } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('content_key', 'academic_tos')
        .single();
      
      if (terms) setTermsText(terms.content_text);
      setLoading(false);
    };

    fetchConfig();
  }, []);

  // Complex Calculation Logic
  const calculateTotal = useCallback(() => {
    let total = isNaN(baseBudget) ? 0 : baseBudget;
    let flatFees = 0;
    let percentIncrease = 0;

    selectedAddons.forEach(id => {
      const addon = availableAddons.find(a => a.id === id);
      if (addon) {
        if (addon.price_type === 'FLAT_FEE') flatFees += addon.price_value;
        if (addon.price_type === 'PERCENT_INCREASE') percentIncrease += (addon.price_value / 100);
      }
    });

    // Add flat fees first, then apply percentage multipliers (like Urgency)
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
      return alert("Please fill out all mandatory fields (Name, Email, WhatsApp, Topic, and Deadline).");
    }
    if (!acceptTerms) return alert("You must accept the Terms of Service.");
    if (baseBudget < 20000) return alert("Custom projects require a minimum base budget of ₦20,000.");

    setSubmitting(true);
    const orderStringId = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;

    // Compile addons into a readable string for the admin panel
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
      legal_name: name,
      email: email,
      guest_whatsapp: whatsapp,
      whatsapp_sync: whatsapp,
      topic: `[COMPLEX] ${topic}`,
      service_tier: 'CUSTOM', // Bypasses standard word math in the backend
      financial_quote: calculateTotal(),
      deadline,
      workflow_status: 'Briefing Received',
      additional_info: compiledInstructions,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      vault_status: 'Pending Analysis'
    };

    // Assuming createSecureOrder logic remains exactly as defined previously
    const serverResponse = await createSecureOrder(payload as any, '') as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      alert(`Submission failed: ${serverResponse?.error}`);
      setSubmitting(false);
      return;
    }

    // Upload file if present
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
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white py-20 px-6 font-['Inter']">
      <div className="max-w-3xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Complex Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Custom Data & Fieldwork</h1>
          <p className="text-zinc-400 text-sm">For projects requiring bespoke logic, statistical analysis, or extreme urgency.</p>
        </div>

        {/* Form Container */}
        <div className="space-y-8 bg-[#0a0a0a] p-8 rounded-[32px] border border-zinc-800">
          
          {/* Base Budget */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block ml-1">Proposed Base Budget (₦)</label>
            <input 
              type="number" 
              className="w-full bg-black border border-purple-500/30 p-5 rounded-2xl text-purple-400 font-black text-2xl outline-none focus:border-purple-500 transition" 
              value={baseBudget || ''} 
              onChange={e => setBaseBudget(parseInt(e.target.value) || 0)} 
            />
            <p className="text-[10px] text-zinc-500 mt-2 ml-1">Do not include add-ons here. Enter the budget for the primary research only.</p>
          </div>

          {/* Dynamic Add-ons */}
          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Select Required Add-ons</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div 
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-purple-500 bg-purple-500/5' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-purple-400' : 'text-zinc-300'}`}>{addon.name}</h4>
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

          {/* Core Details */}
          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Full Name" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-purple-500 outline-none" value={name} onChange={e => setName(e.target.value)} />
              <input type="email" placeholder="Email Address" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-purple-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="tel" placeholder="WhatsApp Number" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-purple-500 outline-none" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              <input type="date" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm text-zinc-400 focus:border-purple-500 outline-none [color-scheme:dark]" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <input type="text" placeholder="Project Topic / Main Objective" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-purple-500 outline-none" value={topic} onChange={e => setTopic(e.target.value)} />
            <textarea placeholder="Specific instructions, methodologies, or data requirements..." className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-purple-500 outline-none resize-none h-32" value={instructions} onChange={e => setInstructions(e.target.value)} />
            
            {/* File Upload */}
            <label className="border-2 border-dashed border-zinc-800 hover:border-purple-500/50 bg-[#0f0f0f] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-6 h-6 text-zinc-600 mb-2" />
              <span className="text-xs font-bold text-zinc-400">Attach Brief or Dataset</span>
              <input type="file" className="hidden" onChange={(e) => setBriefFile(e.target.files?.[0] || null)} />
            </label>
            {briefFile && (
              <div className="flex items-center gap-2 text-xs bg-purple-500/10 text-purple-400 p-3 rounded-xl border border-purple-500/20">
                <Paperclip className="w-4 h-4" /> {briefFile.name}
              </div>
            )}
          </div>

          {/* Dynamic Terms */}
          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Terms of Service</label>
            <div className="h-32 overflow-y-auto bg-black border border-zinc-800 rounded-xl p-4 text-[10px] text-zinc-400 leading-relaxed custom-scrollbar">
              {termsText || "Loading terms..."}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-purple-500 bg-black border-zinc-800 rounded" />
              <span className="text-xs text-zinc-300 font-bold leading-relaxed">I agree to the terms above. I understand this custom quote is subject to review by the research team.</span>
            </label>
          </div>

          {/* Total & Submit */}
          <div className="bg-purple-500/10 p-6 rounded-2xl border border-purple-500/20 text-center">
            <div className="text-4xl font-black text-purple-400 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-zinc-500 mt-2 tracking-widest">Calculated Custom Quote</p>
          </div>

          <button 
            onClick={submitOrder} 
            disabled={!acceptTerms || submitting} 
            className="w-full bg-purple-600 text-white font-black uppercase text-xs tracking-[1px] py-5 rounded-2xl shadow-xl shadow-purple-500/20 hover:bg-purple-500 transition disabled:opacity-50"
          >
            {submitting ? 'Encrypting Data...' : 'Submit Custom Request'}
          </button>

        </div>
      </div>
    </div>
  );
}