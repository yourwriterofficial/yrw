'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { Upload, Paperclip, CheckCircle2 } from 'lucide-react';
import type { CreateOrderServerActionResponse } from '@/lib/types';

type OrderAddon = {
  id: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
};

export default function LoggedInContentOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  const [baseBudget, setBaseBudget] = useState<number>(30000);
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState('Website Copy / Landing Page');
  const [tone, setTone] = useState('Professional & Corporate');
  const [audience, setAudience] = useState('');
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
    if (!topic || !deadline || !audience) {
      alert('Please fill out all mandatory fields (Topic, Deadline, Target Audience).');
      return;
    }
    if (!acceptTerms) {
      alert('You must accept the Content Terms of Service.');
      return;
    }

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
      client_id: user.id,
      legal_name: profile.full_name,
      email: user.email,
      whatsapp_sync: profile.whatsapp || '',
      topic: `[CONTENT] ${topic}`,
      service_tier: 'CUSTOM',
      financial_quote: calculateTotal(),
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

    router.push('/dashboard/client');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary py-20 px-6 font-['Inter']">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Creative Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Content & Creative Writing</h1>
          <p className="text-secondary text-sm">Tailored copy, eBooks, and SEO content designed to engage your exact audience.</p>
          <p className="text-xs text-emerald-400 mt-2">Logged in as: {profile?.full_name || user.email}</p>
        </div>

        <div className="space-y-8 bg-secondary border border-theme p-8 rounded-[32px]">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2 block ml-1">Proposed Base Budget (₦)</label>
            <input
              type="number"
              className="w-full bg-primary border border-theme p-5 rounded-2xl text-amber-500 font-black text-2xl outline-none focus:border-amber-500 transition"
              value={baseBudget || ''}
              onChange={e => setBaseBudget(parseInt(e.target.value) || 0)}
            />
            <p className="text-[10px] text-secondary mt-2 ml-1">Enter your budget based on word count expectations.</p>
          </div>

          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Select Content Add-ons</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-amber-500 bg-amber-500/5' : 'border-theme bg-primary hover:border-zinc-700'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-theme'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-amber-500' : 'text-primary'}`}>{addon.name}</h4>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-primary"
                value={contentType}
                onChange={e => setContentType(e.target.value)}
              >
                <option>Website Copy / Landing Page</option>
                <option>SEO Blog Article</option>
                <option>eBook / Ghostwriting</option>
                <option>Fictional Narrative</option>
                <option>Business Plan</option>
              </select>
              <select
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-primary"
                value={tone}
                onChange={e => setTone(e.target.value)}
              >
                <option>Professional & Corporate</option>
                <option>Conversational & Friendly</option>
                <option>Persuasive & Sales-Driven</option>
                <option>Humorous & Witty</option>
                <option>Academic & Technical</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Project Title or Core Subject"
              className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-primary"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Who is your target audience? (e.g., Tech startups, Gen Z shoppers)"
              className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-amber-500 outline-none text-primary"
              value={audience}
              onChange={e => setAudience(e.target.value)}
              required
            />
            <input
              type="date"
              className="w-full bg-primary border border-theme p-4 rounded-xl text-sm text-secondary focus:border-amber-500 outline-none [color-scheme:dark]"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />

            <textarea
              placeholder="Provide detailed context, competitor links, or stylistic preferences..."
              className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-amber-500 outline-none resize-none h-32 text-primary"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />

            <label className="border-2 border-dashed border-theme hover:border-amber-500/50 bg-primary rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-6 h-6 text-secondary mb-2" />
              <span className="text-xs font-bold text-secondary">Attach Brand Guidelines or References</span>
              <input type="file" className="hidden" onChange={e => setBriefFile(e.target.files?.[0] || null)} />
            </label>
            {briefFile && (
              <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-500 p-3 rounded-xl border border-amber-500/20">
                <Paperclip className="w-4 h-4" /> {briefFile.name}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-6 border-t border-theme">
            <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Terms of Service</label>
            <div className="h-32 overflow-y-auto bg-primary border border-theme rounded-xl p-4 leading-relaxed custom-scrollbar prose prose-invert max-w-none"
                 dangerouslySetInnerHTML={{ __html: termsText || "Loading terms..." }} />
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 accent-amber-500 bg-primary border border-theme rounded"
              />
              <span className="text-xs text-primary font-bold leading-relaxed">I agree to the Content terms above.</span>
            </label>
          </div>

          <div className="bg-amber-500/10 p-6 rounded-2xl border border-amber-500/20 text-center">
            <div className="text-4xl font-black text-amber-500 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-secondary mt-2 tracking-widest">Calculated Custom Quote</p>
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