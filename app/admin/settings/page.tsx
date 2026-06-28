'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';

type Addon = {
  id: string;
  service_category: string;
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
  is_active: boolean;
};

type GroupedAddon = {
  name: string;
  description: string;
  price_type: 'FLAT_FEE' | 'PERCENT_INCREASE';
  price_value: number;
  is_active: boolean;
  categories: string[];
  ids: string[];
};

type SiteContent = {
  id: string;
  content_key: string;
  content_text: string;
};

const KEY_LABELS: Record<string, string> = {
  academic_tos: 'Standard Academic & Complex Custom Terms of Service',
  content_tos: 'Content Writing Terms of Service',
  resume_tos: 'Resume & CV Terms of Service',
  dev_tos: 'Full Stack & Software Development Terms of Service',
};

let toastId = 0;
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const event = new CustomEvent('app:toast', { detail: { id: toastId++, message, type } });
  window.dispatchEvent(event);
};

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SettingsContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-purple-500 text-xs font-black uppercase tracking-widest animate-pulse">Loading Config...</span>
      </div>
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groupedAddons, setGroupedAddons] = useState<GroupedAddon[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [activeTab, setActiveTab] = useState<'ADDONS' | 'CONTENT'>('ADDONS');
  const [editingAddon, setEditingAddon] = useState<Partial<GroupedAddon> | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const [previewHtml, setPreviewHtml] = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  const fetchSettingsData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return router.push('/dashboard/client');

    const { data: addonData } = await supabase.from('order_addons').select('*').order('created_at', { ascending: false });
    if (addonData) {
      const groups: Record<string, GroupedAddon> = {};
      (addonData as Addon[]).forEach(item => {
        const key = `${item.name.toLowerCase()}_${item.price_value}_${item.price_type}`;
        if (!groups[key]) {
          groups[key] = {
            name: item.name,
            description: item.description,
            price_type: item.price_type,
            price_value: item.price_value,
            is_active: item.is_active,
            categories: [item.service_category],
            ids: [item.id]
          };
        } else {
          if (!groups[key].categories.includes(item.service_category)) {
            groups[key].categories.push(item.service_category);
          }
          groups[key].ids.push(item.id);
        }
      });
      setGroupedAddons(Object.values(groups));
    }

    const { data: contentData } = await supabase.from('site_content').select('*').order('content_key');
    if (contentData) {
      setSiteContent(contentData as SiteContent[]);
      const previewMap: Record<string, string> = {};
      contentData.forEach((c: SiteContent) => {
        previewMap[c.id] = c.content_text;
      });
      setPreviewHtml(previewMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const handleSaveAddon = async () => {
    if (!editingAddon?.name || !editingAddon?.price_value) {
      showToast('Please fill in all required fields (Name, Price).', 'error');
      return;
    }
    if (selectedCategories.length === 0) {
      showToast('Please select at least one display category.', 'error');
      return;
    }
    setSaving(true);
    try {
      // 1. Delete old rows
      if (editingAddon.ids && editingAddon.ids.length > 0) {
        await supabase.from('order_addons').delete().in('id', editingAddon.ids);
      }
      
      // 2. Insert new rows for each selected category
      const recordsToInsert = selectedCategories.map(cat => ({
        service_category: cat,
        name: editingAddon.name,
        description: editingAddon.description || '',
        price_type: editingAddon.price_type || 'FLAT_FEE',
        price_value: Number(editingAddon.price_value),
        is_active: editingAddon.is_active ?? true,
      }));
      
      const { error } = await supabase.from('order_addons').insert(recordsToInsert);
      if (error) showToast(`Error saving: ${error.message}`, 'error');
      else showToast('Add-on saved successfully', 'success');
    } catch (err: any) {
      showToast(`Error saving: ${err.message}`, 'error');
    }
    setEditingAddon(null);
    setSelectedCategories([]);
    setSaving(false);
    fetchSettingsData();
  };

  const toggleAddonStatus = async (ids: string[], currentStatus: boolean) => {
    const { error } = await supabase.from('order_addons').update({ is_active: !currentStatus }).in('id', ids);
    if (error) showToast('Failed to toggle status', 'error');
    else { showToast('Status toggled', 'success'); fetchSettingsData(); }
  };

  const deleteAddon = async (ids: string[]) => {
    if (!confirm('Are you sure you want to permanently delete this add-on across all selected categories?')) return;
    const { error } = await supabase.from('order_addons').delete().in('id', ids);
    if (error) showToast('Delete failed', 'error');
    else { showToast('Add-on deleted', 'success'); fetchSettingsData(); }
  };

  const handleUpdateContent = async (id: string, newText: string) => {
    setSaving(true);
    const { error } = await supabase.from('site_content').update({ content_text: newText }).eq('id', id);
    if (error) showToast(`Error saving content: ${error.message}`, 'error');
    else {
      showToast('Content updated successfully!', 'success');
      setPreviewHtml(prev => ({ ...prev, [id]: newText }));
    }
    setSaving(false);
    fetchSettingsData();
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold animate-in slide-in-from-right duration-300 ${
            t.type === 'success' ? 'bg-emerald-500 text-black' : t.type === 'error' ? 'bg-red-500 text-white' : 'bg-card text-primary'
          }`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="p-6 md:p-10 overflow-y-auto relative max-w-[1600px]">
        <div className="animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-theme pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
                <lucide.Settings className="text-purple-500 w-8 h-8" /> Platform Configuration
              </h1>
              <p className="text-secondary text-sm mt-2">Manage dynamic pricing variables, pipeline add-ons, and site-wide copy (HTML supported).</p>
            </div>
            <div className="flex bg-secondary border border-theme rounded-full p-1">
              <button onClick={() => setActiveTab('ADDONS')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'ADDONS' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                Pricing & Add-ons
              </button>
              <button onClick={() => setActiveTab('CONTENT')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'CONTENT' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                Site Content (HTML)
              </button>
            </div>
          </div>

          {/* ADDONS TAB */}
          {activeTab === 'ADDONS' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <lucide.Activity className="w-5 h-5" /> Active Modifiers
                </h2>
                <button onClick={() => { setEditingAddon({ price_type: 'FLAT_FEE', is_active: true, categories: [], ids: [] }); setSelectedCategories([]); }} className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1">
                  <lucide.Plus className="w-4 h-4" /> New Add-on
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAddons.map((addon, index) => (
                  <div key={index} className={`p-6 rounded-2xl border transition ${addon.is_active ? 'bg-card border-theme' : 'bg-primary border-red-500/20 opacity-60'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-wrap gap-1 max-w-[80%]">
                        {addon.categories.map(cat => (
                          <span key={cat} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 text-purple-400 rounded-md">
                            {cat}
                          </span>
                        ))}
                      </div>
                      <button onClick={() => toggleAddonStatus(addon.ids, addon.is_active)} className={addon.is_active ? 'text-emerald-500' : 'text-red-500'}>
                        {addon.is_active ? <lucide.ToggleRight className="w-6 h-6" /> : <lucide.ToggleLeft className="w-6 h-6" />}
                      </button>
                    </div>
                    <h3 className="text-sm font-bold text-primary mb-1">{addon.name}</h3>
                    <p className="text-xs text-secondary mb-4 h-10 overflow-hidden">{addon.description}</p>
                    <div className="flex items-center justify-between border-t border-theme pt-4">
                      <div className="text-lg font-black text-primary">
                        {addon.price_type === 'FLAT_FEE' ? `₦${addon.price_value.toLocaleString()}` : `+${addon.price_value}%`}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingAddon(addon); setSelectedCategories(addon.categories); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-secondary transition"><lucide.Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteAddon(addon.ids)} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500 transition"><lucide.Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTENT TAB */}
          {activeTab === 'CONTENT' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2 mb-6">
                <lucide.FileText className="w-5 h-5" /> Text & Legal Copy (HTML supported)
              </h2>
              <div className="space-y-8">
                {siteContent.map(content => (
                  <div key={content.id} className="bg-card border border-theme p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-purple-400">
                        {KEY_LABELS[content.content_key] || `Site Content (${content.content_key})`}
                      </h3>
                      <span className="text-[9px] font-mono text-secondary bg-white/5 px-2 py-1 rounded">
                        Key: {content.content_key}
                      </span>
                    </div>
                    <textarea
                      className="w-full bg-primary border border-theme rounded-xl p-4 text-sm text-primary focus:border-purple-500 outline-none resize-y font-mono"
                      defaultValue={content.content_text}
                      id={`content-${content.id}`}
                      rows={12}
                      onChange={(e) => {
                        setPreviewHtml(prev => ({ ...prev, [content.id]: e.target.value }));
                      }}
                    />
                    <div className="mt-4">
                      <div className="text-[10px] uppercase font-black text-secondary mb-2">Preview</div>
                      <div className="bg-primary border border-theme rounded-xl p-4 prose prose-invert max-w-none text-xs"
                           dangerouslySetInnerHTML={{ __html: previewHtml[content.id] || '' }} />
                    </div>
                    <button
                      onClick={() => {
                        const val = (document.getElementById(`content-${content.id}`) as HTMLTextAreaElement).value;
                        handleUpdateContent(content.id, val);
                      }}
                      disabled={saving}
                      className="mt-4 bg-white/5 hover:bg-white/10 text-primary px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
                    >
                      <lucide.Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Update Content'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Addon Edit Modal */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-theme rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-primary">{editingAddon.ids && editingAddon.ids.length > 0 ? 'Edit Add-on' : 'Create New Add-on'}</h2>
              <button onClick={() => setEditingAddon(null)} className="text-secondary hover:text-primary transition"><lucide.X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Display in Order Pages</label>
                <div className="space-y-2 bg-secondary border border-theme p-4 rounded-xl">
                  {[
                    { key: 'ACADEMIC', label: 'Standard Academic' },
                    { key: 'CUSTOM', label: 'Complex Custom & Fieldwork' },
                    { key: 'CONTENT', label: 'Content Writing' },
                    { key: 'RESUME', label: 'Resume / CV' },
                    { key: 'DEV', label: 'Full Stack Development' },
                  ].map(cat => {
                    const isChecked = selectedCategories.includes(cat.key);
                    return (
                      <label key={cat.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedCategories(prev => prev.filter(c => c !== cat.key));
                            } else {
                              setSelectedCategories(prev => [...prev, cat.key]);
                            }
                          }}
                          className="w-4 h-4 accent-purple-500 bg-primary border border-theme rounded"
                        />
                        <span className="text-sm text-primary font-bold">{cat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Add-on Name</label>
                <input type="text" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingAddon.name || ''} onChange={e => setEditingAddon({ ...editingAddon, name: e.target.value })} placeholder="e.g., PowerPoint Presentation" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Description</label>
                <textarea className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none resize-none text-primary h-20" value={editingAddon.description || ''} onChange={e => setEditingAddon({ ...editingAddon, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Pricing Logic</label>
                  <select className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingAddon.price_type || 'FLAT_FEE'} onChange={e => setEditingAddon({ ...editingAddon, price_type: e.target.value as any })}>
                    <option value="FLAT_FEE">Flat Fee (₦)</option><option value="PERCENT_INCREASE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Value</label>
                  <input type="number" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingAddon.price_value || ''} onChange={e => setEditingAddon({ ...editingAddon, price_value: Number(e.target.value) })} />
                </div>
              </div>
              <button onClick={handleSaveAddon} disabled={saving} className="w-full bg-purple-500 hover:bg-purple-400 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition mt-4">
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}