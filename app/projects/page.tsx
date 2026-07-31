'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import {
  BookOpen, Clock, Loader2, Lock, Search, ShieldCheck,
  Puzzle, Share2, Eye, CheckCircle2, Users, X, FileText,
  Calendar, ScrollText, Zap, AlertTriangle, CreditCard,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import ProjectsAssistant from '@/app/components/ProjectsAssistant';
import Header from '@/app/components/Header';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Input } from '@/app/components/ui/Input';
import { Checkbox } from '@/app/components/ui/Checkbox';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Shell } from '@/app/components/ui/Shell';
import { Select } from '@/app/components/ui/Select';
import { Textarea } from '@/app/components/ui/Textarea';

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
const PAGE_SIZE = 30;

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


const LEVEL_BADGE: Record<string, string> = {
  OND: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  HND: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  BSc: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MSc: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PhD: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const levelBadgeClass = (lvl: string) => LEVEL_BADGE[lvl] || LEVEL_BADGE.BSc;

// Single source of truth for the level dropdowns — OND/HND sit below BSc,
// mirroring Nigerian polytechnic-to-university academic tiers.
const LEVEL_OPTIONS = [
  { value: 'OND', label: 'OND' },
  { value: 'HND', label: 'HND' },
  { value: 'BSc', label: 'BSc' },
  { value: 'MSc', label: 'MSc / PGD' },
  { value: 'PhD', label: 'PhD' },
];

export default function ProjectsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [depts, setDepts] = useState<{ department: string; count: number }[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const [userEmail, setUserEmail] = useState('');


  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customLevel, setCustomLevel] = useState('BSc');
  const [customDept, setCustomDept] = useState('General');
  const [customCard, setCustomCard] = useState<{ title: string; level: string; department: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSearchDept, setSelectedSearchDept] = useState('all');
  const [selectedSearchLevel, setSelectedSearchLevel] = useState('all');

  const [sessionSeed, setSessionSeed] = useState(() => Math.random());
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ OND: 4999, HND: 5999, BSc: 5999, MSc: 4500, PhD: 10000 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});
  const [pageSettings, setPageSettings] = useState<any>({
    hero_title: "Project Topics & Research Materials",
    hero_description: "Thousands of ready-made materials across every Nigerian department — full Chapters 1–5, in MS Word, delivered to your secure vault.",
    features: ["Chapters 1–5", "Working hours 8am–7pm", "4-hour delivery"],
    disclaimer_text: "Please note: these are ready-made materials — we do not check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project will be delivered as-is. Need a plagiarism-free, AI-free custom write-up? Use our main writing service →",
    checkout_terms: "I understand this is a ready-made material — similarity/plagiarism and AI-detection levels are not checked or guaranteed. My purchase means the project will be delivered (Chapters 1–5, MS Word) to my vault. Working hours are 8am–7pm; delivery is within 4 hours.",
    delivery_text: "Delivered within 4 hours",
    show_random: true
  });

  const [addonWords, setAddonWords] = useState<Record<number, number>>({});
  const [addonFeatures, setAddonFeatures] = useState<Record<number, string[]>>({});
  const [customLocation, setCustomLocation] = useState('');

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const slugify = (title: string) =>
    title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const copyPermalink = (topicId: number, title: string) => {
    const link = `${window.location.origin}/projects/${topicId}-${slugify(title)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(topicId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const mergedDepts = useCallback(() => {
    const dbDepts = depts.map(d => d.department);
    const set = new Set([...dbDepts, ...NIGERIAN_DEPARTMENTS]);
    return Array.from(set).sort();
  }, [depts])();

  const browseFilterOptions = {
    dept: [{ value: 'all', label: 'All Departments' }, ...mergedDepts.map(d => ({ value: d, label: d }))],
    level: [{ value: 'all', label: 'All Levels' }, ...LEVEL_OPTIONS],
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      if (user?.email) setUserEmail(user.email);

      // Loaded via a server route (service role) instead of querying these
      // tables directly — their RLS only grants SELECT to authenticated users,
      // which silently emptied this page for the logged-out visitors who make
      // up most of its traffic. See app/api/projects/meta/route.ts.
      try {
        const res = await fetch('/api/projects/meta');
        const json = await res.json();
        if (res.ok) {
          setLevelPrices(json.levelPrices);
          setDeptPrices(json.deptPrices);
          setPageSettings((prev: any) => ({ ...prev, ...json.pageSettings }));
          setDepts(json.depts || []);
          setAddons(json.addons || []);
        }
      } catch (err) {
        console.error('Failed to load project metadata:', err);
      }
    })();
  }, []);

  // Compute pricing fallback
  const getTopicPrice = useCallback((lvl: string, deptName: string, customPrice?: number) => {
    if (customPrice !== undefined && Number(customPrice) > 0) return Number(customPrice);
    const deptPrice = deptPrices[deptName];
    if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
    return levelPrices[lvl] || levelPrices.BSc || 3999;
  }, [levelPrices, deptPrices]);

  const fetchTopics = useCallback(async (targetPage: number, seedOverride?: number) => {
    // Server route (service role) instead of querying project_topics directly
    // — its RLS only grants SELECT to authenticated users, which silently
    // emptied this page for logged-out visitors. See app/api/projects/topics/route.ts.
    const params = new URLSearchParams({
      page: String(targetPage),
      dept,
      level,
      search: debounced.trim(),
      random: String(!!pageSettings.show_random),
      seed: String(seedOverride ?? sessionSeed),
    });

    try {
      const res = await fetch(`/api/projects/topics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load topics');

      setTotal(json.total || 0);
      const mapped = (json.topics || []).map((t: Topic) => ({
        ...t,
        price: getTopicPrice(t.level, t.department, t.price)
      }));
      setTopics(mapped);
      setPage(targetPage);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
      setTotal(0);
      setTopics([]);
      setPage(targetPage);
    }
  }, [dept, level, debounced, sessionSeed, pageSettings.show_random, getTopicPrice]);

  const handlePageChange = (p: number) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (p < 1 || p > totalPages) return;
    setLoading(true);
    fetchTopics(p).finally(() => {
      setLoading(false);
      document.getElementById('topics-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const executeAvailabilitySearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setMsg('');
    
    // Sync filter state
    setDept(selectedSearchDept);
    setLevel(selectedSearchLevel);
    
    // Simulated loading delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      setDebounced(search.trim());
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setMsg('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTopics(1).finally(() => setLoading(false));
  }, [dept, level, debounced, hasSearched]);

  // ---- checkout ----
  const openCart = (c: Cart) => {
    setPreview(null);
    setSelectedAddons(new Set());
    setAddonWords({});
    setAddonFeatures({});
    setCustomLocation('');
    setAcceptedTerms(false);
    setMsg('');
    setCart(c);
  };

  const cartTotal = () => {
    if (!cart) return 0;
    let t = cart.basePrice;
    addons.forEach(a => {
      if (selectedAddons.has(a.id)) {
        if (a.price_type === 'per_word') {
          const w = addonWords[a.id] || 1000;
          t += Number(a.price) * w;
        } else {
          t += Number(a.price);
        }

        // Add features
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
    if (!cart || !acceptedTerms) return;
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
          topicId: cart.topicId,
          customTitle: cart.customTitle,
          department: cart.department,
          level: cart.level,
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

  const checkCustomAvailability = () => {
    if (customTitle.trim().length < 5) { setMsg('Please enter a fuller topic title.'); return; }
    setMsg('');
    setCustomCard({ title: customTitle.trim(), level: customLevel, department: customDept });
    // Reshuffle the catalogue behind it too, same as a full page reload.
    const newSeed = Math.random();
    setSessionSeed(newSeed);
    fetchTopics(page, newSeed);
  };

  // Title difference highlighters for similar searches
  const renderTitleWithDifferences = (title: string) => {
    const cleanWords = (t: string) =>
      t.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    const words = cleanWords(title);
    const wordsSet = new Set(words);
    if (words.length === 0) return title;

    let bestMatchTitle = "";
    let bestOverlap = 0;

    topics.forEach(other => {
      if (other.title === title) return;
      const otherWords = cleanWords(other.title);
      if (otherWords.length === 0) return;
      const common = otherWords.filter(w => wordsSet.has(w));
      const overlap = common.length / Math.max(words.length, otherWords.length);
      if (overlap > bestOverlap && overlap > 0.45 && overlap < 0.98) {
        bestOverlap = overlap;
        bestMatchTitle = other.title;
      }
    });

    if (bestOverlap > 0.45 && bestMatchTitle) {
      const otherWordsSet = new Set(cleanWords(bestMatchTitle));
      const tokens = title.split(/(\s+)/);
      return tokens.map((token, idx) => {
        const cleanToken = token.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        if (cleanToken && !otherWordsSet.has(cleanToken)) {
          return (
            <span key={idx} className="text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/25 font-extrabold shadow-sm text-xs select-none">
              {token}
            </span>
          );
        }
        return token;
      });
    }
    return title;
  };

  const TopicCard = ({ t, highlightDiffs }: { t: Topic; highlightDiffs?: boolean }) => (
    <Card padding="md" interactive className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="success">{t.department}</Badge>
        <Badge variant="default" className={levelBadgeClass(t.level)}>{t.level}</Badge>
      </div>
      <h3 className="text-sm font-bold leading-relaxed text-primary line-clamp-3">
        {highlightDiffs ? renderTitleWithDifferences(t.title) : t.title}
      </h3>
      <div className="flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-secondary font-mono">
        <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {t.pages || '—'} pages</span>
        <span className="inline-flex items-center gap-1"><ScrollText className="w-3 h-3" /> Ch. {t.chapters}</span>
        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.year}</span>
        <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> {t.format}</span>
      </div>
      <div className="flex gap-2 mt-auto pt-1 flex-wrap">
        <Button variant="secondary" size="sm" className="flex-1 min-w-[70px]" onClick={() => setPreview(t)}><Eye className="w-3.5 h-3.5" /> Preview</Button>
        <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => copyPermalink(t.id, t.title)}>
          {copiedId === t.id ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
        </Button>
        <Button size="sm" className="flex-1 min-w-[90px]" onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: Number(t.price) })}>Get · {naira(t.price)}</Button>
      </div>
    </Card>
  );

  const deptOptions = [{ value: 'all', label: 'All Departments' }, ...mergedDepts.map(d => ({ value: d, label: d }))];
  const levelOptions = [{ value: 'all', label: 'All Levels' }, ...LEVEL_OPTIONS];

  return (
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <Header projectsContext />
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white">
        <div className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-white/5 animate-blob" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-white/[0.03] animate-blob animation-delay-2000" />
        <Shell size="md" className="text-center pt-header-24 sm:pt-header-28 pb-12 relative z-10 space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-2">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display italic font-medium text-3xl md:text-4xl lg:text-5xl">
            {pageSettings.hero_title}
          </h1>
          <p className="text-sm md:text-base opacity-90 max-w-2xl mx-auto">
            {pageSettings.hero_description}
          </p>
          <div className="flex gap-2 justify-center flex-wrap text-xs font-bold">
            {Array.isArray(pageSettings.features) && pageSettings.features.map((f: string, i: number) => (
              <Badge key={i} variant="default" className="bg-white/15 border-white/20 text-white">{f}</Badge>
            ))}
            <Badge variant="default" className="bg-white/15 border-white/20 text-white">
              OND {naira(levelPrices.OND)} · HND {naira(levelPrices.HND)} · BSc {naira(levelPrices.BSc)} · MSc {naira(levelPrices.MSc)} · PhD {naira(levelPrices.PhD)}
            </Badge>
          </div>

          {/* DATABASE SEARCH CARD MOVED HERE */}
          {!hasSearched && !isSearching ? (
            <div className="max-w-2xl mx-auto mt-6 text-left">
              <Card padding="lg" elevation={3} className="text-primary">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-primary">Database Search & Availability</h2>
                  <p className="text-xs text-secondary mt-1.5 leading-relaxed font-semibold">
                    Place your full project topic below to search our database of 100,000+ completed projects and check instant availability.
                  </p>
                </div>

                <div className="space-y-4 text-left">
                  <Textarea
                    label="Your Full Project Topic *"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="e.g. Challenges and prospects of financial autonomy to local government administration..."
                    rows={3}
                    fullWidth
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Department"
                      value={selectedSearchDept}
                      onChange={e => setSelectedSearchDept(e.target.value)}
                      options={deptOptions}
                    />
                    <Select
                      label="Academic Level"
                      value={selectedSearchLevel}
                      onChange={e => setSelectedSearchLevel(e.target.value)}
                      options={levelOptions}
                    />
                  </div>

                  <Button
                    onClick={executeAvailabilitySearch}
                    disabled={!search.trim() || isSearching}
                    fullWidth
                    size="lg"
                  >
                    Check Availability & Retrieve Material
                  </Button>
                </div>
              </Card>
            </div>
          ) : hasSearched && !isSearching ? (
            loading ? (
              <Card padding="lg" elevation={3} className="max-w-md mx-auto mt-6 text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent mb-4" />
                <h3 className="text-sm font-bold text-primary">Loading matching topics...</h3>
              </Card>
            ) : topics.length === 0 ? (
              /* NO DIRECT RESULTS - SHOW CUSTOM WRITEUP CARD HERE IN HERO */
              <Card padding="lg" elevation={3} className="max-w-2xl mx-auto mt-6 text-center">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-theme pb-4 text-left mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-primary">Search Results</h3>
                    <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}>
                    <Search className="w-3.5 h-3.5" /> Search Another Topic
                  </Button>
                </div>

                <div className="w-14 h-14 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-bold text-primary mb-2">Custom Write-up Available!</h4>
                <p className="text-xs text-secondary mb-6 leading-relaxed max-w-md mx-auto font-semibold">
                  Our writers can prepare your custom topic as an original project with complete Chapters 1–5, structured layout, and full references.
                </p>

                <Card padding="md" className="text-left space-y-4 max-w-lg mx-auto mb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Available</Badge>
                    <Badge variant="default">{selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel}</Badge>
                    <Badge variant="default">{selectedSearchDept === 'all' ? 'General' : selectedSearchDept}</Badge>
                  </div>
                  <p className="text-xs font-bold text-primary leading-normal break-words">{search}</p>
                  <div className="border-t border-theme pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] text-secondary uppercase font-bold block">Standard Cost</span>
                      <span className="text-sm font-mono font-bold text-success">{naira(getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept))}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openCart({
                        customTitle: search.trim(),
                        level: selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel,
                        department: selectedSearchDept === 'all' ? 'General' : selectedSearchDept,
                        title: search.trim(),
                        basePrice: getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept)
                      })}
                    >
                      Order Custom Write-up
                    </Button>
                  </div>
                </Card>
              </Card>
            ) : (
              /* DIRECT MATCHES FOUND - SHOW THE COMPACT SEARCH RESULTS BANNER */
              <Card padding="md" elevation={2} className="max-w-2xl mx-auto mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 text-left">
                <div>
                  <h3 className="text-sm font-bold text-primary">Search Results</h3>
                  <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}>
                  <Search className="w-3.5 h-3.5" /> Search Another Topic
                </Button>
              </Card>
            )
          ) : isSearching ? (
            <Card padding="lg" elevation={3} className="max-w-md mx-auto mt-10 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent mb-4" />
              <h3 className="text-sm font-bold text-primary">Scanning Project Database...</h3>
              <p className="text-xs text-secondary mt-1">Checking chapters, tables, and references availability for your topic.</p>
            </Card>
          ) : null}
        </Shell>
      </section>

      {/* SERVICES (project-topics specific) */}
      <section id="services" className="px-4 md:px-6 py-10 border-b border-theme">
        <Shell size="lg">
          <h2 className="text-lg md:text-xl font-bold text-primary text-center mb-6">What's Included With Every Topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="lg" className="text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center mx-auto mb-3 text-accent">
                <ScrollText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-primary mb-1">Ready-made Chapters 1–5</h3>
              <p className="text-xs text-secondary">Full academic material in MS Word, matched to your department and level.</p>
            </Card>
            <Card padding="lg" className="text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center mx-auto mb-3 text-warning">
                <Puzzle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-primary mb-1">Optional Add-ons</h3>
              <p className="text-xs text-secondary">Extend any topic with extras like SPSS analysis, PowerPoint slides, or a location/case-study change.</p>
            </Card>
            <Card padding="lg" className="text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center mx-auto mb-3 text-info">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-primary mb-1">Secure Vault Delivery</h3>
              <p className="text-xs text-secondary">Your material lands in your dashboard's Secure Vault, ready to download.</p>
            </Card>
          </div>
        </Shell>
      </section>

      {/* HOW IT WORKS (project-topics specific) */}
      <section id="how-it-works" className="px-4 md:px-6 py-10 border-b border-theme bg-card/30">
        <Shell size="lg">
          <h2 className="text-lg md:text-xl font-bold text-primary text-center mb-6">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: '1', label: 'Pick a Topic', desc: 'Browse or search 100,000+ ready-made topics.' },
              { n: '2', label: 'Choose Add-ons', desc: 'Extend it with optional extras if you need them.' },
              { n: '3', label: 'Pay Securely', desc: 'Checkout with card — no account required upfront.' },
              { n: '4', label: 'Get Delivered', desc: 'Material lands in your Secure Vault within hours.' },
            ].map(step => (
              <Card key={step.n} padding="md" className="text-center">
                <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-accent text-[var(--accent-foreground)] font-black flex items-center justify-center text-sm">{step.n}</div>
                <h4 className="text-xs font-bold text-primary mb-1">{step.label}</h4>
                <p className="text-[11px] text-secondary leading-relaxed">{step.desc}</p>
              </Card>
            ))}
          </div>
        </Shell>
      </section>

      {/* DISCLAIMER */}
      <div className="bg-[var(--warning-bg)] border-b border-warning/20 px-4 md:px-6 py-3">
        <Shell size="lg" className="flex items-start gap-2 text-xs md:text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {pageSettings.disclaimer_text.includes("Use our main writing service") ? (
              <>
                <strong>Please note:</strong> these are ready-made materials — we do <strong>not</strong> check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project <strong>will be delivered</strong> as-is. Need a <strong>plagiarism-free, AI-free</strong> custom write-up? {' '}
                <Link href="/order/academic" className="underline font-bold">Use our main writing service →</Link>
              </>
            ) : pageSettings.disclaimer_text}
          </p>
        </Shell>
      </div>

      {/* DATABASE SEARCH & AVAILABILITY RESULTS CONTAINER */}
      {hasSearched && !isSearching && !loading && topics.length > 0 && (
        <Shell size="full" className="max-w-[1320px] py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
            <div>
              <h3 className="text-lg font-bold text-primary">Matching Database Topics</h3>
              <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}>
              <Search className="w-3.5 h-3.5" /> Search Another Topic
            </Button>
          </div>

          {msg && !cart && <div className="mb-4 text-xs font-bold text-danger bg-[var(--danger-bg)] border border-danger/20 rounded-xl p-3">{msg}</div>}

          <div id="topics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {topics.map(t => <TopicCard key={t.id} t={t} highlightDiffs />)}
          </div>

          {/* PAGINATION BAR */}
          {Math.ceil(total / PAGE_SIZE) > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => handlePageChange(page - 1)}
              >
                Prev
              </Button>

              {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
                const totalPages = Math.ceil(total / PAGE_SIZE);
                let pageNum = page - 2 + i;
                if (page <= 2) pageNum = i + 1;
                if (page >= totalPages - 1) pageNum = totalPages - 4 + i;
                pageNum = Math.max(1, Math.min(pageNum, totalPages));

                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition ${page === pageNum ? 'bg-accent text-[var(--accent-foreground)]' : 'bg-secondary border border-theme text-primary hover:bg-hover'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <Button
                variant="secondary"
                size="sm"
                disabled={page === Math.ceil(total / PAGE_SIZE) || loading}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Shell>
      )}

      {/* BROWSE ALL PROJECT TOPICS (below search section) */}
      {!hasSearched && !isSearching && (
        <Shell size="full" className="max-w-[1320px] pb-16">
          {/* Filter Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-bold text-primary">Browse Available Topics</h2>
              <p className="text-xs text-secondary mt-0.5">
                {total > 0 ? `${total.toLocaleString()} topics in our database` : 'Loading topics…'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={dept}
                onChange={e => { setDept(e.target.value); setPage(1); }}
                options={browseFilterOptions.dept}
                className="w-44 text-xs"
              />
              <Select
                value={level}
                onChange={e => { setLevel(e.target.value); setPage(1); }}
                options={browseFilterOptions.level}
                className="w-36 text-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-secondary text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading topics…
            </div>
          ) : topics.length === 0 ? (
            <EmptyState
              icon={<Search className="w-5 h-5" />}
              title="No topics found"
              description="Try a different department or level."
            />
          ) : (
            <>
              <div id="topics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map(t => <TopicCard key={t.id} t={t} />)}
              </div>

              {Math.ceil(total / PAGE_SIZE) > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                  >Prev</Button>
                  {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
                    const totalPages = Math.ceil(total / PAGE_SIZE);
                    let p: number;
                    if (totalPages <= 5) { p = i + 1; }
                    else if (page <= 3) { p = i + 1; }
                    else if (page >= totalPages - 2) { p = totalPages - 4 + i; }
                    else { p = page - 2 + i; }
                    return (
                      <button key={p} onClick={() => handlePageChange(p)}
                        className={`px-4 py-2 rounded-xl border text-xs font-bold transition ${p === page ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'bg-secondary border-theme text-primary hover:bg-hover'}`}
                      >{p}</button>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === Math.ceil(total / PAGE_SIZE) || loading}
                    onClick={() => handlePageChange(page + 1)}
                  >Next</Button>
                </div>
              )}
            </>
          )}
        </Shell>
      )}

      {/* PREVIEW MODAL — an honest metadata/structure summary, not a fake
          scanned-document simulation. This used to render a fabricated
          50-"page" locked document (fake cover page, fake student name,
          fake matric number, fake abstract text, Lorem ipsum body copy) —
          it read as deceptive rather than reassuring, so it's gone. */}
      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="bg-card border border-theme rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-theme/50 flex justify-between items-start gap-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Badge variant="success">{preview.department}</Badge>
                <Badge variant="default" className={levelBadgeClass(preview.level)}>{preview.level}</Badge>
              </div>
              <button onClick={() => setPreview(null)} className="text-secondary hover:text-primary p-1.5 bg-hover rounded-lg transition shrink-0"><lucide.X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-5">
              <h3 className="text-base font-bold text-primary leading-snug">{renderTitleWithDifferences(preview.title)}</h3>

              <div className="flex gap-x-4 gap-y-1 flex-wrap text-xs text-secondary font-mono">
                <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {preview.pages || 50} pages</span>
                <span className="inline-flex items-center gap-1"><ScrollText className="w-3.5 h-3.5" /> Chapters {preview.chapters || '1-5'}</span>
                <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {preview.year}</span>
                <span className="inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> {preview.format}</span>
              </div>

              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-secondary mb-2">What's Included</h4>
                <ul className="space-y-1.5">
                  {[
                    'Chapter 1 — Introduction, Background & Objectives',
                    'Chapter 2 — Literature Review',
                    'Chapter 3 — Research Methodology',
                    'Chapter 4 — Data Presentation & Analysis',
                    'Chapter 5 — Summary, Conclusion & Recommendations',
                    'References & Questionnaire/Appendix',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-primary">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-secondary/60 border border-theme rounded-xl p-3 text-[11px] text-secondary leading-relaxed">
                Ready-made material — not custom-written or plagiarism-checked. {pageSettings.delivery_text}, straight to your Secure Vault as an editable MS Word document.
              </div>
            </div>

            <div className="p-5 border-t border-theme/50 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" onClick={() => copyPermalink(preview.id, preview.title)}>
                {copiedId === preview.id ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
              </Button>
              <Button onClick={() => {
                const p = preview;
                setPreview(null);
                openCart({
                  topicId: p.id,
                  department: p.department,
                  level: p.level,
                  title: p.title,
                  basePrice: getTopicPrice(p.level, p.department || 'General', Number(p.price))
                });
              }}>
                Get Material — {naira(getTopicPrice(preview.level, preview.department || 'General', Number(preview.price)))}
              </Button>
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
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadgeClass(cart.level)}`}>{cart.level}</span>
                <p className="text-sm font-bold text-primary mt-2">{cart.title}</p>
                <p className="text-[11px] text-secondary">Chapters 1–5 · MS Word · {naira(cart.basePrice)}</p>
                <p className="text-[11px] font-bold text-success mt-1">{pageSettings.delivery_text}</p>
              </div>

              <div className="bg-success/10 border border-success/20 rounded-2xl p-4 flex items-center gap-3">
                <lucide.Zap className="w-4 h-4 text-success shrink-0" />
                <p className="text-xs font-bold text-primary">Ready for instant delivery — no writer wait, straight to your Secure Vault after payment.</p>
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
                  <p className="text-[10px] text-secondary mt-1 font-semibold">An account will be created automatically using your email as your temporary password. You can change this later from your Profile.</p>
                </div>
              )}

              {addons.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase font-black text-secondary mb-2">Optional Add-ons</p>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {addons
                      .filter(a => [13, 14, 5, 10].includes(Number(a.id)))
                      .map(a => {
                        const on = selectedAddons.has(a.id);
                        return (
                          <div key={a.id} className={`p-3 rounded-xl border transition space-y-2 ${on ? 'border-emerald-500 bg-emerald-500/5' : 'border-theme bg-secondary'}`}>
                            <button onClick={() => setSelectedAddons(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="w-full text-left flex items-start gap-3">
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-theme'}`}>{on && <lucide.Check className="w-3 h-3 text-black" />}</div>
                              <div className="flex-1">
                                <div className="flex justify-between gap-2">
                                  <span className="text-sm font-bold text-primary">{a.name}</span>
                                  <span className="text-xs font-black text-emerald-500 shrink-0">
                                    {a.price_type === 'per_word' ? `₦${a.price}/word` : `+${naira(a.price)}`}
                                  </span>
                                </div>
                                {a.description && <p className="text-[11px] text-secondary">{a.description}</p>}
                              </div>
                            </button>

                            {on && (
                              <div className="pl-7 space-y-2 border-t border-theme/20 pt-2 text-xs">
                                {/* If pricing type is per word */}
                                {a.price_type === 'per_word' && (
                                  <div className="flex items-center gap-2">
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
                                      className="w-24 bg-card border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500 font-mono text-center"
                                    />
                                    <span className="text-emerald-500 font-bold ml-1">
                                      ➔ {naira((addonWords[a.id] || 1000) * a.price)}
                                    </span>
                                  </div>
                                )}

                                {/* If location changer is active */}
                                {a.is_location_changer && (
                                  <div className="space-y-1">
                                    <span className="text-secondary text-[11px] block">Target Location / Case Study:</span>
                                    <input
                                      type="text"
                                      value={customLocation}
                                      onChange={e => setCustomLocation(e.target.value)}
                                      placeholder="e.g. Enugu State, University of Ibadan"
                                      className="w-full bg-card border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                {/* If it has sub-features */}
                                {Array.isArray(a.features) && a.features.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-secondary text-[10px] font-black uppercase tracking-wider block mb-1">Includes Features:</span>
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
                                              className="w-3.5 h-3.5 accent-emerald-500 shrink-0"
                                            />
                                            <span className="text-secondary text-[11px] flex-1">{f.name}</span>
                                            <span className="text-secondary font-bold text-[11px] shrink-0">+{naira(f.price)}</span>
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

              <div className="flex justify-between items-center border-t border-theme pt-3">
                <span className="text-sm font-bold text-secondary">Total</span>
                <span className="text-2xl font-black text-emerald-500">{naira(cartTotal())}</span>
              </div>

              <label className="flex items-start gap-2 cursor-pointer bg-secondary border border-theme rounded-xl p-3">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
                <span className="text-[11px] text-primary leading-relaxed">
                  {pageSettings.checkout_terms}
                  <strong className="block mt-1.5 text-emerald-500 font-bold">
                    * AI-free and plagiarism-free revisions are only performed if you select the respective "No AI" or "No Plagiarism" add-ons above.
                  </strong>
                </span>
              </label>

              {msg && <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

              <button
                onClick={pay}
                disabled={!acceptedTerms || busy || (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim()))}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-black transition disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
              >
                {busy
                  ? 'Redirecting to payment…'
                  : `Pay ${naira(cartTotal())} & Get Material`}
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
