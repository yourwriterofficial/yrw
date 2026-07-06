'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { createSecureOrder } from '@/app/actions/createOrder';
import { compileMilestones } from './OrderMilestonesPayment';
import type { CreateOrderServerActionResponse } from '@/lib/types';
import {
  Sparkles, X, ArrowLeft, GraduationCap, PenTool, Terminal, Briefcase, Settings,
  CheckCircle2, Loader2, Bot, User as UserIcon, MessageCircle, Compass, Wallet,
} from 'lucide-react';

type CategoryId = 'academic' | 'content' | 'dev' | 'resume' | 'custom';

type OrderAddon = {
  id: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
};

type Msg = { role: 'bot' | 'user'; text: string };

const WHATSAPP_NUMBER = '2348121443666';
const MIN_LEAD_DAYS = 14;

const PLAN_RATES: Record<'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD', number> = {
  GOLD: 100, SILVER: 80, BRONZE: 70, STANDARD: 60,
};
const PLAN_DISCOUNTS: Record<'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD', number> = {
  GOLD: 15, SILVER: 10, BRONZE: 8, STANDARD: 6,
};
const PLAN_BLURB: Record<'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD', string> = {
  GOLD: 'Premium — MSc/PhD level, 5 correction cycles, 95–100% originality.',
  SILVER: 'Standard — university assignments, 3 correction cycles.',
  BRONZE: 'Essential — solid writing support, 2 correction cycles.',
  STANDARD: 'Basic drafting — 1 correction cycle.',
};
const MIN_CUSTOM_QUOTE = 10000;

const CATEGORIES: { id: CategoryId; label: string; blurb: string; icon: React.ReactNode; accent: string; addonCategory: string | null; tosKey: string; prefix: string }[] = [
  { id: 'academic', label: 'Research & Academic Writing', blurb: 'Essays, term papers, theses & dissertations — priced per word, with plagiarism & AI reports included.', icon: <GraduationCap className="w-5 h-5" />, accent: 'emerald', addonCategory: null, tosKey: 'academic_tos', prefix: 'RW' },
  { id: 'content', label: 'Content & Creative Writing', blurb: 'Website copy, eBooks, SEO articles & fictional narratives, tailored to your voice and audience.', icon: <PenTool className="w-5 h-5" />, accent: 'amber', addonCategory: 'CONTENT', tosKey: 'content_tos', prefix: 'CT' },
  { id: 'dev', label: 'Software & Web Development', blurb: 'Web apps, mobile apps, APIs, dashboards, and database-backed systems, built to spec.', icon: <Terminal className="w-5 h-5" />, accent: 'cyan', addonCategory: 'DEV', tosKey: 'dev_tos', prefix: 'DEV' },
  { id: 'resume', label: 'Executive Resumes & CVs', blurb: 'ATS-optimized resumes, cover letters, and LinkedIn overhauls designed to land interviews.', icon: <Briefcase className="w-5 h-5" />, accent: 'blue', addonCategory: 'RESUME', tosKey: 'resume_tos', prefix: 'CV' },
  { id: 'custom', label: 'Custom Data & Fieldwork', blurb: 'SPSS analysis, survey design, fieldwork, and bespoke projects with emergency turnaround.', icon: <Settings className="w-5 h-5" />, accent: 'purple', addonCategory: 'CUSTOM', tosKey: 'academic_tos', prefix: 'CUST' },
];

const SUBTYPES: Record<CategoryId, string[]> = {
  academic: ['Essay', 'Term Paper', 'Research Paper', 'Literature Review', 'Thesis', 'Dissertation', 'Case Study', 'Lab Report', 'Something else'],
  content: ['Website Copy / Landing Page', 'SEO Blog Article', 'eBook / Ghostwriting', 'Fictional Narrative', 'Business Plan', 'Something else'],
  dev: [],
  resume: ['Executive Resume / CV', 'Cover Letter', 'LinkedIn Profile Overhaul', 'Full Career Package'],
  custom: ['SPSS / Statistical Analysis', 'Survey Design & Data Collection', 'PowerPoint Deck', 'Fieldwork / Interviews', 'Something else'],
};

const TOUR_STEPS = [
  { id: 'rw-tour-dashboard', title: 'Dashboard', text: "This is your Dashboard home — see every active order and its live status at a glance." },
  { id: 'rw-tour-neworder', title: 'New Order', text: 'Tap here anytime to start a new order — research, content, dev work, resumes, or custom projects.' },
  { id: 'rw-tour-vault', title: 'Secure Vault', text: 'Your Secure Vault holds every file we deliver. Files stay locked until your balance is paid — no surprises.' },
  { id: 'rw-tour-wallet', title: 'Wallet', text: 'Top up your Wallet to pay deposits and balances instantly, without re-entering card details each time.' },
  { id: 'rw-tour-profile', title: 'My Profile', text: 'Update your name, WhatsApp number, billing details, and password here.' },
];

