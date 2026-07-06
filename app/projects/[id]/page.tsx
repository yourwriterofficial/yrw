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

  // Fetch data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

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
    <div className="min-h-screen bg-primary text-primary font-['Inter'] pb-12 pt-20">
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
            <p className="text-[9px] text-secondary text-center leading-normal">Working hours are 8am–7pm. Material is delivered directly to your Secure Vault.</p>
          </div>
        </div>
      </div>

      <ProjectsAssistant />
    </div>
  );
}
