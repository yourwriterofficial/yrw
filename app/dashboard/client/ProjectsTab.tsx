'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

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

type Cart = {
  topicId?: number;
  customTitle?: string;
  department?: string;
  level: string;
  title: string;
  basePrice: number;
};

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const PAGE_SIZE = 15;

const NIGERIAN_DEPARTMENTS = [
  "Accountancy / Accounting",
  "Actuarial Science",
  "Adult Education",
  "Agricultural Economics",
  "Agricultural Engineering",
  "Agricultural Science",
  "Anatomy",
  "Animal Science",
  "Applied Biochemistry",
  "Applied Chemistry",
  "Architecture",
  "Banking and Finance",
  "Biochemistry",
  "Biological Sciences",
  "Botany",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Civil Law",
  "Common Law",
  "Computer Engineering",
  "Computer Science",
  "Cooperative and Rural Development",
  "Creative Arts",
  "Dentistry",
  "Economics",
  "Educational Management",
  "Electrical / Electronic Engineering",
  "English Language",
  "English and Literary Studies",
  "Estate Management",
  "Fine and Applied Arts",
  "Fisheries and Aquaculture",
  "Food Science and Technology",
  "Forestry and Wildlife Management",
  "Geography",
  "Geology",
  "Guidance and Counseling",
  "History and International Studies",
  "Industrial Chemistry",
  "Industrial Relations and Personnel Management",
  "Insurance",
  "International Relations",
  "Library and Information Science",
  "Linguistics",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Medical Laboratory Science",
  "Medicine and Surgery",
  "Microbiology",
  "Music",
  "Nursing Science",
  "Optometry",
  "Petroleum Engineering",
  "Pharmacy",
  "Philosophy",
  "Physics",
  "Physiology",
  "Political Science",
  "Public Administration",
  "Public Health",
  "Quantity Surveying",
  "Radiography",
  "Religious Studies",
  "Sociology",
  "Statistics",
  "Surveying and Geoinformatics",
  "Theatre Arts",
  "Urban and Regional Planning",
  "Veterinary Medicine",
  "Zoology"
];

