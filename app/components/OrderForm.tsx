'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { HelpCircle, ChevronRight, ChevronLeft, Upload, Paperclip, CheckCircle2 } from 'lucide-react';
import type { ServiceTier, CreateOrderServerActionResponse } from '@/lib/types';

type Plan = ServiceTier;

const PLAN_RATES: Record<Exclude<Plan, 'CUSTOM'>, number> = {
  GOLD: 100, SILVER: 80, BRONZE: 70, STANDARD: 60,
};

const PLAN_DISCOUNTS: Record<Exclude<Plan, 'CUSTOM'>, number> = {
  GOLD: 15, SILVER: 10, BRONZE: 8, STANDARD: 6,
};

export default function OrderForm() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [termsText, setTermsText] = useState<string>(''); // dynamic TOS

  // Form Metadata States
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [plan, setPlan] = useState<Plan>('GOLD');
  const [customPrice, setCustomPrice] = useState<number>(50000);
  const [refStyle, setRefStyle] = useState<string>('APA 7th Edition');
  const [fontStyle, setFontStyle] = useState<string>('Times New Roman (12pt)');

  const [dbRefStyles, setDbRefStyles] = useState<string[]>([]);
  const [dbFontStyles, setDbFontStyles] = useState<string[]>([]);

  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [mediaLink, setMediaLink] = useState<string>('');

  const [words, setWords] = useState<number>(1000);
  const [deadline, setDeadline] = useState<string>('');
  const [additionalInfo, setAdditionalInfo] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoMsg, setPromoMsg] = useState<string>('');
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);

  const isCustom = plan === 'CUSTOM';

  // Fetch admin styles, draft, and Terms of Service
  useEffect(() => {
    const fetchInitialData = async () => {
      // Reference & font styles
      const { data: refs } = await supabase.from('reference_styles').select('name').eq('active', true).order('sort_order');
      const { data: fonts } = await supabase.from('font_styles').select('name').eq('active', true).order('sort_order');
      if (refs) setDbRefStyles(refs.map(r => r.name));
      if (fonts) setDbFontStyles(fonts.map(f => f.name));

      // Terms of Service (academic pipeline)
      const { data: tos } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('content_key', 'academic_tos')
        .single();
      if (tos && tos.content_text) {
        setTermsText(tos.content_text);
      } else {
        // Fallback static TOS (in case DB is empty)
        setTermsText(`Welcome to Your Research Writer. By providing an upfront payment, you acknowledge that you have read, understood, and agreed to be bound by the following terms and conditions. This payment constitutes a legally binding contract between the client and the agency.

1. Payment and Delivery Protocol
- A non-negotiable 60% deposit is required before any work commences.
- Upon completion, a similarities PDF report preview (AI and Plagiarism report) of the work will be provided for your review.
- The editable Word document will be released only upon receipt of the remaining 40% balance.
- Please refer to our official profile for our current working days and hours of operation.

2. Contract Scope and Refund Policy
- Each task is treated as an individual contract. Terms, briefs, or credits cannot be transferred.
- Termination of a contract while work is in progress is not permitted and does not qualify for a refund.
- Refunds are only issued in the event of a documented failure on our part (e.g., missed deadline or plagiarism exceeding pre‑agreed limits).
- We do not guarantee specific grades. No refund will be issued if a poor result is caused by vague requirements or faulty instructions from the client.

3. Client Obligations
- Include task outlines, lecture keynotes, and supplementary verbal instructions.
- We do not log into student portals. Clients must transmit materials directly.
- Word count and deadlines must be specific. We charge per word, not per page.
- All instructions must be submitted before work begins. Post‑commencement requirements may incur "Interference Fees".

4. Thesis and Dissertation Special Terms
- Default delivery is simultaneous for holistic feedback.
- Chapter‑based delivery is treated and billed as separate contracts with individual deposits and balances.

5. Communication Guidelines
- Communication is strictly limited to WhatsApp text or voice notes. Voice calls are prohibited to ensure a documented paper trail.

6. Feedback and Post‑Submission Review
- Clients have three (3) days to request revisions. Afterward, the contract is finalized.
- Payment of the final balance constitutes formal acceptance.
- All feedback must be compiled into a single batch directly into the Word document using the "Comments" feature. We do not accept staggered feedback or complete document revisions via WhatsApp text.

Note: As the student, you are the primary link between the classroom and the writer. By working within these parameters, we ensure the best possible outcome for your academic success.`);
      }

      // Load draft from localStorage
      const savedDraft = localStorage.getItem('rw_order_draft');
      if (savedDraft && !name && !email && !whatsapp && !topic) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.name && parsed.name.trim()) setName(parsed.name);
          if (parsed.email && parsed.email.trim()) setEmail(parsed.email);
          if (parsed.whatsapp && parsed.whatsapp.trim()) setWhatsapp(parsed.whatsapp);
          if (parsed.topic && parsed.topic.trim()) setTopic(parsed.topic);
          if (parsed.words && !isNaN(parseInt(parsed.words))) setWords(parseInt(parsed.words));
        } catch (e) {}
      }
      setIsLoaded(true);
    };

    fetchInitialData();
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (isLoaded) {
      const draft = { name, email, whatsapp, topic, words: words.toString() };
      localStorage.setItem('rw_order_draft', JSON.stringify(draft));
    }
  }, [name, email, whatsapp, topic, words, isLoaded]);

  const getUiTotalPrice = (): number => {
    if (isCustom) return customPrice;
    const base = words * PLAN_RATES[plan as Exclude<Plan, 'CUSTOM'>];
    const volumeDiscount = words >= 10000 ? PLAN_DISCOUNTS[plan as Exclude<Plan, 'CUSTOM'>] : 0;
    let afterVolume = base * (1 - volumeDiscount / 100);
    if (promoDiscount > 0) afterVolume = afterVolume * (1 - promoDiscount / 100);
    return Math.round(afterVolume);
  };

  const applyPromo = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!promoCode) return;
    setPromoMsg('Verifying...');
    const { data } = await supabase.from('promo_codes').select('discount_percent').eq('code', promoCode.toUpperCase()).eq('active', true).single();
    if (!data) {
      setPromoMsg('❌ Invalid or inactive code');
      setPromoDiscount(0);
    } else {
      setPromoDiscount(data.discount_percent);
      setPromoMsg(`✅ ${data.discount_percent}% discount applied`);
    }
  };

  const handleFileInterception = (e: React.ChangeEvent<HTMLInputElement>, type: 'brief' | 'extra') => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    const sizeCeiling = 25 * 1024 * 1024;
    for (const file of selectedFiles) {
      if (file.size > sizeCeiling) {
        alert(`File Too Large: "${file.name}" exceeds the 25MB limit. Please upload it to Google Drive and paste the link in Step 4 instead.`);
        e.target.value = '';
        return;
      }
    }
    if (type === 'brief') setBriefFile(selectedFiles[0] || null);
    else setExtraFiles(selectedFiles);
  };

  const validateStep = useCallback((currentStep: number): boolean => {
    if (currentStep === 1) {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedWhatsapp = whatsapp.trim();
      const trimmedTopic = topic.trim();
      
      if (!trimmedName || !trimmedEmail || !trimmedWhatsapp || !trimmedTopic) {
        alert("Required Fields Missing: Please fill out your Name, Email, WhatsApp number, and Research Topic to continue.");
        return false;
      }
    }
    return true;
  }, [name, email, whatsapp, topic]);

  const goToStep = (n: number) => {
    if (n > step && !validateStep(step)) return;
    setStep(n);
  };

  const submitOrder = async () => {
    if (!acceptTerms) return alert('You must read and accept the Terms of Service to proceed.');
    if (!validateStep(1)) return;
    if (!deadline) return alert('Please assign a project deadline date.');

    setLoading(true);
    const orderStringId = `RW-${Math.floor(100000 + Math.random() * 900000)}`;
    const calculatedPages = Math.ceil(words / 275);
    
    const payloadManifest = {
      order_id: orderStringId,
      guest_name: name,
      guest_email: email,
      guest_whatsapp: whatsapp,
      legal_name: name,
      email: email,
      topic: isCustom ? `[PROPOSAL] ${topic}` : topic,
      word_count: words,
      page_count: calculatedPages,
      service_tier: plan,
      financial_quote: isCustom ? customPrice : 0,
      workflow_status: 'Briefing Received',
      deadline,
      reference_style: refStyle,
      font_specification: fontStyle,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      additional_info: additionalInfo,
      media_link: mediaLink || undefined,
      vault_status: 'Secured in Vault',
      whatsapp_sync: whatsapp,
      last_activity: new Date().toISOString(),
    };

    const serverResponse = await createSecureOrder(payloadManifest, promoCode) as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      console.error('Order creation failed:', serverResponse?.error);
      alert(`Submission failed: ${serverResponse?.error || 'Unknown error'}`);
      setLoading(false);
      return;
    }

    const uploadUnit = async (file: File, label: 'brief' | 'extra') => {
      const ext = file.name.split('.').pop();
      const storagePath = `${orderStringId}/${label}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('order-files').upload(storagePath, file);
      if (!error) {
        await supabase.from('order_files').insert({
          order_id: serverResponse.orderDbId,
          file_path: storagePath,
          file_name: file.name,
          file_type: label,
        });
      }
    };

    if (briefFile) await uploadUnit(briefFile, 'brief');
    for (const file of extraFiles) await uploadUnit(file, 'extra');

    localStorage.removeItem('rw_order_draft');
    router.push(`/complete-registration?email=${encodeURIComponent(email)}&orderId=${orderStringId}`);
    setLoading(false);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest font-black text-emerald-400 animate-pulse">
          {loading ? 'Processing Order & Encrypting...' : 'Loading Framework...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 bg-transparent text-white font-['Inter']">
      {/* Stepper */}
      <div className="flex justify-between items-center mb-12 relative px-2 max-w-2xl mx-auto">
        <div className="absolute h-[1px] bg-zinc-800 left-8 right-8 top-[15px] -z-10" />
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex flex-col items-center justify-center text-xs font-black transition-all duration-300 relative ${
              s <= step ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 scale-110' : 'bg-zinc-950 text-zinc-600 border border-zinc-800'
            }`}
            onClick={() => goToStep(s)}
          >
            {s}
            <span className={`absolute top-10 text-[8px] tracking-widest uppercase hidden md:block font-black ${s <= step ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {['Details', 'Instructions', 'Materials', 'Links', 'Review'][s - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Details & Plans */}
      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div>
            <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">Select Your Price Plan</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">We operate strictly within the following structures to ensure transparency and quality. Please select the plan that best aligns with your academic requirements.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GOLD PLAN */}
              <div onClick={() => setPlan('GOLD')} className={`p-6 rounded-2xl border cursor-pointer transition relative ${plan === 'GOLD' ? 'border-amber-400 bg-amber-400/5 shadow-[0_0_20px_rgba(251,191,36,0.1)]' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}>
                {plan === 'GOLD' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-amber-400" /></div>}
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 mb-1">GOLD PLAN</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-4">Premium Academic Excellence</p>
                <div className="text-2xl font-black mb-4">₦100<span className="text-sm text-zinc-500 font-medium">/word</span></div>
                <ul className="text-xs text-zinc-300 space-y-2 mb-4">
                  <li><span className="text-amber-400 mr-2">★</span><strong>95–100%</strong> plagiarism-free guaranteed</li>
                  <li><span className="text-amber-400 mr-2">★</span>Best for: MSc and PhD level research</li>
                  <li><span className="text-amber-400 mr-2">★</span>Includes Plagiarism & AI reports</li>
                  <li><span className="text-amber-400 mr-2">★</span>Grade-A delivery with intensive auditing</li>
                  <li><span className="text-amber-400 mr-2">★</span>Flexible submission (by chapters) & Google Docs</li>
                  <li><span className="text-amber-400 mr-2">★</span>Full preliminary pages included</li>
                  <li><span className="text-amber-400 mr-2">★</span><strong>5 correction cycles</strong></li>
                </ul>
                <div className="text-[10px] text-amber-400 bg-amber-400/10 inline-block px-2 py-1 rounded font-bold">15% discount for projects &gt; 10,000 words</div>
              </div>

              {/* SILVER PLAN */}
              <div onClick={() => setPlan('SILVER')} className={`p-6 rounded-2xl border cursor-pointer transition relative ${plan === 'SILVER' ? 'border-slate-300 bg-slate-300/5 shadow-[0_0_20px_rgba(203,213,225,0.1)]' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}>
                {plan === 'SILVER' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-slate-300" /></div>}
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-1">SILVER PLAN</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-4">Standard Academic Support</p>
                <div className="text-2xl font-black mb-4">₦80<span className="text-sm text-zinc-500 font-medium">/word</span></div>
                <ul className="text-xs text-zinc-300 space-y-2 mb-4">
                  <li><span className="text-slate-300 mr-2">★</span><strong>90–100%</strong> plagiarism-free level</li>
                  <li><span className="text-slate-300 mr-2">★</span>Best for: Standard university assignments</li>
                  <li><span className="text-slate-300 mr-2">★</span>Includes Plagiarism & AI reports</li>
                  <li><span className="text-slate-300 mr-2">★</span>Standard grammar checks & on-time delivery</li>
                  <li><span className="text-slate-300 mr-2">★</span>Full preliminary pages included</li>
                  <li><span className="text-slate-300 mr-2">★</span><strong>3 correction cycles</strong></li>
                </ul>
                <div className="text-[10px] text-slate-300 bg-slate-300/10 inline-block px-2 py-1 rounded font-bold">10% discount for projects &gt; 10,000 words</div>
              </div>

              {/* BRONZE PLAN */}
              <div onClick={() => setPlan('BRONZE')} className={`p-6 rounded-2xl border cursor-pointer transition relative ${plan === 'BRONZE' ? 'border-orange-500 bg-orange-500/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}>
                {plan === 'BRONZE' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-orange-500" /></div>}
                <h3 className="text-sm font-black uppercase tracking-wider text-orange-500 mb-1">BRONZE PLAN</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-4">Essential Writing Support</p>
                <div className="text-2xl font-black mb-4">₦70<span className="text-sm text-zinc-500 font-medium">/word</span></div>
                <ul className="text-xs text-zinc-300 space-y-2 mb-4">
                  <li><span className="text-orange-500 mr-2">★</span><strong>85–90%</strong> plagiarism-free level</li>
                  <li><span className="text-orange-500 mr-2">★</span>Includes Plagiarism & AI reports</li>
                  <li><span className="text-orange-500 mr-2">★</span>Standard formatting & citations</li>
                  <li><span className="text-orange-500 mr-2">★</span>Cover page, TOC, and References</li>
                  <li><span className="text-orange-500 mr-2">★</span><strong>2 correction cycles</strong></li>
                </ul>
                <div className="text-[10px] text-orange-500 bg-orange-500/10 inline-block px-2 py-1 rounded font-bold">8% discount for projects &gt; 10,000 words</div>
              </div>

              {/* STANDARD PLAN */}
              <div onClick={() => setPlan('STANDARD')} className={`p-6 rounded-2xl border cursor-pointer transition relative ${plan === 'STANDARD' ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}>
                {plan === 'STANDARD' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>}
                <h3 className="text-sm font-black uppercase tracking-wider text-emerald-500 mb-1">STANDARD PLAN</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-4">Basic Drafting</p>
                <div className="text-2xl font-black mb-4">₦60<span className="text-sm text-zinc-500 font-medium">/word</span></div>
                <ul className="text-xs text-zinc-300 space-y-2 mb-4">
                  <li><span className="text-emerald-500 mr-2">★</span><strong>75–80%</strong> plagiarism-free level</li>
                  <li><span className="text-emerald-500 mr-2">★</span>Includes Plagiarism & AI reports</li>
                  <li><span className="text-emerald-500 mr-2">★</span>Basic formatting</li>
                  <li><span className="text-emerald-500 mr-2">★</span>Cover page, TOC, and References</li>
                  <li><span className="text-emerald-500 mr-2">★</span><strong>1 correction cycle</strong></li>
                </ul>
                <div className="text-[10px] text-emerald-500 bg-emerald-500/10 inline-block px-2 py-1 rounded font-bold">6% discount for projects &gt; 10,000 words</div>
              </div>

              {/* CUSTOM PLAN */}
              <div onClick={() => setPlan('CUSTOM')} className={`col-span-1 md:col-span-2 p-6 rounded-2xl border cursor-pointer transition relative ${plan === 'CUSTOM' ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}>
                {plan === 'CUSTOM' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-purple-500" /></div>}
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-500 mb-1">CUSTOM / EMERGENCY ORDERS</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">Emergency requests, PowerPoint presentations, and technical works involving complex calculations are subject to custom pricing and are treated as independent contracts. Propose your budget here.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Your Details & Research Topic</div>
            <input type="text" placeholder="Full Name" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={name} onChange={e => setName(e.target.value)} required />
            <input type="email" placeholder="Email Address" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="tel" placeholder="WhatsApp Number (e.g. +234...)" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required />
            <input type="text" placeholder="Research Topic Title" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={topic} onChange={e => setTopic(e.target.value)} required />
          </div>

          <div className="space-y-4">
            <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Formatting Requirements</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block ml-1">Citation Style</label>
                <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-xs text-white outline-none focus:border-emerald-500" value={refStyle} onChange={e => setRefStyle(e.target.value)}>
                  {dbRefStyles.length > 0 && (
                    <optgroup label="Custom Overrides">
                      {dbRefStyles.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Global: Arts & Humanities">
                    <option value="MLA 9th Edition">MLA 9th</option>
                    <option value="Chicago 17th Edition">Chicago 17th</option>
                    <option value="Turabian">Turabian</option>
                  </optgroup>
                  <optgroup label="Global: Social & Behavioral Sciences">
                    <option value="APA 7th Edition">APA 7th</option>
                    <option value="Harvard">Harvard</option>
                    <option value="ASA 6th Edition">ASA 6th</option>
                    <option value="APSA">APSA</option>
                  </optgroup>
                  <optgroup label="Global: Sciences & Engineering">
                    <option value="Vancouver">Vancouver</option>
                    <option value="AMA 11th Edition">AMA 11th</option>
                    <option value="IEEE">IEEE</option>
                  </optgroup>
                  <optgroup label="Nigeria: Law Jurisprudence">
                    <option value="NALT Uniform Citation Guide">NALT</option>
                    <option value="NIALS Format">NIALS</option>
                    <option value="Unilag LCM">Unilag LCM</option>
                    <option value="OAU Law Format">OAU Law Format</option>
                  </optgroup>
                  <optgroup label="Nigeria: Postgraduate">
                    <option value="UI SPGS Format">UI SPGS Format</option>
                    <option value="ABU Zaria Thesis Guide">ABU Thesis Guide</option>
                    <option value="UNN Postgraduate Style">UNN PG Style</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block ml-1">Font Preference</label>
                <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-xs text-white outline-none focus:border-emerald-500" value={fontStyle} onChange={e => setFontStyle(e.target.value)}>
                  {dbFontStyles.length > 0 && (
                    <optgroup label="Custom Options">
                      {dbFontStyles.map(f => <option key={f} value={f}>{f}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Standard Academic">
                    <option value="Times New Roman (12pt)">Times New Roman (12pt)</option>
                    <option value="Georgia (11pt)">Georgia (11pt)</option>
                    <option value="Garamond (12pt)">Garamond (12pt)</option>
                  </optgroup>
                  <optgroup label="Modern & Clean">
                    <option value="Arial (11pt)">Arial (11pt)</option>
                    <option value="Calibri (11pt)">Calibri (11pt)</option>
                    <option value="Helvetica (11pt)">Helvetica (11pt)</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
          <button onClick={() => { if (validateStep(1)) goToStep(2); }} className="w-full bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-5 rounded-full hover:bg-[#1ed760] transition flex items-center justify-center gap-2">
            Proceed to Instructions <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Instructions */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Upload Your Instructions</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">Upload the project prompt, grading rubric, or core guidelines provided by your university.</p>
            <label className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-[#0f0f0f] rounded-[20px] p-10 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-8 h-8 text-zinc-600 mb-3" />
              <span className="text-xs font-bold text-zinc-400">Select Instruction File</span>
              <span className="text-[10px] text-zinc-600 mt-1">Accepts PDF, DOCX, TXT (Max 25MB)</span>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => handleFileInterception(e, 'brief')} />
            </label>
            {briefFile && (
              <div className="mt-4 flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/20">
                <Paperclip className="w-4 h-4 shrink-0" />
                <span className="truncate font-medium">{briefFile.name}</span>
                <span className="ml-auto text-[10px] opacity-60">({(briefFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(3)} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 flex items-center justify-center gap-1">
              Save and Continue <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => goToStep(1)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {/* Step 3: Materials */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Additional Materials (Optional)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">Attach any extra reading lists, datasets, lecture slides, or references you want our writers to use.</p>
            <label className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-[#0f0f0f] rounded-[20px] p-10 flex flex-col items-center justify-center cursor-pointer transition">
              <Paperclip className="w-8 h-8 text-zinc-600 mb-3" />
              <span className="text-xs font-bold text-zinc-400">Select Extra Files</span>
              <span className="text-[10px] text-zinc-600 mt-1">Combined maximum: 25MB</span>
              <input type="file" multiple className="hidden" onChange={(e) => handleFileInterception(e, 'extra')} />
            </label>
            {extraFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Uploaded Files:</div>
                {extraFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/50">
                    <span className="truncate">{file.name}</span>
                    <span className="ml-auto text-[9px] text-zinc-600">({(file.size / (1024*1024)).toFixed(2)} MB)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(4)} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 transition">Continue to Links</button>
            <button onClick={() => goToStep(2)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {/* Step 4: Links */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Link to Cloud Storage (Optional)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">If you have massive files or folders exceeding our 25MB upload limit, securely paste your Google Drive, Dropbox, or OneDrive share link here.</p>
            <input type="url" placeholder="Paste your secure share link here" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={mediaLink} onChange={e => setMediaLink(e.target.value)} />
            <div className="text-[10px] text-zinc-600 mt-2 ml-1">💡 You can skip this step and click continue if you don't have large external links.</div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(5)} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 transition">Review Order Summary</button>
            <button onClick={() => goToStep(3)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Terms */}
      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-[24px] border border-zinc-800 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">Order Summary</h3>
            {isCustom ? (
              <div className="space-y-2 animate-in fade-in">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Proposed Budget (₦)</label>
                <input type="number" className="w-full bg-black border border-emerald-500/30 p-4 rounded-xl text-emerald-400 font-black text-xl outline-none focus:border-emerald-500" value={customPrice || ''} onChange={e => setCustomPrice(parseInt(e.target.value) || 0)} />
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Current Pricing Tier</label>
                <div className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-sm font-black outline-none text-white">
                  {plan} TIER (₦{PLAN_RATES[plan]}/word)
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-zinc-900">
              <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">
                <span>Select Word Count</span>
                <span>{words.toLocaleString()} Total Words</span>
              </div>
              <input type="range" max="30000" min="50" step="50" value={words} onChange={e => setWords(parseInt(e.target.value) || 0)} className="w-full accent-emerald-500 mb-4 cursor-pointer bg-zinc-800" />
              <div className="grid grid-cols-2 gap-4">
                <div><input type="number" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none font-medium text-white" value={words || ''} onChange={e => setWords(parseInt(e.target.value) || 0)} placeholder="Enter exact word count" /></div>
                <div><input type="text" readOnly className="w-full bg-zinc-950 border border-zinc-900 p-3 rounded-xl text-sm text-zinc-500 font-bold outline-none cursor-default" value={`${Math.ceil(words / 275)} Target Pages`} /></div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-1">Project Deadline</label>
            <input type="date" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white outline-none focus:border-emerald-500 [color-scheme:dark]" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} required />
          </div>

          <div className="relative">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-1 ml-1">Additional Notes for the Writer</label>
            <textarea className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white outline-none focus:border-emerald-500 transition pb-12" rows={4} placeholder="Enter any specific instructions, structure requirements, or source preferences..." value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} />
            <div className="absolute bottom-4 right-4 text-[8px] font-black text-zinc-600 tracking-widest uppercase">{additionalInfo.length} Chars | {additionalInfo.trim() === '' ? 0 : additionalInfo.trim().split(/\s+/).length} Words</div>
          </div>

          <div className="bg-[#0a0a0a] p-4 rounded-xl border border-zinc-800">
            <div className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-2 ml-1">Promo Code</div>
            <div className="flex gap-2">
              <input type="text" className="flex-1 bg-black border border-zinc-800 p-4 rounded-xl text-xs uppercase tracking-widest font-black outline-none focus:border-emerald-500 text-white" placeholder="ENTER CODE" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
              <button onClick={applyPromo} className="bg-zinc-900 text-white border border-zinc-800 px-6 rounded-xl text-[10px] font-black tracking-wider hover:bg-zinc-800 transition">APPLY</button>
            </div>
            {promoMsg && <p className={`text-[10px] font-bold mt-2.5 ml-1 ${promoMsg.includes('❌') ? 'text-red-500' : 'text-emerald-400'}`}>{promoMsg}</p>}
          </div>

          {/* DISCOUNT AND PRICE BREAKDOWN */}
          {(() => {
            if (isCustom) {
              const deposit = customPrice * 0.6;
              const balance = customPrice * 0.4;
              return (
                <div className="bg-purple-500/5 p-6 rounded-[30px] border border-purple-500/10 text-center space-y-3">
                  <div className="text-4xl font-black text-purple-500 tracking-tight">₦{customPrice.toLocaleString()}</div>
                  <p className="text-[9px] uppercase font-black text-zinc-500 tracking-widest">Proposed Budget</p>
                  <div className="flex justify-between text-sm text-zinc-400 border-t border-purple-500/20 pt-3 mt-2">
                    <span>60% Deposit (due now)</span>
                    <span>₦{deposit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>40% Balance (on completion)</span>
                    <span>₦{balance.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 inline-block bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-3 py-1 rounded-full text-[9px] uppercase tracking-wider">Subject to Team Approval</div>
                </div>
              );
            }

            const originalPrice = words * PLAN_RATES[plan as Exclude<Plan, 'CUSTOM'>];
            const volumeDiscountPercent = words >= 10000 ? PLAN_DISCOUNTS[plan as Exclude<Plan, 'CUSTOM'>] : 0;
            const volumeSaved = originalPrice * (volumeDiscountPercent / 100);
            const afterVolume = originalPrice - volumeSaved;
            const promoAmount = afterVolume * (promoDiscount / 100);
            const finalQuote = getUiTotalPrice();
            const depositAmount = finalQuote * 0.6;
            const balanceAmount = finalQuote * 0.4;

            return (
              <div className="bg-emerald-500/5 p-6 rounded-[30px] border border-emerald-500/10">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base price ({words.toLocaleString()} words × ₦{PLAN_RATES[plan]})</span>
                    <span>₦{originalPrice.toLocaleString()}</span>
                  </div>
                  {volumeDiscountPercent > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Volume discount ({volumeDiscountPercent}%)</span>
                      <span>- ₦{Math.round(volumeSaved).toLocaleString()}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Promo code ({promoDiscount}%)</span>
                      <span>- ₦{Math.round(promoAmount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-emerald-500/20">
                    <span>Total Quote</span>
                    <span className="text-emerald-500">₦{finalQuote.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-400 mt-2">
                    <span>60% Deposit (due now)</span>
                    <span>₦{depositAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>40% Balance (on completion)</span>
                    <span>₦{balanceAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TERMS OF SERVICE - DYNAMIC WITH FORMATTING */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-1">Terms of Service</label>
            <div className="max-h-64 overflow-y-auto bg-black border border-zinc-800 rounded-2xl p-6 text-xs text-zinc-400 pr-4 custom-scrollbar"
                 style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {termsText}
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-5 rounded-xl border border-zinc-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-500 shrink-0 bg-black border-zinc-800 rounded" />
              <span className="text-sm text-zinc-300 font-bold leading-relaxed">I have read, understand, and agree to the Terms of Service. I authorize processing under the 60%/40% deposit structure.</span>
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={submitOrder} disabled={!acceptTerms || loading} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-5 rounded-full flex-1 shadow-2xl shadow-emerald-500/20 hover:bg-[#1ed760] transition disabled:opacity-50 disabled:cursor-not-allowed">Confirm Order & Proceed</button>
            <button onClick={() => goToStep(4)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}
    </div>
  );
}