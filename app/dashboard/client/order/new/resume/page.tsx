'use client';
import { BillingDetailsFields, PaymentStructureFields, compileMilestones } from '@/app/components/OrderMilestonesPayment';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { Upload, Paperclip, CheckCircle2, Calendar } from 'lucide-react';
import type { CreateOrderServerActionResponse } from '@/lib/types';
import OrderCategoryNav from '@/app/components/OrderCategoryNav';

import { getEffectiveUser } from '@/lib/impersonate';
import { showToast } from '@/app/components/ui/Toast';

type OrderAddon = {
  id: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
};

export default function LoggedInResumeOrderPage() {
  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [paymentStructure, setPaymentStructure] = useState<'60/40' | 'CUSTOM'>('60/40');
  const [milestones, setMilestones] = useState<any[]>([
    { name: 'Initial Deposit', percentage: 40, trigger: 'Upon signing this agreement' },
    { name: 'Second Payment', percentage: 30, trigger: 'Completion of core project phase' },
    { name: 'Final Payment', percentage: 30, trigger: 'Final delivery and client sign off' }
  ]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  const [topic, setTopic] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level (3-8 years)');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { user, profile } = await getEffectiveUser();
      if (!user) return router.push('/login');
      setUser(user);
      setProfile(profile);
    };
    fetchUser();
  }, [router]);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: addons } = await supabase
        .from('order_addons')
        .select('*')
        .eq('service_category', 'RESUME')
        .eq('is_active', true);
      if (addons) setAvailableAddons(addons as OrderAddon[]);

      const { data: terms } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('content_key', 'resume_tos')
        .single();
      if (terms) setTermsText(terms.content_text);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const calculateTotal = useCallback(() => {
    let total = 0;
    let percentIncrease = 0;
    selectedAddons.forEach(id => {
      const addon = availableAddons.find(a => a.id === id);
      if (addon) {
        if (addon.price_type === 'FLAT_FEE') total += addon.price_value;
        if (addon.price_type === 'PERCENT_INCREASE') percentIncrease += addon.price_value / 100;
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
    if (!topic || !deadline) {
      showToast('Please fill out all mandatory fields (Target Role, Deadline).', 'error');
      return;
    }
    if (selectedAddons.size === 0) {
      showToast('Please select at least one CV/Resume package to continue.', 'error');
      return;
    }
    if (!acceptTerms) {
      showToast('You must accept the Resume Terms of Service.', 'error');
      return;
    }

    setSubmitting(true);
    const orderStringId = `CV-${Math.floor(100000 + Math.random() * 900000)}`;
    const selectedNames = Array.from(selectedAddons)
      .map(id => availableAddons.find(a => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    const compiledInstructions = `
      [TARGET ROLE]: ${topic}
      [EXPERIENCE LEVEL]: ${experienceLevel}
      [LINKEDIN]: ${linkedInUrl || 'Not provided'}
      [NOTES]: ${instructions}
      [SELECTED PACKAGES]: ${selectedNames}
    `.trim();

    const payload = {
      order_id: orderStringId,
      client_id: user.id,
      legal_name: profile.full_name,
      email: user.email,
      whatsapp_sync: profile.whatsapp || '',
      topic: `[RESUME] ${topic}`,
      service_tier: 'CUSTOM',
      financial_quote: calculateTotal(),
      client_company: clientCompany || null,
      client_address: clientAddress || null,
      client_phone: profile?.whatsapp || null,
      payment_structure_type: paymentStructure,
      payment_milestones: compileMilestones(paymentStructure, milestones, calculateTotal()),
      deadline,
      workflow_status: 'Briefing Received',
      additional_info: compiledInstructions,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      vault_status: 'Pending Profile Review',
    };

    const serverResponse = (await createSecureOrder(payload as any, '')) as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      showToast(`Submission failed: ${serverResponse?.error}`, 'error');
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

    router.push('/dashboard/client');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary py-12 px-6 font-['Inter']">
      <OrderCategoryNav />
      <div className="max-w-3xl mx-auto space-y-12 mt-6">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Executive Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Executive Resumes & CVs</h1>
          <p className="text-secondary text-sm">ATS‑compliant resumes, Cover Letters, and LinkedIn optimizations to secure top‑tier interviews.</p>
          <p className="text-xs text-emerald-400 mt-2">Logged in as: {profile?.full_name || user.email}</p>
        </div>

        <div className="space-y-8 bg-secondary border border-theme p-8 rounded-[32px]">
          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Select Required Packages</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-theme bg-primary hover:border-zinc-500/50'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-theme'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-primary'}`}>{addon.name}</h4>
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
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase tracking-widest">Target Job Title</label>
              <input
                type="text"
                placeholder="E.g., Senior Software Engineer / Product Manager"
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-blue-500 outline-none text-primary font-bold hover:border-zinc-500/50"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                required
              />
              <p className="text-[9px] text-secondary ml-1">State the role title you are targeting to guide resume tailoring.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase tracking-widest">Experience Level</label>
              <select
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-blue-500 outline-none text-primary font-bold hover:border-zinc-500/50"
                value={experienceLevel}
                onChange={e => setExperienceLevel(e.target.value)}
              >
                <option>Entry-Level (0-2 years)</option>
                <option>Mid-Level (3-8 years)</option>
                <option>Senior/Executive (9+ years)</option>
                <option>Career Change</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase tracking-widest">Target Delivery Deadline</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none group-focus-within:text-blue-500 transition-colors">
                  <Calendar className="w-5 h-5" />
                </div>
                <input
                  type="date"
                  className="w-full bg-card border border-theme p-4 pl-12 rounded-xl text-sm text-primary focus:border-blue-500 outline-none dark:[color-scheme:dark] transition-all font-bold hover:border-theme cursor-pointer"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  min={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  required
                />
              </div>
              <p className="text-[9px] text-secondary ml-1">We require a minimum 2-week (14 day) lead time. Add an Urgent Delivery add-on if you need it faster.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase tracking-widest">LinkedIn Profile URL (Optional)</label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/username"
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-blue-500 outline-none text-primary font-bold hover:border-zinc-500/50"
                value={linkedInUrl}
                onChange={e => setLinkedInUrl(e.target.value)}
              />
              <p className="text-[9px] text-secondary ml-1">Paste your profile link if you want us to update your online profile too.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase tracking-widest">Key Achievements & Targets</label>
              <textarea
                placeholder="List specific companies you are targeting, core achievements to highlight, or formatting preferences..."
                className="w-full bg-primary border border-theme p-4 rounded-xl text-sm focus:border-blue-500 outline-none resize-none h-24 text-primary font-medium hover:border-zinc-500/50"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase tracking-widest">Current CV / Resume Brief</label>
              <label className="border-2 border-dashed border-theme hover:border-blue-500/50 bg-primary rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
                <Upload className="w-6 h-6 text-secondary mb-2" />
                <span className="text-xs font-bold text-secondary">Attach Your Current CV/Resume</span>
                <span className="text-[10px] text-secondary mt-1">If you don't have one, attach a list of your work history.</span>
                <input type="file" className="hidden" onChange={e => setBriefFile(e.target.files?.[0] || null)} />
              </label>
              {briefFile && (
                <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-500 p-3 rounded-xl border border-blue-500/20 w-full break-words">
                  <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{briefFile.name}</span>
                </div>
              )}
            </div>
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
                className="mt-1 w-4 h-4 accent-blue-500 bg-primary border border-theme rounded"
              />
              <span className="text-xs text-primary font-bold leading-relaxed">I agree to the Resume Terms of Service.</span>
            </label>
          </div>

          <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20 text-center">
            <div className="text-4xl font-black text-blue-500 tracking-tight">₦{calculateTotal().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-secondary mt-2 tracking-widest">Total Package Price</p>
          </div>

          <button
            onClick={submitOrder}
            disabled={!acceptTerms || selectedAddons.size === 0 || submitting}
            className="w-full bg-blue-600 text-white font-black uppercase text-xs tracking-[1px] py-5 rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition disabled:opacity-50"
          >
            {submitting ? 'Encrypting Documents...' : 'Finalize Resume Request'}
          </button>
        </div>
      </div>
    </div>
  );
}