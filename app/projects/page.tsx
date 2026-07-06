'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import ProjectsAssistant from '@/app/components/ProjectsAssistant';

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
type Addon = { id: number; name: string; description: string | null; price: number };
type Cart = { topicId?: number; customTitle?: string; department?: string; level: string; title: string; basePrice: number };

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const LEVEL_PRICE: Record<string, number> = { BSc: 3999, MSc: 4500, PhD: 10000 };
const PAGE_SIZE = 48;

const levelBadge = (lvl: string) =>
  lvl === 'PhD' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    : lvl === 'MSc' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

export default function ProjectsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [depts, setDepts] = useState<{ department: string; count: number }[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dept, setDept] = useState('all');
  const [level, setLevel] = useState('all');

  const [preview, setPreview] = useState<Topic | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<number>>(new Set());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customLevel, setCustomLevel] = useState('BSc');
  const [customCard, setCustomCard] = useState<{ title: string; level: string } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      const [{ data: d }, { data: a }] = await Promise.all([
        supabase.from('project_topic_departments').select('*'),
        supabase.from('project_addons').select('id, name, description, price').eq('is_active', true).order('sort_order'),
      ]);
      setDepts((d as any[]) || []);
      setAddons((a as Addon[]) || []);
    })();
  }, []);

  // debounce search
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(t); }, [search]);

  const fetchTopics = useCallback(async (reset: boolean) => {
    const from = reset ? 0 : page * PAGE_SIZE;
    let q = supabase.from('project_topics').select('*', { count: 'exact' }).eq('is_active', true);
    if (dept !== 'all') q = q.eq('department', dept);
    if (level !== 'all') q = q.eq('level', level);
    if (debounced.trim()) q = q.ilike('title', `%${debounced.trim()}%`);
    q = q.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    const { data, count } = await q;
    if (reset) { setTopics((data as Topic[]) || []); setPage(1); }
    else { setTopics(prev => [...prev, ...((data as Topic[]) || [])]); setPage(p => p + 1); }
    setTotal(count || 0);
  }, [dept, level, debounced, page]);

  useEffect(() => { setLoading(true); fetchTopics(true).finally(() => setLoading(false)); /* eslint-disable-next-line */ }, [dept, level, debounced]);

  const loadMore = async () => { setLoadingMore(true); await fetchTopics(false); setLoadingMore(false); };

  // ---- checkout ----
  const openCart = (c: Cart) => {
    if (isLoggedIn === false) { router.push('/login?next=/projects'); return; }
    setPreview(null);
    setSelectedAddons(new Set());
    setAcceptedTerms(false);
    setMsg('');
    setCart(c);
  };

  const cartTotal = () => {
    if (!cart) return 0;
    let t = cart.basePrice;
    addons.forEach(a => { if (selectedAddons.has(a.id)) t += Number(a.price); });
    return Math.round(t);
  };

  const pay = async () => {
    if (!cart || !acceptedTerms) return;
    setBusy(true);
    try {
      const res = await fetch('/api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: cart.topicId,
          customTitle: cart.customTitle,
          department: cart.department,
          level: cart.level,
          addonIds: Array.from(selectedAddons),
        }),
      });
      const data = await res.json();
      if (res.status === 401) { router.push('/login?next=/projects'); return; }
      if (res.ok && data.authorization_url) window.location.href = data.authorization_url;
      else setMsg(data.error || 'Could not start checkout.');
    } catch { setMsg('Network error. Please try again.'); }
    setBusy(false);
  };

  const checkCustomAvailability = () => {
    if (customTitle.trim().length < 5) { setMsg('Please enter a fuller topic title.'); return; }
    setMsg('');
    setCustomCard({ title: customTitle.trim(), level: customLevel });
  };

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter']">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white">
        <div className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-white/[0.03]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 py-12">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Project Topics & Research Materials</h1>
          <p className="text-sm md:text-base opacity-90 max-w-2xl mx-auto">
            Thousands of ready-made materials across every Nigerian department — <strong>full Chapters 1–5</strong>,
            in <strong>MS Word</strong>, delivered to your secure vault.
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-5 text-xs font-bold">
            <span className="bg-white/15 px-4 py-1.5 rounded-full">📖 Chapters 1–5</span>
            <span className="bg-white/15 px-4 py-1.5 rounded-full">🕗 Working hours 8am–7pm</span>
            <span className="bg-amber-400 text-emerald-950 px-4 py-1.5 rounded-full">⚡ 4-hour delivery</span>
            <span className="bg-white/15 px-4 py-1.5 rounded-full">BSc {naira(3999)} · MSc {naira(4500)} · PhD {naira(10000)}</span>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <div className="bg-amber-400/10 border-b border-amber-400/30 px-4 md:px-6 py-3">
        <div className="max-w-5xl mx-auto text-xs md:text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <lucide.AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>Please note:</strong> these are ready-made materials — we do <strong>not</strong> check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project <strong>will be delivered</strong> as-is.
            Need a <strong>plagiarism-free, AI-free</strong> custom write-up? {' '}
            <Link href="/order/academic" className="underline font-bold">Use our main writing service →</Link>
          </p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="sticky top-0 z-40 bg-secondary/90 backdrop-blur border-b border-theme px-4 md:px-6 py-3 flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <lucide.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search 3,000+ topics…" className="w-full bg-card border border-theme rounded-full pl-11 pr-4 py-2.5 text-sm text-primary outline-none focus:border-emerald-500" />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="bg-card border border-theme rounded-full px-4 py-2.5 text-sm text-primary outline-none focus:border-emerald-500 max-w-[200px]">
          <option value="all">📂 All Departments</option>
          {depts.map(d => <option key={d.department} value={d.department}>{d.department}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} className="bg-card border border-theme rounded-full px-4 py-2.5 text-sm text-primary outline-none focus:border-emerald-500">
          <option value="all">🎓 All Levels</option>
          <option value="BSc">BSc / HND</option>
          <option value="MSc">MSc / PGD</option>
          <option value="PhD">PhD</option>
        </select>
        <span className="text-xs text-secondary font-bold whitespace-nowrap">{total.toLocaleString()} found</span>
      </div>

      <div className="max-w-[1320px] mx-auto flex">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-theme bg-secondary/40 py-5 sticky top-[57px] self-start max-h-[calc(100vh-57px)] overflow-y-auto">
          <div className="text-[11px] font-black uppercase tracking-wider text-secondary px-5 pb-3">📋 Departments</div>
          <ul>
            <li><button onClick={() => setDept('all')} className={`w-full text-left px-5 py-2 text-sm font-bold border-l-[3px] transition ${dept === 'all' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-transparent text-secondary hover:text-primary hover:bg-white/5'}`}>All Topics</button></li>
            {depts.map(d => (
              <li key={d.department}>
                <button onClick={() => setDept(d.department)} className={`w-full text-left px-5 py-2 text-sm font-bold border-l-[3px] transition truncate ${dept === d.department ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-transparent text-secondary hover:text-primary hover:bg-white/5'}`}>
                  {d.department} <span className="float-right text-xs bg-card px-2 py-0.5 rounded-full">{d.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6">
          {/* Custom request */}
          <div className="mb-6 bg-card border border-theme rounded-2xl p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-black text-primary">Can't find your topic? Check availability instantly.</p>
                <p className="text-xs text-secondary">Type any topic — we prepare full <strong>Chapters 1–5</strong> at your level's rate.</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Your project topic…" className="flex-1 md:w-64 bg-secondary border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500" />
                <select value={customLevel} onChange={e => setCustomLevel(e.target.value)} className="bg-secondary border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none">
                  <option value="BSc">BSc</option><option value="MSc">MSc</option><option value="PhD">PhD</option>
                </select>
                <button onClick={checkCustomAvailability} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider px-4 rounded-xl transition whitespace-nowrap">Check Availability</button>
              </div>
            </div>
            {customCard && (
              <div className="mt-4 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 animate-in fade-in">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-black">✓ Available</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(customCard.level)}`}>{customCard.level}</span>
                  </div>
                  <p className="text-sm font-bold text-primary">{customCard.title}</p>
                  <p className="text-[11px] text-secondary">Chapters 1–5 · MS Word · 2026 · {naira(LEVEL_PRICE[customCard.level])}</p>
                </div>
                <button onClick={() => openCart({ customTitle: customCard.title, level: customCard.level, title: customCard.title, basePrice: LEVEL_PRICE[customCard.level] })} className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition whitespace-nowrap">Get · {naira(LEVEL_PRICE[customCard.level])}</button>
              </div>
            )}
          </div>

          {msg && !cart && <div className="mb-4 text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

          {loading ? (
            <div className="py-20 text-center text-secondary text-sm flex items-center justify-center gap-2"><lucide.Loader2 className="w-4 h-4 animate-spin" /> Loading topics…</div>
          ) : topics.length === 0 ? (
            <div className="py-20 text-center text-secondary">
              <div className="text-5xl mb-3">🔎</div>
              <h3 className="text-lg font-bold text-primary">No topics found</h3>
              <p className="text-sm">Try a different search — or check availability of your own topic above.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {topics.map(t => (
                  <div key={t.id} className="bg-card border border-theme rounded-2xl p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:shadow-lg transition">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.department}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(t.level)}`}>{t.level}</span>
                    </div>
                    <h3 className="text-sm font-bold leading-snug text-primary line-clamp-3">{t.title}</h3>
                    <div className="flex gap-3 flex-wrap text-[11px] text-secondary">
                      <span>📄 {t.pages || '—'} pages</span><span>📖 Ch. {t.chapters}</span><span>📅 {t.year}</span><span>📝 {t.format}</span>
                    </div>
                    <div className="flex gap-2 mt-auto pt-1">
                      <button onClick={() => setPreview(t)} className="flex-1 py-2 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition">👁 Preview</button>
                      <button onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: Number(t.price) })} className="flex-1 py-2 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-emerald-950 transition">Get · {naira(t.price)}</button>
                    </div>
                  </div>
                ))}
              </div>
              {topics.length < total && (
                <div className="text-center mt-8">
                  <button onClick={loadMore} disabled={loadingMore} className="px-8 py-3 rounded-xl bg-secondary border border-theme text-primary font-bold text-sm hover:bg-white/5 transition disabled:opacity-50">
                    {loadingMore ? 'Loading…' : `Load more (${(total - topics.length).toLocaleString()} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* PREVIEW MODAL */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-card border border-theme rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{preview.department}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(preview.level)}`}>{preview.level}</span>
                </div>
                <button onClick={() => setPreview(null)} className="text-secondary hover:text-primary"><lucide.X className="w-5 h-5" /></button>
              </div>
              <h2 className="text-lg font-black text-primary leading-snug mb-3">{preview.title}</h2>
              <p className="text-sm text-secondary leading-relaxed mb-4">{preview.description}</p>
              <div className="grid grid-cols-2 gap-3 bg-secondary border border-theme rounded-xl p-4 mb-4 text-sm">
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Pages</span>{preview.pages || '—'}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Chapters</span>{preview.chapters}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Format</span>{preview.format}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Year</span>{preview.year}</div>
              </div>
              <button onClick={() => openCart({ topicId: preview.id, department: preview.department, level: preview.level, title: preview.title, basePrice: Number(preview.price) })} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black transition">
                💳 Get Complete Material — {naira(preview.price)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (add-ons + terms) */}
      {cart && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setCart(null)}>
          <div className="bg-card border border-theme rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-black text-primary">Complete Your Purchase</h2>
                <button onClick={() => setCart(null)} className="text-secondary hover:text-primary"><lucide.X className="w-5 h-5" /></button>
              </div>
              <div className="bg-secondary border border-theme rounded-xl p-4">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadge(cart.level)}`}>{cart.level}</span>
                <p className="text-sm font-bold text-primary mt-2">{cart.title}</p>
                <p className="text-[11px] text-secondary">Chapters 1–5 · MS Word · {naira(cart.basePrice)}</p>
              </div>

              {addons.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase font-black text-secondary mb-2">Optional Add-ons</p>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {addons.map(a => {
                      const on = selectedAddons.has(a.id);
                      return (
                        <button key={a.id} onClick={() => setSelectedAddons(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition ${on ? 'border-emerald-500 bg-emerald-500/5' : 'border-theme bg-secondary hover:bg-white/5'}`}>
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-theme'}`}>{on && <lucide.Check className="w-3 h-3 text-black" />}</div>
                          <div className="flex-1">
                            <div className="flex justify-between gap-2"><span className="text-sm font-bold text-primary">{a.name}</span><span className="text-xs font-black text-emerald-500 shrink-0">+{naira(a.price)}</span></div>
                            {a.description && <p className="text-[11px] text-secondary">{a.description}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-theme pt-3">
                <span className="text-sm font-bold text-secondary">Total</span>
                <span className="text-2xl font-black text-emerald-500">{naira(cartTotal())}</span>
              </div>

              <label className="flex items-start gap-2 cursor-pointer bg-secondary border border-theme rounded-xl p-3">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
                <span className="text-[11px] text-primary leading-relaxed">
                  I understand this is a <strong>ready-made</strong> material — similarity/plagiarism and AI-detection levels are <strong>not checked or guaranteed</strong>. My purchase means the project <strong>will be delivered</strong> (Chapters 1–5, MS Word) to my vault. Working hours are 8am–7pm; delivery is within 4 hours.
                </span>
              </label>

              {msg && <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

              <button onClick={pay} disabled={!acceptedTerms || busy} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black transition disabled:opacity-40 disabled:cursor-not-allowed">
                {busy ? 'Redirecting to payment…' : `Pay ${naira(cartTotal())} & Get Material`}
              </button>
              <p className="text-[10px] text-secondary text-center">Payment is required before your order is created — unpaid attempts are never saved.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-theme py-8 text-center text-xs text-secondary">
        <p>© {new Date().getFullYear()} YourResearchWriter · Working hours 8am–7pm · <Link href="/" className="text-emerald-500 hover:underline">Home</Link></p>
      </footer>

      <ProjectsAssistant />
    </div>
  );
}
