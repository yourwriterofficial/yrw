'use client';

import { BillingDetailsFields, PaymentStructureFields, compileMilestones } from '@/app/components/OrderMilestonesPayment';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { createSecureOrder, orderDataSchema } from '@/app/actions/createOrder';
import { Upload, Paperclip, CheckCircle2, Calendar, Star, Info, type LucideIcon } from 'lucide-react';
import type { CreateOrderServerActionResponse } from '@/lib/types';
import type { z } from 'zod';
import OrderCategoryNav from '@/app/components/OrderCategoryNav';
import { fetchPricingTiers, type PricingTier, type ServicePricingCategory } from '@/lib/pricingTiers';
import { fetchPageSettings } from '@/lib/pageSettings';
import { ORDER_PAGE_DEFAULTS, type OrderPageContent } from '@/lib/pageContentDefaults';
import { showToast } from '@/app/components/ui/Toast';
import { getEffectiveUser } from '@/lib/impersonate';
import { Input } from '@/app/components/ui/Input';
import { Select } from '@/app/components/ui/Select';
import { Textarea } from '@/app/components/ui/Textarea';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';


type OrderAddon = {
  id: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
};

type ExtraFieldSpec =
  | { type: 'select'; key: string; label: string; options: string[]; defaultValue: string }
  | { type: 'text'; key: string; label: string; placeholder?: string; required?: boolean; helperText?: string };

export interface ServiceOrderPageConfig {
  serviceCategory: ServicePricingCategory;
  pageKey: keyof typeof ORDER_PAGE_DEFAULTS;
  orderPrefix: string;
  tosKey: string;
  accent: 'amber' | 'cyan' | 'blue' | 'purple';
  icon: LucideIcon;
  vaultStatusDefault: string;
  topicLabel: string;
  topicPlaceholder: string;
  topicHelperText?: string;
  briefLabel: string;
  briefHelperText?: string;
  minProposedBudget: number;
  extraFields?: ExtraFieldSpec[];
  additionalInfoLabel?: string;
}

