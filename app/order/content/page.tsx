'use client';
import { BillingDetailsFields, PaymentStructureFields, compileMilestones } from '@/app/components/OrderMilestonesPayment';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { Upload, Paperclip, CheckCircle2, Calendar } from 'lucide-react';
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

export default function ContentOrderForm() {
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

  const [baseBudget, setBaseBudget] = useState<number>(30000);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState('Website Copy / Landing Page');
  const [tone, setTone] = useState('Professional & Corporate');
  const [audience, setAudience] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: addons } = await supabase
        .from('order_addons')
        .select('*')
        .eq('service_category', 'CONTENT')
        .eq('is_active', true);
      if (addons) setAvailableAddons(addons as OrderAddon[]);

      const { data: terms } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('content_key', 'content_tos')
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
    if (!name || !email || !whatsapp || !topic || !deadline || !audience) {
      return alert("Please fill out all mandatory fields.");
    }
    if (!acceptTerms) return alert("You must accept the Content Terms of Service.");

    setSubmitting(true);
    const orderStringId = `CT-${Math.floor(100000 + Math.random() * 900000)}`;
    const selectedNames = Array.from(selectedAddons)
      .map(id => availableAddons.find(a => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    const compiledInstructions = `
      [CONTENT TYPE]: ${contentType}
      [TONE]: ${tone}
      [TARGET AUDIENCE]: ${audience}
      [NOTES]: ${instructions}
      [ADD-ONS]: ${selectedNames || 'None'}
    `.trim();

    const payload = {
      order_id: orderStringId,
      guest_name: name,
      guest_email: email,
      guest_whatsapp: whatsapp,
      legal_name: name,
      email: email,
      whatsapp_sync: whatsapp,
      topic: `[CONTENT] ${topic}`,
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
      vault_status: 'Pending Outline',
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
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary py-12 px-6 font-['Inter']">
      <OrderCategoryNav />
      <div className="max-w-3xl mx-auto space-y-12 mt-6">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Creative Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Content & Creative Writing</h1>
          <p className="text-zinc-400 text-sm">Tailored copy, eBooks, and SEO content designed to engage your exact audience.</p>
        </div>

        <div className="space-y-8 bg-[#0a0a0a] p-8 rounded-[32px] border border-zinc-800">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block ml-1">Proposed Base Budget (₦)</label>
            <input
              type="number"
              className="w-full bg-black border border-amber-500/30 p-5 rounded-2xl text-amber-500 font-black text-2xl outline-none focus:border-amber-500 transition"
              value={baseBudget || ''}
              onChange={e => setBaseBudget(parseInt(e.target.value) || 0)}
            />
            <p className="text-[10px] text-zinc-500 mt-2 ml-1">Enter your budget based on word count expectations.</p>
          </div>

          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Select Content Add-ons</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-amber-500' : 'text-zinc-300'}`}>{addon.name}</h4>
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
                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-white font-bold hover:border-zinc-750" required />
                <p className="text-[9px] text-zinc-500 ml-1">Please enter your legal name as it appears on official records.</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Email Address</label>
                <input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-white font-bold hover:border-zinc-750" required />
                <p className="text-[9px] text-zinc-500 ml-1">Your secure quotes and workspace access details will be sent here.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">WhatsApp Number</label>
                <input type="tel" placeholder="+234..." value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-white font-bold hover:border-zinc-750" required />
                <p className="text-[9px] text-zinc-500 ml-1">Used for emergency synchronization and revision requests.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Target Delivery Deadline</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-focus-within:text-amber-500 transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <input 
                    type="date" 
                    className="w-full bg-card border border-theme p-4 pl-12 rounded-xl text-sm text-primary focus:border-amber-500 outline-none dark:[color-scheme:dark] transition-all font-bold hover:border-theme cursor-pointer" 
                    value={deadline} 
                    onChange={e => setDeadline(e.target.value)} 
                    min={new Date().toISOString().split('T')[0]} 
                    required 
                  />
                </div>
                <p className="text-[9px] text-zinc-500 ml-1">Choose target date. Rush fees apply for turnarounds under 48 hours.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Content Category</label>
                <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-zinc-300 font-bold" value={contentType} onChange={e => setContentType(e.target.value)}>
                  <option>Website Copy / Landing Page</option>
                  <option>SEO Blog Article</option>
                  <option>eBook / Ghostwriting</option>
                  <option>Fictional Narrative</option>
                  <option>Business Plan</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Tone of Voice</label>
                <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-zinc-300 font-bold" value={tone} onChange={e => setTone(e.target.value)}>
                  <option>Professional & Corporate</option>
                  <option>Conversational & Friendly</option>
                  <option>Persuasive & Sales-Driven</option>
                  <option>Humorous & Witty</option>
                  <option>Academic & Technical</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Project Title / Topic</label>
              <input type="text" placeholder="E.g., SEO Article on Digital Marketing Trends" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-white font-bold hover:border-zinc-700" required />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Target Audience</label>
              <input type="text" placeholder="Who is your target audience? (e.g., Tech startups, Gen Z shoppers)" value={audience} onChange={e => setAudience(e.target.value)} className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-white font-bold hover:border-zinc-700" required />
              <p className="text-[9px] text-zinc-500 ml-1">Detailing your target audience helps us draft in the correct tone.</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase">Stylistic Context & Instructions</label>
              <textarea
                placeholder="Provide detailed context, competitor links, or stylistic preferences..."
                className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-amber-500 outline-none resize-none h-32 text-white font-medium hover:border-zinc-700"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
              />
            </div>
            
            <label className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-[#0f0f0f] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-6 h-6 text-zinc-600 mb-2" />
              <span className="text-xs font-bold text-zinc-400">Attach Brand Guidelines or References</span>
              <input type="file" className="hidden" onChange={e => setBriefFile(e.target.files?.[0] || null)} />
            </label>
            {briefFile && (
              <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-500 p-3 rounded-xl border border-amber-500/20 w-full break-words">
                <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{briefFile.name}</span>
              </div>
            )}
          </div>

          {/* Terms of Service with decodeHtml */}
          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Terms of Service</label>
            <div className="h-32 overflow-y-auto bg-black border border-zinc-800 rounded-xl p-4 leading-relaxed custom-scrollbar prose prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: decodeHtml(termsText || "Loading terms...") }} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-amber-500 bg-black border-zinc-800 rounded"
              />
              <span className="text-xs text-zinc-300 font-bold leading-relaxed">I agree to the Content terms above.</span>
            </label>
          </div>

          <div className="bg-amber-500/10 p-6 rounded-2xl border border-amber-500/20 text-center">
            <div className="text-4xl font-black text-amber-500 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-zinc-500 mt-2 tracking-widest">Calculated Custom Quote</p>
          </div>

          <button
            onClick={submitOrder}
            disabled={!acceptTerms || submitting}
            className="w-full bg-amber-500 text-black font-black uppercase text-xs tracking-[1px] py-5 rounded-2xl shadow-xl shadow-amber-500/20 hover:bg-amber-400 transition disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Submit Content Request'}
          </button>
        </div>
      </div>
    </div>
  );
}