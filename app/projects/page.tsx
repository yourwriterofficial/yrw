'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';

type Topic = {
  id: number;
  title: string;
  department: string;
  description: string | null;
  pages: number | null;
  chapters: string | null;
  format: string | null;
  year: number | null;
  price: number;
};

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

export default function ProjectsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('all');
  const [preview, setPreview] = useState<Topic | null>(null);
  const [buying, setBuying] = useState<number | 'custom' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      const { data } = await supabase
        .from('project_topics')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setTopics((data as Topic[]) || []);
      setLoading(false);
    })();
  }, []);

  const departments = useMemo(() => Array.from(new Set(topics.map(t => t.department))).sort(), [topics]);

  const filtered = useMemo(() => {
    let list = topics;
    if (dept !== 'all') list = list.filter(t => t.department === dept);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [topics, dept, search]);

  const startCheckout = async (payload: { topicId?: number; customTitle?: string; department?: string }, busyKey: number | 'custom') => {
    setMsg('');
    if (isLoggedIn === false) {
      // Pay-first requires a logged-in user
      router.push('/login?next=/projects');
      return;
    }
    setBuying(busyKey);
    try {
      const res = await fetch('/api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) { router.push('/login?next=/projects'); return; }
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setMsg(data.error || 'Could not start checkout. Please try again.');
      }
    } catch {
      setMsg('Network error. Please try again.');
    }
    setBuying(null);
  };

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter']">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white">
        <div className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-white/[0.03]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 py-14">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Project Topics & Research Materials</h1>
          <p className="text-sm md:text-base opacity-90 max-w-2xl mx-auto">
            Browse ready-made project materials across departments. Every purchase delivers
            <strong> Chapters 4 &amp; 5</strong> (data analysis &amp; findings) — instantly to your secure vault.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-5 text-xs font-bold">
            <span className="bg-white/15 px-4 py-1.5 rounded-full">📄 {topics.length} Topics</span>
            <span className="bg-white/15 px-4 py-1.5 rounded-full">🏛️ {departments.length} Departments</span>
            <span className="bg-amber-400 text-emerald-950 px-4 py-1.5 rounded-full">💰 {naira(3000)} each</span>
            <span className="bg-white/15 px-4 py-1.5 rounded-full">📖 Chapters 4 &amp; 5 only</span>
          </div>
        </div>
      </section>

      {/* TOOLBAR */}
      <div className="sticky top-0 z-40 bg-secondary/90 backdrop-blur border-b border-theme px-4 md:px-6 py-3 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <lucide.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topics, keywords, or departments..."
            className="w-full bg-card border border-theme rounded-full pl-11 pr-4 py-2.5 text-sm text-primary outline-none focus:border-emerald-500"
          />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="bg-card border border-theme rounded-full px-4 py-2.5 text-sm text-primary outline-none focus:border-emerald-500 min-w-[170px]">
          <option value="all">📂 All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-xs text-secondary font-bold whitespace-nowrap">{filtered.length} topic{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="max-w-[1320px] mx-auto flex">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-theme bg-secondary/40 py-5 sticky top-[57px] self-start max-h-[calc(100vh-57px)] overflow-y-auto">
          <div className="text-[11px] font-black uppercase tracking-wider text-secondary px-5 pb-3">📋 Departments</div>
          <ul>
            <li>
              <button onClick={() => setDept('all')} className={`w-full text-left px-5 py-2.5 text-sm font-bold border-l-[3px] transition ${dept === 'all' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-transparent text-secondary hover:text-primary hover:bg-white/5'}`}>
                All Topics <span className="float-right text-xs bg-card px-2 py-0.5 rounded-full">{topics.length}</span>
              </button>
            </li>
            {departments.map(d => {
              const count = topics.filter(t => t.department === d).length;
              return (
                <li key={d}>
                  <button onClick={() => setDept(d)} className={`w-full text-left px-5 py-2.5 text-sm font-bold border-l-[3px] transition truncate ${dept === d ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-transparent text-secondary hover:text-primary hover:bg-white/5'}`}>
                    {d} <span className="float-right text-xs bg-card px-2 py-0.5 rounded-full">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6">
          {/* Custom request banner */}
          <div className="mb-6 bg-card border border-theme rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-black text-primary">Can't find your topic?</p>
              <p className="text-xs text-secondary">Type it below — we'll prepare <strong>Chapters 4 &amp; 5</strong> for {naira(3000)}.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Your project topic..." className="flex-1 md:w-72 bg-secondary border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500" />
              <button
                onClick={() => { if (customTitle.trim().length < 5) { setMsg('Please enter a fuller topic title.'); return; } startCheckout({ customTitle: customTitle.trim() }, 'custom'); }}
                disabled={buying === 'custom'}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider px-4 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
              >
                {buying === 'custom' ? '…' : `Get for ${naira(3000)}`}
              </button>
            </div>
          </div>

          {msg && <div className="mb-4 text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

          {loading ? (
            <div className="py-20 text-center text-secondary text-sm flex items-center justify-center gap-2"><lucide.Loader2 className="w-4 h-4 animate-spin" /> Loading topics…</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-secondary">
              <div className="text-5xl mb-3">🔎</div>
              <h3 className="text-lg font-bold text-primary">No topics found</h3>
              <p className="text-sm">Try a different search or department — or request your topic above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(t => (
                <div key={t.id} className="bg-card border border-theme rounded-2xl p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:shadow-lg transition">
                  <span className="self-start text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.department}</span>
                  <h3 className="text-sm font-bold leading-snug text-primary line-clamp-3">{t.title}</h3>
                  <div className="flex gap-3 flex-wrap text-[11px] text-secondary">
                    <span>📄 {t.pages || '—'} pages</span>
                    <span>📖 Ch. {t.chapters || '4-5'}</span>
                    <span>📅 {t.year || '—'}</span>
                  </div>
                  <div className="flex gap-2 mt-auto pt-1">
                    <button onClick={() => setPreview(t)} className="flex-1 py-2 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition">👁 Preview</button>
                    <button onClick={() => startCheckout({ topicId: t.id }, t.id)} disabled={buying === t.id} className="flex-1 py-2 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-emerald-950 transition disabled:opacity-50">
                      {buying === t.id ? '…' : `Get · ${naira(t.price)}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* PREVIEW MODAL */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-card border border-theme rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{preview.department}</span>
                <button onClick={() => setPreview(null)} className="text-secondary hover:text-primary"><lucide.X className="w-5 h-5" /></button>
              </div>
              <h2 className="text-lg font-black text-primary leading-snug mb-3">{preview.title}</h2>
              <p className="text-sm text-secondary leading-relaxed mb-4">{preview.description}</p>
              <div className="grid grid-cols-2 gap-3 bg-secondary border border-theme rounded-xl p-4 mb-4 text-sm">
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Pages</span>{preview.pages || '—'}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Chapters</span>{preview.chapters || '4-5'} only</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Format</span>{preview.format}</div>
                <div><span className="block text-[10px] uppercase text-secondary font-bold">Year</span>{preview.year || '—'}</div>
              </div>
              <div className="bg-amber-400/10 border border-amber-400/30 text-amber-600 dark:text-amber-400 rounded-xl p-3 text-xs font-bold mb-4">
                ⚠ This material covers <strong>Chapters 4 &amp; 5 only</strong> (data analysis, results & discussion).
              </div>
              <button onClick={() => { const p = preview; setPreview(null); startCheckout({ topicId: p.id }, p.id); }} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black transition">
                💳 Get Complete Material — {naira(preview.price)}
              </button>
              {isLoggedIn === false && <p className="text-[11px] text-secondary text-center mt-2">You'll be asked to log in first — payment is required before your order is created.</p>}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-theme py-8 text-center text-xs text-secondary">
        <p>© {new Date().getFullYear()} YourResearchWriter · <Link href="/" className="text-emerald-500 hover:underline">Home</Link></p>
      </footer>
    </div>
  );
}