function accentClasses(accent: string) {
  const map: Record<string, { text: string; border: string; bg: string; solidBg: string; solidText: string }> = {
    emerald: { text: 'text-emerald-500', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', solidBg: 'bg-emerald-500', solidText: 'text-black' },
    amber: { text: 'text-amber-500', border: 'border-amber-500/30', bg: 'bg-amber-500/10', solidBg: 'bg-amber-500', solidText: 'text-black' },
    cyan: { text: 'text-cyan-500', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', solidBg: 'bg-cyan-500', solidText: 'text-black' },
    blue: { text: 'text-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/10', solidBg: 'bg-blue-500', solidText: 'text-white' },
    purple: { text: 'text-purple-500', border: 'border-purple-500/30', bg: 'bg-purple-500/10', solidBg: 'bg-purple-500', solidText: 'text-white' },
    violet: { text: 'text-violet-500', border: 'border-violet-500/30', bg: 'bg-violet-500/10', solidBg: 'bg-violet-500', solidText: 'text-white' },
  };
  return map[accent] || map.emerald;
}

function decodeHtml(str: string) {
  if (!str) return '';
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function minDeadlineStr() {
  return new Date(Date.now() + MIN_LEAD_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}
function isUrgentAddon(name: string) {
  return /urgent|rush|priority|expedite|emergency/i.test(name);
}
function waLink(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Animates a line of text character-by-character; replays whenever `text` changes. */
function TypewriterLine({ label, text }: { label: string; text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 14);
    return () => clearInterval(id);
  }, [text]);
  return (
    <div className="flex gap-1.5 text-[11px] leading-snug">
      <span className="text-secondary shrink-0 font-bold">{label}:</span>
      <span className="text-primary font-medium break-words">{shown}<span className="opacity-40 animate-pulse">{shown.length < text.length ? '▍' : ''}</span></span>
    </div>
  );
}

type Step =
  | 'askName' | 'category' | 'quickMenu' | 'subtype' | 'subtypeOther'
  | 'devBuild' | 'devPlatform' | 'devFeatures' | 'devAuth' | 'devDb' | 'devPayment'
  | 'contactEmail' | 'contactWhatsapp'
  | 'topic' | 'audience' | 'tone' | 'experienceLevel' | 'linkedin'
  | 'words' | 'plan'
  | 'budget'
  | 'leadTimeCheck'
  | 'addonsLoading' | 'addonQuestion'
  | 'deadline' | 'terms' | 'review' | 'negotiateInput'
  | 'submitting' | 'success' | 'error';

export default function OrderAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('askName');
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [data, setData] = useState<Record<string, any>>({});
  const [inputVal, setInputVal] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [loggedInProfile, setLoggedInProfile] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletPaying, setWalletPaying] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [addons, setAddons] = useState<OrderAddon[]>([]);
  const [addonIndex, setAddonIndex] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<OrderAddon[]>([]);

  const [termsText, setTermsText] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [finalOrderId, setFinalOrderId] = useState('');
  const [finalEmail, setFinalEmail] = useState('');
  const [finalDeposit, setFinalDeposit] = useState<number>(0);
  const [depositPaidFromWallet, setDepositPaidFromWallet] = useState(false);
  const [wasNegotiated, setWasNegotiated] = useState(false);
  const [proposedPrice, setProposedPrice] = useState<number>(0);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ---------- Session + memory bootstrap ----------
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        setLoggedInUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setLoggedInProfile(profile);

        const { data: walletRow } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
        setWalletBalance(Number(walletRow?.balance) || 0);

        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .or(`client_id.eq.${user.id},email.eq.${user.email}`);
        const hasOrders = !!count && count > 0;
        setHasHistory(hasOrders);

        if (hasOrders) {
          try {
            const raw = localStorage.getItem(`rw_assistant_memory_${user.id}`);
            if (raw) {
              const mem = JSON.parse(raw);
              setData(d => ({ ...d, name: mem.name || profile?.full_name }));
            }
          } catch {}
        }
      }
      setSessionChecked(true);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, step, thinking]);

  // ---------- Tour target tracking ----------
  useEffect(() => {
    if (!tourActive) return;
    const update = () => {
      const el = document.getElementById(TOUR_STEPS[tourStep]?.id);
      setTourRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    const id = setInterval(update, 200);
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('resize', update); };
  }, [tourActive, tourStep]);



  const category = data.category as CategoryId | undefined;
  const catDef = category ? CATEGORIES.find(c => c.id === category)! : undefined;
  const accent = accentClasses(catDef?.accent || 'violet');
  const firstName = (data.name || loggedInProfile?.full_name || '').split(' ')[0];

  const say = (text: string) => setHistory(h => [...h, { role: 'bot', text }]);
  const reply = (text: string) => setHistory(h => [...h, { role: 'user', text }]);

  const advance = (next: Step, botLine: string, delay = 450) => {
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      say(botLine);
      setStep(next);
    }, delay);
  };

  const reset = () => {
    setHistory([]);
    setData(d => ({ name: d.name }));
    setAddons([]);
    setAddonIndex(0);
    setSelectedAddons([]);
    setTermsText('');
    setAcceptTerms(false);
    setErrorMsg('');
    setWasNegotiated(false);
    setInputVal('');
    setTimeout(() => greet(), 150);
  };

  const introLine = () => "By the way — if you'd rather talk to a writer directly, just tap \"Contact Writer\" up top any time.";

  const greet = () => {
    if (isLoggedIn) {
      const name = firstName || 'there';
      if (hasHistory) {
        say(`Welcome back, ${name}! I'm the ResearchWriter Assistant. ${introLine()} What would you like to do today?`);
        setStep('quickMenu');
      } else {
        say(`Hi ${name}! I'm the ResearchWriter Assistant. ${introLine()} How can I help you today?`);
        setStep('category');
      }
    } else {
      say(`Hi! I'm the ResearchWriter Assistant 🤖. ${introLine()} First — what's your name?`);
      setStep('askName');
    }
  };

  const openAssistant = () => {
    setOpen(true);
    if (history.length === 0 && sessionChecked) {
      setTimeout(greet, 200);
    }
  };

  // re-greet once session check resolves if opened too early
  useEffect(() => {
    if (open && sessionChecked && history.length === 0) {
      const t = setTimeout(greet, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked]);

  const persistMemoryIfEligible = () => {
    if (isLoggedIn && loggedInUser) {
      try {
        localStorage.setItem(`rw_assistant_memory_${loggedInUser.id}`, JSON.stringify({ name: data.name || loggedInProfile?.full_name || '' }));
      } catch {}
    }
  };

  // ---------- Name ----------
  const submitName = () => {
    if (!inputVal.trim()) return;
    const name = inputVal.trim();
    reply(name);
    setData(d => ({ ...d, name }));
    setInputVal('');
    advance('category', `Great to meet you, ${name.split(' ')[0]}! How can I help you today?`);
  };

  // ---------- Quick menu (returning logged-in users) ----------
  const pickQuickAction = async (action: string) => {
    reply(action);
    if (action === 'Start a New Order') {
      advance('category', 'Sounds good — how can I help you today?');
      return;
    }
    if (action === 'Check My Order Status') {
      setThinking(true);
      const { data: orders } = await supabase
        .from('orders')
        .select('order_id, topic, workflow_status, financial_quote, deadline')
        .or(`client_id.eq.${loggedInUser.id},email.eq.${loggedInUser.email}`)
        .order('created_at', { ascending: false })
        .limit(1);
      setThinking(false);
      const o = orders?.[0];
      if (!o) { say("You don't have any orders yet — want to start one?"); }
      else { say(`Your most recent order ${o.order_id} ("${o.topic}") is currently: ${o.workflow_status}. Quote: ₦${(o.financial_quote || 0).toLocaleString()}, due ${o.deadline ? new Date(o.deadline).toLocaleDateString() : 'TBC'}.`); }
      setTimeout(() => { say('Anything else I can help with?'); setStep('quickMenu'); }, 400);
      return;
    }
    if (action === 'View My Order History') {
      setThinking(true);
      const { data: orders } = await supabase
        .from('orders')
        .select('order_id, topic, workflow_status, financial_quote')
        .or(`client_id.eq.${loggedInUser.id},email.eq.${loggedInUser.email}`)
        .order('created_at', { ascending: false })
        .limit(10);
      setThinking(false);
      if (!orders || orders.length === 0) { say("No orders on file yet — want to start one?"); }
      else { say(orders.map(o => `• ${o.order_id} — ${o.topic} (${o.workflow_status}, ₦${(o.financial_quote || 0).toLocaleString()})`).join('\n')); }
      setTimeout(() => { say('Anything else I can help with?'); setStep('quickMenu'); }, 400);
      return;
    }
    if (action === 'Pay Outstanding Balance') {
      setThinking(true);
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .or(`client_id.eq.${loggedInUser.id},email.eq.${loggedInUser.email}`)
        .order('created_at', { ascending: false });
      const due = (orders || []).find((o: any) => !o.sixty_percent_paid || !o.forty_percent_paid);
      setThinking(false);
      if (!due) { say("You're all caught up — no outstanding balance!"); setStep('quickMenu'); return; }
      const isDeposit = !due.sixty_percent_paid;
      const amount = Math.round((due.financial_quote || 0) * (isDeposit ? 0.6 : 0.4));
      say(`You have ${isDeposit ? 'a deposit' : 'a balance'} of ₦${amount.toLocaleString()} due on ${due.order_id}. Generating your payment link...`);
      try {
        const res = await fetch('/api/paystack/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: due.order_id, amount, email: loggedInUser.email, name: loggedInProfile?.full_name || firstName, type: isDeposit ? 'DEPOSIT' : 'BALANCE' }),
        });
        const json = await res.json();
        if (res.ok && json.link) {
          say('Your payment link is ready.');
          say('__PAY_LINK__' + json.link);
          setStep('quickMenu');
        } else {
          say(`Couldn't generate a payment link right now: ${json.error || 'please try again later.'}`);
          setStep('quickMenu');
        }
      } catch {
        say("Couldn't reach the payment gateway — please try again shortly.");
        setStep('quickMenu');
      }
      return;
    }
    if (action === 'Take a Dashboard Tour') {
      say("Let's take a look around your dashboard!");
      setOpen(false);
      if (!pathname?.startsWith('/dashboard/client')) router.push('/dashboard/client');
      setTimeout(() => { setTourStep(0); setTourActive(true); }, 500);
      return;
    }
    if (action === 'Message My Writer on WhatsApp') {
      const msg = `Hi, this is ${loggedInProfile?.full_name || firstName || 'a client'} — I'd like to speak with a writer about my order.`;
      window.open(waLink(msg), '_blank');
      say('Opening WhatsApp for you now.');
      setStep('quickMenu');
      return;
    }
    if (action === 'Update My Account') {
      say('Taking you to your profile settings...');
      setOpen(false);
      router.push('/dashboard/client?tab=profile');
      return;
    }
  };

  // ---------- Category / subtype ----------
  const pickCategory = (cat: CategoryId) => {
    const def = CATEGORIES.find(c => c.id === cat)!;
    reply(def.label);
    setData(d => ({ ...d, category: cat }));
    if (cat === 'dev') {
      advance('devBuild', "Nice choice. Tell me in your own words — what do you want to build?");
    } else {
      advance('subtype', `Great — what type of ${def.label.toLowerCase()} project is this?`);
    }
  };

  const needsContact = () => !isLoggedIn;

  const proceedAfterIntro = () => {
    if (needsContact()) {
      advance('contactEmail', `What's the best email to reach you on, ${firstName || 'friend'}?`);
    } else {
      goToCategoryDetails();
    }
  };

  const pickSubtype = (val: string) => {
    if (val === 'Something else') {
      reply(val);
      advance('subtypeOther', "No problem — describe it briefly in your own words.");
      return;
    }
    reply(val);
    setData(d => ({ ...d, subtype: val }));
    proceedAfterIntro();
  };

  const submitSubtypeOther = () => {
    if (!inputVal.trim()) return;
    reply(inputVal.trim());
    setData(d => ({ ...d, subtype: inputVal.trim() }));
    setInputVal('');
    proceedAfterIntro();
  };

  // ---------- Dev branch ----------
  const submitDevBuild = () => {
    if (!inputVal.trim() || inputVal.trim().length < 5) { setErrorMsg('A few more words would help — what should this build actually do?'); return; }
    setErrorMsg('');
    reply(inputVal.trim());
    setData(d => ({ ...d, devBuild: inputVal.trim() }));
    setInputVal('');
    advance('devPlatform', 'Got it. Where should this run?');
  };

  const pickDevPlatform = (val: string) => {
    reply(val);
    setData(d => ({ ...d, devPlatform: val }));
    advance('devFeatures', 'What are the must-have features? (e.g. user login, admin dashboard, payments, chat)');
  };

  const submitDevFeatures = () => {
    if (!inputVal.trim()) return;
    reply(inputVal.trim());
    setData(d => ({ ...d, devFeatures: inputVal.trim() }));
    setInputVal('');
    advance('devAuth', 'Will people need to sign up or log in to use it?');
  };

  const pickYesNo = (field: string, val: 'Yes' | 'No', next: Step, nextLine: string) => {
    reply(val);
    setData(d => ({ ...d, [field]: val }));
    advance(next, nextLine);
  };

  // ---------- Contact ----------
  const submitContactEmail = () => {
    if (!inputVal.trim() || !inputVal.includes('@')) { setErrorMsg("That doesn't look like a valid email — mind double-checking?"); return; }
    setErrorMsg('');
    reply(inputVal.trim());
    setData(d => ({ ...d, email: inputVal.trim() }));
    setInputVal('');
    advance('contactWhatsapp', 'And a WhatsApp number, in case we need to reach you quickly about this order?');
  };

  const submitContactWhatsapp = () => {
    if (!inputVal.trim()) return;
    reply(inputVal.trim());
    setData(d => ({ ...d, whatsapp: inputVal.trim() }));
    setInputVal('');
    goToCategoryDetails();
  };

  // ---------- Category-specific detail flow ----------
  const goToCategoryDetails = () => {
    if (category === 'academic') advance('topic', "What's your research topic or assignment title?");
    else if (category === 'content') advance('topic', "What's the working title or subject of this piece?");
    else if (category === 'dev') advance('topic', 'Last thing before pricing — give this project a short title.');
    else if (category === 'resume') advance('topic', 'What job title or role are you targeting?');
    else if (category === 'custom') advance('topic', 'Give this project a short title.');
  };

  const submitTopic = () => {
    if (!inputVal.trim() || inputVal.trim().length < 3) { setErrorMsg('A little more detail would help here.'); return; }
    setErrorMsg('');
    reply(inputVal.trim());
    setData(d => ({ ...d, topic: inputVal.trim() }));
    setInputVal('');
    if (category === 'academic') advance('words', 'Roughly how many words does this need to be?');
    else if (category === 'content') advance('audience', 'Who is the target audience for this? (e.g. tech startups, Gen Z shoppers)');
    else if (category === 'resume') advance('experienceLevel', "What's your experience level?");
    else if (category === 'dev' || category === 'custom') advance('budget', category === 'dev' ? "What's your proposed budget for this build? (in ₦)" : "What's your proposed base budget for this? (in ₦)");
  };

  const submitWords = () => {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ''), 10);
    if (!n || n < 50) { setErrorMsg('Please enter a word count of at least 50.'); return; }
    setErrorMsg('');
    reply(`${n.toLocaleString()} words`);
    setData(d => ({ ...d, words: n }));
    setInputVal('');
    advance('plan', `Here's what ${n.toLocaleString()} words looks like across our quality tiers — pick one:`);
  };

  const pickPlan = (plan: keyof typeof PLAN_RATES) => {
    reply(`${plan} tier`);
    setData(d => ({ ...d, plan }));
    goToLeadTime();
  };

  const submitAudience = () => {
    if (!inputVal.trim()) return;
    reply(inputVal.trim());
    setData(d => ({ ...d, audience: inputVal.trim() }));
    setInputVal('');
    advance('tone', 'What tone should it be written in?');
  };

  const pickTone = (val: string) => {
    reply(val);
    setData(d => ({ ...d, tone: val }));
    advance('budget', "What's your proposed budget for this? (in ₦)");
  };

  const pickExperience = (val: string) => {
    reply(val);
    setData(d => ({ ...d, experienceLevel: val }));
    advance('linkedin', 'Got a LinkedIn profile you\'d like optimized too? Paste the link, or say "skip".');
  };

  const submitLinkedin = () => {
    const val = inputVal.trim();
    reply(val || 'skip');
    setData(d => ({ ...d, linkedin: /^skip$/i.test(val) ? '' : val }));
    setInputVal('');
    goToLeadTime();
  };

  const submitBudget = () => {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ''), 10);
    const min = 20000;
    if (!n || n < min) { setErrorMsg(`Please enter a budget of at least ₦${min.toLocaleString()}.`); return; }
    setErrorMsg('');
    reply(`₦${n.toLocaleString()}`);
    setData(d => ({ ...d, budget: n }));
    setInputVal('');
    goToLeadTime();
  };

  // ---------- Lead time gate ----------
  const goToLeadTime = () => {
    advance('leadTimeCheck', `Quick heads-up — we need a minimum of ${MIN_LEAD_DAYS} days (2 weeks) to deliver quality work. Is that okay for you?`);
  };

  const answerLeadTime = (ok: boolean) => {
    reply(ok ? 'Yes, that works' : "Not really, I was hoping for something sooner");
    setData(d => ({ ...d, leadTimeOk: ok }));
    loadAddonsAndAdvance(ok);
  };

  // ---------- Add-ons ----------
  const loadAddonsAndAdvance = async (leadTimeOk: boolean) => {
    setStep('addonsLoading');
    setThinking(true);
    const addonCat = catDef?.addonCategory;
    if (!addonCat) {
      setThinking(false);
      say(leadTimeOk
        ? 'One more thing — when do you need this delivered by?'
        : "We don't currently offer rush add-ons for this category, but our 2-week minimum still applies. Let's set your date:");
      setStep('deadline');
      return;
    }
    const { data: list } = await supabase
      .from('order_addons')
      .select('*')
      .eq('service_category', addonCat)
      .eq('is_active', true);
    setThinking(false);
    if (!list || list.length === 0) {
      say('One more thing — when do you need this delivered by?');
      setStep('deadline');
      return;
    }
    setAddons(list as OrderAddon[]);
    setAddonIndex(0);
    setSelectedAddons([]);
    say(leadTimeOk
      ? "We also offer a few optional add-ons for this. I'll run through them quickly — just say yes or no."
      : "Let's see if any of these can help speed things up:");
    setTimeout(() => {
      say(formatAddon(list[0] as OrderAddon, !leadTimeOk));
      setStep('addonQuestion');
    }, 500);
  };

  const formatAddon = (a: OrderAddon, flagUrgent: boolean) => {
    const price = a.price_type === 'FLAT_FEE' ? `+₦${a.price_value.toLocaleString()}` : `+${a.price_value}%`;
    const flag = flagUrgent && isUrgentAddon(a.name) ? '⚡ ' : '';
    return `${flag}${a.name} (${price}) — ${a.description}`;
  };

  const answerAddon = (yes: boolean) => {
    const current = addons[addonIndex];
    reply(yes ? 'Yes, add it' : 'No thanks');
    if (yes) setSelectedAddons(s => [...s, current]);
    const nextIndex = addonIndex + 1;
    if (nextIndex < addons.length) {
      setThinking(true);
      setTimeout(() => {
        setThinking(false);
        say(formatAddon(addons[nextIndex], data.leadTimeOk === false));
        setAddonIndex(nextIndex);
      }, 400);
    } else {
      const noneSelected = selectedAddons.length === 0 && !yes;
      // Resume packages ARE the product — nudge once if nothing was chosen, then
      // proceed regardless (admin can finalize pricing) to avoid an endless loop.
      if (category === 'resume' && noneSelected && !data.resumeNudged) {
        setData(d => ({ ...d, resumeNudged: true }));
        setThinking(true);
        setTimeout(() => {
          setThinking(false);
          say("A CV/Resume package is what we price your order on — take another look and pick the one that fits. (You can also propose your own budget at the end.)");
          setAddonIndex(0);
          setStep('addonQuestion');
          say(formatAddon(addons[0], false));
        }, 400);
        return;
      }
      setThinking(true);
      setTimeout(() => {
        setThinking(false);
        say('One more thing — when do you need this delivered by?');
        setStep('deadline');
      }, 400);
    }
  };

  // ---------- Deadline / terms ----------
  const submitDeadline = () => {
    if (!inputVal) { setErrorMsg('Please pick a date.'); return; }
    const chosen = new Date(inputVal);
    const min = new Date(minDeadlineStr());
    if (chosen < min) { setErrorMsg(`We need at least ${MIN_LEAD_DAYS} days — please pick a later date.`); return; }
    setErrorMsg('');
    reply(new Date(inputVal).toLocaleDateString());
    setData(d => ({ ...d, deadline: inputVal }));
    setInputVal('');
    goToTerms();
  };

  const goToTerms = async () => {
    setStep('terms');
    setThinking(true);
    const key = catDef?.tosKey || 'academic_tos';
    const { data: terms } = await supabase.from('site_content').select('content_text').eq('content_key', key).single();
    setThinking(false);
    setTermsText(terms?.content_text ? stripTags(decodeHtml(terms.content_text)) : 'Standard terms apply: a deposit is required before work begins, and the remaining balance is due before final files are released.');
    say('Before we finalize this, please review our terms of service.');
  };

  const acceptTermsAndReview = () => {
    if (!acceptTerms) return;
    reply('I agree to the Terms of Service');
    setStep('review');
  };

  // ---------- Pricing / review ----------
  const computeTotal = (): number => {
    if (category === 'academic') {
      const words = data.words || 0;
      const plan = (data.plan || 'STANDARD') as keyof typeof PLAN_RATES;
      const base = words * PLAN_RATES[plan];
      const volumeDiscount = words >= 10000 ? PLAN_DISCOUNTS[plan] : 0;
      return Math.round(base * (1 - volumeDiscount / 100));
    }
    const base = category === 'resume' ? 0 : (data.budget || 0);
    let flatFees = 0;
    let percentIncrease = 0;
    selectedAddons.forEach(a => {
      if (a.price_type === 'FLAT_FEE') flatFees += a.price_value;
      else percentIncrease += a.price_value / 100;
    });
    return Math.round((base + flatFees) * (1 + percentIncrease));
  };

  const buildAdditionalInfo = (): string => {
    if (category === 'content') return `[CONTENT TYPE]: ${data.subtype}\n[TONE]: ${data.tone}\n[TARGET AUDIENCE]: ${data.audience}\n[ADD-ONS]: ${selectedAddons.map(a => a.name).join(', ') || 'None'}`;
    if (category === 'dev') return `[PROJECT BRIEF]: ${data.devBuild}\n[PLATFORM]: ${data.devPlatform}\n[KEY FEATURES]: ${data.devFeatures}\n[AUTH REQUIRED]: ${data.devAuth}\n[DATABASE REQUIRED]: ${data.devDb}\n[PAYMENT INTEGRATION]: ${data.devPayment}\n[REQUESTED ADD-ONS]: ${selectedAddons.map(a => a.name).join(', ') || 'None'}`;
    if (category === 'resume') return `[TARGET ROLE]: ${data.topic}\n[EXPERIENCE LEVEL]: ${data.experienceLevel}\n[LINKEDIN]: ${data.linkedin || 'Not provided'}\n[SELECTED PACKAGES]: ${selectedAddons.map(a => a.name).join(', ') || 'None'}`;
    if (category === 'custom') return `[PROJECT TYPE]: ${data.subtype}\n[REQUESTED ADD-ONS]: ${selectedAddons.map(a => a.name).join(', ') || 'None'}`;
    return `[TYPE]: ${data.subtype || ''}`;
  };

  const doSubmit = async (finalPrice: number, negotiated: boolean) => {
    setStep('submitting');
    setWasNegotiated(negotiated);
    setProposedPrice(finalPrice);

    const orderStringId = `${catDef?.prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const name = isLoggedIn ? (loggedInProfile?.full_name || data.name || loggedInUser?.email?.split('@')[0]) : data.name;
    const email = isLoggedIn ? loggedInUser?.email : data.email;
    const whatsapp = isLoggedIn ? (loggedInProfile?.whatsapp || '') : data.whatsapp;

    let topic = data.topic || data.subtype || 'Assistant-guided order';
    if (category === 'content') topic = `[CONTENT] ${topic}`;
    if (category === 'dev') topic = `[DEV] ${topic}`;
    if (category === 'resume') topic = `[RESUME] ${topic}`;
    if (category === 'custom') topic = `[COMPLEX] ${topic}`;
    if (negotiated) topic = `[PROPOSAL] ${topic}`;

    const serviceTier = (category === 'academic' && !negotiated) ? data.plan : 'CUSTOM';

    const payload: any = {
      order_id: orderStringId,
      topic,
      service_tier: serviceTier,
      financial_quote: serviceTier === 'CUSTOM' ? finalPrice : undefined,
      word_count: category === 'academic' ? data.words : undefined,
      deadline: data.deadline,
      additional_info: category === 'academic' ? undefined : buildAdditionalInfo(),
      client_phone: whatsapp || null,
      payment_structure_type: '60/40',
      payment_milestones: compileMilestones('60/40', [], finalPrice),
      workflow_status: 'Briefing Received',
      vault_status: negotiated ? 'Pending Price Negotiation' : 'Secured in Vault',
    };

    if (negotiated) {
      const estimate = computeTotal();
      payload.additional_info = `${payload.additional_info ? payload.additional_info + '\n' : ''}[PRICE NEGOTIATION]: Our estimate was ₦${estimate.toLocaleString()}; client proposed ₦${finalPrice.toLocaleString()}. Awaiting admin review.`;
    }

    if (isLoggedIn) {
      payload.client_id = loggedInUser.id;
      payload.legal_name = name;
      payload.email = email;
      payload.whatsapp_sync = whatsapp;
    } else {
      payload.guest_name = name;
      payload.guest_email = email;
      payload.guest_whatsapp = whatsapp;
      payload.legal_name = name;
      payload.email = email;
      payload.whatsapp_sync = whatsapp;
    }

    const res = await createSecureOrder(payload, '') as CreateOrderServerActionResponse;

    if (!res?.success) {
      setThinking(false);
      say(`Something went wrong: ${res?.error || 'please try again.'}`);
      setStep('error');
      return;
    }

    persistMemoryIfEligible();
    setFinalOrderId(orderStringId);
    setFinalEmail(email);
    setFinalDeposit(Math.round(finalPrice * 0.6));
    setDepositPaidFromWallet(false);
    setStep('success');
  };

  const payDepositFromWallet = async () => {
    setWalletPaying(true);
    try {
      const res = await fetch('/api/client/pay-milestone-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: finalOrderId, milestoneIndex: 0 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWalletBalance(b => b - finalDeposit);
        setDepositPaidFromWallet(true);
        say('Deposit paid from your wallet — your project is now active! 🎉');
      } else {
        say(`Couldn't pay from wallet: ${data.error || 'please try card instead.'}`);
      }
    } catch {
      say('Network error paying from wallet — please try card instead.');
    }
    setWalletPaying(false);
  };

  const confirmPrice = () => doSubmit(computeTotal(), false);

  const declinePrice = () => {
    reply("I'd like to propose a different price");
    advance('negotiateInput', `No problem — what would you like to pay instead? (minimum ₦${MIN_CUSTOM_QUOTE.toLocaleString()})`);
  };

  const submitNegotiation = () => {
    const n = parseInt(inputVal.replace(/[^0-9]/g, ''), 10);
    if (!n || n < MIN_CUSTOM_QUOTE) { setErrorMsg(`Please propose at least ₦${MIN_CUSTOM_QUOTE.toLocaleString()}.`); return; }
    setErrorMsg('');
    reply(`₦${n.toLocaleString()}`);
    setInputVal('');
    doSubmit(n, true);
  };

  const contactWriter = () => {
    const msg = `Hi, this is ${data.name || loggedInProfile?.full_name || 'a visitor'} — I'd like to speak with a writer directly${category ? ` about a ${catDef?.label.toLowerCase()} project` : ''}.`;
    window.open(waLink(msg), '_blank');
  };

  // ---------- Render helpers ----------
  const Chip = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${accent.border} ${accent.text} ${accent.bg} hover:brightness-110 cursor-pointer text-left`}>
      {children}
    </button>
  );

  const TextRow = ({ onSubmit, placeholder, type = 'text', autoFocus = true }: { onSubmit: () => void; placeholder: string; type?: string; autoFocus?: boolean }) => (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          type={type}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={placeholder}
          className="flex-1 bg-card border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500 dark:[color-scheme:dark]"
        />
        <button onClick={onSubmit} className={`px-4 rounded-xl text-xs font-black uppercase ${accent.solidBg} ${accent.solidText}`}>Send</button>
      </div>
      {errorMsg && <p className="text-[11px] text-red-500 font-bold">{errorMsg}</p>}
    </div>
  );

  // Live order-notes summary (typewriter, no overlap — own scroll region)
  const renderNotes = () => {
    if (!category || step === 'askName' || step === 'quickMenu') return null;
    const rows: [string, string][] = [];
    rows.push(['Category', catDef?.label || '']);
    if (data.subtype) rows.push(['Type', data.subtype]);
    if (data.devBuild) rows.push(['Build', data.devBuild]);
    if (data.devPlatform) rows.push(['Platform', data.devPlatform]);
    if (data.topic) rows.push(['Title', data.topic]);
    if (data.words) rows.push(['Word Count', `${data.words.toLocaleString()} words`]);
    if (data.plan) rows.push(['Tier', data.plan]);
    if (data.audience) rows.push(['Audience', data.audience]);
    if (data.tone) rows.push(['Tone', data.tone]);
    if (data.experienceLevel) rows.push(['Experience', data.experienceLevel]);
    if (data.budget) rows.push(['Budget', `₦${data.budget.toLocaleString()}`]);
    if (selectedAddons.length > 0) rows.push(['Add-ons', selectedAddons.map(a => a.name).join(', ')]);
    if (data.deadline) rows.push(['Deadline', new Date(data.deadline).toLocaleDateString()]);
    if (rows.length === 0) return null;
    return (
      <div className="border-t border-theme bg-secondary/60 px-3 py-2 max-h-24 overflow-y-auto custom-scrollbar shrink-0 space-y-1">
        <p className="text-[9px] uppercase font-black tracking-widest text-secondary mb-1">📝 Your Order Notes</p>
        {rows.map(([label, val]) => <TypewriterLine key={label + val} label={label} text={val} />)}
      </div>
    );
  };

  const renderController = () => {
    switch (step) {
      case 'askName':
        return <TextRow onSubmit={submitName} placeholder="Your name" />;

      case 'quickMenu':
        return (
          <div className="flex flex-col gap-2">
            {['Start a New Order', 'Check My Order Status', 'View My Order History', 'Pay Outstanding Balance', 'Take a Dashboard Tour', 'Message My Writer on WhatsApp', 'Update My Account'].map(a => (
              <Chip key={a} onClick={() => pickQuickAction(a)}>{a}</Chip>
            ))}
          </div>
        );

      case 'category':
        return (
          <div className="flex flex-col gap-2">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => pickCategory(c.id)} className={`flex items-start gap-3 p-3 rounded-xl border border-theme bg-card hover:${accentClasses(c.accent).bg} transition text-left cursor-pointer`}>
                <span className={accentClasses(c.accent).text}>{c.icon}</span>
                <span>
                  <span className="block text-sm font-bold text-primary">{c.label}</span>
                  <span className="block text-[11px] text-secondary mt-0.5">{c.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        );

      case 'subtype':
        return <div className="flex flex-wrap gap-2">{SUBTYPES[category!].map(s => <Chip key={s} onClick={() => pickSubtype(s)}>{s}</Chip>)}</div>;

      case 'subtypeOther':
        return <TextRow onSubmit={submitSubtypeOther} placeholder="e.g. an interactive quiz app for students" />;

      case 'devBuild':
        return <TextRow onSubmit={submitDevBuild} placeholder="e.g. A booking platform for a hair salon with WhatsApp reminders" />;

      case 'devPlatform':
        return <div className="flex flex-wrap gap-2">{['Web App', 'Mobile App (iOS/Android)', 'Both Web & Mobile', 'API / Backend Only', 'Not sure yet'].map(o => <Chip key={o} onClick={() => pickDevPlatform(o)}>{o}</Chip>)}</div>;

      case 'devFeatures':
        return <TextRow onSubmit={submitDevFeatures} placeholder="e.g. user login, admin dashboard, payments, chat" />;

      case 'devAuth':
        return <div className="flex gap-2">
          <Chip onClick={() => pickYesNo('devAuth', 'Yes', 'devDb', 'Will it need its own database — to store users, orders, or content?')}>Yes</Chip>
          <Chip onClick={() => pickYesNo('devAuth', 'No', 'devDb', 'Will it need its own database — to store users, orders, or content?')}>No</Chip>
        </div>;

      case 'devDb':
        return <div className="flex gap-2">
          <Chip onClick={() => pickYesNo('devDb', 'Yes', 'devPayment', 'Do you need payment processing built in (Paystack, Stripe, etc.)?')}>Yes</Chip>
          <Chip onClick={() => pickYesNo('devDb', 'No', 'devPayment', 'Do you need payment processing built in (Paystack, Stripe, etc.)?')}>No</Chip>
        </div>;

      case 'devPayment':
        return <div className="flex gap-2">
          <Chip onClick={() => { reply('Yes'); setData(d => ({ ...d, devPayment: 'Yes' })); needsContact() ? advance('contactEmail', `What's the best email to reach you on, ${firstName || 'friend'}?`) : goToCategoryDetails(); }}>Yes</Chip>
          <Chip onClick={() => { reply('No'); setData(d => ({ ...d, devPayment: 'No' })); needsContact() ? advance('contactEmail', `What's the best email to reach you on, ${firstName || 'friend'}?`) : goToCategoryDetails(); }}>No</Chip>
        </div>;

      case 'contactEmail':
        return <TextRow onSubmit={submitContactEmail} placeholder="you@email.com" type="email" />;
      case 'contactWhatsapp':
        return <TextRow onSubmit={submitContactWhatsapp} placeholder="+234..." type="tel" />;

      case 'topic':
        return <TextRow onSubmit={submitTopic} placeholder={category === 'academic' ? 'e.g. Impact of Monetary Policy on Small Businesses' : 'Short project title'} />;

      case 'words':
        return <TextRow onSubmit={submitWords} placeholder="e.g. 3000" type="number" />;

      case 'plan':
        return (
          <div className="flex flex-col gap-2">
            {(Object.keys(PLAN_RATES) as (keyof typeof PLAN_RATES)[]).map(p => {
              const words = data.words || 0;
              const base = words * PLAN_RATES[p];
              const disc = words >= 10000 ? PLAN_DISCOUNTS[p] : 0;
              const price = Math.round(base * (1 - disc / 100));
              return (
                <button key={p} onClick={() => pickPlan(p)} className={`flex items-center justify-between p-3 rounded-xl border border-theme bg-card hover:${accent.bg} transition text-left cursor-pointer`}>
                  <span>
                    <span className="block text-sm font-black text-primary">{p} <span className="text-secondary font-normal text-[11px]">— ₦{PLAN_RATES[p]}/word</span></span>
                    <span className="block text-[10px] text-secondary">{PLAN_BLURB[p]}</span>
                  </span>
                  <span className="text-sm font-black text-emerald-500 shrink-0 ml-3">₦{price.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        );

      case 'audience':
        return <TextRow onSubmit={submitAudience} placeholder="e.g. Tech startups, Gen Z shoppers" />;

      case 'tone':
        return <div className="flex flex-wrap gap-2">{['Professional & Corporate', 'Conversational & Friendly', 'Persuasive & Sales-Driven', 'Humorous & Witty', 'Academic & Technical'].map(t => <Chip key={t} onClick={() => pickTone(t)}>{t}</Chip>)}</div>;

      case 'experienceLevel':
        return <div className="flex flex-wrap gap-2">{['Entry-Level (0-2 years)', 'Mid-Level (3-8 years)', 'Senior/Executive (9+ years)', 'Career Change'].map(t => <Chip key={t} onClick={() => pickExperience(t)}>{t}</Chip>)}</div>;

      case 'linkedin':
        return <TextRow onSubmit={submitLinkedin} placeholder='Paste link, or type "skip"' />;

      case 'budget':
        return <TextRow onSubmit={submitBudget} placeholder="e.g. 50000" type="number" />;

      case 'leadTimeCheck':
        return <div className="flex gap-2"><Chip onClick={() => answerLeadTime(true)}>Yes, that works</Chip><Chip onClick={() => answerLeadTime(false)}>Not really</Chip></div>;

      case 'addonsLoading':
        return <p className="text-xs text-secondary flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking available add-ons...</p>;

      case 'addonQuestion':
        return <div className="flex gap-2"><Chip onClick={() => answerAddon(true)}>Yes, add it</Chip><Chip onClick={() => answerAddon(false)}>No thanks</Chip></div>;

      case 'deadline':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="date" value={inputVal} min={minDeadlineStr()} onChange={e => setInputVal(e.target.value)} className="flex-1 bg-card border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500 dark:[color-scheme:dark]" />
              <button onClick={submitDeadline} className={`px-4 rounded-xl text-xs font-black uppercase ${accent.solidBg} ${accent.solidText}`}>Set</button>
            </div>
            <p className="text-[10px] text-secondary">Earliest available date: {new Date(minDeadlineStr()).toLocaleDateString()} (2-week minimum).</p>
            {errorMsg && <p className="text-[11px] text-red-500 font-bold">{errorMsg}</p>}
          </div>
        );

      case 'terms':
        return (
          <div className="space-y-3">
            <div className="max-h-28 overflow-y-auto bg-card border border-theme rounded-xl p-3 text-[11px] text-secondary leading-relaxed custom-scrollbar">{termsText}</div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500" />
              <span className="text-[11px] text-primary font-bold">I agree to the Terms of Service.</span>
            </label>
            <button onClick={acceptTermsAndReview} disabled={!acceptTerms} className={`w-full py-2.5 rounded-xl text-xs font-black uppercase disabled:opacity-40 disabled:cursor-not-allowed ${accent.solidBg} ${accent.solidText}`}>Continue to Price Review</button>
          </div>
        );

      case 'review': {
        const total = computeTotal();
        const deposit = Math.round(total * 0.6);
        const balance = total - deposit;
        return (
          <div className="space-y-3">
            <div className={`p-4 rounded-2xl border ${accent.border} ${accent.bg}`}>
              <p className="text-[10px] uppercase font-black tracking-widest text-secondary">Estimated Total</p>
              <p className={`text-3xl font-black ${accent.text}`}>₦{total.toLocaleString()}</p>
              <div className="mt-2 pt-2 border-t border-theme text-[11px] text-secondary space-y-1">
                <div className="flex justify-between"><span>60% Deposit (due now)</span><span className="text-primary font-bold">₦{deposit.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>40% Balance (on completion)</span><span className="text-primary font-bold">₦{balance.toLocaleString()}</span></div>
              </div>
              {isLoggedIn && walletBalance > 0 && (
                <div className={`mt-2 pt-2 border-t border-theme text-[11px] ${walletBalance >= deposit ? 'text-emerald-500' : 'text-secondary'} font-bold flex items-center gap-1`}>
                  <Wallet className="w-3.5 h-3.5" /> Wallet balance: ₦{walletBalance.toLocaleString()}
                  {walletBalance >= deposit ? ' — covers your deposit!' : ''}
                </div>
              )}
            </div>
            <p className="text-xs text-secondary">Are you happy with this price, or would you like to propose what you can afford?</p>
            <div className="flex gap-2">
              <button onClick={confirmPrice} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase ${accent.solidBg} ${accent.solidText}`}>Yes, Submit Order</button>
              <button onClick={declinePrice} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase bg-secondary border border-theme text-primary">Propose My Own Price</button>
            </div>
          </div>
        );
      }

      case 'negotiateInput':
        return <TextRow onSubmit={submitNegotiation} placeholder="e.g. 30000" type="number" />;

      case 'submitting':
        return <p className="text-xs text-secondary flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting your order...</p>;

      case 'success':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm"><CheckCircle2 className="w-5 h-5" /> Order {finalOrderId} created!</div>
            {wasNegotiated ? (
              <p className="text-xs text-secondary">Thanks! Our team will review your offer of ₦{proposedPrice.toLocaleString()} and get back to you via WhatsApp or email within 24 hours.</p>
            ) : depositPaidFromWallet ? (
              <p className="text-xs text-emerald-500 font-bold">Deposit paid ✓ — we've started your project. Track it in your dashboard.</p>
            ) : (
              <>
                <p className="text-xs text-secondary">Next: pay your ₦{finalDeposit.toLocaleString()} deposit to get started.</p>
                {isLoggedIn && walletBalance >= finalDeposit && (
                  <button onClick={payDepositFromWallet} disabled={walletPaying} className="w-full py-2.5 rounded-xl text-xs font-black uppercase bg-emerald-500 text-black hover:bg-emerald-400 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    <Wallet className="w-4 h-4" /> {walletPaying ? 'Paying…' : `Pay Deposit from Wallet (₦${finalDeposit.toLocaleString()})`}
                  </button>
                )}
                <button onClick={() => { setOpen(false); router.push(`/complete-registration?email=${encodeURIComponent(finalEmail)}&orderId=${finalOrderId}`); }} className={`w-full py-2.5 rounded-xl text-xs font-black uppercase ${accent.solidBg} ${accent.solidText}`}>{isLoggedIn && walletBalance >= finalDeposit ? 'Or Pay with Card' : 'Proceed to Payment'}</button>
              </>
            )}
            <button onClick={reset} className="w-full py-2 rounded-xl text-xs font-bold bg-secondary border border-theme text-primary">Start Another Order</button>
          </div>
        );

      case 'error':
        return <button onClick={reset} className="w-full py-2.5 rounded-xl text-xs font-black uppercase bg-secondary border border-theme text-primary">Try Again</button>;

      default:
        return null;
    }
  };

  // Admin pages get no assistant; /projects has its own page-scoped assistant.
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/projects')) return null;

  return (
    <>
      {!open && !tourActive && (
        <button onClick={openAssistant} className="fixed bottom-6 left-6 z-50 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 transition" aria-label="Open order assistant">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-wide hidden sm:inline">Need Help Ordering?</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 left-6 z-50 w-[92vw] max-w-sm bg-card border border-theme rounded-[24px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '82vh' }}>
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wide">Order Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={contactWriter} title="Contact Writer directly on WhatsApp" className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/10 rounded-lg cursor-pointer text-[10px] font-black uppercase">
                <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Contact Writer</span>
              </button>
              {history.length > 0 && <button onClick={reset} title="Start over" className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[160px]">
            {history.map((m, i) => {
              if (m.role === 'bot' && m.text.startsWith('__PAY_LINK__')) {
                const link = m.text.replace('__PAY_LINK__', '');
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-violet-500/20 text-violet-400"><Bot className="w-3.5 h-3.5" /></div>
                    <a href={link} className="px-3 py-2 rounded-2xl text-xs font-black uppercase bg-emerald-500 text-black rounded-tl-sm">Pay Now →</a>
                  </div>
                );
              }
              return (
                <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.role === 'bot' ? 'bg-violet-500/20 text-violet-400' : 'bg-secondary text-secondary'}`}>
                    {m.role === 'bot' ? <Bot className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed max-w-[80%] whitespace-pre-line ${m.role === 'bot' ? 'bg-secondary text-primary rounded-tl-sm' : 'bg-emerald-500/10 text-primary rounded-tr-sm'}`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            {thinking && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-violet-500/20 text-violet-400"><Bot className="w-3.5 h-3.5" /></div>
                <div className="px-3 py-2 rounded-2xl bg-secondary text-secondary text-xs">•••</div>
              </div>
            )}
          </div>

          {renderNotes()}

          {!thinking && <div className="p-4 border-t border-theme shrink-0">{renderController()}</div>}
        </div>
      )}

      {tourActive && (
        <>
          {tourRect && (
            <div
              className="fixed z-[70] rounded-xl pointer-events-none transition-all duration-300"
              style={{
                top: tourRect.top - 6, left: tourRect.left - 6, width: tourRect.width + 12, height: tourRect.height + 12,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)', border: '2px solid #8b5cf6',
              }}
            />
          )}
          <div className="fixed z-[71] bottom-24 left-6 w-[90vw] max-w-sm bg-card border border-violet-500/40 rounded-2xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-violet-400 font-black text-xs uppercase tracking-wide"><Compass className="w-4 h-4" /> Dashboard Tour ({tourStep + 1}/{TOUR_STEPS.length})</div>
            <p className="text-sm font-bold text-primary">{TOUR_STEPS[tourStep].title}</p>
            <p className="text-xs text-secondary">{TOUR_STEPS[tourStep].text}</p>
            <div className="flex gap-2">
              {tourStep > 0 && <button onClick={() => setTourStep(s => s - 1)} className="px-3 py-2 rounded-xl text-xs font-bold bg-secondary border border-theme text-primary">Back</button>}
              <button
                onClick={() => {
                  if (tourStep < TOUR_STEPS.length - 1) setTourStep(s => s + 1);
                  else { setTourActive(false); setOpen(true); setTimeout(() => { say("That's your dashboard! Anything else I can help with?"); setStep('quickMenu'); }, 200); }
                }}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-black uppercase bg-violet-600 text-white"
              >
                {tourStep < TOUR_STEPS.length - 1 ? 'Next' : 'Finish Tour'}
              </button>
              <button onClick={() => { setTourActive(false); setOpen(true); }} className="px-3 py-2 rounded-xl text-xs font-bold text-secondary">Skip</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
