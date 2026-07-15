'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder } from '@/app/actions/createOrder';
import { HelpCircle, ChevronRight, ChevronLeft, ChevronDown, Upload, Paperclip, CheckCircle2, Calendar, Trash2, Star, Info } from 'lucide-react';
import type { ServiceTier, CreateOrderServerActionResponse } from '@/lib/types';
import OrderCategoryNav from './OrderCategoryNav';
import { getEffectiveUser } from '@/lib/impersonate';
import { showToast } from '@/app/components/ui/Toast';
import { fetchPricingTiers, type PricingTier } from '@/lib/pricingTiers';
import { fetchPageSettings } from '@/lib/pageSettings';
import { ORDER_PAGE_DEFAULTS, type OrderPageContent } from '@/lib/pageContentDefaults';

type Plan = ServiceTier;

// Fixed, per-tier accent so the visual identity stays stable even though admins can rename,
// reprice, or re-describe each tier via /admin/settings.
const TIER_ACCENT: Record<string, { text: string; border: string; bg: string; glow: string; ring: string }> = {
  GOLD: { text: 'text-amber-400', border: 'border-amber-400', bg: 'bg-amber-400/5', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.12)]', ring: 'bg-amber-400/10' },
  SILVER: { text: 'text-slate-400', border: 'border-slate-400', bg: 'bg-slate-400/5', glow: 'shadow-[0_0_20px_rgba(203,213,225,0.12)]', ring: 'bg-slate-400/10' },
  BRONZE: { text: 'text-orange-500', border: 'border-orange-500', bg: 'bg-orange-500/5', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.12)]', ring: 'bg-orange-500/10' },
  STANDARD: { text: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500/5', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.12)]', ring: 'bg-emerald-500/10' },
};
const DEFAULT_ACCENT = TIER_ACCENT.STANDARD;

