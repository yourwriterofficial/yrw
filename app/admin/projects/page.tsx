'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { ToastContainer, showToast } from '@/app/components/ui/Toast';

type Topic = {
  id?: number;
  title: string;
  department: string;
  description: string;
  pages: number;
  chapters: string;
  format: string;
  year: number;
  level: string;
  price: number;
  is_active: boolean;
};

type Addon = {
  id?: number;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  sort_order?: number;
  price_type?: string;
  features?: { name: string; price: number }[];
  is_location_changer?: boolean;
};

const BLANK: Topic = {
  title: '', department: '', description: '', pages: 70, chapters: '1-5',
  format: 'MS Word', year: 2026, level: 'BSc', price: 3999, is_active: true,
};
const BLANK_ADDON: Addon = {
  name: '', description: '', price: 0, is_active: true,
  price_type: 'fixed', features: [], is_location_changer: false
};

export default function AdminProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'topics' | 'addons' | 'settings'>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  // Settings State variables
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ BSc: 3999, MSc: 4500, PhD: 10000 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});
  const [pageSettings, setPageSettings] = useState<any>({
    hero_title: '', hero_description: '', disclaimer_text: '', checkout_terms: '', delivery_text: '⚡ Delivered within 4 hours', show_random: true, features: []
  });
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptPrice, setNewDeptPrice] = useState(0);
  const [newBadgeText, setNewBadgeText] = useState('');

  const load = useCallback(async (q?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return router.push('/dashboard/client');

    let query = supabase.from('project_topics').select('*', { count: 'exact' });
    if (q && q.trim()) query = query.ilike('title', `%${q.trim()}%`);
    const { data, count } = await query.order('created_at', { ascending: false }).limit(200);
    setTopics((data as Topic[]) || []);
    setTotal(count || 0);

    const { data: ad } = await supabase.from('project_addons').select('*').order('sort_order');
    setAddons((ad as Addon[]) || []);

    // Fetch dynamic project settings
    const { data: settingsData } = await supabase.from('project_settings').select('*');
    if (settingsData) {
      let lp = { BSc: 3999, MSc: 4500, PhD: 10000 };
      let dp = {};
      let ps: any = { hero_title: '', hero_description: '', disclaimer_text: '', checkout_terms: '', delivery_text: '⚡ Delivered within 4 hours', show_random: true, features: [] };
      settingsData.forEach(s => {
        if (s.key === 'level_prices') lp = s.value;
        if (s.key === 'department_prices') dp = s.value;
        if (s.key === 'page_settings') ps = { ...ps, ...s.value };
      });
      setLevelPrices(lp);
      setDeptPrices(dp);
      setPageSettings(ps);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);
  // debounced server-side search
  useEffect(() => { const t = setTimeout(() => load(search), 350); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.department.trim()) {
      return showToast('Title and department are required.', 'error');
    }
    setSaving(true);
    const payload = {
      title: editing.title,
      department: editing.department,
      description: editing.description || null,
      pages: Number(editing.pages) || 0,
      chapters: editing.chapters || '1-5',
      format: editing.format || 'MS Word',
      year: Number(editing.year) || null,
      level: editing.level || 'BSc',
      price: Number(editing.price) || levelPrices[editing.level] || 3999,
      is_active: editing.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from('project_topics').update(payload).eq('id', editing.id)
      : await supabase.from('project_topics').insert(payload);
    setSaving(false);
    if (error) return showToast(error.message, 'error');
    showToast(editing.id ? 'Topic updated' : 'Topic created', 'success');
    setEditing(null);
    load(search);
  };

  const saveAddon = async () => {
    if (!editingAddon) return;
    if (!editingAddon.name.trim()) return showToast('Add-on name is required.', 'error');
    const featNames = (editingAddon.features || []).map(f => f.name.trim()).filter(Boolean);
    if (new Set(featNames).size !== featNames.length) {
      return showToast('Sub-feature names must be unique — rename the duplicate before saving.', 'error');
    }
    setSaving(true);
    const payload = {
      name: editingAddon.name,
      description: editingAddon.description || null,
      price: Number(editingAddon.price) || 0,
      is_active: editingAddon.is_active,
      price_type: editingAddon.price_type || 'fixed',
      features: editingAddon.features || [],
      is_location_changer: !!editingAddon.is_location_changer
    };
    const { error } = editingAddon.id
      ? await supabase.from('project_addons').update(payload).eq('id', editingAddon.id)
      : await supabase.from('project_addons').insert(payload);
    setSaving(false);
    if (error) return showToast([error.message, error.details, error.hint].filter(Boolean).join(' — '), 'error');
    showToast('Add-on saved', 'success');
    setEditingAddon(null);
    load(search);
  };

  const removeAddon = async (a: Addon) => {
    if (!confirm(`Delete add-on "${a.name}"?`)) return;
    await supabase.from('project_addons').delete().eq('id', a.id);
    showToast('Add-on deleted', 'success');
    load(search);
  };

  const toggleActive = async (t: Topic) => {
    await supabase.from('project_topics').update({ is_active: !t.is_active }).eq('id', t.id);
    load();
  };

  const remove = async (t: Topic) => {
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    await supabase.from('project_topics').delete().eq('id', t.id);
    showToast('Topic deleted', 'success');
    load();
  };

  const saveSettings = async (key: string, value: any) => {
    setSaving(true);
    const { error } = await supabase.from('project_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    });
    setSaving(false);
    if (error) return showToast(error.message, 'error');
    showToast('Settings saved successfully', 'success');
  };

  if (loading) return <LoadingScreen label="Loading project topics..." accent="emerald" />;

  return (
    <div className="p-6 md:p-10">
      <ToastContainer />
      <PageHeader
        title="Project Topics"
        description="Manage the /projects catalogue, per-topic prices, purchase add-ons, and page copy."
        breadcrumb="Admin / Project Topics"
        icon={<lucide.BookOpen className="w-8 h-8 text-emerald-500" />}
        actions={
          tab === 'topics' ? (
            <button onClick={() => setEditing({ ...BLANK })} className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <lucide.Plus className="w-4 h-4" /> New Topic
            </button>
          ) : tab === 'addons' ? (
            <button onClick={() => setEditingAddon({ ...BLANK_ADDON, features: [] })} className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <lucide.Plus className="w-4 h-4" /> New Add-on
            </button>
          ) : null
        }
      />

      <div className="flex bg-secondary border border-theme rounded-full p-1 w-fit mb-6">
        <button onClick={() => setTab('topics')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${tab === 'topics' ? 'bg-emerald-500 text-black' : 'text-secondary hover:text-primary'}`}>Topics ({total.toLocaleString()})</button>
        <button onClick={() => setTab('addons')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${tab === 'addons' ? 'bg-emerald-500 text-black' : 'text-secondary hover:text-primary'}`}>Add-ons ({addons.length})</button>
        <button onClick={() => setTab('settings')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${tab === 'settings' ? 'bg-emerald-500 text-black' : 'text-secondary hover:text-primary'}`}>Settings & Copy</button>
      </div>

      {tab === 'topics' && (
        <>
          <div className="mb-4 relative max-w-md">
            <lucide.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search 3,000+ topics by title…" className="w-full bg-secondary border border-theme rounded-full pl-11 pr-4 py-2.5 text-sm text-primary outline-none focus:border-emerald-500" />
          </div>
          <p className="text-[11px] text-secondary mb-3">{total.toLocaleString()} topics total · showing up to 200 (refine with search).</p>
          <div className="bg-secondary border border-theme rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-card border-b border-theme text-secondary text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Title</th><th className="p-4">Department</th><th className="p-4">Level</th><th className="p-4">Price</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {topics.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="p-4 font-bold text-primary max-w-sm"><span className="line-clamp-2">{t.title}</span></td>
                      <td className="p-4 text-secondary">{t.department}</td>
                      <td className="p-4"><span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-secondary">{t.level}</span></td>
                      <td className="p-4 font-black text-emerald-500">₦{Number(t.price).toLocaleString()}</td>
                      <td className="p-4">
                        <button onClick={() => toggleActive(t)} className={`text-[10px] font-black uppercase px-2 py-1 rounded ${t.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-secondary'}`}>{t.is_active ? 'Active' : 'Hidden'}</button>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditing(t)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-primary"><lucide.Pencil className="w-4 h-4" /></button>
                          <button onClick={() => remove(t)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"><lucide.Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {topics.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-secondary text-sm">No topics found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'addons' && (
        <div className="bg-secondary border border-theme rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card border-b border-theme text-secondary text-[10px] uppercase tracking-wider">
                <tr><th className="p-4">Add-on</th><th className="p-4">Description</th><th className="p-4">Price / Rate</th><th className="p-4">Type</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {addons.map(a => (
                  <tr key={a.id} className="hover:bg-white/[0.02]">
                    <td className="p-4 font-bold text-primary">
                      {a.name}
                      {a.is_location_changer && <span className="ml-2 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Location Changer</span>}
                    </td>
                    <td className="p-4 text-secondary max-w-md">
                      <span className="line-clamp-2">{a.description}</span>
                      {Array.isArray(a.features) && a.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {a.features.map((f, fi) => (
                            <span key={`${a.id}-${fi}`} className="text-[9px] bg-white/5 text-secondary px-1.5 py-0.5 rounded border border-theme">
                              {f.name} (+₦{Number(f.price).toLocaleString()})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-black text-emerald-500">
                      {a.price_type === 'per_word' ? `₦${a.price}/word` : `+₦${Number(a.price).toLocaleString()}`}
                    </td>
                    <td className="p-4 text-xs font-bold text-primary">
                      {a.price_type === 'per_word' ? 'Per Word' : 'Fixed Price'}
                    </td>
                    <td className="p-4"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${a.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-secondary'}`}>{a.is_active ? 'Active' : 'Hidden'}</span></td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingAddon({ ...a, features: (a.features || []).map(f => ({ ...f })) })} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-primary"><lucide.Pencil className="w-4 h-4" /></button>
                        <button onClick={() => removeAddon(a)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"><lucide.Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {addons.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-secondary text-sm">No add-ons yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6 max-w-4xl">
          {/* LEVEL PRICES */}
          <div className="bg-secondary border border-theme rounded-2xl p-6">
            <h2 className="text-sm font-black uppercase text-emerald-400 mb-4 flex items-center gap-2">
              <lucide.Award className="w-5 h-5" /> Global Base Level Prices
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.keys(levelPrices).map(lvl => (
                <div key={lvl}>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">{lvl} Price (₦)</label>
                  <input
                    type="number"
                    value={levelPrices[lvl]}
                    onChange={e => setLevelPrices(prev => ({ ...prev, [lvl]: Number(e.target.value) || 0 }))}
                    className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary font-mono"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => saveSettings('level_prices', levelPrices)}
              disabled={saving}
              className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              Save Level Prices
            </button>
          </div>

          {/* DEPARTMENT PRICING */}
          <div className="bg-secondary border border-theme rounded-2xl p-6">
            <h2 className="text-sm font-black uppercase text-emerald-400 mb-4 flex items-center gap-2">
              <lucide.Folder className="w-5 h-5" /> Department Price Overrides
            </h2>
            <p className="text-xs text-secondary mb-4">
              Set custom base prices for specific departments. These override the global academic level pricing.
            </p>
            {Object.keys(deptPrices).length > 0 ? (
              <div className="space-y-2 mb-4">
                {Object.keys(deptPrices).map(deptName => (
                  <div key={deptName} className="flex justify-between items-center bg-primary border border-theme rounded-xl px-4 py-2 text-sm">
                    <span className="font-bold text-primary">{deptName}</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={deptPrices[deptName]}
                        onChange={e => setDeptPrices(prev => ({ ...prev, [deptName]: Number(e.target.value) || 0 }))}
                        className="w-28 bg-secondary border border-theme rounded-lg px-2 py-1 text-center font-mono text-xs text-primary"
                      />
                      <button
                        onClick={() => {
                          const next = { ...deptPrices };
                          delete next[deptName];
                          setDeptPrices(next);
                        }}
                        className="text-red-400 hover:text-red-500 p-1"
                      >
                        <lucide.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-secondary italic mb-4">No department price overrides configured yet.</p>
            )}

            {/* ADD DEPT OVERRIDE */}
            <div className="flex gap-2 items-end border-t border-theme/20 pt-4">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Department Name</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  className="w-full bg-primary border border-theme rounded-xl px-3 py-2 text-xs text-primary"
                />
              </div>
              <div className="w-32">
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Price (₦)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={newDeptPrice || ''}
                  onChange={e => setNewDeptPrice(Number(e.target.value) || 0)}
                  className="w-full bg-primary border border-theme rounded-xl px-3 py-2 text-xs text-primary font-mono text-center"
                />
              </div>
              <button
                onClick={() => {
                  if (!newDeptName.trim() || !newDeptPrice) return showToast('Please enter both name and price', 'error');
                  setDeptPrices(prev => ({ ...prev, [newDeptName.trim()]: newDeptPrice }));
                  setNewDeptName('');
                  setNewDeptPrice(0);
                }}
                className="bg-white/5 hover:bg-white/10 text-primary border border-theme px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
              >
                Add Override
              </button>
            </div>

            <button
              onClick={() => saveSettings('department_prices', deptPrices)}
              disabled={saving}
              className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              Save Department Prices
            </button>
          </div>

          {/* PAGE COPY CONFIGURATION */}
          <div className="bg-secondary border border-theme rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black uppercase text-emerald-400 mb-2 flex items-center gap-2">
              <lucide.FileText className="w-5 h-5" /> Project Page Content & Copy
            </h2>
            
            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Hero Title</label>
              <input
                type="text"
                value={pageSettings.hero_title || ''}
                onChange={e => setPageSettings({ ...pageSettings, hero_title: e.target.value })}
                className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Hero Description</label>
              <textarea
                rows={2}
                value={pageSettings.hero_description || ''}
                onChange={e => setPageSettings({ ...pageSettings, hero_description: e.target.value })}
                className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary resize-y"
              />
            </div>

            {/* Badges/Features */}
            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-2">Hero Feature Badges</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {Array.isArray(pageSettings.features) && pageSettings.features.map((badge: string, idx: number) => (
                  <span key={idx} className="bg-white/5 border border-theme text-primary text-xs px-3 py-1 rounded-full flex items-center gap-2">
                    {badge}
                    <button
                      onClick={() => setPageSettings({ ...pageSettings, features: pageSettings.features.filter((_: string, i: number) => i !== idx) })}
                      className="text-red-400 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Add new badge (e.g. ⚡ 4-hour delivery)"
                  value={newBadgeText}
                  onChange={e => setNewBadgeText(e.target.value)}
                  className="flex-1 bg-primary border border-theme rounded-xl px-3 py-2 text-xs text-primary"
                />
                <button
                  onClick={() => {
                    if (!newBadgeText.trim()) return;
                    setPageSettings({ ...pageSettings, features: [...(pageSettings.features || []), newBadgeText.trim()] });
                    setNewBadgeText('');
                  }}
                  className="bg-white/5 hover:bg-white/10 text-primary border border-theme px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
                >
                  Add Badge
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Disclaimer Text (Hero Bottom)</label>
              <textarea
                rows={3}
                value={pageSettings.disclaimer_text || ''}
                onChange={e => setPageSettings({ ...pageSettings, disclaimer_text: e.target.value })}
                className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary resize-y"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Delivery Time Badge (shown on every card + checkout)</label>
              <input
                type="text"
                value={pageSettings.delivery_text || ''}
                onChange={e => setPageSettings({ ...pageSettings, delivery_text: e.target.value })}
                className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Checkout Terms Agreement</label>
              <textarea
                rows={3}
                value={pageSettings.checkout_terms || ''}
                onChange={e => setPageSettings({ ...pageSettings, checkout_terms: e.target.value })}
                className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary resize-y"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-primary font-bold pt-2 select-none">
              <input
                type="checkbox"
                checked={!!pageSettings.show_random}
                onChange={e => setPageSettings({ ...pageSettings, show_random: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
              Show project topics ordered randomly (session-stable)
            </label>

            <button
              onClick={() => saveSettings('page_settings', pageSettings)}
              disabled={saving}
              className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              Save Page Copy
            </button>
          </div>
        </div>
      )}

      {/* Add-on editor */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-primary border border-theme rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-primary">{editingAddon.id ? 'Edit Add-on' : 'New Add-on'}</h2>
              <button onClick={() => setEditingAddon(null)}><lucide.X className="w-5 h-5 text-secondary hover:text-primary" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Name *</label><input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editingAddon.name} onChange={e => setEditingAddon({ ...editingAddon, name: e.target.value })} placeholder="e.g. Plagiarism Report" /></div>
              <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Description</label><textarea rows={2} className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary resize-y" value={editingAddon.description} onChange={e => setEditingAddon({ ...editingAddon, description: e.target.value })} /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Pricing Type</label>
                  <select
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary"
                    value={editingAddon.price_type || 'fixed'}
                    onChange={e => setEditingAddon({ ...editingAddon, price_type: e.target.value })}
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="per_word">Price Per Word</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">
                    {editingAddon.price_type === 'per_word' ? 'Rate per word (₦)' : 'Price (₦)'}
                  </label>
                  <input type="number" step={editingAddon.price_type === 'per_word' ? '0.1' : '1'} className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-mono" value={editingAddon.price} onChange={e => setEditingAddon({ ...editingAddon, price: Number(e.target.value) })} />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-primary font-bold"><input type="checkbox" checked={editingAddon.is_active} onChange={e => setEditingAddon({ ...editingAddon, is_active: e.target.checked })} className="w-4 h-4 accent-emerald-500" /> Available at checkout</label>
              
              <label className="flex items-center gap-2 cursor-pointer text-sm text-primary font-bold">
                <input
                  type="checkbox"
                  checked={!!editingAddon.is_location_changer}
                  onChange={e => setEditingAddon({ ...editingAddon, is_location_changer: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                Allows buyer to change case study/location
              </label>

              {/* Sub-features Builder */}
              <div className="border-t border-theme/20 pt-4">
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-2">Sub-features (Optional)</label>
                
                {Array.isArray(editingAddon.features) && editingAddon.features.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-36 overflow-y-auto pr-1">
                    {editingAddon.features.map((feat: any, idx: number) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={feat.name}
                          onChange={e => {
                            const next = [...(editingAddon.features || [])];
                            next[idx] = { ...feat, name: e.target.value };
                            setEditingAddon({ ...editingAddon, features: next });
                          }}
                          placeholder="Feature Name (e.g. SPSS Analysis)"
                          className="flex-1 bg-secondary border border-theme rounded-xl px-3 py-1.5 text-xs text-primary"
                        />
                        <input
                          type="number"
                          value={feat.price}
                          onChange={e => {
                            const next = [...(editingAddon.features || [])];
                            next[idx] = { ...feat, price: Number(e.target.value) || 0 };
                            setEditingAddon({ ...editingAddon, features: next });
                          }}
                          placeholder="Price"
                          className="w-24 bg-secondary border border-theme rounded-xl px-3 py-1.5 text-xs text-primary text-center font-mono"
                        />
                        <button
                          onClick={() => {
                            const next = (editingAddon.features || []).filter((_, i) => i !== idx);
                            setEditingAddon({ ...editingAddon, features: next });
                          }}
                          className="text-red-400 hover:text-red-500 p-1"
                        >
                          <lucide.Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    const next = [...(editingAddon.features || []), { name: '', price: 0 }];
                    setEditingAddon({ ...editingAddon, features: next });
                  }}
                  className="bg-white/5 hover:bg-white/10 text-primary border border-theme/50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 w-fit"
                >
                  <lucide.Plus className="w-3.5 h-3.5" /> Add Sub-feature
                </button>
              </div>

              <div className="flex gap-3 pt-2 border-t border-theme/20">
                <button onClick={() => setEditingAddon(null)} className="flex-1 py-3 bg-secondary border border-theme text-primary rounded-xl font-bold text-sm">Cancel</button>
                <button onClick={saveAddon} disabled={saving} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-black text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Add-on'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / create topic modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-primary border border-theme rounded-3xl p-6 md:p-8 max-w-2xl w-full my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-primary">{editing.id ? 'Edit Topic' : 'New Topic'}</h2>
              <button onClick={() => setEditing(null)}><lucide.X className="w-5 h-5 text-secondary hover:text-primary" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Title *</label><input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Department *</label><input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.department} onChange={e => setEditing({ ...editing, department: e.target.value })} placeholder="e.g. Computer Science" /></div>
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Level</label>
                  <select className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.level} onChange={e => { const lv = e.target.value; setEditing({ ...editing, level: lv, price: levelPrices[lv] || editing.price }); }}>
                    <option value="BSc">BSc / HND</option><option value="MSc">MSc / PGD</option><option value="PhD">PhD</option>
                  </select>
                </div>
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Price (₦)</label><input type="number" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-mono" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
              </div>
              <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Description</label><textarea rows={3} className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary resize-y" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Pages</label><input type="number" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.pages} onChange={e => setEditing({ ...editing, pages: Number(e.target.value) })} /></div>
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Chapters</label><input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.chapters} onChange={e => setEditing({ ...editing, chapters: e.target.value })} /></div>
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Year</label><input type="number" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.year} onChange={e => setEditing({ ...editing, year: Number(e.target.value) })} /></div>
                <div><label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Format</label><input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary" value={editing.format} onChange={e => setEditing({ ...editing, format: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-primary font-bold"><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 accent-emerald-500" /> Visible on /projects</label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-3 bg-secondary border border-theme text-primary rounded-xl font-bold text-sm">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-black text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Topic'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
