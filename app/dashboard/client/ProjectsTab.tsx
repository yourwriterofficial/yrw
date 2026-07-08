'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';

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

const IGBO_FIRST = ["Chidi", "Emeka", "Kelechi", "Uchenna", "Tochukwu", "Nonso", "Ejike", "Nnamdi", "Ngozi", "Chioma", "Chinyere", "Ifeoma", "Ogechi", "Uju", "Ezinne", "Nneka", "Chinedu", "Chika", "Ezenwa", "Obinna"];
const IGBO_LAST = ["Okeke", "Okafor", "Nwosu", "Okoye", "Nwachukwu", "Opara", "Diala", "Ezeugo", "Onuoha", "Eze", "Obi", "Okoro", "Chukwu"];
const YORUBA_FIRST = ["Olumide", "Babajide", "Tunde", "Segun", "Adebayo", "Femi", "Kunle", "Jide", "Kola", "Dayo", "Wale", "Damilola", "Temitope", "Gbolahan", "Yetunde", "Funmilayo"];
const YORUBA_LAST = ["Balogun", "Adebayo", "Ojo", "Alabi", "Babalola", "Awolowo", "Soyinka", "Adenuga", "Alakija", "Adeleke", "Abiola"];
const HAUSA_FIRST = ["Abdul", "Aminu", "Ibrahim", "Musa", "Yusuf", "Usman", "Amina", "Zainab", "Halima", "Fatimah", "Aisha", "Lawal"];
const HAUSA_LAST = ["Bello", "Ibrahim", "Abubakar", "Garba", "Usman", "Mohammed", "Dangote", "Danjuma", "Shagari"];
const ENGLISH_FIRST = ["Emmanuel", "Blessing", "Grace", "Victor", "Daniel", "Faith", "Miracle", "Precious", "David", "Samuel", "Joseph", "Esther"];