function decodeHtml(str: string) {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * The "Payment and Delivery Protocol" clause of the default Terms of Service —
 * generated from the client's actual selected payment structure instead of
 * always describing a 60/40 split, so the terms they accept always match the
 * milestones they configured.
 */
function paymentProtocolClause(paymentStructure: '60/40' | 'CUSTOM', milestones: Array<{ name: string; percentage: number; trigger: string }>): string {
  if (paymentStructure === 'CUSTOM' && milestones.length > 0) {
    const steps = milestones
      .map((m, i) => `  ${i + 1}. ${m.name} (${m.percentage}%) — ${m.trigger}`)
      .join('\n');
    return `- A non-negotiable ${milestones[0].percentage}% initial payment ("${milestones[0].name}") is required before any work commences.
- Upon completion, a similarities PDF report preview (AI and Plagiarism report) of the work will be provided for your review.
- The editable Word document will be released only once every milestone below has been paid, in order:
${steps}
- Please refer to our official profile for our current working days and hours of operation.`;
  }
  return `- A non-negotiable 60% deposit is required before any work commences.
- Upon completion, a similarities PDF report preview (AI and Plagiarism report) of the work will be provided for your review.
- The editable Word document will be released only upon receipt of the remaining 40% balance.
- Please refer to our official profile for our current working days and hours of operation.`;
}

function defaultTermsText(paymentStructure: '60/40' | 'CUSTOM', milestones: Array<{ name: string; percentage: number; trigger: string }>): string {
  return `Welcome to Your Research Writer. By providing an upfront payment, you acknowledge that you have read, understood, and agreed to be bound by the following terms and conditions. This payment constitutes a legally binding contract between the client and the agency.

1. Payment and Delivery Protocol
${paymentProtocolClause(paymentStructure, milestones)}

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

Note: As the student, you are the primary link between the classroom and the writer. By working within these parameters, we ensure the best possible outcome for your academic success.`;
}

export default function OrderForm() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [termsText, setTermsText] = useState<string>('');
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [pageContent, setPageContent] = useState<OrderPageContent>(ORDER_PAGE_DEFAULTS.order_academic);

  // Session & wallet
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [loggedInProfile, setLoggedInProfile] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');

  // Form fields
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [plan, setPlan] = useState<Plan>('GOLD');
  const [customPrice, setCustomPrice] = useState<number>(50000);
  const [refStyle, setRefStyle] = useState<string>('APA 7th Edition');
  const [fontStyle, setFontStyle] = useState<string>('Times New Roman (12pt)');
  const [showFormattingOptions, setShowFormattingOptions] = useState<boolean>(false);

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

  // Dynamic milestones & billing fields
  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [paymentStructure, setPaymentStructure] = useState<'60/40' | 'CUSTOM'>('60/40');
  const [milestones, setMilestones] = useState<Array<{ name: string; percentage: number; trigger: string }>>([
    { name: 'Initial Deposit', percentage: 40, trigger: 'Upon signing this agreement' },
    { name: 'Second Payment', percentage: 30, trigger: 'Completion of core project phase' },
    { name: 'Final Payment', percentage: 30, trigger: 'Final delivery and client sign off' }
  ]);

  const getTier = useCallback((key: string) => tiers.find(t => t.tier_key === key), [tiers]);

  // Check login status and fetch wallet balance
  useEffect(() => {
    const checkSession = async () => {
      const { user, profile } = await getEffectiveUser();
      if (user) {
        setIsLoggedIn(true);
        setLoggedInUser(user);
        setLoggedInProfile(profile);
        setName(profile?.full_name || user.email?.split('@')[0] || '');
        setEmail(user.email || '');
        setWhatsapp(profile?.whatsapp || '');

        // Fetch wallet balance
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
        setWalletBalance(wallet?.balance || 0);
      }
    };
    checkSession();
  }, []);

  // Fetch config and draft
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: refs } = await supabase.from('reference_styles').select('name').eq('active', true).order('sort_order');
      const { data: fonts } = await supabase.from('font_styles').select('name').eq('active', true).order('sort_order');
      if (refs) setDbRefStyles(refs.map(r => r.name));
      if (fonts) setDbFontStyles(fonts.map(f => f.name));

      const [tierData, content] = await Promise.all([
        fetchPricingTiers('ACADEMIC'),
        fetchPageSettings('order_academic', ORDER_PAGE_DEFAULTS.order_academic),
      ]);
      setTiers(tierData);
      setPageContent(content);

      const { data: tos } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('content_key', 'academic_tos')
        .single();
      // Only store an admin-customized override here — when absent, leave this
      // empty so the payment-structure-aware default (computed below) is used
      // instead of a one-time snapshot that can't react to the client's choice.
      setTermsText(tos?.content_text || '');

      if (!isLoggedIn) {
        const savedDraft = localStorage.getItem('rw_order_draft');
        if (savedDraft && !name && !email && !whatsapp && !topic) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.name) setName(parsed.name);
            if (parsed.email) setEmail(parsed.email);
            if (parsed.whatsapp) setWhatsapp(parsed.whatsapp);
            if (parsed.topic) setTopic(parsed.topic);
            if (parsed.words) setWords(parseInt(parsed.words));
          } catch (e) {}
        }
      }
      setIsLoaded(true);
    };
    fetchInitialData();
  }, [isLoggedIn, name, email, whatsapp, topic]);

  // Auto-save draft for guests
  useEffect(() => {
    if (isLoaded && !isLoggedIn) {
      const draft = { name, email, whatsapp, topic, words: words.toString() };
      localStorage.setItem('rw_order_draft', JSON.stringify(draft));
    }
  }, [name, email, whatsapp, topic, words, isLoaded, isLoggedIn]);

  const getUiTotalPrice = (): number => {
    if (isCustom) return customPrice;
    const tier = getTier(plan);
    if (!tier || !tier.rate_per_word) return 0;
    const base = words * tier.rate_per_word;
    const volumeDiscount = words >= tier.volume_discount_threshold_words ? tier.volume_discount_percent : 0;
    let afterVolume = base * (1 - volumeDiscount / 100);
    if (promoDiscount > 0) afterVolume = afterVolume * (1 - promoDiscount / 100);
    return Math.round(afterVolume);
  };

  // Admin's custom terms (if set) always win; otherwise generate terms that
  // describe the client's actually-selected payment structure.
  const effectiveTermsText = useMemo(
    () => termsText || defaultTermsText(paymentStructure, milestones),
    [termsText, paymentStructure, milestones]
  );

  const firstMilestoneShare = paymentStructure === 'CUSTOM' ? (milestones[0]?.percentage || 0) : 60;
  const depositAmount = Math.round(getUiTotalPrice() * (firstMilestoneShare / 100));
  const balanceAmount = getUiTotalPrice() - depositAmount;

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
        showToast(`File Too Large: "${file.name}" exceeds the 25MB limit.`, 'error');
        e.target.value = '';
        return;
      }
    }
    if (type === 'brief') setBriefFile(selectedFiles[0] || null);
    else setExtraFiles(selectedFiles);
  };

  const validateStep = useCallback((currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!isLoggedIn) {
        if (!name.trim() || !email.trim() || !whatsapp.trim() || !topic.trim()) {
          showToast("Please fill out your Name, Email, WhatsApp, and Research Topic.", 'error');
          return false;
        }
      } else {
        if (!topic.trim()) {
          showToast("Research Topic is required.", 'error');
          return false;
        }
      }
    }
    if (currentStep === 4) {
      if (plan === 'CUSTOM' && (!customPrice || customPrice < 15000)) {
        showToast("Proposed budget must be at least ₦15,000.", 'error');
        return false;
      }
    }
    return true;
  }, [name, email, whatsapp, topic, isLoggedIn, plan, customPrice]);

  const goToStep = (n: number) => {
    if (n > step && !validateStep(step)) return;
    setStep(n);
  };

  const submitOrder = async () => {
    if (!acceptTerms) return showToast('You must accept the Terms of Service.', 'error');
    if (!validateStep(1)) return;
    if (plan === 'CUSTOM' && (!customPrice || customPrice < 15000)) {
      return showToast('Proposed budget must be at least ₦15,000.', 'error');
    }
    if (!deadline) return showToast('Please assign a deadline.', 'error');
    if (paymentMethod === 'wallet' && isLoggedIn && walletBalance < depositAmount) {
      showToast('Insufficient wallet balance. Please top up or choose card payment.', 'error');
      return;
    }

    setLoading(true);
    const orderStringId = `RW-${Math.floor(100000 + Math.random() * 900000)}`;
    const calculatedPages = Math.ceil(words / 275);

    const payloadManifest: any = {
      order_id: orderStringId,
      topic: isCustom ? `[PROPOSAL] ${topic}` : topic,
      word_count: words,
      page_count: calculatedPages,
      service_tier: plan,
      financial_quote: isCustom ? customPrice : 0,
      workflow_status: 'Briefing Received',
      deadline,
      reference_style: refStyle,
      font_specification: fontStyle,
      corrections_status: 'None',
      additional_info: additionalInfo,
      media_link: mediaLink || undefined,
      vault_status: 'Secured in Vault',
      last_activity: new Date().toISOString(),
      client_company: clientCompany || null,
      client_address: clientAddress || null,
      client_phone: whatsapp || null,
      payment_structure_type: paymentStructure,
      payment_milestones: paymentStructure === 'CUSTOM'
        ? milestones.map(m => ({
            name: m.name,
            percentage: m.percentage,
            amount: Math.round((m.percentage / 100) * (isCustom ? customPrice : getUiTotalPrice())),
            paid: false,
            delivered: false,
            paid_at: null,
            tx_ref: null,
            trigger: m.trigger
          }))
        : [
            { name: 'Initial Deposit', percentage: 60, amount: Math.round((isCustom ? customPrice : getUiTotalPrice()) * 0.6), paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: 'Upon signing this agreement' },
            { name: 'Final Payment', percentage: 40, amount: Math.round((isCustom ? customPrice : getUiTotalPrice()) * 0.4), paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: 'Upon project completion' }
          ]
    };

    if (isLoggedIn) {
      payloadManifest.client_id = loggedInUser.id;
      payloadManifest.legal_name = name;
      payloadManifest.email = email;
      payloadManifest.whatsapp_sync = whatsapp;
    } else {
      payloadManifest.guest_name = name;
      payloadManifest.guest_email = email;
      payloadManifest.guest_whatsapp = whatsapp;
      payloadManifest.legal_name = name;
      payloadManifest.email = email;
      payloadManifest.whatsapp_sync = whatsapp;
    }

    // Only forward the promo code if it was actually applied (promoDiscount > 0) —
    // otherwise the server would silently discount a quote the client never
    // displayed, desyncing financial_quote/payment_milestones from the wallet
    // debit and on-screen total, which are both computed from getUiTotalPrice().
    const serverResponse = await createSecureOrder(payloadManifest, promoDiscount > 0 ? promoCode : '') as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      showToast(`Submission failed: ${serverResponse?.error}`, 'error');
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

    // --- PAYMENT HANDLING ---
    if (isLoggedIn && paymentMethod === 'wallet') {
      try {
        const res = await fetch('/api/client/pay-order-deposit-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderStringId, amount: depositAmount }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast(data.error || 'Wallet deduction failed. Please contact support.', 'error');
          setLoading(false);
          return;
        }
      } catch {
        showToast('Network error during wallet payment.', 'error');
        setLoading(false);
        return;
      }
      showToast('Order placed! Deposit paid from wallet.', 'success');
      router.push('/dashboard/client');
    } else {
      // Pay with card – redirect to Paystack (guest or card payment)
      router.push(`/complete-registration?email=${encodeURIComponent(email)}&orderId=${orderStringId}`);
    }
    setLoading(false);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-primary text-primary flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest font-black text-emerald-400 animate-pulse">
          {loading ? 'Processing Order & Encrypting...' : 'Loading Framework...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 md:px-6 bg-transparent text-primary font-['Inter']">
      <OrderCategoryNav />

      {/* Stepper - Responsive */}
      <div className="flex justify-between items-center mb-12 relative px-2 max-w-2xl mx-auto flex-wrap gap-2">
        <div className="absolute h-[1px] bg-zinc-800 dark:bg-zinc-900 left-8 right-8 top-[15px] -z-10 hidden md:block" />
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex flex-col items-center justify-center text-xs font-black transition-all duration-300 relative cursor-pointer ${
              s <= step ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 scale-110' : 'bg-secondary text-secondary border border-theme'
            }`}
            onClick={() => goToStep(s)}
          >
            {s}
            <span className={`absolute top-10 text-[8px] tracking-widest uppercase hidden md:block font-black ${s <= step ? 'text-emerald-500' : 'text-secondary'}`}>
              {['Details', 'Instructions', 'Materials', 'Links', 'Review'][s - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: Details & Plans */}
      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div>
            <h2 className="text-xl font-bold text-primary mb-2">{pageContent.hero.title}</h2>
            <p className="text-sm text-secondary leading-relaxed mb-6">{pageContent.hero.subtitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tiers.map(tier => {
                const accent = TIER_ACCENT[tier.tier_key] || DEFAULT_ACCENT;
                const isSelected = plan === tier.tier_key;
                return (
                  <div
                    key={tier.id}
                    onClick={() => setPlan(tier.tier_key as Plan)}
                    className={`p-6 rounded-2xl border cursor-pointer transition relative overflow-hidden break-words bg-card ${isSelected ? `${accent.border} ${accent.bg} ${accent.glow}` : 'border-theme hover:border-zinc-500/50'}`}
                  >
                    {tier.highlight && (
                      <div className={`absolute top-0 right-0 ${accent.ring} ${accent.text} text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl flex items-center gap-1`}>
                        <Star className="w-3 h-3 fill-current" /> Most Popular
                      </div>
                    )}
                    {isSelected && <div className="absolute top-4 right-4"><CheckCircle2 className={`w-5 h-5 ${accent.text}`} /></div>}
                    <h3 className={`text-sm font-bold uppercase tracking-wide mb-1 ${accent.text}`}>{tier.name}</h3>
                    <p className="text-[11px] text-secondary font-medium mb-4">{tier.tagline}</p>
                    <div className="text-2xl font-bold mb-4">₦{tier.rate_per_word}<span className="text-sm text-secondary font-medium">/word</span></div>
                    <ul className="text-xs text-primary space-y-2 mb-4 break-words">
                      {tier.features.map((f, i) => (
                        <li key={i} className="flex gap-2"><span className={`${accent.text} shrink-0`}>•</span><span>{f}</span></li>
                      ))}
                    </ul>
                    {tier.volume_discount_percent > 0 && (
                      <div className={`text-[10px] ${accent.text} ${accent.ring} inline-block px-2 py-1 rounded font-semibold break-words`}>
                        {tier.volume_discount_percent}% discount for projects &gt; {tier.volume_discount_threshold_words.toLocaleString()} words
                      </div>
                    )}
                  </div>
                );
              })}

              {/* PROPOSE YOUR OWN BUDGET */}
              <div onClick={() => setPlan('CUSTOM')} className={`col-span-1 md:col-span-2 p-6 rounded-2xl border cursor-pointer transition relative overflow-hidden break-words bg-card ${plan === 'CUSTOM' ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_20px_rgba(168,85,247,0.12)]' : 'border-theme hover:border-zinc-500/50'}`}>
                {plan === 'CUSTOM' && <div className="absolute top-4 right-4"><CheckCircle2 className="w-5 h-5 text-purple-500" /></div>}
                <h3 className="text-sm font-bold uppercase tracking-wide text-purple-500 mb-1">Propose Your Own Budget</h3>
                <p className="text-xs text-secondary leading-relaxed break-words mb-3">{pageContent.budget_note.title}</p>
                <div className="flex items-start gap-2 text-xs text-secondary bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 mb-4">
                  <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>{pageContent.budget_note.text}</span>
                </div>
                {plan === 'CUSTOM' && (
                  <input
                    type="number"
                    className="w-full bg-primary border border-theme p-4 rounded-xl font-bold text-lg outline-none focus:border-purple-500 transition text-primary"
                    value={customPrice || ''}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setCustomPrice(parseInt(e.target.value) || 0)}
                    placeholder="Minimum ₦15,000"
                  />
                )}
              </div>
            </div>
          </div>

          {!isLoggedIn && (
            <div className="space-y-4">
              <div className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 font-bold">Your Personal Details</div>

              <div className="space-y-1">
                <label className="text-[10px] text-secondary block ml-1 font-bold">Full Name</label>
                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition hover:border-zinc-550 font-bold" required />
                <p className="text-[9px] text-secondary ml-1">Please enter your legal name as it appears on your university files.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-secondary block ml-1 font-bold">Email Address</label>
                <input type="email" placeholder="john.doe@university.edu" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition hover:border-zinc-550 font-bold" required />
                <p className="text-[9px] text-secondary ml-1">We will send your quotes, confirmations, and vault release links to this email.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-secondary block ml-1 font-bold">WhatsApp Number</label>
                <input type="tel" placeholder="+234..." value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition hover:border-zinc-550 font-bold" required />
                <p className="text-[9px] text-secondary ml-1">Needed for emergency updates, status changes, and prompt feedback on requirements.</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 mb-2 font-bold">Research Topic</div>
            <input type="text" placeholder="Research Topic Title" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition hover:border-zinc-550 font-bold" required />
            <p className="text-[9px] text-secondary ml-1">E.g., 'Impact of Monetary Policy on Small Businesses in Sub-Saharan Africa.'</p>
          </div>

          <div className="space-y-4 bg-secondary/30 p-6 rounded-2xl border border-theme">
            <div className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 font-bold">Billing & Company Details (Optional)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-secondary block ml-1 font-bold">Company Name</label>
                <input type="text" placeholder="e.g. My Company Ltd" value={clientCompany} onChange={e => setClientCompany(e.target.value)} className="w-full bg-card border border-theme p-3 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-secondary block ml-1 font-bold">Billing Address</label>
                <input type="text" placeholder="Street, City, State, Country" value={clientAddress} onChange={e => setClientAddress(e.target.value)} className="w-full bg-card border border-theme p-3 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition font-semibold" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowFormattingOptions(v => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 font-bold">Formatting Requirements</div>
                {!showFormattingOptions && (
                  <p className="text-[10px] text-secondary ml-1 mt-1">Using default: {refStyle} · {fontStyle}. Tap to customize.</p>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-secondary shrink-0 transition-transform ${showFormattingOptions ? 'rotate-180' : ''}`} />
            </button>
            {showFormattingOptions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-[9px] text-secondary uppercase font-bold tracking-wider mb-1 block ml-1">Citation Style</label>
                  <select value={refStyle} onChange={e => setRefStyle(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-xs text-primary outline-none focus:border-emerald-500 font-bold">
                    {dbRefStyles.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-secondary uppercase font-bold tracking-wider mb-1 block ml-1">Font Preference</label>
                  <select value={fontStyle} onChange={e => setFontStyle(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-xs text-primary outline-none focus:border-emerald-500 font-bold">
                    {dbFontStyles.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { if (validateStep(1)) goToStep(2); }} className="w-full bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] py-5 rounded-full hover:bg-[#1ed760] transition flex items-center justify-center gap-2">
            Proceed to Instructions <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 2: Instructions */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-secondary p-6 rounded-2xl border border-theme">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-500 mb-2">Upload Your Instructions</h3>
            <p className="text-xs text-secondary leading-relaxed mb-6">Upload the project prompt, grading rubric, or core guidelines provided by your university.</p>
            <label className="border-2 border-dashed border-theme hover:border-emerald-500/50 bg-card rounded-[20px] p-10 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-8 h-8 text-secondary mb-3" />
              <span className="text-xs font-bold text-primary">Select Instruction File</span>
              <span className="text-[10px] text-secondary mt-1">Accepts PDF, DOCX, TXT (Max 25MB)</span>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => handleFileInterception(e, 'brief')} />
            </label>
            {briefFile && (
              <div className="mt-4 flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/20 break-words w-full">
                <Paperclip className="w-4 h-4 shrink-0" />
                <span className="truncate font-medium">{briefFile.name}</span>
                <span className="ml-auto text-[10px] opacity-60 shrink-0">({(briefFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(3)} className="bg-emerald-500 text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 flex items-center justify-center gap-1 hover:bg-emerald-450 transition cursor-pointer">Save and Continue <ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => goToStep(1)} className="bg-primary text-secondary border border-theme px-6 rounded-full font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {/* STEP 3: Materials */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-secondary p-6 rounded-2xl border border-theme">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-500 mb-2">Additional Materials (Optional)</h3>
            <p className="text-xs text-secondary leading-relaxed mb-6">Attach any extra reading lists, datasets, lecture slides, or references you want our writers to use.</p>
            <label className="border-2 border-dashed border-theme hover:border-emerald-500/50 bg-card rounded-[20px] p-10 flex flex-col items-center justify-center cursor-pointer transition">
              <Paperclip className="w-8 h-8 text-secondary mb-3" />
              <span className="text-xs font-bold text-primary">Select Extra Files</span>
              <span className="text-[10px] text-secondary mt-1">Combined maximum: 25MB</span>
              <input type="file" multiple className="hidden" onChange={(e) => handleFileInterception(e, 'extra')} />
            </label>
            {extraFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] font-black uppercase text-secondary tracking-wider">Uploaded Files:</div>
                {extraFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-primary p-2.5 rounded-xl border border-theme break-words">
                    <span className="truncate text-primary">{file.name}</span>
                    <span className="ml-auto text-[9px] text-secondary shrink-0">({(file.size / (1024*1024)).toFixed(2)} MB)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(4)} className="bg-emerald-500 text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 hover:bg-emerald-450 transition cursor-pointer">Continue to Links</button>
            <button onClick={() => goToStep(2)} className="bg-primary text-secondary border border-theme px-6 rounded-full font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {/* STEP 4: Links */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-secondary p-6 rounded-2xl border border-theme">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-500 mb-2">Link to Cloud Storage (Optional)</h3>
            <p className="text-xs text-secondary leading-relaxed mb-6">If you have massive files or folders exceeding our 25MB upload limit, securely paste your Google Drive, Dropbox, or OneDrive share link here.</p>
            <input type="url" placeholder="Paste your secure share link here" value={mediaLink} onChange={e => setMediaLink(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-sm text-primary focus:border-emerald-500 outline-none transition" />
            <div className="text-[10px] text-secondary mt-2 ml-1">💡 You can skip this step and click continue if you don't have large external links.</div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => goToStep(5)} className="bg-emerald-500 text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-full flex-1 transition hover:bg-emerald-450 cursor-pointer">Review Order Summary</button>
            <button onClick={() => goToStep(3)} className="bg-primary text-secondary border border-theme px-6 rounded-full font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}

      {/* STEP 5: Review & Terms (with wallet integration) */}
      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-secondary p-6 rounded-[24px] border border-theme space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-500">Order Summary</h3>
            {isCustom ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Proposed Budget (₦)</label>
                <input type="number" value={customPrice || ''} onChange={e => setCustomPrice(parseInt(e.target.value) || 0)} className="w-full bg-primary border border-emerald-500/30 p-4 rounded-xl text-emerald-500 font-black text-xl outline-none focus:border-emerald-500 font-bold" />
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-secondary block ml-1">Current Pricing Tier</label>
                <div className="w-full bg-primary border border-theme p-4 rounded-xl text-sm font-black outline-none text-primary">{getTier(plan)?.name || plan} TIER (₦{getTier(plan)?.rate_per_word || 0}/word)</div>
              </div>
            )}
            <div className="pt-4 border-t border-theme">
              <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">
                <span>Select Word Count</span>
                <span>{words.toLocaleString()} Total Words</span>
              </div>
              <input type="range" max="30000" min="50" step="50" value={words} onChange={e => setWords(parseInt(e.target.value) || 0)} className="w-full accent-emerald-500 mb-4 cursor-pointer bg-card" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={words || ''} onChange={e => setWords(parseInt(e.target.value) || 0)} placeholder="Enter exact word count" className="w-full bg-primary border border-theme p-3 rounded-xl text-sm outline-none font-bold text-primary" />
                <input type="text" readOnly value={`${Math.ceil(words / 275)} Target Pages`} className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-secondary font-black outline-none cursor-default" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-secondary tracking-widest block ml-1 font-bold">Target Delivery Deadline</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none group-focus-within:text-emerald-500 transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                className="w-full bg-card border border-theme p-4 pl-12 rounded-[16px] text-sm text-primary outline-none focus:border-emerald-500 transition-all font-bold hover:border-theme cursor-pointer dark:[color-scheme:dark]"
                required
              />
            </div>
            <p className="text-[9px] text-secondary ml-1 leading-relaxed">
              Choose your target completion date. We require a minimum 2-week (14 day) lead time to guarantee quality work.
            </p>
          </div>

          <div className="relative">
            <label className="text-[10px] font-black uppercase text-secondary tracking-widest block mb-1 ml-1 font-bold">Additional Notes for the Writer</label>
            <textarea rows={4} placeholder="Enter any specific instructions, structure requirements, or source preferences..." value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} className="w-full bg-card border border-theme p-4 rounded-[16px] text-sm text-primary outline-none focus:border-emerald-500 transition pb-12 font-medium hover:border-theme" />
            <div className="absolute bottom-4 right-4 text-[8px] font-black text-secondary tracking-widest uppercase">{additionalInfo.length} Chars | {additionalInfo.trim() === '' ? 0 : additionalInfo.trim().split(/\s+/).length} Words</div>
          </div>

          <div className="bg-secondary p-4 rounded-xl border border-theme">
            <div className="text-[10px] uppercase font-black text-secondary tracking-widest mb-2 ml-1 font-bold">Promo Code</div>
            <div className="flex gap-2">
              <input type="text" placeholder="ENTER CODE" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} className="flex-1 bg-primary border border-theme p-4 rounded-xl text-xs uppercase tracking-widest font-black outline-none focus:border-emerald-500 text-primary" />
              <button onClick={applyPromo} className="bg-secondary text-primary border border-theme px-6 rounded-xl text-[10px] font-black tracking-wider hover:bg-primary transition cursor-pointer">APPLY</button>
            </div>
            {promoMsg && <p className={`text-[10px] font-bold mt-2.5 ml-1 ${promoMsg.includes('❌') ? 'text-red-500' : 'text-emerald-500'}`}>{promoMsg}</p>}
          </div>

          {/* Payment Structure Selection */}
          <div className="bg-secondary p-5 rounded-2xl border border-theme space-y-4">
            <label className="text-[10px] font-black uppercase text-secondary tracking-widest block ml-1">Payment Structure</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-primary font-bold text-sm">
                <input type="radio" name="paymentStructure" value="60/40" checked={paymentStructure === '60/40'} onChange={() => setPaymentStructure('60/40')} className="accent-emerald-500" />
                <span>Standard (60% Deposit / 40% Balance)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-primary font-bold text-sm">
                <input type="radio" name="paymentStructure" value="CUSTOM" checked={paymentStructure === 'CUSTOM'} onChange={() => setPaymentStructure('CUSTOM')} className="accent-emerald-500" />
                <span>Custom Milestones</span>
              </label>
            </div>

            {paymentStructure === 'CUSTOM' && (
              <div className="border-t border-theme pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary font-bold">Define Milestones (Percentages must sum to 100%)</span>
                  <button
                    type="button"
                    onClick={() => setMilestones([...milestones, { name: 'Milestone X', percentage: 10, trigger: 'Upon phase completion' }])}
                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider"
                  >
                    + Add Milestone
                  </button>
                </div>
                <div className="space-y-2">
                  {milestones.map((m, idx) => (
                    <div key={idx} className="bg-primary/50 border border-theme rounded-xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input type="text" className="col-span-4 bg-secondary border border-theme rounded-lg p-2 text-xs text-primary font-bold" value={m.name} onChange={e => {
                        const upd = [...milestones];
                        upd[idx].name = e.target.value;
                        setMilestones(upd);
                      }} placeholder="Name" />
                      <input type="text" className="col-span-4 bg-secondary border border-theme rounded-lg p-2 text-xs text-primary" value={m.trigger} onChange={e => {
                        const upd = [...milestones];
                        upd[idx].trigger = e.target.value;
                        setMilestones(upd);
                      }} placeholder="Trigger" />
                      <div className="col-span-3 flex items-center gap-1">
                        <input type="number" className="w-full bg-secondary border border-theme rounded-lg p-2 text-xs text-primary font-bold" value={m.percentage} onChange={e => {
                          const upd = [...milestones];
                          upd[idx].percentage = parseInt(e.target.value) || 0;
                          setMilestones(upd);
                        }} />
                        <span className="text-xs font-bold text-secondary">%</span>
                      </div>
                      <button type="button" onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))} className="col-span-1 text-secondary hover:text-red-400 text-center"><Trash2 className="w-4 h-4 mx-auto" /></button>
                    </div>
                  ))}
                </div>
                <div className="text-right text-xs font-bold text-secondary">
                  Total Milestone sum: <span className={milestones.reduce((s, m) => s + m.percentage, 0) === 100 ? 'text-emerald-400' : 'text-red-400'}>{milestones.reduce((s, m) => s + m.percentage, 0)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Price breakdown */}
          {(() => {
            const finalQuote = getUiTotalPrice();
            if (paymentStructure === 'CUSTOM') {
              return (
                <div className="bg-emerald-500/5 p-6 rounded-[30px] border border-emerald-500/20 overflow-x-auto space-y-4">
                  <div className="flex justify-between font-black text-lg pb-2 border-b border-theme flex-wrap gap-2 text-primary">
                    <span>Total Project Cost</span>
                    <span className="text-emerald-500">₦{finalQuote.toLocaleString()}</span>
                  </div>
                  <div className="space-y-2">
                    {milestones.map((m, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-secondary font-bold">
                        <span>{idx + 1}. {m.name || `Milestone ${idx+1}`} ({m.percentage}%)</span>
                        <span className="text-primary">₦{Math.round(finalQuote * (m.percentage / 100)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (isCustom) {
              const deposit = customPrice * 0.6;
              const balance = customPrice * 0.4;
              return (
                <div className="bg-purple-500/5 p-6 rounded-[30px] border border-purple-500/20 text-center space-y-3 overflow-x-auto">
                  <div className="text-4xl font-black text-purple-500 tracking-tight break-words">₦{customPrice.toLocaleString()}</div>
                  <p className="text-[9px] uppercase font-black text-secondary tracking-widest">Proposed Budget</p>
                  <div className="flex justify-between text-sm text-secondary border-t border-purple-500/10 pt-3 mt-2 flex-wrap gap-2">
                    <span>60% Deposit (due now)</span>
                    <span>₦{deposit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-secondary flex-wrap gap-2">
                    <span>40% Balance (on completion)</span>
                    <span>₦{balance.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 inline-block bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-3 py-1 rounded-full text-[9px] uppercase tracking-wider break-words">Subject to Team Approval</div>
                </div>
              );
            }

            const tier = getTier(plan);
            const rate = tier?.rate_per_word || 0;
            const originalPrice = words * rate;
            const volumeDiscountPercent = tier && words >= tier.volume_discount_threshold_words ? tier.volume_discount_percent : 0;
            const volumeSaved = originalPrice * (volumeDiscountPercent / 100);
            const afterVolume = originalPrice - volumeSaved;
            const promoAmount = afterVolume * (promoDiscount / 100);
            const depositAmount = finalQuote * 0.6;
            const balanceAmount = finalQuote * 0.4;
            return (
              <div className="bg-emerald-500/5 p-6 rounded-[30px] border border-emerald-500/20 overflow-x-auto">
                <div className="space-y-2 text-sm min-w-[280px]">
                  <div className="flex justify-between flex-wrap gap-2 text-primary font-medium"> <span>Base price ({words.toLocaleString()} words × ₦{rate})</span> <span>₦{originalPrice.toLocaleString()}</span> </div>
                  {volumeDiscountPercent > 0 && ( <div className="flex justify-between text-emerald-500 font-bold flex-wrap gap-2"> <span>Volume discount ({volumeDiscountPercent}%)</span> <span>- ₦{Math.round(volumeSaved).toLocaleString()}</span> </div> )}
                  {promoDiscount > 0 && ( <div className="flex justify-between text-emerald-500 font-bold flex-wrap gap-2"> <span>Promo code ({promoDiscount}%)</span> <span>- ₦{Math.round(promoAmount).toLocaleString()}</span> </div> )}
                  <div className="flex justify-between font-black text-lg pt-2 border-t border-emerald-500/10 flex-wrap gap-2 text-primary"> <span>Total Quote</span> <span className="text-emerald-500 font-black">₦{finalQuote.toLocaleString()}</span> </div>
                  <div className="flex justify-between text-xs text-secondary mt-2 flex-wrap gap-2 border-t border-theme pt-2"> <span>60% Deposit (due now)</span> <span>₦{depositAmount.toLocaleString()}</span> </div>
                  <div className="flex justify-between text-xs text-secondary flex-wrap gap-2"> <span>40% Balance (on completion)</span> <span>₦{balanceAmount.toLocaleString()}</span> </div>
                </div>
              </div>
            );
          })()}

          {/* Payment Method Selection (only for logged‑in users) */}
          {isLoggedIn && (
            <div className="bg-secondary p-4 rounded-xl border border-theme">
              <div className="text-[10px] uppercase font-black text-secondary tracking-widest mb-2 ml-1 font-bold">Payment Method</div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-primary font-bold">
                  <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="accent-emerald-500" />
                  <span className="text-sm">Pay with Card (Paystack)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-primary font-bold">
                  <input type="radio" name="paymentMethod" value="wallet" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} className="accent-emerald-500" />
                  <span className="text-sm">
                    Pay from Wallet (Balance: ₦{walletBalance.toLocaleString()})
                    {paymentMethod === 'wallet' && walletBalance < depositAmount && (
                      <span className="text-red-400 ml-2 font-black text-xs">– Insufficient balance</span>
                    )}
                  </span>
                </label>
              </div>
              {paymentMethod === 'wallet' && walletBalance >= depositAmount && (
                <p className="text-emerald-500 text-xs mt-2 font-bold">
                  Deposit of ₦{depositAmount.toLocaleString()} will be deducted from your wallet.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-secondary tracking-widest block ml-1 font-bold">Terms of Service</label>
            <div className="max-h-64 overflow-y-auto bg-primary border border-theme rounded-2xl p-6 pr-4 custom-scrollbar prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: decodeHtml(effectiveTermsText) }} />
            </div>
          </div>

          <div className="bg-secondary p-5 rounded-xl border border-theme">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-500 shrink-0 bg-primary border-theme rounded" />
              <span className="text-sm text-primary font-bold leading-relaxed break-words">
                I have read, understand, and agree to the Terms of Service. I authorize processing under the {paymentStructure === 'CUSTOM' ? 'selected milestone' : '60%/40% deposit'} payment structure.
              </span>
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={submitOrder}
              disabled={!acceptTerms || loading || (paymentMethod === 'wallet' && walletBalance < depositAmount)}
              className="bg-emerald-500 text-black font-black uppercase text-[11px] tracking-[1.5px] py-5 px-4 rounded-full flex-1 shadow-2xl shadow-emerald-500/20 hover:bg-emerald-450 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap md:whitespace-normal cursor-pointer"
            >
              Confirm Order & Proceed
            </button>
            <button onClick={() => goToStep(4)} className="bg-primary text-secondary border border-theme px-6 rounded-full font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-secondary transition"><ChevronLeft className="w-4 h-4" /> Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
