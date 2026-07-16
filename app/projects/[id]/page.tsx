'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import ProjectsAssistant from '@/app/components/ProjectsAssistant';
import Header from '@/app/components/Header';

type Topic = {
  id: number;
  title: string;
  department: string;
  description: string | null;
  pages: number | null;
  chapters: string | null;
  format: string | null;
  year: number | null;
  level: string;
  price: number;
};

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  price_type?: string;
  features?: { name: string; price: number }[];
  is_location_changer?: boolean;
};

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

const levelBadge = (lvl: string) =>
  lvl === 'PhD' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    : lvl === 'MSc' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

export default function ProjectPermalinkPage() {
  const params = useParams();
  const rawParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  // Permalinks are `/projects/{id}-{slug}` (slug is cosmetic, for sharing) but
  // plain `/projects/{id}` still resolves — only the leading numeric id matters.
  const id = rawParam ? rawParam.match(/^\d+/)?.[0] : undefined;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [related, setRelated] = useState<Topic[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuration + pricing
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ BSc: 3999, MSc: 4500, PhD: 10000 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});
  const [pageSettings, setPageSettings] = useState<any>({
    checkout_terms: "I understand this is a ready-made material — similarity/plagiarism and AI-detection levels are not checked or guaranteed. My purchase means the project will be delivered (Chapters 1–5, MS Word) to my vault. Working hours are 8am–7pm; delivery is within 4 hours.",
    delivery_text: "⚡ Delivered within 4 hours"
  });

  // Checkout inputs
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<number>>(new Set());
  const [addonWords, setAddonWords] = useState<Record<number, number>>({});
  const [addonFeatures, setAddonFeatures] = useState<Record<number, string[]>>({});
  const [customLocation, setCustomLocation] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Secure Document Preview States & Effects
  const [openPreview, setOpenPreview] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [previewTab, setPreviewTab] = useState<'title' | 'abstract' | 'contents' | 'chapter1'>('title');
  const [previewZoom, setPreviewZoom] = useState(100);

  useEffect(() => {
    if (!openPreview) return;
    setPreviewTab('title');
    setIsWindowBlurred(false);

    // Prevent copying
    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      alert("Copying text is disabled in the secure document viewer. Please purchase the project material to download the complete file.");
    };

    // Prevent keyboard copy/selection shortcuts and PrintScreen
    const preventKeys = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (
        (isCmdOrCtrl && ['c', 'a', 's', 'p', 'x'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen' || 
        e.key === 'Snapshot'
      ) {
        e.preventDefault();
        alert("This operation is disabled in the secure document viewer. Please purchase the material to unlock.");
      }
    };

    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('keydown', preventKeys);
    document.addEventListener('dragstart', preventDrag);

    // Dynamic blur protection when focus is lost (blocks screenshot/snip programs)
    const handleBlur = () => {
      setIsWindowBlurred(true);
    };
    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('keydown', preventKeys);
      document.removeEventListener('dragstart', preventDrag);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [openPreview]);

  const getFaculty = (dept: string) => {
    const d = (dept || '').toLowerCase();
    if (d.includes('computer') || d.includes('science') || d.includes('microbiology') || d.includes('biochemistry') || d.includes('math') || d.includes('geology') || d.includes('chemistry') || d.includes('biology') || d.includes('botany')) return 'Science';
    if (d.includes('engineering') || d.includes('technology')) return 'Engineering and Technology';
    if (d.includes('accounting') || d.includes('business') || d.includes('finance') || d.includes('admin') || d.includes('actuarial') || d.includes('insurance')) return 'Management Sciences';
    if (d.includes('law')) return 'Law';
    if (d.includes('nursing') || d.includes('anatomy') || d.includes('medicine') || d.includes('dentistry') || d.includes('medical')) return 'Basic Medical Sciences';
    if (d.includes('education')) return 'Education';
    if (d.includes('economics') || d.includes('mass') || d.includes('sociology') || d.includes('geography') || d.includes('relation') || d.includes('political')) return 'Social Sciences';
    if (d.includes('english') || d.includes('history') || d.includes('linguistics') || d.includes('art') || d.includes('music')) return 'Arts';
    if (d.includes('agric') || d.includes('animal') || d.includes('fisheries') || d.includes('forestry')) return 'Agriculture';
    return 'Social & Management Sciences';
  };

  const getCleanTitle = (title: string) => {
    return (title || '').replace(/^\[PROJECT\]\s*/i, '').trim().toUpperCase();
  };

  const parseTitle = (title: string, dept: string) => {
    let clean = (title || '').replace(/^\[PROJECT\]\s*/i, '').trim();
    
    // Extract case study / location
    let caseStudy = '';
    const caseMatch = clean.match(/\((?:a\s+)?case\s+study\s+(?:of|in)\s+([^\)]+)\)/i) || 
                      clean.match(/(?:a\s+)?case\s+study\s+(?:of|in)\s+([^,\.\(]+)/i) ||
                      clean.match(/in\s+([A-Z][a-zA-Z\s]+(?:State|University|Hospital|LGA|Nigeria))/i);
    if (caseMatch) {
      caseStudy = caseMatch[1].trim();
      clean = clean.replace(/\(?(?:a\s+)?case\s+study\s+(?:of|in)\s+[^\)]+\)?/i, '').replace(/in\s+[A-Z][a-zA-Z\s]+(?:State|University|Hospital|LGA|Nigeria)/i, '').trim();
    } else {
      caseStudy = "selected organizations in Nigeria";
    }

    // Attempt to extract variables X and Y
    let varA = '';
    let varB = '';
    const cleanLower = clean.toLowerCase();
    
    if (cleanLower.startsWith('impact of') || cleanLower.startsWith('effect of') || cleanLower.startsWith('influence of') || cleanLower.startsWith('assessment of') || cleanLower.startsWith('evaluation of')) {
      const core = clean.replace(/^(impact|effect|influence|assessment|evaluation|analysis)\s+of\s+/i, '').trim();
      const splitOn = core.match(/^(.*?)\s+(?:on|to|against|in|towards)\s+(.*)$/i);
      if (splitOn) {
        varA = splitOn[1].trim();
        varB = splitOn[2].trim();
      } else {
        varA = core;
        varB = dept;
      }
    } else if (cleanLower.startsWith('relationship between')) {
      const core = clean.replace(/^relationship\s+between\s+/i, '').trim();
      const splitAnd = core.match(/^(.*?)\s+and\s+(.*)$/i);
      if (splitAnd) {
        varA = splitAnd[1].trim();
        varB = splitAnd[2].trim();
      } else {
        varA = core;
        varB = dept;
      }
    } else if (cleanLower.startsWith('challenges and prospects of')) {
      varA = clean.replace(/^challenges\s+and\s+prospects\s+of\s+/i, '').trim();
      varB = dept;
    } else {
      const words = clean.split(' ');
      const half = Math.floor(words.length / 2);
      varA = words.slice(0, half).join(' ');
      varB = words.slice(half).join(' ');
    }

    return {
      varA: varA || clean,
      varB: varB || dept,
      caseStudy: caseStudy,
      cleanTitle: clean.toUpperCase()
    };
  };

  const generateProjectPreview = (title: string, dept: string, lvl: string) => {
    const { varA, varB, caseStudy, cleanTitle } = parseTitle(title, dept);
    const deptUpper = (dept || '').toUpperCase();
    
    const abstract = `This study investigates the critical dimensions of "${cleanTitle}" with particular emphasis on "${caseStudy}". The main objective of the study was to evaluate the statistical relationship between "${varA}" and "${varB}" within the contemporary Nigerian environment. The research design employed was a descriptive survey design. A sample size of 150 respondents was selected from the target population using simple random sampling techniques. Data collection was done using a structured questionnaire titled "${cleanTitle} Questionnaire" which was validated by academic experts in the Department of ${deptUpper}. The collected data were analyzed using statistical package for social sciences (SPSS) with descriptive statistics (mean and standard deviation) and inferential statistics (Chi-Square/Regression analysis). The findings revealed that "${varA}" has a statistically significant positive effect on "${varB}" in Nigeria. Based on the findings, it is recommended that stakeholders should prioritize implementation of policies that support these parameters to foster sustainable national development.`;
    
    const background = `In contemporary academic and operational discourse, the concept of "${varA}" has transitioned from a localized initiative to a global imperative. Historically, the integration of structured frameworks around "${varA}" has been recognized as a primary driver of efficiency, organizational resilience, and systemic progress within the domain of ${deptUpper}.

Within the specific context of Nigeria, the practical execution of "${varA}" is often constrained by socio-economic dynamics, policy inconsistencies, and infrastructural limitations. These challenges create a complex environment that requires rigorous empirical analysis to resolve.

Furthermore, the direct relationship between "${varA}" and "${varB}" remains a critical point of interest. While theoretical models suggest that positive improvements in "${varA}" will yield corresponding advancements in "${varB}", practitioners in "${caseStudy}" frequently encounter institutional bottlenecks. This study, focusing on "${caseStudy}", seeks to bridge the gap between academic theory and practical reality by providing localized, actionable evidence.`;

    const problem = `Despite the growing recognition and potential benefits of "${varA}", there remains a persistent gap in its standard implementation and documentation within Nigeria. Many organizations and institutions in "${caseStudy}" continue to operate under outdated paradigms, leading to low productivity, sub-optimal outcomes, and strategic resource wastage.

Moreover, there is a lack of rigorous academic literature focusing on how "${varA}" directly impacts "${varB}" within ${deptUpper} in Nigeria. Without localized, empirical datasets, administrators are left without the necessary guideposts to formulate effective policies. This study is designed to address this critical gap by conducting a detailed, mixed-methods evaluation of "${varA}" in relation to "${varB}" in "${caseStudy}".`;

    return { abstract, background, problem, varA, varB, caseStudy };
  };

  // Fetch data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      if (user?.email) setUserEmail(user.email);

      // Load settings
      const { data: settingsData } = await supabase.from('project_settings').select('*');
      let lp: Record<string, number> = { BSc: 3999, MSc: 4500, PhD: 10000 };
      let dp = {};
      let ps = { ...pageSettings };
      if (settingsData) {
        settingsData.forEach(s => {
          if (s.key === 'level_prices') lp = s.value;
          if (s.key === 'department_prices') dp = s.value;
          if (s.key === 'page_settings') ps = { ...ps, ...s.value };
        });
        setLevelPrices(lp);
        setDeptPrices(dp);
        setPageSettings(ps);
      }

      // Fetch specific topic
      const { data: tData, error: tErr } = await supabase
        .from('project_topics')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (tErr || !tData) {
        setTopic(null);
        setLoading(false);
        return;
      }

      const activeTopic = tData as Topic;
      const getPrice = (lvl: string, deptName: string, customPrice?: number) => {
        if (customPrice !== undefined && Number(customPrice) > 0) return Number(customPrice);
        const deptPrice = (dp as Record<string, number>)[deptName];
        if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
        return lp[lvl] || 3999;
      };

      activeTopic.price = getPrice(activeTopic.level, activeTopic.department, activeTopic.price);
      setTopic(activeTopic);

      // Fetch related and active addons
      const [{ data: relData }, { data: addData }] = await Promise.all([
        supabase
          .from('project_topics')
          .select('*')
          .eq('department', activeTopic.department)
          .eq('is_active', true)
          .neq('id', activeTopic.id)
          .limit(6),
        supabase
          .from('project_addons')
          .select('id, name, description, price, price_type, features, is_location_changer')
          .eq('is_active', true)
          .order('sort_order')
      ]);

      const mappedRel = (relData || []).map(r => ({
        ...r,
        price: getPrice(r.level, r.department, r.price)
      }));

      setRelated(mappedRel);
      setAddons((addData as Addon[]) || []);
      setLoading(false);
    })();
  }, [id]);

  const cartTotal = () => {
    if (!topic) return 0;
    let t = topic.price;
    addons.forEach(a => {
      if (selectedAddons.has(a.id)) {
        if (a.price_type === 'per_word') {
          const w = addonWords[a.id] || 1000;
          t += Number(a.price) * w;
        } else {
          t += Number(a.price);
        }

        if (Array.isArray(a.features) && addonFeatures[a.id]) {
          a.features.forEach(f => {
            if (addonFeatures[a.id].includes(f.name)) {
              t += Number(f.price);
            }
          });
        }
      }
    });
    return Math.round(t);
  };

  const pay = async () => {
    if (!topic || !acceptedTerms) return;
    if (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim())) {
      setMsg('Please enter a valid email — your receipt and vault access link go there.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          department: topic.department,
          level: topic.level,
          addonIds: Array.from(selectedAddons),
          addonWords: addonWords,
          addonFeatures: addonFeatures,
          customLocation: customLocation,
          email: isLoggedIn === false ? guestEmail.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) window.location.href = data.authorization_url;
      else setMsg(data.error || 'Could not start checkout.');
    } catch { setMsg('Network error. Please try again.'); }
    setBusy(false);
  };

  const slugify = (title: string) =>
    title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const copyLink = () => {
    const link = topic ? `${window.location.origin}/projects/${topic.id}-${slugify(topic.title)}` : window.location.href;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-secondary text-sm flex items-center justify-center gap-2">
          <lucide.Loader2 className="w-5 h-5 animate-spin" /> Loading project details…
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center text-secondary">
        <div className="text-6xl mb-4">🔎</div>
        <h3 className="text-xl font-bold text-primary mb-2">Topic not found</h3>
        <p className="text-sm mb-6">The project topic you are looking for is unavailable or has been archived.</p>
        <Link href="/projects" className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl font-bold transition">
          Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] pb-12 pt-header-20">
      <Header projectsContext />
      {/* HEADER BREADCRUMB */}
      <div className="border-b border-theme bg-secondary/30 px-4 md:px-8 py-4">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center gap-4 flex-wrap text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2 text-secondary">
            <Link href="/projects" className="hover:text-emerald-500 transition">📚 Projects Catalog</Link>
            <lucide.ChevronRight className="w-3.5 h-3.5" />
            <span className="text-secondary truncate max-w-xs">{topic.department}</span>
            <lucide.ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary truncate max-w-xs font-semibold">{topic.title}</span>
          </div>
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme bg-card hover:bg-white/5 transition text-xs font-bold">
            {copied ? <><lucide.Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</> : <><lucide.Share2 className="w-3.5 h-3.5" /> Copy Permalink</>}
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* LEFT: TOPIC MAIN INFO */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-theme rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">{topic.department}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded border ${levelBadge(topic.level)}`}>{topic.level}</span>
              </div>
              
              <h1 className="text-xl md:text-2xl font-black text-primary leading-snug">
                {topic.title}
              </h1>

              {topic.description && (
                <div className="space-y-2">
                  <h3 className="text-xs uppercase font-black text-secondary">Overview / Abstract</h3>
                  <p className="text-sm text-secondary leading-relaxed bg-secondary/20 p-4 rounded-xl border border-theme">{topic.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/30 border border-theme rounded-2xl p-5 text-sm">
                <div><span className="block text-[10px] uppercase text-secondary font-bold mb-1">Pages</span><span className="font-bold text-primary">{topic.pages || '—'}</span></div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold mb-1">Chapters</span><span className="font-bold text-primary">{topic.chapters || '1-5'}</span></div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold mb-1">Format</span><span className="font-bold text-primary">{topic.format || 'MS Word'}</span></div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold mb-1">Year</span><span className="font-bold text-primary">{topic.year || '2026'}</span></div>
              </div>
            </div>

            {/* RELATED TOPICS */}
            {related.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-black text-primary flex items-center gap-2">
                  <lucide.BookOpen className="w-5 h-5 text-emerald-500" /> Other topics in {topic.department}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {related.map(r => (
                    <Link key={r.id} href={`/projects/${r.id}`} className="bg-card border border-theme rounded-2xl p-5 block hover:border-emerald-500/40 hover:shadow-md transition">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(r.level)}`}>{r.level}</span>
                      </div>
                      <h4 className="text-xs font-bold text-primary line-clamp-2 leading-relaxed mb-3">{r.title}</h4>
                      <div className="flex justify-between items-center text-[10px] text-secondary">
                        <span>📖 Ch. {r.chapters}</span>
                        <span className="font-black text-emerald-500">{naira(r.price)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: DYNAMIC ADDONS & CHECKOUT CARD */}
          <div className="bg-card border border-theme rounded-3xl p-6 space-y-5 shadow-lg lg:sticky lg:top-[80px]">
            <h2 className="text-base font-black text-primary border-b border-theme pb-3">Purchase Material</h2>
            
            <div className="flex justify-between items-center bg-secondary/30 p-4 rounded-2xl border border-theme">
              <div>
                <span className="text-[10px] uppercase text-secondary font-bold">Chapters 1–5 Base Price</span>
                <span className="block text-xs font-bold text-primary mt-0.5">MS Word format</span>
              </div>
              <span className="text-lg font-black text-primary">{naira(topic.price)}</span>
            </div>

            {/* Optional Addons */}
            {addons.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-black text-secondary tracking-wider ml-1">Customize Options</p>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {addons.map(a => {
                    const on = selectedAddons.has(a.id);
                    return (
                      <div key={a.id} className={`p-3 rounded-xl border transition space-y-2 text-xs ${on ? 'border-emerald-500 bg-emerald-500/5' : 'border-theme bg-secondary'}`}>
                        <button onClick={() => setSelectedAddons(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="w-full text-left flex items-start gap-2.5">
                          <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-theme'}`}>{on && <lucide.Check className="w-2.5 h-2.5 text-black" />}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-1.5"><span className="font-bold text-primary truncate">{a.name}</span><span className="font-black text-emerald-500 shrink-0">{a.price_type === 'per_word' ? `₦${a.price}/w` : `+₦${a.price}`}</span></div>
                            {a.description && <p className="text-[10px] text-secondary line-clamp-2 mt-0.5">{a.description}</p>}
                          </div>
                        </button>

                        {on && (
                          <div className="pl-6 space-y-2 border-t border-theme/20 pt-2">
                            {a.price_type === 'per_word' && (
                              <div className="flex items-center gap-2">
                                <span className="text-secondary text-[10px]">Words:</span>
                                <input
                                  type="number"
                                  min={500}
                                  step={100}
                                  value={addonWords[a.id] || 1000}
                                  onChange={e => setAddonWords(prev => ({ ...prev, [a.id]: Math.max(100, Number(e.target.value) || 0) }))}
                                  className="w-16 bg-card border border-theme rounded px-1.5 py-0.5 text-center font-mono"
                                />
                                <span className="text-emerald-500 font-bold">➔ {naira((addonWords[a.id] || 1000) * a.price)}</span>
                              </div>
                            )}

                            {a.is_location_changer && (
                              <div className="space-y-1">
                                <span className="text-secondary text-[10px] block">Preferred Location:</span>
                                <input
                                  type="text"
                                  value={customLocation}
                                  onChange={e => setCustomLocation(e.target.value)}
                                  placeholder="e.g. Enugu State"
                                  className="w-full bg-card border border-theme rounded px-2 py-1 outline-none"
                                />
                              </div>
                            )}

                            {Array.isArray(a.features) && a.features.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-secondary text-[9px] font-black uppercase tracking-wider block">Features:</span>
                                <div className="grid grid-cols-1 gap-1">
                                  {a.features.map((f, fi) => {
                                    const selected = (addonFeatures[a.id] || []).includes(f.name);
                                    return (
                                      <label key={`${a.id}-${fi}`} className="flex items-center gap-2 cursor-pointer py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={e => {
                                            const current = addonFeatures[a.id] || [];
                                            const next = e.target.checked
                                              ? [...current, f.name]
                                              : current.filter(x => x !== f.name);
                                            setAddonFeatures(prev => ({ ...prev, [a.id]: next }));
                                          }}
                                          className="w-3 h-3 accent-emerald-500 shrink-0"
                                        />
                                        <span className="text-secondary text-[10px] flex-1">{f.name}</span>
                                        <span className="text-secondary font-bold text-[10px] shrink-0">+{naira(f.price)}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-theme pt-3.5">
              <span className="text-sm font-bold text-secondary">Total Price</span>
              <span className="text-2xl font-black text-emerald-500">{naira(cartTotal())}</span>
            </div>

            {isLoggedIn === false && (
              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Your Email (for receipt & vault access)</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-secondary border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-secondary mt-1">No password needed — after payment we'll email you a one-click login link to your dashboard.</p>
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer bg-secondary/40 border border-theme rounded-xl p-3 text-[10px] text-primary leading-relaxed">
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-emerald-500 shrink-0" />
              <span>
                {pageSettings.checkout_terms}
              </span>
            </label>

            {msg && <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

            <button onClick={pay} disabled={!acceptedTerms || busy || (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim()))} className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-sm uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? 'Redirecting to payment…' : `Pay ${naira(cartTotal())} & Get Material`}
            </button>
            <button onClick={() => setOpenPreview(true)} className="w-full py-3 rounded-xl bg-secondary border border-theme hover:bg-white/5 text-primary font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2">
              👁 Preview Material
            </button>
            <p className="text-[9px] text-secondary text-center leading-normal">Working hours are 8am–7pm. Material is delivered directly to your Secure Vault.</p>
          </div>
        </div>
      </div>

      <ProjectsAssistant />

      {/* SECURE PREVIEW MODAL */}
      {openPreview && topic && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setOpenPreview(false)}>
          <div className="bg-card border border-theme rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-theme/50 flex justify-between items-center gap-4 bg-secondary/20">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">{topic.department}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(topic.level)}`}>{topic.level}</span>
                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                  <lucide.Lock className="w-3.5 h-3.5" /> SECURE PREVIEW (ANTI-COPY/SCREENSHOT ACTIVE)
                </span>
              </div>
              <button onClick={() => setOpenPreview(false)} className="text-secondary hover:text-primary p-1 bg-white/5 hover:bg-white/10 rounded-lg transition"><lucide.X className="w-5 h-5" /></button>
            </div>

            {/* Document Viewer Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-secondary/30">
              <h2 className="text-base font-black text-primary leading-snug mb-4">{topic.title}</h2>
              
              <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Document Navigation Tabs */}
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible shrink-0 gap-2 pb-3 lg:pb-0 border-b lg:border-b-0 lg:border-r border-theme/30 lg:pr-4 lg:w-48">
                  <button onClick={() => setPreviewTab('title')} className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left whitespace-nowrap transition flex items-center gap-2 ${previewTab === 'title' ? 'bg-emerald-500 text-black' : 'bg-card text-primary border border-theme hover:bg-white/5'}`}>
                    <lucide.FileText className="w-3.5 h-3.5" /> Title Page
                  </button>
                  <button onClick={() => setPreviewTab('abstract')} className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left whitespace-nowrap transition flex items-center gap-2 ${previewTab === 'abstract' ? 'bg-emerald-500 text-black' : 'bg-card text-primary border border-theme hover:bg-white/5'}`}>
                    <lucide.Bookmark className="w-3.5 h-3.5" /> Abstract
                  </button>
                  <button onClick={() => setPreviewTab('contents')} className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left whitespace-nowrap transition flex items-center gap-2 ${previewTab === 'contents' ? 'bg-emerald-500 text-black' : 'bg-card text-primary border border-theme hover:bg-white/5'}`}>
                    <lucide.List className="w-3.5 h-3.5" /> Table of Contents
                  </button>
                  <button onClick={() => setPreviewTab('chapter1')} className={`px-4 py-2.5 rounded-xl text-xs font-bold text-left whitespace-nowrap transition flex items-center gap-2 ${previewTab === 'chapter1' ? 'bg-emerald-500 text-black' : 'bg-card text-primary border border-theme hover:bg-white/5'}`}>
                    <lucide.BookOpen className="w-3.5 h-3.5" /> Chapter One
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  {/* Document Zoom Controls Toolbar */}
                  <div className="flex justify-end items-center gap-2 px-3 py-1.5 bg-card border border-theme/60 rounded-xl text-[10px] text-secondary w-fit ml-auto">
                    <span>ZOOM:</span>
                    <button onClick={() => setPreviewZoom(z => Math.max(80, z - 10))} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold text-primary">-</button>
                    <span className="font-mono text-primary font-bold min-w-[32px] text-center">{previewZoom}%</span>
                    <button onClick={() => setPreviewZoom(z => Math.min(130, z + 10))} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold text-primary">+</button>
                  </div>

                  {/* Page Canvas (Papersheet View) */}
                  <div 
                    className="w-full bg-white text-zinc-950 border border-zinc-200 p-8 md:p-12 shadow-inner relative rounded-xl select-none overflow-y-auto max-h-[50vh] lg:max-h-[60vh] min-h-[45vh]" 
                    style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
                    onContextMenu={e => e.preventDefault()}
                  >
                    {/* Dynamic Watermark Overlay */}
                    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.03] z-10 flex flex-wrap gap-x-12 gap-y-16 rotate-[-25deg] scale-125 justify-center items-center">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span key={i} className="text-[10px] font-black tracking-widest text-black font-mono uppercase whitespace-nowrap">
                          {userEmail || 'GUEST_UNAUTHORIZED'} • DO NOT COPY • SECURE PREVIEW
                        </span>
                      ))}
                    </div>

                    {/* Window Focus Blur Shield */}
                    {isWindowBlurred && (
                      <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[6px] flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer" onClick={() => setIsWindowBlurred(false)}>
                        <lucide.Lock className="w-12 h-12 text-emerald-600 mb-3 animate-bounce" />
                        <h3 className="text-zinc-950 font-black text-sm uppercase tracking-wider">Preview Hidden for Security</h3>
                        <p className="text-zinc-600 text-xs mt-1 max-w-xs">Window lost focus (anti-screenshot active). Click here to restore the preview.</p>
                      </div>
                    )}

                    {/* Document Pages */}
                    {previewTab === 'title' && (
                      <div className="text-center space-y-10 py-6 text-zinc-900" style={{ fontSize: `${previewZoom / 100}em` }}>
                        <div className="text-sm font-black tracking-wide leading-relaxed font-serif uppercase">
                          {getCleanTitle(topic.title)}
                        </div>
                        <div className="text-xs uppercase font-serif">
                          BY
                          <br /><br />
                          <span className="font-bold underline text-xs">CONFIDENTIAL STUDENT</span>
                          <br />
                          (MATRIC NO: RW/2022/NIG-042)
                        </div>
                        <div className="text-xs leading-relaxed max-w-md mx-auto font-serif">
                          A RESEARCH PROJECT SUBMITTED TO THE DEPARTMENT OF {topic.department.toUpperCase()}, 
                          FACULTY OF {getFaculty(topic.department).toUpperCase()}, IN PARTIAL FULFILLMENT OF THE REQUIREMENTS 
                          FOR THE AWARD OF THE DEGREE OF {topic.level === 'PhD' ? 'DOCTOR OF PHILOSOPHY (Ph.D)' : topic.level === 'MSc' ? 'MASTER OF SCIENCE (M.Sc)' : 'BACHELOR OF SCIENCE (B.Sc)'} IN {topic.department.toUpperCase()}.
                        </div>
                        <div className="text-xs uppercase tracking-wider font-serif">
                          NIGERIAN UNIVERSITY ACADEMIC DEPOSIT SYSTEM
                          <br /><br />
                          YEAR: {topic.year || new Date().getFullYear()}
                        </div>
                      </div>
                    )}

                    {previewTab === 'abstract' && (
                      <div className="text-zinc-900 text-justify font-serif space-y-4" style={{ fontSize: `${previewZoom / 100}em` }}>
                        <h3 className="text-center font-bold text-sm uppercase underline mb-4">ABSTRACT</h3>
                        <p className="text-xs leading-relaxed text-indent-8 font-serif" style={{ textIndent: '2rem' }}>
                          {generateProjectPreview(topic.title, topic.department, topic.level).abstract}
                        </p>
                        <p className="text-xs font-bold mt-4 font-serif">
                          Keywords: <span className="font-normal italic">{topic.department}, Nigerian Development, Implementation, Performance Evaluation, {topic.level} Research.</span>
                        </p>
                      </div>
                    )}

                    {previewTab === 'contents' && (
                      <div className="text-zinc-900 font-serif space-y-3 text-xs" style={{ fontSize: `${previewZoom / 100}em` }}>
                        <h3 className="text-center font-bold text-sm uppercase underline mb-4">TABLE OF CONTENTS</h3>
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold"><span>Title Page</span><span>i</span></div>
                          <div className="flex justify-between font-bold"><span>Certification / Approval Page</span><span>ii</span></div>
                          <div className="flex justify-between font-bold"><span>Dedication</span><span>iii</span></div>
                          <div className="flex justify-between font-bold"><span>Acknowledgements</span><span>iv</span></div>
                          <div className="flex justify-between font-bold"><span>Abstract</span><span>v</span></div>
                          <div className="flex justify-between font-bold"><span>Table of Contents</span><span>vi</span></div>
                          
                          <div className="flex justify-between font-bold mt-2"><span>CHAPTER ONE: INTRODUCTION</span><span>1</span></div>
                          <div className="flex justify-between pl-4"><span>1.1 Background of the Study</span><span>1</span></div>
                          <div className="flex justify-between pl-4"><span>1.2 Statement of the Problem</span><span>4</span></div>
                          <div className="flex justify-between pl-4"><span>1.3 Objectives of the Study</span><span>5</span></div>
                          <div className="flex justify-between pl-4"><span>1.4 Research Questions</span><span>6</span></div>
                          <div className="flex justify-between pl-4"><span>1.5 Research Hypotheses</span><span>7</span></div>
                          <div className="flex justify-between pl-4"><span>1.6 Significance of the Study</span><span>8</span></div>
                          <div className="flex justify-between pl-4"><span>1.7 Scope and Delimitation of the Study</span><span>9</span></div>
                          <div className="flex justify-between pl-4"><span>1.8 Operational Definition of Terms</span><span>10</span></div>

                          <div className="flex justify-between font-bold mt-2"><span>CHAPTER TWO: LITERATURE REVIEW</span><span>12</span></div>
                          <div className="flex justify-between pl-4"><span>2.1 Conceptual Framework</span><span>12</span></div>
                          <div className="flex justify-between pl-4"><span>2.2 Theoretical Framework</span><span>22</span></div>
                          <div className="flex justify-between pl-4"><span>2.3 Empirical Literature Review</span><span>28</span></div>

                          <div className="flex justify-between font-bold mt-2"><span>CHAPTER THREE: RESEARCH METHODOLOGY</span><span>35</span></div>
                          <div className="flex justify-between pl-4"><span>3.1 Research Design</span><span>35</span></div>
                          <div className="flex justify-between pl-4"><span>3.2 Population of the Study</span><span>36</span></div>
                          <div className="flex justify-between pl-4"><span>3.3 Sample Size and Sampling Techniques</span><span>37</span></div>
                          <div className="flex justify-between pl-4"><span>3.4 Instrument for Data Collection</span><span>38</span></div>
                          <div className="flex justify-between pl-4"><span>3.5 Method of Data Analysis</span><span>40</span></div>

                          <div className="flex justify-between font-bold mt-2"><span>CHAPTER FOUR: DATA ANALYSIS & DISCUSSION</span><span>42</span></div>
                          <div className="flex justify-between font-bold mt-2"><span>CHAPTER FIVE: SUMMARY, CONCLUSION & RECOMM.</span><span>48</span></div>
                        </div>
                      </div>
                    )}

                    {previewTab === 'chapter1' && (
                      <div className="text-zinc-900 font-serif space-y-6 text-xs text-justify" style={{ fontSize: `${previewZoom / 100}em` }}>
                        <div className="text-center font-bold">
                          <h3>CHAPTER ONE</h3>
                          <h3>INTRODUCTION</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-bold">1.1 Background of the Study</h4>
                          <p style={{ textIndent: '2rem' }} className="leading-relaxed">{generateProjectPreview(topic.title, topic.department, topic.level).background}</p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-bold">1.2 Statement of the Problem</h4>
                          <p style={{ textIndent: '2rem' }} className="leading-relaxed">{generateProjectPreview(topic.title, topic.department, topic.level).problem}</p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-bold">1.3 Objectives of the Study</h4>
                          <p>The main objective of this study is to examine the implications and impact of {getCleanTitle(topic.title)} in Nigeria. Specifically, the study aims to:</p>
                          <ul className="list-decimal pl-6 space-y-1">
                            <li>Assess the current level of implementation and awareness of {generateProjectPreview(topic.title, topic.department, topic.level).varA} in {generateProjectPreview(topic.title, topic.department, topic.level).caseStudy}.</li>
                            <li>Evaluate the main socio-economic challenges hindering optimal performance of these parameters.</li>
                            <li>Determine the statistical relationship between {generateProjectPreview(topic.title, topic.department, topic.level).varA} and {generateProjectPreview(topic.title, topic.department, topic.level).varB} in the target sector.</li>
                            <li>Offer strategic recommendations to policy makers and academic researchers.</li>
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-bold">1.4 Research Questions</h4>
                          <p>To guide this investigation, the following research questions have been formulated:</p>
                          <ul className="list-disc pl-6 space-y-1">
                            <li>What is the current level of implementation and awareness of {generateProjectPreview(topic.title, topic.department, topic.level).varA} in {generateProjectPreview(topic.title, topic.department, topic.level).caseStudy}?</li>
                            <li>What are the primary challenges affecting the optimal integration of {generateProjectPreview(topic.title, topic.department, topic.level).varA}?</li>
                            <li>Is there any significant relationship between {generateProjectPreview(topic.title, topic.department, topic.level).varA} and {generateProjectPreview(topic.title, topic.department, topic.level).varB}?</li>
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-bold">1.5 Research Hypotheses</h4>
                          <p className="italic">Hypothesis One:</p>
                          <p className="pl-4"><strong>H0:</strong> There is no significant relationship between the implementation of {generateProjectPreview(topic.title, topic.department, topic.level).varA} and the performance of {generateProjectPreview(topic.title, topic.department, topic.level).varB} in {generateProjectPreview(topic.title, topic.department, topic.level).caseStudy}.</p>
                          <p className="pl-4"><strong>H1:</strong> There is a significant relationship between the implementation of {generateProjectPreview(topic.title, topic.department, topic.level).varA} and the performance of {generateProjectPreview(topic.title, topic.department, topic.level).varB} in {generateProjectPreview(topic.title, topic.department, topic.level).caseStudy}.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-theme/50 flex flex-col md:flex-row justify-between items-center gap-4 bg-secondary/20">
              <div className="text-left">
                <span className="block text-[11px] font-bold text-secondary uppercase">Project Scope details</span>
                <span className="text-xs text-primary font-bold">{topic.pages || 50} pages • Chapters 1-5 complete (MS Word & PDF format)</span>
              </div>
              <button 
                onClick={() => { setOpenPreview(false); pay(); }} 
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
              >
                💳 Purchase Complete Material — {naira(topic.price)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
