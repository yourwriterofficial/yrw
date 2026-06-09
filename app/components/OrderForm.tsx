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

  // Fetch admin styles & load draft (only once)
  useEffect(() => {
    const fetchAdminOverrides = async () => {
      const { data: refs } = await supabase.from('reference_styles').select('name').eq('active', true).order('sort_order');
      const { data: fonts } = await supabase.from('font_styles').select('name').eq('active', true).order('sort_order');
      if (refs) setDbRefStyles(refs.map(r => r.name));
      if (fonts) setDbFontStyles(fonts.map(f => f.name));
    };
    fetchAdminOverrides();

    // Load draft ONLY if fields are currently empty (prevents overwriting user input)
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
  }, []);

  // Auto-save draft whenever fields change (after initial load)
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
      setPromoMsg('❌ Invalid or inactive token');
      setPromoDiscount(0);
    } else {
      setPromoDiscount(data.discount_percent);
      setPromoMsg(`✅ ${data.discount_percent}% discount authorized`);
    }
  };

  const handleFileInterception = (e: React.ChangeEvent<HTMLInputElement>, type: 'brief' | 'extra') => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    const sizeCeiling = 25 * 1024 * 1024;
    for (const file of selectedFiles) {
      if (file.size > sizeCeiling) {
        alert(`Storage Violation: "${file.name}" exceeds the direct 25MB threshold. Please clear this file and paste a Google Drive link in Step 4 instead.`);
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
        alert("Required Fields Missing: Please fill out your Name, Email, WhatsApp number, and Research Topic to initialize your secure workspace profile.");
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
    if (!acceptTerms) return alert('You must formally accept the Terms of Service structure.');
    if (!validateStep(1)) return;
    if (!deadline) return alert('Please assign a pipeline deadline date.');

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
      media_link: mediaLink || null,
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

    // Upload files (if any)
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

    // Remove draft and redirect to account creation page
    localStorage.removeItem('rw_order_draft');
    router.push(`/complete-registration?email=${encodeURIComponent(email)}&orderId=${orderStringId}`);
    setLoading(false);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest font-black text-emerald-400 animate-pulse">
          {loading ? 'Encrypting & Syncing Manifest...' : 'Initializing Framework...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 bg-transparent text-white font-['Inter']">
      {/* Stepper */}
      <div className="flex justify-between items-center mb-16 relative px-2">
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
              {['Details', 'Brief', 'Context', 'Media', 'Review'][s - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-[24px] border border-zinc-800">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Acquisition Routing Path</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">Select whether you want to follow our structured system price tiers, or state your alternative project requirements along with your target budget directly to the writing syndicate.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setPlan('GOLD')} className={`p-5 rounded-2xl border cursor-pointer transition text-left ${plan !== 'CUSTOM' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className={`w-4 h-4 ${plan !== 'CUSTOM' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                  <span className="text-xs font-black uppercase tracking-wider">System Tiers (Standard)</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">Fixed per-word rates ranging from ₦60 to ₦100. Includes automatic volumetric logic discounts.</p>
              </div>
              <div onClick={() => setPlan('CUSTOM')} className={`p-5 rounded-2xl border cursor-pointer transition text-left ${plan === 'CUSTOM' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <HelpCircle className={`w-4 h-4 ${plan === 'CUSTOM' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                  <span className="text-xs font-black uppercase tracking-wider">Custom Proposal (Bespoke)</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">Name your price. Describe your scope metrics and proposed fee. The syndicate will approve or decline via email logs.</p>
              </div>
            </div>
          </div>
          {plan !== 'CUSTOM' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['GOLD', 'SILVER', 'BRONZE', 'STANDARD'] as const).map((p) => (
                  <div key={p} onClick={() => setPlan(p)} className={`p-4 rounded-xl border text-center cursor-pointer transition ${plan === p ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest block ${plan === p ? 'text-emerald-400' : 'text-zinc-500'}`}>{p}</span>
                    <span className="font-black text-sm block mt-1">₦{PLAN_RATES[p]}/w</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Identity & Topic Context</div>
            <input type="text" placeholder="Full Legal Name" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={name} onChange={e => setName(e.target.value)} required />
            <input type="email" placeholder="Email Address" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="tel" placeholder="WhatsApp Connection Link Number (e.g. +234...)" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required />
            <input type="text" placeholder="Research Topic Title" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={topic} onChange={e => setTopic(e.target.value)} required />
          </div>
          <div className="space-y-4">
            <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Formatting Configurations</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block ml-1">Citation Model</label>
                <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-xs text-white outline-none focus:border-emerald-500" value={refStyle} onChange={e => setRefStyle(e.target.value)}>
                  {dbRefStyles.length > 0 && (
                    <optgroup label="Custom Overrides (Admin Panels)">
                      {dbRefStyles.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Global: Arts & Humanities">
                    <option value="MLA 9th Edition">MLA 9th (Modern Language Association)</option>
                    <option value="Chicago 17th Edition">Chicago 17th (Notes & Bibliography)</option>
                    <option value="Turabian">Turabian (Student Papers)</option>
                  </optgroup>
                  <optgroup label="Global: Social & Behavioral Sciences">
                    <option value="APA 7th Edition">APA 7th (Psychology, Business, SPGS)</option>
                    <option value="Harvard">Harvard (Author-Date Format)</option>
                    <option value="ASA 6th Edition">ASA 6th (Sociology Matrix)</option>
                    <option value="APSA">APSA (Political Science Variant)</option>
                  </optgroup>
                  <optgroup label="Global: Sciences & Engineering">
                    <option value="Vancouver">Vancouver (Medical Sciences standard)</option>
                    <option value="AMA 11th Edition">AMA 11th (American Medical)</option>
                    <option value="IEEE">IEEE (Tech, Computer Engineering)</option>
                  </optgroup>
                  <optgroup label="Nigeria: Law Jurisprudence">
                    <option value="NALT Uniform Citation Guide">NALT (Nigerian Association of Law Teachers)</option>
                    <option value="NIALS Format">NIALS (Nigerian Institute of Advanced Legal Studies)</option>
                    <option value="Unilag LCM">Unilag LCM (University of Lagos Legal Citation Model)</option>
                    <option value="OAU Law Format">OAU Law Format (Obafemi Awolowo University)</option>
                  </optgroup>
                  <optgroup label="Nigeria: Postgraduate SPGS Specifics">
                    <option value="UI SPGS Format">UI SPGS Format (University of Ibadan)</option>
                    <option value="ABU Zaria Thesis Guide">ABU Thesis Guide (Ahmadu Bello University)</option>
                    <option value="UNN Postgraduate Style">UNN PG Style (University of Nigeria, Nsukka)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block ml-1">Typographic Blueprint</label>
                <select className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-xs text-white outline-none focus:border-emerald-500" value={fontStyle} onChange={e => setFontStyle(e.target.value)}>
                  {dbFontStyles.length > 0 && (
                    <optgroup label="Custom Options (Admin Panels)">
                      {dbFontStyles.map(f => <option key={f} value={f}>{f}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Standard Academic (Serif)">
                    <option value="Times New Roman (12pt)">Times New Roman (12pt) - Universal</option>
                    <option value="Georgia (11pt)">Georgia (11pt) - APA Approved</option>
                    <option value="Garamond (12pt)">Garamond (12pt) - Classic Print</option>
                    <option value="Computer Modern (12pt)">Computer Modern (12pt) - LaTeX / Mathematical</option>
                  </optgroup>
                  <optgroup label="Modern & Clean (Sans-Serif)">
                    <option value="Arial (11pt)">Arial (11pt) - High Contrast</option>
                    <option value="Calibri (11pt)">Calibri (11pt) - Standard Default</option>
                    <option value="Helvetica (11pt)">Helvetica (11pt) - Clean Core</option>
                    <option value="Roboto (11pt)">Roboto (11pt) - Digital Native</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
          <button onClick={() => { if (validateStep(1)) goToStep(2); }} className="w-full bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-5 rounded-full hover:bg-[#1ed760] transition flex items-center justify-center gap-2">
            Proceed to Primary Briefing <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Steps 2, 3, 4, 5 – unchanged */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Primary Institutional Brief</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">Upload the core requirements documentation, project prompt sheet, matrix rubric, or grading guidelines outline provided by your university.</p>
            <label className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-[#0f0f0f] rounded-[20px] p-10 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-8 h-8 text-zinc-600 mb-3" />
              <span className="text-xs font-bold text-zinc-400">Select standard instruction file</span>
              <span className="text-[10px] text-zinc-600 mt-1">Accepts PDF, DOCX, TXT formats up to 25MB</span>
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
              Sync Briefing Records <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => goToStep(1)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Auxiliary Reading Content (Optional)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">Attach supplemental resource packages, recommended reading lists, foundational data sets, or lecture slides to map the writing parameters exactly to the professor's expectations.</p>
            <label className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-[#0f0f0f] rounded-[20px] p-10 flex flex-col items-center justify-center cursor-pointer transition">
              <Paperclip className="w-8 h-8 text-zinc-600 mb-3" />
              <span className="text-xs font-bold text-zinc-400">Select auxiliary reference batch</span>
              <span className="text-[10px] text-zinc-600 mt-1">Combined maximum direct threshold limit: 25MB</span>
              <input type="file" multiple className="hidden" onChange={(e) => handleFileInterception(e, 'extra')} />
            </label>
            {extraFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Context Stack:</div>
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
            <button onClick={() => goToStep(4)} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 transition">Proceed to Media Link Sync</button>
            <button onClick={() => goToStep(2)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-2">Cloud System Volume Repository</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">If you have massive target resource matrices, raw archival spreadsheets, or foundational media data links exceeding 25MB, drop the shared link paths securely here.</p>
            <input type="url" placeholder="Paste secure Google Drive, Dropbox, or OneDrive share path token link here" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white focus:border-emerald-500 outline-none transition" value={mediaLink} onChange={e => setMediaLink(e.target.value)} />
            <div className="text-[10px] text-zinc-600 mt-2 ml-1">💡 You can bypass or click continue directly if your requirements do not utilize large data link dependencies.</div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(5)} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 transition">Review System Manifest Summary</button>
            <button onClick={() => goToStep(3)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0a0a0a] p-6 rounded-[24px] border border-zinc-800 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">Final Volume Metric Mapping</h3>
            {isCustom ? (
              <div className="space-y-2 animate-in fade-in">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Adjust Negotiation Proposal Bid (₦)</label>
                <input type="number" className="w-full bg-black border border-emerald-500/30 p-4 rounded-xl text-emerald-400 font-black text-xl outline-none focus:border-emerald-500" value={customPrice || ''} onChange={e => setCustomPrice(parseInt(e.target.value) || 0)} />
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block ml-1">Switch System Framework Tier</label>
                <select className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs font-black tracking-wide outline-none text-zinc-300" value={plan} onChange={e => setPlan(e.target.value as Plan)}>
                  <option value="GOLD">Gold Strategy Framework Matrix (₦100 per word)</option>
                  <option value="SILVER">Silver Strategy Framework Matrix (₦80 per word)</option>
                  <option value="BRONZE">Bronze Strategy Framework Matrix (₦70 per word)</option>
                  <option value="STANDARD">Standard Strategy Framework Matrix (₦60 per word)</option>
                </select>
              </div>
            )}
            <div className="pt-4 border-t border-zinc-900">
              <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">
                <span>Volumetric Slider Integration</span>
                <span>{words.toLocaleString()} Total Words</span>
              </div>
              <input type="range" max="30000" min="50" step="50" value={words} onChange={e => setWords(parseInt(e.target.value) || 0)} className="w-full accent-emerald-500 mb-4 cursor-pointer bg-zinc-800" />
              <div className="grid grid-cols-2 gap-4">
                <div><input type="number" className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none font-medium text-white" value={words || ''} onChange={e => setWords(parseInt(e.target.value) || 0)} placeholder="State exact words count" /></div>
                <div><input type="text" readOnly className="w-full bg-zinc-950 border border-zinc-900 p-3 rounded-xl text-sm text-zinc-500 font-bold outline-none cursor-default" value={`${Math.ceil(words / 275)} Target Pages`} /></div>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block ml-1">Target Workspace Delivery Date</label>
            <input type="date" className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white outline-none focus:border-emerald-500 [color-scheme:dark]" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} required />
          </div>
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-1 ml-1">Bespoke Strategic Directives</label>
            <textarea className="w-full bg-[#0f0f0f] border border-zinc-800 p-4 rounded-[16px] text-sm text-white outline-none focus:border-emerald-500 transition pb-12" rows={4} placeholder="Log unique structural instructions, specific context definitions, source preferences, etc..." value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} />
            <div className="absolute bottom-4 right-4 text-[8px] font-black text-zinc-600 tracking-widest uppercase">{additionalInfo.length} Chars | {additionalInfo.trim() === '' ? 0 : additionalInfo.trim().split(/\s+/).length} Words</div>
          </div>
          <div className="bg-[#0a0a0a] p-4 rounded-xl border border-zinc-800">
            <div className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-2 ml-1">Voucher Verification</div>
            <div className="flex gap-2">
              <input type="text" className="flex-1 bg-black border border-zinc-800 p-4 rounded-xl text-xs uppercase tracking-widest font-black outline-none focus:border-emerald-500 text-white" placeholder="ENTER PROMO CODE" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
              <button onClick={applyPromo} className="bg-zinc-900 text-white border border-zinc-800 px-6 rounded-xl text-[10px] font-black tracking-wider hover:bg-zinc-800 transition">APPLY</button>
            </div>
            {promoMsg && <p className={`text-[10px] font-bold mt-2.5 ml-1 ${promoMsg.includes('❌') ? 'text-red-500' : 'text-emerald-400'}`}>{promoMsg}</p>}
          </div>
          <div className="bg-emerald-500/5 p-8 rounded-[30px] border border-emerald-500/10 text-center shadow-inner relative">
            <div className="text-5xl font-black text-emerald-500 tracking-tight">₦{getUiTotalPrice().toLocaleString()}</div>
            <p className="text-[9px] uppercase font-black text-zinc-500 mt-2 tracking-widest">{isCustom ? 'Proposed Contract Evaluation Budget' : 'Net Framework Manifest Quotation'}</p>
            {isCustom && <div className="mt-3 inline-block bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-3 py-1 rounded-full text-[9px] uppercase tracking-wider">Subject to Syndicate Review Matrix</div>}
          </div>
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-zinc-900 text-[11px] leading-relaxed text-zinc-400">
            <div className="font-bold text-emerald-500 text-[10px] uppercase tracking-widest mb-2 flex items-center">📜 Operational Contract Protocol Definitions <span className="text-zinc-600 lowercase tracking-normal ml-2 font-medium">(1 min read)</span></div>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>60% upfront configuration deposit</strong> required before intellectual sourcing initializes.</li>
              <li>Final editable project deliverables unlocked from secure vault upon clearing the <strong>40% structural balance</strong>.</li>
              <li>Revision iterations loop cycles must be submitted in a unified batch commentary log within <strong>3 days</strong> post initial routing preview.</li>
              <li>Communication paths are strictly limited to verified writing text trail archives within WhatsApp logging platforms.</li>
            </ul>
          </div>
          <div className="bg-[#0a0a0a] p-4 rounded-xl border border-zinc-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-emerald-500 shrink-0 bg-black border-zinc-800 rounded" />
              <span className="text-xs text-zinc-400 leading-relaxed">I authorize structural processing initialization under the terms defined inside the 60%/40% contract architecture milestone map.</span>
            </label>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={submitOrder} disabled={!acceptTerms} className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-5 rounded-full flex-1 shadow-2xl shadow-emerald-500/20 hover:bg-[#1ed760] transition disabled:opacity-50 disabled:cursor-not-allowed">Authorize & Transmit Briefing Manifest</button>
            <button onClick={() => goToStep(4)} className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-6 rounded-full font-bold text-xs flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}
    </div>
  );
}