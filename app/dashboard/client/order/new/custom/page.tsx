'use client';

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

export default function LoggedInCustomOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  const [baseBudget, setBaseBudget] = useState<number>(50000);
  const [topic, setTopic] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profile);
    };
    fetchUser();
  }, [router]);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: addons } = await supabase
        .from('order_addons')
        .select('*')
        .eq('service_category', 'CUSTOM')
        .eq('is_active', true);
      if (addons) setAvailableAddons(addons as OrderAddon[]);

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
    if (!topic || !deadline) {
      alert('Please fill out all mandatory fields (Topic, Deadline).');
      return;
    }
    if (!acceptTerms) {
      alert('You must accept the Terms of Service.');
      return;
    }
    if (baseBudget < 20000) {
      alert('Custom projects require a minimum base budget of ₦20,000.');
      return;
    }

    setSubmitting(true);
    const orderStringId = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
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
      client_id: user.id,
      legal_name: profile.full_name,
      email: user.email,
      whatsapp_sync: profile.whatsapp || '',
      topic: `[COMPLEX] ${topic}`,
      service_tier: 'CUSTOM',
      financial_quote: calculateTotal(),
      deadline,
      workflow_status: 'Briefing Received',
      additional_info: compiledInstructions,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      vault_status: 'Pending Analysis',
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

    router.push('/dashboard/client');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary py-12 px-6 font-['Inter']">
      <OrderCategoryNav />
      <div className="max-w-3xl mx-auto space-y-12 mt-6">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Complex Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Custom Data & Fieldwork</h1>
          <p className="text-secondary text-sm">For projects requiring bespoke logic, statistical analysis, or extreme urgency.</p>
          <p className="text-xs text-emerald-400 mt-2">Logged in as: {profile?.full_name || user.email}</p>
        </div>

        <div className="space-y-8 bg-secondary border border-theme p-8 rounded-[32px]">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2 block ml-1">Proposed Base Budget (₦)</label>
            <input
              type="number"
              className="w-full bg-primary border border-theme p-5 rounded-2xl text-purple-400 font-black text-2xl outline-none focus:border-purple-500 transition"
              value={baseBudget || ''}
              onChange={e => setBaseBudget(parseInt(e.target.value) || 0)}
            />
            <p className="text-[10px] text-secondary mt-2 ml-1">Do not include add-ons here. Enter the budget for the primary research only.</p>
          </div>

          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Select Required Add-ons</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-purple-500 bg-purple-500/5' : 'border-theme bg-primary hover:border-zinc-700'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-theme'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-purple-400' : 'text-primary'}`}>{addon.name}</h4>
                          <span className="text-xs font-black text-secondary">
                            {addon.price_type === 'FLAT_FEE' ? `+₦${addon.price_value.toLocaleString()}` : `+${addon.price_value}%`}
                          </span>
                        </div>
                        <p className="text-[10px] text-secondary">{addon.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-theme">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase tracking-widest">Project Topic / Objective</label>
              <input
                type="text"
                placeholder="E.g., Fieldwork Analysis of Consumer Patterns"
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary font-bold hover:border-zinc-700"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                required
              />
              <p className="text-[9px] text-zinc-500 ml-1">Enter a clear headline or summary topic for your custom project.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase tracking-widest">Target Delivery Deadline</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-focus-within:text-purple-500 transition-colors">
                  <Calendar className="w-5 h-5" />
                </div>
                <input
                  type="date"
                  className="w-full bg-card border border-theme p-4 pl-12 rounded-xl text-sm text-primary focus:border-purple-500 outline-none dark:[color-scheme:dark] transition-all font-bold hover:border-theme cursor-pointer"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <p className="text-[9px] text-zinc-500 ml-1">Choose target date. Allow at least 3–4 days for complex fieldwork tasks.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase tracking-widest">Methodologies & Data Guidelines</label>
              <textarea
                placeholder="Specific instructions, methodologies, or data requirements..."
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none resize-none h-32 text-primary font-medium hover:border-zinc-700"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
              />
              <p className="text-[9px] text-zinc-500 ml-1">Paste any technical requirements, required software (e.g. SPSS, R), or formatting guides.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold ml-1 uppercase tracking-widest">Datasets / Brief Files</label>
              <label className="border-2 border-dashed border-theme hover:border-purple-500/50 bg-primary rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
                <Upload className="w-6 h-6 text-secondary mb-2" />
                <span className="text-xs font-bold text-secondary">Attach Brief or Dataset</span>
                <input type="file" className="hidden" onChange={e => setBriefFile(e.target.files?.[0] || null)} />
              </label>
              {briefFile && (
                <div className="flex items-center gap-2 text-xs bg-purple-500/10 text-purple-400 p-3 rounded-xl border border-purple-500/20 w-full break-words">
                  <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{briefFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Terms of Service */}
          <div className="space-y-4 pt-6 border-t border-theme">
            <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Terms of Service</label>
            <div className="h-32 overflow-y-auto bg-primary border border-theme rounded-xl p-4 leading-relaxed custom-scrollbar prose prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: termsText || "Loading terms..." }} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-purple-500 bg-primary border border-theme rounded"
              />
              <span className="text-xs text-primary font-bold leading-relaxed">
                I agree to the terms above. I understand this custom quote is subject to review by the research team.
              </span>
            </label>
          </div>

          <div className="bg-purple-500/10 p-6 rounded-2xl border border-purple-500/20 text-center">
            <div className="text-4xl font-black text-purple-400 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-secondary mt-2 tracking-widest">Calculated Custom Quote</p>
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