export default function ProjectsTab({ user }: { user: any }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Availability Search states
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSearchDept, setSelectedSearchDept] = useState('all');
  const [selectedSearchLevel, setSelectedSearchLevel] = useState('all');

  // General Filter Catalog states
  const [dept, setDept] = useState('all');
  const [level, setLevel] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Cart / Checkout Modal
  const [cart, setCart] = useState<Cart | null>(null);
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<number>>(new Set());
  const [addonWords, setAddonWords] = useState<Record<number, number>>({});
  const [addonFeatures, setAddonFeatures] = useState<Record<number, string[]>>({});
  const [customLocation, setCustomLocation] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Preview Modal
  const [previewTopic, setPreviewTopic] = useState<Topic | null>(null);

  // Settings loaded from DB
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ OND: 4999, HND: 5999, BSc: 5999, MSc: 4500, PhD: 10000 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAddons();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('project_settings').select('*');
    if (data) {
      let lp = { OND: 4999, HND: 5999, BSc: 5999, MSc: 4500, PhD: 10000 };
      let dp = {};
      data.forEach(s => {
        if (s.key === 'level_prices') lp = s.value;
        if (s.key === 'department_prices') dp = s.value;
      });
      setLevelPrices(lp);
      setDeptPrices(dp);
    }
  };

  const getTopicPrice = (lvl: string, deptName: string) => {
    const deptPrice = deptPrices[deptName];
    if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
    return levelPrices[lvl] || levelPrices.BSc || 3999;
  };

  const fetchTopics = useCallback(async (searchQuery?: string, selectedDept?: string, selectedLvl?: string) => {
    setLoading(true);
    try {
      let q = supabase
        .from('project_topics')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      const activeSearch = searchQuery !== undefined ? searchQuery : search;
      const activeDept = selectedDept !== undefined ? selectedDept : dept;
      const activeLvl = selectedLvl !== undefined ? selectedLvl : level;

      if (activeSearch.trim()) {
        q = q.ilike('title', `%${activeSearch.trim()}%`);
      }
      if (activeDept !== 'all') {
        q = q.eq('department', activeDept);
      }
      if (activeLvl !== 'all') {
        q = q.eq('level', activeLvl);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await q
        .order('title', { ascending: true })
        .range(from, to);

      if (error) throw error;
      setTopics(data || []);
      setTotal(count || 0);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to load project topics', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, dept, level, search]);

  useEffect(() => {
    if (!isSearching) {
      fetchTopics();
    }
  }, [page, dept, level]);

  const executeAvailabilitySearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setMsg('');

    // Simulated scanning delay for premium UI feel
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      setPage(1);
      setDept(selectedSearchDept);
      setLevel(selectedSearchLevel);
      setHasSearched(true);
      await fetchTopics(search, selectedSearchDept, selectedSearchLevel);
    } catch (err: any) {
      console.error(err);
      setMsg('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setHasSearched(false);
    setSearch('');
    setSelectedSearchDept('all');
    setSelectedSearchLevel('all');
    setDept('all');
    setLevel('all');
    setPage(1);
    fetchTopics('', 'all', 'all');
  };

  const fetchAddons = async () => {
    const { data } = await supabase.from('project_addons').select('*').order('price');
    if (data) setAvailableAddons(data);
  };

  const openCart = (item: Cart) => {
    setCart(item);
    setSelectedAddons(new Set());
    setAddonWords({});
    setAddonFeatures({});
    setCustomLocation('');
    setAcceptedTerms(false);
    setMsg('');
  };

  const handleAddonChange = (addonId: number) => {
    const next = new Set(selectedAddons);
    if (next.has(addonId)) {
      next.delete(addonId);
    } else {
      next.add(addonId);
    }
    setSelectedAddons(next);
  };

  const cartTotal = () => {
    if (!cart) return 0;
    let t = cart.basePrice;
    availableAddons.forEach(a => {
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

  const checkout = async () => {
    if (!cart || !acceptedTerms) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: cart.topicId,
          customTitle: cart.customTitle,
          department: cart.department || 'General',
          level: cart.level,
          addonIds: Array.from(selectedAddons),
          addonWords,
          addonFeatures,
          customLocation,
        }),
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else if (res.ok && data.paid_via_wallet) {
        showToast('Purchase completed instantly using your wallet balance!', 'success');
        setCart(null);
        window.location.href = '/dashboard/client?tab=vault';
      } else {
        setMsg(data.error || 'Could not initiate checkout.');
      }
    } catch {
      setMsg('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HERO BANNER IN THE CLIENT TAB */}
      <section className="relative overflow-hidden glass-panel rounded-3xl border border-theme">
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-[0.08] blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
        />
        <div className="relative z-10 text-center px-6 py-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-primary">Buy Already-Made Projects</h2>
          <p className="text-xs md:text-sm text-secondary max-w-2xl mx-auto leading-relaxed">
            Browse, search, and instantly buy completed research projects covering Chapters 1–5.
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-4 text-[10px] font-semibold">
            <span className="border border-theme bg-secondary/60 text-secondary px-3 py-1 rounded-full">📖 Chapters 1–5</span>
            <span className="border border-theme bg-secondary/60 text-secondary px-3 py-1 rounded-full">🕗 Working hours 8am–7pm</span>
            <span className="border border-theme bg-secondary/60 text-secondary px-3 py-1 rounded-full">🇳🇬 Nigerian University Standard</span>
            <span className="border border-theme bg-secondary/60 text-secondary px-3 py-1 rounded-full">⚡ Less than 7 Hours Delivery</span>
            <span className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full">
              OND {naira(levelPrices.OND)} · HND {naira(levelPrices.HND)} · BSc {naira(levelPrices.BSc)} · MSc {naira(levelPrices.MSc)} · PhD {naira(levelPrices.PhD)}
            </span>
          </div>

          {/* AVAILABILITY SEARCH INTERFACE */}
          {!hasSearched && !isSearching ? (
            <div className="max-w-2xl mx-auto mt-8 text-left">
              <Card elevation={2} padding="lg" className="space-y-5 text-center">
                <div>
                  <h3 className="text-lg font-black text-primary">Database Search & Availability</h3>
                  <p className="text-xs text-secondary mt-1 leading-relaxed font-semibold">
                    Place your full project topic below to search our database of 100,000+ completed projects and check instant availability.
                  </p>
                </div>

                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-[9px] uppercase font-black text-secondary ml-1 block mb-1">Your Full Project Topic *</label>
                    <textarea
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="e.g. Challenges and prospects of financial autonomy to local government administration..."
                      rows={3}
                      className="w-full bg-secondary border border-theme rounded-xl p-4 text-xs text-primary focus:border-emerald-500 outline-none transition font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase font-black text-secondary ml-1 block mb-1">Department</label>
                      <select
                        value={selectedSearchDept}
                        onChange={e => setSelectedSearchDept(e.target.value)}
                        className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary outline-none focus:border-emerald-500 font-bold cursor-pointer"
                      >
                        <option value="all">📂 All Departments</option>
                        {NIGERIAN_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-secondary ml-1 block mb-1">Academic Level</label>
                      <select
                        value={selectedSearchLevel}
                        onChange={e => setSelectedSearchLevel(e.target.value)}
                        className="w-full bg-secondary border border-theme rounded-xl p-3 text-xs text-primary outline-none focus:border-emerald-500 font-bold cursor-pointer"
                      >
                        <option value="all">🎓 All Levels</option>
                        <option value="OND">OND</option>
                        <option value="HND">HND</option>
                        <option value="BSc">BSc</option>
                        <option value="MSc">MSc / PGD</option>
                        <option value="PhD">PhD</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={executeAvailabilitySearch}
                    disabled={!search.trim()}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-widest rounded-xl transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    Check Availability & Retrieve Material
                  </button>
                </div>
              </Card>
            </div>
          ) : isSearching ? (
            <div className="max-w-md mx-auto mt-8 text-center">
              <Card elevation={2} padding="lg" className="space-y-4">
                <div className="relative w-12 h-12 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary">Scanning Project Database...</h3>
                  <p className="text-[10px] text-secondary mt-1">Checking chapters, tables, and references availability for your topic.</p>
                </div>
              </Card>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto mt-8 text-left">
              <Card elevation={2} padding="md" className="flex justify-between items-center gap-4">
                <div>
                  <h3 className="text-xs font-bold text-primary">Search Results</h3>
                  <p className="text-[10px] text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                </div>
                <Button variant="secondary" size="sm" icon={<lucide.Search className="w-3.5 h-3.5" />} onClick={resetSearch}>
                  Search Another Topic
                </Button>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* SEARCH RESULTS OR BROWSE LIST */}
      {loading ? (
        <div className="py-12 text-center text-sm text-secondary flex items-center justify-center gap-2">
          <lucide.Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Scanning database...
        </div>
      ) : hasSearched && topics.length === 0 ? (
        /* NO RESULTS - CUSTOM WRITEUP CARD */
        <div className="max-w-2xl mx-auto bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8 space-y-6 text-center shadow-xl">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <lucide.CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-lg font-black text-primary">Custom write-up available!</h4>
            <p className="text-xs text-secondary mt-1.5 leading-relaxed max-w-md mx-auto font-semibold">
              Our writers can prepare this topic for you as an original custom project with complete Chapters 1–5, structured layout, and references.
            </p>
          </div>

          <div className="bg-card border border-theme p-6 rounded-2xl text-left space-y-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-black">✓ Available</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-theme text-primary">{selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-purple-400">{selectedSearchDept === 'all' ? 'General' : selectedSearchDept}</span>
            </div>
            <p className="text-xs font-bold text-primary leading-normal">{search}</p>
            <div className="border-t border-theme/40 pt-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-secondary uppercase font-black block">Standard Cost</span>
                <span className="text-sm font-mono font-bold text-emerald-500">{naira(getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept))}</span>
              </div>
              <button
                onClick={() => openCart({
                  customTitle: search.trim(),
                  level: selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel,
                  department: selectedSearchDept === 'all' ? 'General' : selectedSearchDept,
                  title: search.trim(),
                  basePrice: getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept)
                })}
                className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition cursor-pointer"
              >
                Order Custom Write-up
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* GENERAL BROWSE AND RESULTS CONTAINER */
        <div className="space-y-6">
          {!hasSearched && (
            <div className="border-b border-theme pb-2">
              <h3 className="text-lg font-black text-primary">Browse All Project Topics</h3>
              <p className="text-xs text-secondary mt-0.5">Select a topic from the directory or use the filters below.</p>
            </div>
          )}

          {/* FILTER BAR FOR DIRECTORY */}
          {!hasSearched && (
            <Card elevation={1} padding="sm" className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <lucide.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter browse catalog..."
                  className="w-full bg-secondary border border-theme rounded-xl pl-11 pr-4 py-2.5 text-xs text-primary outline-none focus:border-emerald-500 transition font-bold"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                <select
                  value={dept}
                  onChange={e => { setDept(e.target.value); setPage(1); }}
                  className="bg-secondary border border-theme rounded-xl px-4 py-2.5 text-xs text-primary font-bold outline-none focus:border-emerald-500 cursor-pointer flex-1 md:flex-none"
                >
                  <option value="all">📂 All Departments</option>
                  {NIGERIAN_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <select
                  value={level}
                  onChange={e => { setLevel(e.target.value); setPage(1); }}
                  className="bg-secondary border border-theme rounded-xl px-4 py-2.5 text-xs text-primary font-bold outline-none focus:border-emerald-500 cursor-pointer flex-1 md:flex-none"
                >
                  <option value="all">🎓 All Levels</option>
                  <option value="OND">OND</option>
                  <option value="HND">HND</option>
                  <option value="BSc">BSc</option>
                  <option value="MSc">MSc / PGD</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
            </Card>
          )}

          {/* CATALOG GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {topics.map(t => (
              <Card key={t.id} elevation={1} padding="md" interactive className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.department}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-theme text-primary">{t.level}</span>
                </div>
                <h3 className="text-sm font-bold leading-relaxed text-primary line-clamp-3">
                  {t.title}
                </h3>
                <div className="flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-secondary font-mono">
                  <span>📄 {t.pages || '—'} pages</span><span>📖 Ch. {t.chapters || '1–5'}</span><span>📅 {t.year || '2026'}</span><span>📝 {t.format || 'DOCX'}</span>
                </div>
                <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                  <button onClick={() => setPreviewTopic(t)} className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition min-w-[70px]">👁 Preview</button>
                  <button onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: getTopicPrice(t.level, t.department) })} className="flex-2 py-2.5 rounded-lg text-xs font-black bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] transition">Get · {naira(getTopicPrice(t.level, t.department))}</button>
                </div>
              </Card>
            ))}
          </div>

          {/* PAGINATION */}
          {Math.ceil(total / PAGE_SIZE) > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 rounded-xl bg-secondary border border-theme text-primary text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition"
              >
                ◀ Prev
              </button>
              <button
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 rounded-xl bg-secondary border border-theme text-primary text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition"
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* CHECKOUT DRAWER / MODAL */}
      {cart && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-primary h-screen border-l border-theme flex flex-col shadow-2xl animate-in slide-in-from-right duration-350">
            <header className="p-6 border-b border-theme flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Order Processing Pipeline</span>
                <h3 className="text-lg font-black text-primary mt-1">Configure Deliverable</h3>
              </div>
              <button onClick={() => setCart(null)} className="w-11 h-11 rounded-full bg-secondary hover:bg-white/5 text-primary flex items-center justify-center transition">
                <lucide.X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
              {/* Product Info */}
              <div className="bg-secondary/40 border border-theme rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase bg-emerald-500 text-black px-2 py-0.5 rounded">{cart.level}</span>
                  <span className="text-[9px] font-black uppercase border border-theme text-secondary px-2 py-0.5 rounded">{cart.department}</span>
                </div>
                <h4 className="text-sm font-bold text-primary leading-relaxed">{cart.title}</h4>
                <div className="text-[10px] text-secondary font-mono">Chapters 1 to 5 (Full Study Material)</div>
              </div>

              <Card elevation={1} padding="md" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success border border-success/20 shrink-0">
                  <lucide.Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary">Ready for instant delivery</div>
                  <p className="text-[10px] text-secondary mt-0.5">This is a completed material — no writer wait, delivered to your Secure Vault right after payment.</p>
                </div>
              </Card>

              {/* Add-ons */}
              {availableAddons.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-secondary">Enhance Project (Optional Add-ons)</h4>
                  <div className="space-y-2">
                    {availableAddons.map(a => {
                      const checked = selectedAddons.has(a.id);
                      return (
                        <div key={a.id} className={`border rounded-xl p-4 transition-all ${checked ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30' : 'bg-card border-theme hover:bg-white/5'}`}>
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleAddonChange(a.id)}
                              className="mt-1 accent-emerald-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex justify-between items-center cursor-pointer" onClick={() => handleAddonChange(a.id)}>
                                <span className="text-xs font-bold text-primary">{a.name}</span>
                                <span className="text-xs font-mono font-black text-emerald-500">
                                  {a.price_type === 'per_word' ? `₦${a.price}/word` : `+${naira(a.price)}`}
                                </span>
                              </div>
                              {a.description && <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">{a.description}</p>}
                              
                              {checked && (
                                <div className="mt-3 space-y-3 border-t border-theme/20 pt-3">
                                  {a.price_type === 'per_word' && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-secondary text-[11px]">Word count:</span>
                                      <input
                                        type="number"
                                        min={500}
                                        step={100}
                                        value={addonWords[a.id] || 1000}
                                        onChange={e => {
                                          const w = Math.max(100, Number(e.target.value) || 0);
                                          setAddonWords(prev => ({ ...prev, [a.id]: w }));
                                        }}
                                        className="w-20 bg-secondary border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500 font-mono text-center font-bold"
                                      />
                                      <span className="text-emerald-500 font-bold ml-1">
                                        ➔ {naira((addonWords[a.id] || 1000) * a.price)}
                                      </span>
                                    </div>
                                  )}

                                  {a.is_location_changer && (
                                    <div className="space-y-1 text-xs">
                                      <label className="text-[9px] font-black uppercase tracking-wider text-secondary block">Specify Case Study Location/Region *</label>
                                      <input
                                        value={customLocation}
                                        onChange={e => setCustomLocation(e.target.value)}
                                        placeholder="e.g. Kaduna State, First Bank Nigeria Plc..."
                                        className="w-full bg-secondary border border-theme rounded-lg px-3 py-2 text-xs text-primary outline-none focus:border-emerald-500 font-bold"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings and Terms */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] text-secondary leading-relaxed bg-amber-400/5 border border-amber-400/15 p-3 rounded-xl flex gap-2">
                  <lucide.AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <p>
                    Ready-made files are delivered instantly or compiled within hours. Specific case-study adaptations might take up to 24 hours.
                  </p>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span className="text-[10px] text-secondary leading-relaxed font-bold">
                    I acknowledge that this is a study material purchase and will be delivered to my Secure Vault inside this dashboard.
                  </span>
                </label>
              </div>
            </div>

            <footer className="p-6 border-t border-theme bg-secondary/20 shrink-0 space-y-4">
              {msg && <div className="text-xs font-bold text-red-500 text-center">{msg}</div>}
              
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-secondary uppercase font-black block">Total Investment</span>
                  <span className="text-xl font-mono font-black text-emerald-400">{naira(cartTotal())}</span>
                </div>
                <button
                  onClick={checkout}
                  disabled={!acceptedTerms || busy}
                  className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-wider rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {busy ? (
                    <>
                      <lucide.Loader2 className="w-4 h-4 animate-spin" /> Starting Payment...
                    </>
                  ) : (
                    <>
                      Proceed to Pay <lucide.ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* PREVIEW TOPIC MODAL */}
      {previewTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-primary border border-theme rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <header className="p-5 border-b border-theme flex justify-between items-center">
              <h4 className="font-black text-sm text-primary">Topic Preview Details</h4>
              <button onClick={() => setPreviewTopic(null)} className="w-11 h-11 rounded-full bg-secondary hover:bg-white/5 text-primary flex items-center justify-center">
                <lucide.X className="w-4 h-4" />
              </button>
            </header>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full">{previewTopic.department}</span>
                <span className="text-[10px] font-black uppercase border border-theme text-primary px-2 py-0.5 rounded">{previewTopic.level}</span>
              </div>
              <h3 className="text-base font-bold text-primary leading-relaxed">{previewTopic.title}</h3>
              
              <div className="bg-secondary/40 border border-theme rounded-xl p-4 space-y-2">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-secondary">Document Scope</h5>
                <p className="text-xs text-primary leading-relaxed">
                  {previewTopic.description || 'Full research project covering Chapters 1 to 5, inclusive of abstract, introduction, literature review, methodology, data presentation/analysis, summary, conclusion, and detailed bibliography/references.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-secondary/30 p-3 rounded-lg border border-theme/40 text-center">
                  <div className="text-secondary text-[9px] uppercase font-black">Chapters</div>
                  <div className="text-primary font-bold mt-1">Ch. {previewTopic.chapters || '1–5'}</div>
                </div>
                <div className="bg-secondary/30 p-3 rounded-lg border border-theme/40 text-center">
                  <div className="text-secondary text-[9px] uppercase font-black">Format</div>
                  <div className="text-primary font-bold mt-1">{previewTopic.format || 'MS Word'}</div>
                </div>
              </div>
            </div>
            <footer className="p-4 bg-secondary/20 border-t border-theme flex justify-end gap-2">
              <button onClick={() => setPreviewTopic(null)} className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-white/5 text-primary rounded-xl transition">Close</button>
              <button
                onClick={() => {
                  const t = previewTopic;
                  setPreviewTopic(null);
                  openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: getTopicPrice(t.level, t.department) });
                }}
                className="px-4 py-2 text-xs font-black bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] rounded-xl transition"
              >
                Select Topic
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
