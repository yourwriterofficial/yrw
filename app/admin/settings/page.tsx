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

type SiteContent = {
  id: string;
  content_key: string;
  content_text: string;
};

// Toast helper
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
  
  // Data States
  const [addons, setAddons] = useState<Addon[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'ADDONS' | 'CONTENT'>('ADDONS');
  const [editingAddon, setEditingAddon] = useState<Partial<Addon> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);

  // Toast listener
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
    if (addonData) setAddons(addonData as Addon[]);

    const { data: contentData } = await supabase.from('site_content').select('*').order('content_key');
    if (contentData) setSiteContent(contentData as SiteContent[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  // --- ADDON HANDLERS ---
  const handleSaveAddon = async () => {
    if (!editingAddon?.name || !editingAddon?.price_value || !editingAddon?.service_category) {
      showToast('Please fill in all required fields (Category, Name, Price).', 'error');
      return;
    }
    
    setSaving(true);
    const payload = {
      service_category: editingAddon.service_category,
      name: editingAddon.name,
      description: editingAddon.description || '',
      price_type: editingAddon.price_type || 'FLAT_FEE',
      price_value: Number(editingAddon.price_value),
      is_active: editingAddon.is_active ?? true,
    };

    if (editingAddon.id) {
      const { error } = await supabase.from('order_addons').update(payload).eq('id', editingAddon.id);
      if (error) {
        showToast(`Error updating: ${error.message}`, 'error');
      } else {
        showToast('Add-on updated successfully', 'success');
      }
    } else {
      const { error } = await supabase.from('order_addons').insert([payload]);
      if (error) {
        showToast(`Error creating: ${error.message}`, 'error');
      } else {
        showToast('Add-on created successfully', 'success');
      }
    }

    setEditingAddon(null);
    setSaving(false);
    fetchSettingsData();
  };

  const toggleAddonStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('order_addons').update({ is_active: !currentStatus }).eq('id', id);
    if (error) {
      showToast('Failed to toggle status', 'error');
    } else {
      showToast('Status toggled', 'success');
      fetchSettingsData();
    }
  };

  const deleteAddon = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this add-on?')) return;
    const { error } = await supabase.from('order_addons').delete().eq('id', id);
    if (error) {
      showToast('Delete failed', 'error');
    } else {
      showToast('Add-on deleted', 'success');
      fetchSettingsData();
    }
  };

  // --- CONTENT HANDLERS ---
  const handleUpdateContent = async (id: string, newText: string) => {
    setSaving(true);
    const { error } = await supabase.from('site_content').update({ content_text: newText }).eq('id', id);
    if (error) {
      showToast(`Error saving content: ${error.message}`, 'error');
    } else {
      showToast('Content updated successfully!', 'success');
    }
    setSaving(false);
    fetchSettingsData();
  };

  if (loading) return <LoadingScreen />;

  // ===== MAIN CONTENT (NO SIDEBAR – PROVIDED BY LAYOUT) =====
  return (
    <>
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold animate-in slide-in-from-right duration-300 ${
            t.type === 'success' ? 'bg-emerald-500 text-black' : t.type === 'error' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-white'
          }`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="p-6 md:p-10 overflow-y-auto relative max-w-[1600px]">
        <div className="animate-in fade-in duration-300">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <lucide.Settings className="text-purple-500 w-8 h-8" /> Platform Configuration
              </h1>
              <p className="text-zinc-400 text-sm mt-2">Manage dynamic pricing variables, pipeline add-ons, and site-wide copy.</p>
            </div>
            <div className="flex bg-black border border-white/10 rounded-full p-1">
              <button onClick={() => setActiveTab('ADDONS')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'ADDONS' ? 'bg-purple-500 text-white' : 'text-zinc-400 hover:text-white'}`}>
                Pricing & Add-ons
              </button>
              <button onClick={() => setActiveTab('CONTENT')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'CONTENT' ? 'bg-purple-500 text-white' : 'text-zinc-400 hover:text-white'}`}>
                Site Content
              </button>
            </div>
          </div>

          {/* --- TAB 1: DYNAMIC ADDONS --- */}
          {activeTab === 'ADDONS' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <lucide.Activity className="w-5 h-5" /> Active Modifiers
                </h2>
                <button 
                  onClick={() => setEditingAddon({ price_type: 'FLAT_FEE', service_category: 'ACADEMIC', is_active: true })} 
                  className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1"
                >
                  <lucide.Plus className="w-4 h-4" /> New Add-on
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {addons.map(addon => (
                  <div key={addon.id} className={`p-6 rounded-2xl border transition ${addon.is_active ? 'bg-[#0a0a0a] border-white/5' : 'bg-black border-red-500/20 opacity-60'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 text-purple-400 rounded-md">
                        {addon.service_category}
                      </span>
                      <button onClick={() => toggleAddonStatus(addon.id, addon.is_active)} className={addon.is_active ? 'text-emerald-500' : 'text-red-500'}>
                        {addon.is_active ? <lucide.ToggleRight className="w-6 h-6" /> : <lucide.ToggleLeft className="w-6 h-6" />}
                      </button>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">{addon.name}</h3>
                    <p className="text-xs text-zinc-500 mb-4 h-10 overflow-hidden">{addon.description}</p>
                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <div className="text-lg font-black text-white">
                        {addon.price_type === 'FLAT_FEE' ? `₦${addon.price_value.toLocaleString()}` : `+${addon.price_value}%`}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingAddon(addon)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 transition"><lucide.Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteAddon(addon.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500 transition"><lucide.Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- TAB 2: SITE CONTENT --- */}
          {activeTab === 'CONTENT' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2 mb-6">
                <lucide.FileText className="w-5 h-5" /> Text & Legal Copy
              </h2>
              <div className="space-y-8">
                {siteContent.map(content => (
                  <div key={content.id} className="bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 bg-white/5 px-3 py-1.5 rounded-lg inline-block">
                        Key: {content.content_key}
                      </h3>
                    </div>
                    <textarea 
                      className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-zinc-300 focus:border-purple-500 outline-none resize-y min-h-[200px] mb-4"
                      defaultValue={content.content_text}
                      id={`content-${content.id}`}
                    />
                    <button 
                      onClick={() => {
                        const val = (document.getElementById(`content-${content.id}`) as HTMLTextAreaElement).value;
                        handleUpdateContent(content.id, val);
                      }}
                      disabled={saving}
                      className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
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

      {/* --- EDIT / ADD MODAL --- */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#050505] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white">{editingAddon.id ? 'Edit Add-on' : 'Create New Add-on'}</h2>
              <button onClick={() => setEditingAddon(null)} className="text-zinc-500 hover:text-white transition"><lucide.X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Pipeline Category</label>
                <select 
                  className="w-full bg-black border border-white/10 p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-white"
                  value={editingAddon.service_category || 'ACADEMIC'}
                  onChange={(e) => setEditingAddon({...editingAddon, service_category: e.target.value})}
                >
                  <option value="ACADEMIC">Standard Academic</option>
                  <option value="CUSTOM">Complex / Custom</option>
                  <option value="CONTENT">Content Writing</option>
                  <option value="RESUME">Resume / CV</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Add-on Name</label>
                <input 
                  type="text" 
                  className="w-full bg-black border border-white/10 p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-white"
                  value={editingAddon.name || ''}
                  onChange={(e) => setEditingAddon({...editingAddon, name: e.target.value})}
                  placeholder="e.g., PowerPoint Presentation"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Description</label>
                <textarea 
                  className="w-full bg-black border border-white/10 p-4 rounded-xl text-sm focus:border-purple-500 outline-none resize-none text-white h-20"
                  value={editingAddon.description || ''}
                  onChange={(e) => setEditingAddon({...editingAddon, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Pricing Logic</label>
                  <select 
                    className="w-full bg-black border border-white/10 p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-white"
                    value={editingAddon.price_type || 'FLAT_FEE'}
                    onChange={(e) => setEditingAddon({...editingAddon, price_type: e.target.value as any})}
                  >
                    <option value="FLAT_FEE">Flat Fee (₦)</option>
                    <option value="PERCENT_INCREASE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Value</label>
                  <input 
                    type="number" 
                    className="w-full bg-black border border-white/10 p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-white"
                    value={editingAddon.price_value || ''}
                    onChange={(e) => setEditingAddon({...editingAddon, price_value: Number(e.target.value)})}
                  />
                </div>
              </div>

              <button 
                onClick={handleSaveAddon} 
                disabled={saving}
                className="w-full bg-purple-500 hover:bg-purple-400 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition mt-4"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}