// Every fragment here is a complete, static class string — Tailwind's scanner only
// generates CSS for literal class text it finds in source, so accent classes must
// never be built by concatenating a Tailwind prefix (e.g. `focus:` or `border-`) with
// a runtime string at the call site. See [[order-pricing-rebuild]] memory note.
const ACCENTS = {
  amber: { text: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-500/5', ring: 'bg-amber-500/10', solid: 'bg-amber-500', chipBg: 'bg-amber-500/10', chipText: 'text-amber-500', chipBorder: 'border-amber-500/20', focusBorder: 'focus:border-amber-500', spinnerBorder: 'border-amber-500/20' },
  cyan: { text: 'text-cyan-500', border: 'border-cyan-500', bg: 'bg-cyan-500/5', ring: 'bg-cyan-500/10', solid: 'bg-cyan-500', chipBg: 'bg-cyan-500/10', chipText: 'text-cyan-500', chipBorder: 'border-cyan-500/20', focusBorder: 'focus:border-cyan-500', spinnerBorder: 'border-cyan-500/20' },
  blue: { text: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-500/5', ring: 'bg-blue-500/10', solid: 'bg-blue-500', chipBg: 'bg-blue-500/10', chipText: 'text-blue-500', chipBorder: 'border-blue-500/20', focusBorder: 'focus:border-blue-500', spinnerBorder: 'border-blue-500/20' },
  purple: { text: 'text-purple-500', border: 'border-purple-500', bg: 'bg-purple-500/5', ring: 'bg-purple-500/10', solid: 'bg-purple-500', chipBg: 'bg-purple-500/10', chipText: 'text-purple-500', chipBorder: 'border-purple-500/20', focusBorder: 'focus:border-purple-500', spinnerBorder: 'border-purple-500/20' },
} as const;

function decodeHtml(str: string) {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export default function ServiceOrderPage(config: ServiceOrderPageConfig) {
  const { serviceCategory, pageKey, orderPrefix, tosKey, vaultStatusDefault, topicLabel, topicPlaceholder, topicHelperText, briefLabel, briefHelperText, minProposedBudget, extraFields = [], additionalInfoLabel } = config;
  const accent = ACCENTS[config.accent];
  const Icon = config.icon;
  const router = useRouter();

  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [paymentStructure, setPaymentStructure] = useState<'60/40' | 'CUSTOM'>('60/40');
  const [milestones, setMilestones] = useState<Array<{ name: string; percentage: number; trigger: string }>>([
    { name: 'Initial Deposit', percentage: 40, trigger: 'Upon signing this agreement' },
    { name: 'Second Payment', percentage: 30, trigger: 'Completion of core project phase' },
    { name: 'Final Payment', percentage: 30, trigger: 'Final delivery and client sign off' },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [loggedInProfile, setLoggedInProfile] = useState<{ full_name?: string | null; whatsapp?: string | null } | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');

  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [pageContent, setPageContent] = useState<OrderPageContent>(ORDER_PAGE_DEFAULTS[pageKey]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [isProposing, setIsProposing] = useState(false);
  const [proposedBudget, setProposedBudget] = useState<number>(minProposedBudget);
  const [words, setWords] = useState<number>(1000);

  const [availableAddons, setAvailableAddons] = useState<OrderAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [termsText, setTermsText] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [topic, setTopic] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [extraValues, setExtraValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    extraFields.forEach(f => { init[f.key] = f.type === 'select' ? f.defaultValue : ''; });
    return init;
  });

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
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
        setWalletBalance(wallet?.balance || 0);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      const [addonsRes, tosRes, tierData, content] = await Promise.all([
        supabase.from('order_addons').select('*').eq('service_category', serviceCategory).eq('is_active', true),
        supabase.from('site_content').select('content_text').eq('content_key', tosKey).single(),
        fetchPricingTiers(serviceCategory),
        fetchPageSettings(pageKey, ORDER_PAGE_DEFAULTS[pageKey]),
      ]);
      if (addonsRes.data) setAvailableAddons(addonsRes.data as OrderAddon[]);
      if (tosRes.data) setTermsText(tosRes.data.content_text);
      setTiers(tierData);
      setPageContent(content);
      if (tierData.length > 0) setSelectedTierId(tierData.find(t => t.highlight)?.id || tierData[0].id);
      setLoading(false);
    };
    fetchConfig();
  }, [serviceCategory, tosKey, pageKey]);

  const selectedTier = tiers.find(t => t.id === selectedTierId) || null;
  const isPerWord = !isProposing && selectedTier?.price_model === 'PER_WORD';

  const perWordBase = useCallback(() => {
    if (!selectedTier?.rate_per_word) return 0;
    const base = words * selectedTier.rate_per_word;
    const discount = words >= selectedTier.volume_discount_threshold_words ? selectedTier.volume_discount_percent : 0;
    return base * (1 - discount / 100);
  }, [selectedTier, words]);

  const baseBudget = isProposing ? proposedBudget : (isPerWord ? perWordBase() : (selectedTier?.flat_price || 0));

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
    const next = new Set(selectedAddons);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedAddons(next);
  };

  const selectTier = (id: string) => {
    setSelectedTierId(id);
    setIsProposing(false);
  };

  const selectProposeOwn = () => {
    setIsProposing(true);
    setSelectedTierId(null);
  };

  const setExtraValue = (key: string, value: string) => setExtraValues(prev => ({ ...prev, [key]: value }));

  const finalQuoteNow = () => calculateTotal();
  const depositAmount = Math.round(finalQuoteNow() * (paymentStructure === 'CUSTOM' ? (milestones[0]?.percentage || 0) / 100 : 0.6));

  const submitOrder = async () => {
    if (!name || !email || !whatsapp || !topic || !deadline) {
      return showToast('Please fill out all mandatory fields (Name, Email, WhatsApp, Topic, and Deadline).', 'error');
    }
    for (const f of extraFields) {
      if (f.type === 'text' && f.required && !extraValues[f.key]?.trim()) {
        return showToast(`${f.label} is required.`, 'error');
      }
    }
    if (!selectedTier && !isProposing) return showToast('Please select a package or propose your own budget.', 'error');
    if (isProposing && proposedBudget < minProposedBudget) {
      return showToast(`Proposed budget must be at least ₦${minProposedBudget.toLocaleString()}.`, 'error');
    }
    if (isPerWord && (!words || words < 50)) {
      return showToast('Word count must be at least 50.', 'error');
    }
    if (!acceptTerms) return showToast('You must accept the Terms of Service.', 'error');
    if (isLoggedIn && paymentMethod === 'wallet' && walletBalance < depositAmount) {
      return showToast('Insufficient wallet balance. Please top up or choose card payment.', 'error');
    }

    setSubmitting(true);
    const orderStringId = `${orderPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const selectedAddonNames = Array.from(selectedAddons).map(id => availableAddons.find(a => a.id === id)?.name).filter(Boolean).join(', ');

    const extraLines = extraFields.map(f => `[${f.label.toUpperCase()}]: ${extraValues[f.key] || 'Not specified'}`).join('\n      ');
    const compiledInstructions = `
      [PACKAGE]: ${selectedTier ? selectedTier.name : 'Custom Proposal'}${isPerWord ? ` (${words.toLocaleString()} words)` : ''}
      ${extraLines}
      [CLIENT NOTES]: ${instructions}
      [REQUESTED ADD-ONS]: ${selectedAddonNames || 'None'}
    `.trim();

    const finalQuote = calculateTotal();
    const payload: z.infer<typeof import('@/app/actions/createOrder').orderDataSchema> & { client_id?: string | null } = {
      order_id: orderStringId,
      legal_name: name,
      email: email,
      whatsapp_sync: whatsapp,
      topic: isProposing ? `[PROPOSAL] ${topic}` : `[${serviceCategory}] ${topic}`,
      service_tier: 'CUSTOM',
      financial_quote: finalQuote,
      word_count: isPerWord ? words : undefined,
      page_count: isPerWord ? Math.ceil(words / 275) : undefined,
      client_company: clientCompany || undefined,
      client_address: clientAddress || undefined,
      client_phone: whatsapp || undefined,
      payment_structure_type: paymentStructure,
      payment_milestones: compileMilestones(paymentStructure, milestones, finalQuote),
      deadline,
      workflow_status: 'Briefing Received',
      additional_info: compiledInstructions,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
      corrections_status: 'None',
      vault_status: vaultStatusDefault,
    };

    if (isLoggedIn && loggedInUser) {
      payload.client_id = loggedInUser.id;
    } else {
      payload.guest_name = name;
      payload.guest_email = email;
      payload.guest_whatsapp = whatsapp;
    }

    const serverResponse = (await createSecureOrder(payload, '')) as CreateOrderServerActionResponse;

    if (!serverResponse?.success) {
      showToast(`Submission failed: ${serverResponse?.error}`, 'error');
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
          setSubmitting(false);
          return;
        }
      } catch {
        showToast('Network error during wallet payment.', 'error');
        setSubmitting(false);
        return;
      }
      showToast('Order placed! Deposit paid from wallet.', 'success');
      router.push('/dashboard/client');
      return;
    }

    router.push(`/complete-registration?email=${encodeURIComponent(email)}&orderId=${orderStringId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className={`w-12 h-12 border-4 ${accent.spinnerBorder} border-t-current ${accent.text} rounded-full animate-spin`} />
      </div>
    );
  }

  const finalQuote = calculateTotal();

  return (
    <div className="min-h-screen bg-primary text-primary py-10 sm:py-12 px-4 sm:px-6 font-['Inter']">
      <OrderCategoryNav />
      <div className="max-w-3xl mx-auto space-y-10 sm:space-y-12 mt-6">
        <div className="text-center">
          <p className={`text-xs font-medium tracking-wide mb-4 flex items-center justify-center gap-2 ${accent.text}`}>
            <Icon className="w-3.5 h-3.5" /> {pageContent.hero.badge}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 tracking-tight">{pageContent.hero.title}</h1>
          <p className="text-secondary text-sm px-2 max-w-xl mx-auto">{pageContent.hero.subtitle}</p>
        </div>

        <Card className="space-y-8">

          {/* PACKAGE TIERS */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-secondary block ml-1">Choose a package</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map(tier => {
                const isSelected = !isProposing && selectedTierId === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => selectTier(tier.id)}
                    className={`p-5 rounded-2xl border cursor-pointer transition relative overflow-hidden bg-card ${isSelected ? `${accent.border} ${accent.bg}` : 'border-theme hover:border-strong'}`}
                  >
                    {tier.highlight && (
                      <div className={`absolute top-0 right-0 ${accent.ring} ${accent.text} text-[10px] font-medium px-3 py-1 rounded-bl-xl flex items-center gap-1`}>
                        <Star className="w-3 h-3 fill-current" /> Popular
                      </div>
                    )}
                    {isSelected && <div className="absolute top-3 left-3"><CheckCircle2 className={`w-4 h-4 ${accent.text}`} /></div>}
                    <h3 className={`text-sm font-bold mt-2 ${accent.text}`}>{tier.name}</h3>
                    <p className="text-[10px] text-secondary mb-3">{tier.tagline}</p>
                    {tier.price_model === 'PER_WORD' ? (
                      <div className="text-xl font-bold mb-1">₦{tier.rate_per_word}<span className="text-xs text-secondary font-medium">/word</span></div>
                    ) : (
                      <div className="text-xl font-bold mb-3">₦{(tier.flat_price || 0).toLocaleString()}</div>
                    )}
                    {tier.price_model === 'PER_WORD' && tier.volume_discount_percent > 0 && (
                      <div className={`text-[9px] ${accent.text} ${accent.ring} inline-block px-2 py-0.5 rounded font-semibold mb-3`}>
                        {tier.volume_discount_percent}% off &gt; {tier.volume_discount_threshold_words.toLocaleString()} words
                      </div>
                    )}
                    <ul className="text-[11px] text-primary space-y-1.5">
                      {tier.features.map((f, i) => (
                        <li key={i} className="flex gap-1.5"><span className={`${accent.text} shrink-0`}>•</span><span>{f}</span></li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* WORD COUNT — shown when the selected package prices per word */}
            {isPerWord && (
              <Card elevation={0} className={`${accent.border} ${accent.bg}`}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-secondary">Word count</label>
                    <span className={`text-xs font-bold ${accent.text}`}>{words.toLocaleString()} words · {Math.ceil(words / 275)} pages</span>
                  </div>
                  <input type="range" max="30000" min="50" step="50" value={words} onChange={e => setWords(parseInt(e.target.value) || 0)} className="w-full cursor-pointer" />
                  <Input
                    type="number"
                    value={words || ''}
                    onChange={e => setWords(parseInt(e.target.value) || 0)}
                    placeholder="Enter exact word count"
                  />
                </div>
              </Card>
            )}

            {/* PROPOSE YOUR OWN BUDGET */}
            <div
              onClick={selectProposeOwn}
              className={`p-5 rounded-2xl border cursor-pointer transition relative bg-card ${isProposing ? `${accent.border} ${accent.bg}` : 'border-theme hover:border-strong'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-bold ${accent.text}`}>Propose Your Own Budget</h3>
                {isProposing && <CheckCircle2 className={`w-4 h-4 ${accent.text}`} />}
              </div>
              <p className="text-xs text-secondary mb-3">{pageContent.budget_note.title}</p>
              <div className={`flex items-start gap-2 text-xs text-secondary ${accent.chipBg} border ${accent.chipBorder} rounded-xl p-3 mb-3`}>
                <Info className={`w-4 h-4 ${accent.text} shrink-0 mt-0.5`} />
                <span>{pageContent.budget_note.text}</span>
              </div>
              {isProposing && (
                <div onClick={e => e.stopPropagation()}>
                  <Input
                    type="number"
                    value={proposedBudget || ''}
                    onChange={e => setProposedBudget(parseInt(e.target.value) || 0)}
                    placeholder={`Minimum ₦${minProposedBudget.toLocaleString()}`}
                  />
                </div>
              )}
            </div>
          </div>

          {availableAddons.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-secondary block ml-1">Optional add-ons</label>
              <div className="grid grid-cols-1 gap-3">
                {availableAddons.map(addon => {
                  const isSelected = selectedAddons.has(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-4 ${isSelected ? `${accent.border} ${accent.bg}` : 'border-theme bg-primary hover:border-strong'}`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? `${accent.solid} ${accent.border}` : 'border-theme'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className={`text-sm font-bold ${isSelected ? accent.text : 'text-primary'}`}>{addon.name}</h4>
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
            {isLoggedIn ? (
              <p className={`text-xs font-bold ${accent.text}`}>Ordering as: {loggedInProfile?.full_name || loggedInUser?.email}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  helper="Please enter your legal name as it appears on official records."
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  helper="Your credentials and secure work deliverables will be sent here."
                />
                <div className="md:col-span-2">
                  <Input
                    label="WhatsApp Number"
                    type="tel"
                    placeholder="+234..."
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    required
                    helper="For emergency support and prompt status updates."
                  />
                </div>
              </div>
            )}

            <Input
              label="Target Delivery Deadline"
              type="date"
              iconLeft={<Calendar className="w-5 h-5" />}
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min="2026-08-13"
              required
              helper="We require a minimum 2-week (14 day) lead time for quality delivery."
              className="dark:[color-scheme:dark] cursor-pointer"
            />

            {extraFields.map(f => (
              <div key={f.key}>
                {f.type === 'select' ? (
                  <Select
                    label={f.label}
                    value={extraValues[f.key]}
                    onChange={e => setExtraValue(f.key, e.target.value)}
                    options={f.options.map(opt => ({ value: opt, label: opt }))}
                  />
                ) : (
                  <Input
                    label={f.label}
                    placeholder={f.placeholder}
                    value={extraValues[f.key]}
                    onChange={e => setExtraValue(f.key, e.target.value)}
                    required={f.required}
                    helper={f.helperText}
                  />
                )}
              </div>
            ))}

            <Input
              label={topicLabel}
              placeholder={topicPlaceholder}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              required
              helper={topicHelperText}
            />

            <BillingDetailsFields companyName={clientCompany} setCompanyName={setClientCompany} address={clientAddress} setAddress={setClientAddress} />

            <Textarea
              label={additionalInfoLabel || 'Additional Instructions'}
              placeholder="Specific instructions, methodologies, or requirements..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={4}
            />

            <div className="space-y-1">
              <label className="text-[10px] text-secondary font-bold ml-1 uppercase">{briefLabel}</label>
              <label className="border-2 border-dashed border-theme hover:border-strong bg-card rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
                <Upload className="w-6 h-6 text-secondary mb-2" />
                <span className="text-xs font-bold text-secondary">{briefHelperText || 'Attach a file'}</span>
                <input type="file" className="hidden" onChange={e => setBriefFile(e.target.files?.[0] || null)} />
              </label>
              {briefFile && (
                <div className={`flex items-center gap-2 text-xs ${accent.chipBg} ${accent.text} p-3 rounded-xl border ${accent.chipBorder} w-full break-words`}>
                  <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{briefFile.name}</span>
                </div>
              )}
            </div>
          </div>

          <PaymentStructureFields
            paymentStructure={paymentStructure}
            setPaymentStructure={setPaymentStructure}
            milestones={milestones}
            setMilestones={setMilestones}
            totalPrice={finalQuote}
          />

          {isLoggedIn && (
            <Card elevation={0}>
              <div className="text-xs font-medium text-secondary mb-2 ml-1">Payment method</div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-primary font-bold">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                  <span className="text-sm">Pay with Card (Paystack)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-primary font-bold">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                  <span className="text-sm">
                    Pay from Wallet (Balance: ₦{walletBalance.toLocaleString()})
                    {paymentMethod === 'wallet' && walletBalance < depositAmount && (
                      <span className="text-red-400 ml-2 font-black text-xs">– Insufficient balance</span>
                    )}
                  </span>
                </label>
              </div>
            </Card>
          )}

          {/* Terms of Service */}
          <div className="space-y-4 pt-6 border-t border-theme">
            <label className="text-xs font-medium text-secondary block ml-1">Terms of service</label>
            <div className="h-32 overflow-y-auto bg-primary border border-theme rounded-xl p-4 leading-relaxed custom-scrollbar prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: decodeHtml(termsText || 'Loading terms...') }} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 bg-primary border-theme rounded"
              />
              <span className="text-xs text-primary font-bold leading-relaxed">
                I agree to the terms above. I understand this quote is subject to review by the team.
              </span>
            </label>
          </div>

          <Card elevation={0} className="text-center">
            <div className="text-3xl font-semibold text-primary tracking-tight">₦{finalQuote.toLocaleString()}</div>
            <p className="text-xs text-secondary mt-2">
              {isProposing ? 'Proposed quote — subject to approval' : 'Calculated quote'}
            </p>
          </Card>

          <Button
            onClick={submitOrder}
            disabled={!acceptTerms || submitting || (isLoggedIn && paymentMethod === 'wallet' && walletBalance < depositAmount)}
            loading={submitting}
            loadingText="Processing..."
            fullWidth
            className={`${accent.solid} text-black font-semibold text-sm py-4 rounded-full transition hover:opacity-90 disabled:opacity-50`}
          >
            Submit request
          </Button>
        </Card>
      </div>
    </div>
  );
}
