'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { Upload, Paperclip, ChevronRight, CheckCircle2, Briefcase } from 'lucide-react';
import type { CreateOrderServerActionResponse } from '@/lib/types';

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

export default function ResumeOrderForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [topic, setTopic] = useState(''); // E.g., "Senior Product Manager"
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level (3-8 years)');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: addons } = await supabase.from('order_addons').select('*').eq('service_category', 'RESUME').eq('is_active', true);
      if (addons) setAvailableAddons(addons as OrderAddon[]);

      const { data: terms } = await supabase.from('site_content').select('content_text').eq('content_key', 'resume_tos').single();
      if (terms) setTermsText(terms.content_text);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const calculateTotal = useCallback(() => {
    let total = 0; // Starts at 0 for resumes, driven entirely by packages/addons
    let percentIncrease = 0;

    selectedAddons.forEach(id => {
      const addon = availableAddons.find(a => a.id === id);
      if (addon) {
        if (addon.price_type === 'FLAT_FEE') total += addon.price_value;
        if (addon.price_type === 'PERCENT_INCREASE') percentIncrease += (addon.price_value / 100);
      }
    });

    total = total * (1 + percentIncrease);
    return Math.round(total);
  }, [selectedAddons, availableAddons]);

  const toggleAddon = (id: string) => {
    const newSelected = new Set(selectedAddons);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedAddons(newSelected);
  };

  const submitOrder = async () => {
    if (!name || !email || !whatsapp || !topic || !deadline) {
      return alert("Please fill out all mandatory fields.");
    }
    if (selectedAddons.size === 0) return alert("Please select at least one CV/Resume package to continue.");
    if (!acceptTerms) return alert("You must accept the Resume Terms of Service.");

    setSubmitting(true);
    const orderStringId = `CV-${Math.floor(100000 + Math.random() * 900000)}`;
    const selectedNames = Array.from(selectedAddons).map(id => availableAddons.find(a => a.id === id)?.name).filter(Boolean).join(', ');

    const compiledInstructions = `
      [TARGET ROLE]: ${topic}
      [EXPERIENCE LEVEL]: ${experienceLevel}
      [LINKEDIN]: ${linkedInUrl || 'Not provided'}
      [NOTES]: ${instructions}
      [SELECTED PACKAGES]: ${selectedNames}
    `.trim();

    const payload = {
      order_id: orderStringId,
      legal_name: name,
      email: email,
      guest_whatsapp: whatsapp,
      whatsapp_sync: whatsapp,
      topic: `[RESUME] ${topic}`,
      service_tier: 'CUSTOM',
      financial_quote: calculateTotal(),
      deadline,
      workflow_status: 'Briefing Received',
      additional_info: compiledInstructions,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      vault_status: 'Pending Profile Review'
    };

    const serverResponse = await createSecureOrder(payload as any, '') as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      alert(`Submission failed: ${serverResponse?.error}`);
      setSubmitting(false);
      return;
    }

    if (briefFile) {
      const ext = briefFile.name.split('.').pop();
      const storagePath = `${orderStringId}/current_cv_${Date.now()}.${ext}`;
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white py-20 px-6 font-['Inter']">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Executive Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Executive Resumes & CVs</h1>
          <p className="text-zinc-400 text-sm">ATS-compliant resumes, Cover Letters, and LinkedIn optimizations to secure top-tier interviews.</p>
        </div>

        <div className="space-y-8 bg-[#0a0a0a] p-8 rounded-[32px] border border-zinc-800">
          
          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Select Required Packages</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div key={addon.id} onClick={() => toggleAddon(addon.id)} className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}>
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-600'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-zinc-300'}`}>{addon.name}</h4>
                          <span className="text-xs font-black text-zinc-500">{addon.price_type === 'FLAT_FEE' ? `₦${addon.price_value.toLocaleString()}` : `+${addon.price_value}%`}</span>
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
              <input type="text" placeholder="Full Name" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none" value={name} onChange={e => setName(e.target.value)} />
              <input type="email" placeholder="Email Address" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="tel" placeholder="WhatsApp Number" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              <input type="date" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm text-zinc-400 focus:border-blue-500 outline-none [color-scheme:dark]" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Target Role / Job Title (e.g., Senior Data Analyst)" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none" value={topic} onChange={e => setTopic(e.target.value)} />
              <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none text-zinc-300" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}>
                <option>Entry-Level (0-2 years)</option>
                <option>Mid-Level (3-8 years)</option>
                <option>Senior/Executive (9+ years)</option>
                <option>Career Change</option>
              </select>
            </div>

            <input type="url" placeholder="Link to Current LinkedIn Profile (Optional)" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none" value={linkedInUrl} onChange={e => setLinkedInUrl(e.target.value)} />
            
            <textarea placeholder="List specific companies you are targeting, core achievements to highlight, or formatting preferences..." className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-xl text-sm focus:border-blue-500 outline-none resize-none h-24" value={instructions} onChange={e => setInstructions(e.target.value)} />
            
            <label className="border-2 border-dashed border-zinc-800 hover:border-blue-500/50 bg-[#0f0f0f] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-6 h-6 text-zinc-600 mb-2" />
              <span className="text-xs font-bold text-zinc-400">Attach Your Current CV/Resume</span>
              <span className="text-[10px] text-zinc-600 mt-1">If you don't have one, attach a list of your work history.</span>
              <input type="file" className="hidden" onChange={(e) => setBriefFile(e.target.files?.[0] || null)} />
            </label>
            {briefFile && (
              <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-400 p-3 rounded-xl border border-blue-500/20">
                <Paperclip className="w-4 h-4" /> {briefFile.name}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Terms of Service</label>
            <div className="h-32 overflow-y-auto bg-black border border-zinc-800 rounded-xl p-4 leading-relaxed custom-scrollbar prose prose-invert max-w-none">
  <div dangerouslySetInnerHTML={{ __html: decodeHtml(termsText || "Loading terms...") }} />
</div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-blue-500 bg-black border-zinc-800 rounded" />
              <span className="text-xs text-zinc-300 font-bold leading-relaxed">I agree to the Resume Terms of Service.</span>
            </label>
          </div>

          <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20 text-center">
            <div className="text-4xl font-black text-blue-500 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-zinc-500 mt-2 tracking-widest">Total Package Price</p>
          </div>

          <button onClick={submitOrder} disabled={!acceptTerms || selectedAddons.size === 0 || submitting} className="w-full bg-blue-600 text-white font-black uppercase text-xs tracking-[1px] py-5 rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition disabled:opacity-50">
            {submitting ? 'Encrypting Documents...' : 'Finalize Resume Request'}
          </button>
        </div>
      </div>
    </div>
  );
}