const pickWriter = (): string => {
  const roll = Math.random();
  if (roll < 0.33) {
    return `${IGBO_FIRST[Math.floor(Math.random() * IGBO_FIRST.length)]} ${IGBO_LAST[Math.floor(Math.random() * IGBO_LAST.length)]}`;
  } else if (roll < 0.66) {
    return `${YORUBA_FIRST[Math.floor(Math.random() * YORUBA_FIRST.length)]} ${YORUBA_LAST[Math.floor(Math.random() * YORUBA_LAST.length)]}`;
  } else if (roll < 0.90) {
    return `${HAUSA_FIRST[Math.floor(Math.random() * HAUSA_FIRST.length)]} ${HAUSA_LAST[Math.floor(Math.random() * HAUSA_LAST.length)]}`;
  } else {
    return `${ENGLISH_FIRST[Math.floor(Math.random() * ENGLISH_FIRST.length)]} ${IGBO_LAST[Math.floor(Math.random() * IGBO_LAST.length)]}`;
  }
};

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

  // Writer Assignment Simulation
  const [assignedWriter, setAssignedWriter] = useState<string | null>(null);
  const [assigningWriter, setAssigningWriter] = useState(false);
  const [writerStage, setWriterStage] = useState<'idle' | 'searching' | 'bidding' | 'done'>('idle');
  const [bidDetails, setBidDetails] = useState({ available: 0, bidding: 0 });

  // Preview Modal
  const [previewTopic, setPreviewTopic] = useState<Topic | null>(null);

  // Settings loaded from DB
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ BSc: 3, MSc: 4, PhD: 10 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAddons();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('project_settings').select('*');
    if (data) {
      let lp = { BSc: 3999, MSc: 4500, PhD: 10000 };
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
    setAssignedWriter(null);
    setWriterStage('idle');

    // Automatically trigger simulated writer search
    triggerWriterSimulation();
  };

  const triggerWriterSimulation = () => {
    setAssigningWriter(true);
    setWriterStage('searching');
    
    // Step 1: Searching for 1.6s
    setTimeout(() => {
      const avail = Math.floor(12 + Math.random() * 10);
      const bid = Math.floor(5 + Math.random() * (avail - 6));
      setBidDetails({ available: avail, bidding: bid });
      setWriterStage('bidding');

      // Step 2: Bidding for 1.8s
      setTimeout(() => {
        const writer = pickWriter();
        setAssignedWriter(writer);
        setWriterStage('done');
        setAssigningWriter(false);
      }, 1800);

    }, 1600);
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
    if (!cart || !acceptedTerms || !assignedWriter) return;
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
          assignedWriter,
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
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white rounded-3xl shadow-lg border border-emerald-600/30">
        <div className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-white/[0.03]" />
        <div className="relative z-10 text-center px-6 py-12">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Buy Already-Made Projects</h2>
          <p className="text-xs md:text-sm opacity-90 max-w-2xl mx-auto leading-relaxed">
            Browse, search, and instantly buy completed research projects covering Chapters 1–5.
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-4 text-[10px] font-bold">
            <span className="bg-white/15 px-3 py-1 rounded-full">📖 Chapters 1–5</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">🕗 Working hours 8am–7pm</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">🇳🇬 Nigerian University Standard</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">⚡ Less than 7 Hours Delivery</span>
            <span className="bg-white/15 px-3 py-1 rounded-full">
              BSc ₦3,999 · MSc ₦4,999 · PhD ₦5,999
            </span>
          </div>

          {/* AVAILABILITY SEARCH INTERFACE */}
          {!hasSearched && !isSearching ? (
            <div className="max-w-2xl mx-auto mt-8 text-left">
              <div className="bg-card border border-theme rounded-3xl p-6 shadow-2xl space-y-5 text-center">
                <div>
                  <h3 className="text-lg font-black text-primary">Database Search & Availability</h3>
                  <p className="text-xs text-secondary mt-1 leading-relaxed font-semibold">
                    Place your full project topic below to search our database of 3,000+ completed projects and check instant availability.
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
                        <option value="BSc">BSc / HND</option>
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
              </div>
            </div>
          ) : isSearching ? (
            <div className="max-w-md mx-auto mt-8 py-8 text-center space-y-4 bg-card border border-theme rounded-3xl p-6 shadow-2xl">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-amber-500/20 border-b-amber-500 animate-spin [animation-direction:reverse]" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary">Scanning Project Database...</h3>
                <p className="text-[10px] text-secondary mt-1">Checking chapters, tables, and references availability for your topic.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto mt-8 bg-card border border-theme rounded-3xl p-5 shadow-2xl flex justify-between items-center gap-4 text-left">
              <div>
                <h3 className="text-xs font-bold text-primary">Search Results</h3>
                <p className="text-[10px] text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
              </div>
              <button 
                onClick={resetSearch}
                className="px-3.5 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <lucide.Search className="w-3.5 h-3.5" /> Search Another Topic
              </button>
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
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition cursor-pointer"
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
            <div className="bg-card border border-theme rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
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
                  <option value="BSc">BSc / HND</option>
                  <option value="MSc">MSc / PGD</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
            </div>
          )}

          {/* CATALOG GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {topics.map(t => (
              <div key={t.id} className="bg-card border border-theme rounded-2xl p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:shadow-lg transition">
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
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 w-fit">⚡ Instant Vault Delivery</span>
                <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                  <button onClick={() => setPreviewTopic(t)} className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-theme bg-secondary hover:bg-white/5 text-primary transition min-w-[70px]">👁 Preview</button>
                  <button onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: getTopicPrice(t.level, t.department) })} className="flex-2 py-2.5 rounded-lg text-xs font-black bg-amber-400 hover:bg-amber-300 text-emerald-950 transition">Get · {naira(getTopicPrice(t.level, t.department))}</button>
                </div>
              </div>
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
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Order Processing Pipeline</span>
                <h3 className="text-lg font-black text-primary mt-1">Configure Deliverable</h3>
              </div>
              <button onClick={() => setCart(null)} className="w-8 h-8 rounded-full bg-secondary hover:bg-white/5 text-primary flex items-center justify-center transition">
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

              {/* Writer Assignment Simulator Box */}
              <div className="bg-card border border-theme rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Writer Selection Status
                  </h4>
                  {assigningWriter && <lucide.Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
                </div>

                {writerStage === 'searching' && (
                  <div className="flex flex-col items-center py-4 space-y-3">
                    <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">Searching available writers...</div>
                  </div>
                )}

                {writerStage === 'bidding' && (
                  <div className="space-y-2 py-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-secondary">Writers Online:</span>
                      <span className="text-primary">{bidDetails.available} found</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-secondary">Active Bidders:</span>
                      <span className="text-amber-400">{bidDetails.bidding} bidding</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full w-2/3 animate-[pulse_1.5s_infinite]" />
                    </div>
                  </div>
                )}

                {writerStage === 'done' && assignedWriter && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-450 border border-emerald-500/30">
                      ✏️
                    </div>
                    <div>
                      <div className="text-[9px] text-secondary font-black uppercase tracking-widest">Assigned Specialist Writer</div>
                      <div className="text-sm font-black text-emerald-400">{assignedWriter}</div>
                      <p className="text-[10px] text-secondary mt-0.5">Assigned to complete and format your deliverable.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Add-ons */}
              {availableAddons.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-secondary">Enhance Project (Optional Add-ons)</h4>
                  <div className="space-y-2">
                    {availableAddons.map(a => {
                      const checked = selectedAddons.has(a.id);
                      return (
                        <div key={a.id} className={`border rounded-xl p-4 transition-all ${checked ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30' : 'bg-card border-theme hover:bg-white/5'}`}>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleAddonChange(a.id)}
                              className="mt-1 accent-emerald-500"
                            />
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-primary">{a.name}</span>
                                <span className="text-xs font-mono font-black text-emerald-500">+{naira(a.price)}</span>
                              </div>
                              {a.description && <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">{a.description}</p>}
                              
                              {a.is_location_changer && checked && (
                                <div className="mt-3 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
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
                          </label>
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
                  disabled={!acceptedTerms || !assignedWriter || busy}
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
              <button onClick={() => setPreviewTopic(null)} className="w-8 h-8 rounded-full bg-secondary hover:bg-white/5 text-primary flex items-center justify-center">
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
                className="px-4 py-2 text-xs font-black bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded-xl transition"
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
