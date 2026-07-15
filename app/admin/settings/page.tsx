'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import NotificationPreferencesPanel from '@/app/components/ui/NotificationPreferencesPanel';
import PageHeader from '@/app/components/ui/PageHeader';
import Card from '@/app/components/ui/Card';
import { showToast } from '@/app/components/ui/Toast';
import type { PricingTier, ServicePricingCategory } from '@/lib/pricingTiers';
import { savePageSetting, fetchPageSettings } from '@/lib/pageSettings';
import { ORDER_PAGE_DEFAULTS, HOME_PAGE_DEFAULTS, type HomePageContent, type OrderPageContent } from '@/lib/pageContentDefaults';

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

const PRICING_CATEGORY_LABELS: Record<ServicePricingCategory, string> = {
  ACADEMIC: 'Academic Writing',
  CONTENT: 'Content & Creative Writing',
  DEV: 'Full Stack & Software',
  RESUME: 'Resume & CV',
  CUSTOM: 'Statistics, Maths, Financial & Fieldwork',
};

const PAGE_OPTIONS: { key: string; label: string }[] = [
  { key: 'home', label: 'Homepage' },
  { key: 'order_academic', label: 'Order — Academic' },
  { key: 'order_content', label: 'Order — Content' },
  { key: 'order_dev', label: 'Order — Full Stack' },
  { key: 'order_resume', label: 'Order — Resume/CV' },
  { key: 'order_statistics', label: 'Order — Statistics & Fieldwork' },
];

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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [groupedAddons, setGroupedAddons] = useState<GroupedAddon[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [activeTab, setActiveTab] = useState<'ADDONS' | 'PRICING' | 'PAGES' | 'CONTENT' | 'INVOICE' | 'NOTIFICATIONS'>('ADDONS');
  const [editingAddon, setEditingAddon] = useState<Partial<GroupedAddon> | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<Record<string, string>>({});
  const [invoiceDefaults, setInvoiceDefaults] = useState<any>(null);

  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [editingTier, setEditingTier] = useState<Partial<PricingTier> | null>(null);

  const [activePage, setActivePage] = useState<string>('home');
  const [homeContent, setHomeContent] = useState<HomePageContent>(HOME_PAGE_DEFAULTS);
  const [orderPageContent, setOrderPageContent] = useState<Record<string, OrderPageContent>>(ORDER_PAGE_DEFAULTS);

  const fetchSettingsData = async () => {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return router.push('/login');
    setUser(authUser);
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', authUser.id).single();
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

    const { data: invDefaults } = await supabase.from('invoice_defaults').select('*').eq('id', 1).maybeSingle();
    if (invDefaults) setInvoiceDefaults(invDefaults);

    const { data: tierData } = await supabase.from('service_pricing_tiers').select('*').order('service_category').order('sort_order');
    if (tierData) setPricingTiers(tierData as PricingTier[]);

    const home = await fetchPageSettings('home', HOME_PAGE_DEFAULTS);
    setHomeContent(home);
    const orderPages: Record<string, OrderPageContent> = {};
    for (const { key } of PAGE_OPTIONS) {
      if (key === 'home') continue;
      orderPages[key] = await fetchPageSettings(key, (ORDER_PAGE_DEFAULTS as any)[key]);
    }
    setOrderPageContent(orderPages);

    setLoading(false);
  };

  const saveTier = async () => {
    if (!editingTier?.name || !editingTier?.service_category || !editingTier?.tier_key) {
      showToast('Name, category, and tier key are required.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      service_category: editingTier.service_category,
      tier_key: editingTier.tier_key,
      name: editingTier.name,
      tagline: editingTier.tagline || '',
      price_model: editingTier.price_model || 'FLAT',
      rate_per_word: editingTier.price_model === 'PER_WORD' ? Number(editingTier.rate_per_word) || 0 : null,
      flat_price: editingTier.price_model === 'FLAT' ? Number(editingTier.flat_price) || 0 : null,
      volume_discount_percent: Number(editingTier.volume_discount_percent) || 0,
      volume_discount_threshold_words: Number(editingTier.volume_discount_threshold_words) || 10000,
      correction_cycles: editingTier.correction_cycles ? Number(editingTier.correction_cycles) : null,
      features: editingTier.features || [],
      highlight: editingTier.highlight ?? false,
      sort_order: Number(editingTier.sort_order) || 0,
      is_active: editingTier.is_active ?? true,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingTier.id
      ? await supabase.from('service_pricing_tiers').update(payload).eq('id', editingTier.id)
      : await supabase.from('service_pricing_tiers').insert(payload);
    if (error) showToast(`Error saving: ${error.message}`, 'error');
    else showToast('Pricing tier saved', 'success');
    setEditingTier(null);
    setSaving(false);
    fetchSettingsData();
  };

  const deleteTier = async (id: string) => {
    if (!confirm('Delete this pricing tier? It will disappear from the live order page immediately.')) return;
    const { error } = await supabase.from('service_pricing_tiers').delete().eq('id', id);
    if (error) showToast('Delete failed', 'error');
    else { showToast('Pricing tier deleted', 'success'); fetchSettingsData(); }
  };

  const toggleTierStatus = async (id: string, current: boolean) => {
    const { error } = await supabase.from('service_pricing_tiers').update({ is_active: !current }).eq('id', id);
    if (error) showToast('Failed to toggle status', 'error');
    else { showToast('Status toggled', 'success'); fetchSettingsData(); }
  };

  const saveHomeSection = async (key: keyof HomePageContent) => {
    setSaving(true);
    const { error } = await savePageSetting('home', key, homeContent[key]);
    setSaving(false);
    if (error) showToast(`Error saving: ${error.message}`, 'error');
    else showToast('Homepage section saved', 'success');
  };

  const restoreHomeSection = (key: keyof HomePageContent) => {
    setHomeContent(prev => ({ ...prev, [key]: structuredClone(HOME_PAGE_DEFAULTS[key]) }));
  };

  const saveOrderPageSection = async (page: string, key: keyof OrderPageContent) => {
    setSaving(true);
    const { error } = await savePageSetting(page, key, orderPageContent[page][key]);
    setSaving(false);
    if (error) showToast(`Error saving: ${error.message}`, 'error');
    else showToast('Page section saved', 'success');
  };

  const restoreOrderPageSection = (page: string, key: keyof OrderPageContent) => {
    setOrderPageContent(prev => ({ ...prev, [page]: { ...prev[page], [key]: structuredClone((ORDER_PAGE_DEFAULTS as any)[page][key]) } }));
  };

  const saveInvoiceDefaults = async () => {
    if (!invoiceDefaults) return;
    setSaving(true);
    const { error } = await supabase.from('invoice_defaults').update({
      contact_email: invoiceDefaults.contact_email,
      bank_name: invoiceDefaults.bank_name,
      account_name: invoiceDefaults.account_name,
      account_number: invoiceDefaults.account_number,
      developer_signature_name: invoiceDefaults.developer_signature_name,
      default_terms: invoiceDefaults.default_terms,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    if (error) showToast(`Failed to save: ${error.message}`, 'error');
    else showToast('Invoice defaults saved', 'success');
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
      <div className="p-6 md:p-10 overflow-y-auto relative max-w-[1600px]">
        <div className="animate-in fade-in duration-300">
          <PageHeader
            title="Platform Configuration"
            description="Manage dynamic pricing variables, pipeline add-ons, and site-wide copy (HTML supported)."
            breadcrumb="Admin / Settings"
            icon={<lucide.Settings className="text-purple-500 w-8 h-8" />}
            actions={
              <div className="flex bg-secondary border border-theme rounded-full p-1 gap-1 overflow-x-auto min-w-0">
                <button onClick={() => setActiveTab('ADDONS')} className={`shrink-0 whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'ADDONS' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                  Add-ons
                </button>
                <button onClick={() => setActiveTab('PRICING')} className={`shrink-0 whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'PRICING' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                  Pricing Tiers
                </button>
                <button onClick={() => setActiveTab('PAGES')} className={`shrink-0 whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'PAGES' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                  Pages
                </button>
                <button onClick={() => setActiveTab('CONTENT')} className={`shrink-0 whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'CONTENT' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                  Site Content (HTML)
                </button>
                <button onClick={() => setActiveTab('INVOICE')} className={`shrink-0 whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'INVOICE' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                  Invoice Defaults
                </button>
                <button onClick={() => setActiveTab('NOTIFICATIONS')} className={`shrink-0 whitespace-nowrap px-4 md:px-6 py-2 rounded-full text-xs font-bold transition ${activeTab === 'NOTIFICATIONS' ? 'bg-purple-500 text-white' : 'text-secondary hover:text-primary'}`}>
                  Push Notifications
                </button>
              </div>
            }
          />

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

          {/* PRICING TAB */}
          {activeTab === 'PRICING' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <p className="text-xs text-secondary max-w-2xl">
                Each tier can price per word or as a flat package — set "Pricing Model" when creating or editing a tier. Per-word pricing works on any service, not just Academic: pick it for a Content, Resume, Dev, or Statistics tier and clients will see a word-count field on that order page.
              </p>
              {(Object.keys(PRICING_CATEGORY_LABELS) as ServicePricingCategory[]).map(cat => {
                const tiersForCat = pricingTiers.filter(t => t.service_category === cat);
                return (
                  <div key={cat} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                        <lucide.Tag className="w-5 h-5" /> {PRICING_CATEGORY_LABELS[cat]}
                      </h2>
                      <button
                        onClick={() => setEditingTier({ service_category: cat, price_model: cat === 'ACADEMIC' ? 'PER_WORD' : 'FLAT', is_active: true, features: [], volume_discount_percent: 0, volume_discount_threshold_words: 10000, sort_order: tiersForCat.length })}
                        className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1"
                      >
                        <lucide.Plus className="w-4 h-4" /> New Tier
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tiersForCat.map(tier => (
                        <div key={tier.id} className={`p-6 rounded-2xl border transition ${tier.is_active ? 'bg-card border-theme' : 'bg-primary border-red-500/20 opacity-60'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 text-purple-400 rounded-md">{tier.tier_key}</span>
                            <button onClick={() => toggleTierStatus(tier.id, tier.is_active)} className={tier.is_active ? 'text-emerald-500' : 'text-red-500'}>
                              {tier.is_active ? <lucide.ToggleRight className="w-6 h-6" /> : <lucide.ToggleLeft className="w-6 h-6" />}
                            </button>
                          </div>
                          <h3 className="text-sm font-bold text-primary mb-1">{tier.name} {tier.highlight && <span className="text-amber-400">★</span>}</h3>
                          <p className="text-xs text-secondary mb-4 h-8 overflow-hidden">{tier.tagline}</p>
                          <div className="flex items-center justify-between border-t border-theme pt-4">
                            <div className="text-lg font-black text-primary">
                              {tier.price_model === 'PER_WORD' ? `₦${tier.rate_per_word}/word` : `₦${(tier.flat_price || 0).toLocaleString()}`}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingTier(tier)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-secondary transition"><lucide.Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => deleteTier(tier.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500 transition"><lucide.Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {tiersForCat.length === 0 && <p className="text-xs text-secondary col-span-full">No tiers configured yet — this service will only show "Propose Your Own Budget" until you add one.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGES TAB */}
          {activeTab === 'PAGES' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map(p => (
                  <button key={p.key} onClick={() => setActivePage(p.key)} className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${activePage === p.key ? 'bg-purple-500 text-white border-purple-500' : 'text-secondary border-theme hover:text-primary'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {activePage === 'home' ? (
                <div className="space-y-6">
                  <div className="bg-card border border-theme p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-purple-400">Hero</h3>
                      <div className="flex gap-2">
                        <button onClick={() => restoreHomeSection('hero')} className="text-[10px] font-bold text-secondary hover:text-primary flex items-center gap-1"><lucide.RotateCcw className="w-3 h-3" /> Restore sample</button>
                        <button onClick={() => saveHomeSection('hero')} disabled={saving} className="bg-white/5 hover:bg-white/10 text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"><lucide.Save className="w-3.5 h-3.5" /> Save</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <LabeledInput label="Badge" value={homeContent.hero.badge} onChange={v => setHomeContent(p => ({ ...p, hero: { ...p.hero, badge: v } }))} />
                      <LabeledInput label="Title — Prefix" value={homeContent.hero.title_prefix} onChange={v => setHomeContent(p => ({ ...p, hero: { ...p.hero, title_prefix: v } }))} />
                      <LabeledInput label="Title — Highlight 1" value={homeContent.hero.title_highlight_1} onChange={v => setHomeContent(p => ({ ...p, hero: { ...p.hero, title_highlight_1: v } }))} />
                      <LabeledInput label="Title — Mid" value={homeContent.hero.title_mid} onChange={v => setHomeContent(p => ({ ...p, hero: { ...p.hero, title_mid: v } }))} />
                      <LabeledInput label="Title — Highlight 2" value={homeContent.hero.title_highlight_2} onChange={v => setHomeContent(p => ({ ...p, hero: { ...p.hero, title_highlight_2: v } }))} />
                    </div>
                    <LabeledTextarea label="Subtitle" value={homeContent.hero.subtitle} onChange={v => setHomeContent(p => ({ ...p, hero: { ...p.hero, subtitle: v } }))} />
                  </div>

                  <div className="bg-card border border-theme p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-purple-400">Trust Bar Items</h3>
                      <div className="flex gap-2">
                        <button onClick={() => restoreHomeSection('trust_bar')} className="text-[10px] font-bold text-secondary hover:text-primary flex items-center gap-1"><lucide.RotateCcw className="w-3 h-3" /> Restore sample</button>
                        <button onClick={() => saveHomeSection('trust_bar')} disabled={saving} className="bg-white/5 hover:bg-white/10 text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"><lucide.Save className="w-3.5 h-3.5" /> Save</button>
                      </div>
                    </div>
                    <ListEditor
                      items={homeContent.trust_bar}
                      onChange={items => setHomeContent(p => ({ ...p, trust_bar: items }))}
                      renderItem={(item, i, update) => <input className="flex-1 bg-secondary border border-theme rounded-lg p-2 text-xs text-primary" value={item} onChange={e => update(e.target.value)} />}
                      newItem={() => 'New trust point'}
                    />
                  </div>

                  <div className="bg-card border border-theme p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-purple-400">Why Us Cards</h3>
                      <div className="flex gap-2">
                        <button onClick={() => restoreHomeSection('why_us')} className="text-[10px] font-bold text-secondary hover:text-primary flex items-center gap-1"><lucide.RotateCcw className="w-3 h-3" /> Restore sample</button>
                        <button onClick={() => saveHomeSection('why_us')} disabled={saving} className="bg-white/5 hover:bg-white/10 text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"><lucide.Save className="w-3.5 h-3.5" /> Save</button>
                      </div>
                    </div>
                    <ListEditor
                      items={homeContent.why_us}
                      onChange={items => setHomeContent(p => ({ ...p, why_us: items }))}
                      newItem={() => ({ icon: 'CheckCircle2', title: 'New Point', text: 'Describe it here.' })}
                      renderItem={(item, i, update) => (
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                          <input className="bg-secondary border border-theme rounded-lg p-2 text-xs text-primary" placeholder="Lucide icon name" value={item.icon} onChange={e => update({ ...item, icon: e.target.value })} />
                          <input className="bg-secondary border border-theme rounded-lg p-2 text-xs text-primary" placeholder="Title" value={item.title} onChange={e => update({ ...item, title: e.target.value })} />
                          <input className="bg-secondary border border-theme rounded-lg p-2 text-xs text-primary md:col-span-2" placeholder="Text" value={item.text} onChange={e => update({ ...item, text: e.target.value })} />
                        </div>
                      )}
                    />
                  </div>

                  <div className="bg-card border border-theme p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-purple-400">FAQs</h3>
                      <div className="flex gap-2">
                        <button onClick={() => restoreHomeSection('faqs')} className="text-[10px] font-bold text-secondary hover:text-primary flex items-center gap-1"><lucide.RotateCcw className="w-3 h-3" /> Restore sample</button>
                        <button onClick={() => saveHomeSection('faqs')} disabled={saving} className="bg-white/5 hover:bg-white/10 text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"><lucide.Save className="w-3.5 h-3.5" /> Save</button>
                      </div>
                    </div>
                    <ListEditor
                      items={homeContent.faqs}
                      onChange={items => setHomeContent(p => ({ ...p, faqs: items }))}
                      newItem={() => ({ q: 'New question?', a: 'Answer here.' })}
                      renderItem={(item, i, update) => (
                        <div className="flex-1 space-y-2">
                          <input className="w-full bg-secondary border border-theme rounded-lg p-2 text-xs text-primary font-bold" placeholder="Question" value={item.q} onChange={e => update({ ...item, q: e.target.value })} />
                          <textarea className="w-full bg-secondary border border-theme rounded-lg p-2 text-xs text-primary" rows={2} placeholder="Answer" value={item.a} onChange={e => update({ ...item, a: e.target.value })} />
                        </div>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-card border border-theme p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-purple-400">Hero</h3>
                      <div className="flex gap-2">
                        <button onClick={() => restoreOrderPageSection(activePage, 'hero')} className="text-[10px] font-bold text-secondary hover:text-primary flex items-center gap-1"><lucide.RotateCcw className="w-3 h-3" /> Restore sample</button>
                        <button onClick={() => saveOrderPageSection(activePage, 'hero')} disabled={saving} className="bg-white/5 hover:bg-white/10 text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"><lucide.Save className="w-3.5 h-3.5" /> Save</button>
                      </div>
                    </div>
                    <LabeledInput label="Badge" value={orderPageContent[activePage]?.hero.badge || ''} onChange={v => setOrderPageContent(p => ({ ...p, [activePage]: { ...p[activePage], hero: { ...p[activePage].hero, badge: v } } }))} />
                    <LabeledInput label="Title" value={orderPageContent[activePage]?.hero.title || ''} onChange={v => setOrderPageContent(p => ({ ...p, [activePage]: { ...p[activePage], hero: { ...p[activePage].hero, title: v } } }))} />
                    <LabeledTextarea label="Subtitle" value={orderPageContent[activePage]?.hero.subtitle || ''} onChange={v => setOrderPageContent(p => ({ ...p, [activePage]: { ...p[activePage], hero: { ...p[activePage].hero, subtitle: v } } }))} />
                  </div>

                  <div className="bg-card border border-theme p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-purple-400">"Propose Your Own Budget" Note</h3>
                      <div className="flex gap-2">
                        <button onClick={() => restoreOrderPageSection(activePage, 'budget_note')} className="text-[10px] font-bold text-secondary hover:text-primary flex items-center gap-1"><lucide.RotateCcw className="w-3 h-3" /> Restore sample</button>
                        <button onClick={() => saveOrderPageSection(activePage, 'budget_note')} disabled={saving} className="bg-white/5 hover:bg-white/10 text-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"><lucide.Save className="w-3.5 h-3.5" /> Save</button>
                      </div>
                    </div>
                    <p className="text-xs text-secondary">Shown to clients whenever the packages above cost more than they want to spend — invites them to propose their own budget instead.</p>
                    <LabeledInput label="Title" value={orderPageContent[activePage]?.budget_note.title || ''} onChange={v => setOrderPageContent(p => ({ ...p, [activePage]: { ...p[activePage], budget_note: { ...p[activePage].budget_note, title: v } } }))} />
                    <LabeledTextarea label="Explanation Text" value={orderPageContent[activePage]?.budget_note.text || ''} onChange={v => setOrderPageContent(p => ({ ...p, [activePage]: { ...p[activePage], budget_note: { ...p[activePage].budget_note, text: v } } }))} />
                  </div>
                </div>
              )}
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

          {/* INVOICE DEFAULTS TAB */}
          {activeTab === 'INVOICE' && invoiceDefaults && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
              <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2 mb-2">
                <lucide.FileText className="w-5 h-5" /> Invoice Prefill Defaults
              </h2>
              <p className="text-secondary text-sm">These values prefill the invoice builder and every auto-generated invoice. Update them once here instead of per invoice.</p>

              <Card padding="lg" className="space-y-5">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Contact Email (shown on invoices)</label>
                  <input type="email" className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none" value={invoiceDefaults.contact_email || ''} onChange={e => setInvoiceDefaults({ ...invoiceDefaults, contact_email: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Bank Name</label>
                    <input type="text" className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none" value={invoiceDefaults.bank_name || ''} onChange={e => setInvoiceDefaults({ ...invoiceDefaults, bank_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Account Name</label>
                    <input type="text" className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none" value={invoiceDefaults.account_name || ''} onChange={e => setInvoiceDefaults({ ...invoiceDefaults, account_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Account Number</label>
                    <input type="text" className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none" value={invoiceDefaults.account_number || ''} onChange={e => setInvoiceDefaults({ ...invoiceDefaults, account_number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Developer / Signature Name</label>
                  <input type="text" className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none" value={invoiceDefaults.developer_signature_name || ''} onChange={e => setInvoiceDefaults({ ...invoiceDefaults, developer_signature_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Default Terms & Conditions (one per line)</label>
                  <textarea
                    className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none resize-y font-mono"
                    rows={6}
                    value={(invoiceDefaults.default_terms || []).join('\n')}
                    onChange={e => setInvoiceDefaults({ ...invoiceDefaults, default_terms: e.target.value.split('\n').filter((l: string) => l.trim()) })}
                  />
                </div>
                <button onClick={saveInvoiceDefaults} disabled={saving} className="bg-purple-500 hover:bg-purple-400 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 disabled:opacity-50">
                  <lucide.Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Invoice Defaults'}
                </button>
              </Card>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'NOTIFICATIONS' && user && (
            <div className="max-w-2xl">
            <Card padding="lg" className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-purple-400 flex items-center gap-2 mb-2">
                  <lucide.BellRing className="w-5 h-5 text-purple-500" /> Admin Push Settings
                </h2>
                <p className="text-secondary text-sm">Configure push notifications for this device to receive alerts on new orders, payments, and client requests.</p>
              </div>
              <NotificationPreferencesPanel userId={user.id} />
            </Card>
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
                    { key: 'CUSTOM', label: 'Statistics, Maths, Financial & Fieldwork' },
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

      {/* Pricing Tier Edit Modal */}
      {editingTier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto py-10">
          <div className="bg-primary border border-theme rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-primary">{editingTier.id ? 'Edit Pricing Tier' : 'Create New Tier'}</h2>
              <button onClick={() => setEditingTier(null)} className="text-secondary hover:text-primary transition"><lucide.X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Tier Key (e.g. GOLD, STARTER)</label>
                  <input type="text" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary uppercase" value={editingTier.tier_key || ''} onChange={e => setEditingTier({ ...editingTier, tier_key: e.target.value.toUpperCase().replace(/\s+/g, '_') })} placeholder="STARTER" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Display Name</label>
                  <input type="text" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.name || ''} onChange={e => setEditingTier({ ...editingTier, name: e.target.value })} placeholder="Starter" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Tagline</label>
                <input type="text" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.tagline || ''} onChange={e => setEditingTier({ ...editingTier, tagline: e.target.value })} placeholder="Short one-line description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Pricing Model</label>
                  <select className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.price_model || 'FLAT'} onChange={e => setEditingTier({ ...editingTier, price_model: e.target.value as any })}>
                    <option value="FLAT">Flat Price (₦)</option>
                    <option value="PER_WORD">Per Word (₦/word)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">{editingTier.price_model === 'PER_WORD' ? 'Rate per Word (₦)' : 'Flat Price (₦)'}</label>
                  <input type="number" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={(editingTier.price_model === 'PER_WORD' ? editingTier.rate_per_word : editingTier.flat_price) || ''} onChange={e => setEditingTier(editingTier.price_model === 'PER_WORD' ? { ...editingTier, rate_per_word: Number(e.target.value) } : { ...editingTier, flat_price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Volume Discount (%)</label>
                  <input type="number" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.volume_discount_percent ?? ''} onChange={e => setEditingTier({ ...editingTier, volume_discount_percent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Discount Threshold (words)</label>
                  <input type="number" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.volume_discount_threshold_words ?? ''} onChange={e => setEditingTier({ ...editingTier, volume_discount_threshold_words: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Correction Cycles</label>
                  <input type="number" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.correction_cycles ?? ''} onChange={e => setEditingTier({ ...editingTier, correction_cycles: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Sort Order</label>
                  <input type="number" className="w-full bg-secondary border border-theme p-4 rounded-xl text-sm focus:border-purple-500 outline-none text-primary" value={editingTier.sort_order ?? ''} onChange={e => setEditingTier({ ...editingTier, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-2">Feature Bullets</label>
                <ListEditor
                  items={editingTier.features || []}
                  onChange={items => setEditingTier({ ...editingTier, features: items })}
                  newItem={() => 'New feature'}
                  renderItem={(item, i, update) => <input className="flex-1 bg-secondary border border-theme rounded-lg p-2 text-xs text-primary" value={item} onChange={e => update(e.target.value)} />}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={editingTier.highlight ?? false} onChange={e => setEditingTier({ ...editingTier, highlight: e.target.checked })} className="w-4 h-4 accent-purple-500 bg-primary border border-theme rounded" />
                <span className="text-sm text-primary font-bold">Mark as "Most Popular"</span>
              </label>
              <button onClick={saveTier} disabled={saving} className="w-full bg-purple-500 hover:bg-purple-400 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl transition mt-4">
                {saving ? 'Saving...' : 'Save Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-1">{label}</label>
      <input type="text" className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 block mb-1">{label}</label>
      <textarea className="w-full bg-secondary border border-theme p-3 rounded-xl text-sm text-primary focus:border-purple-500 outline-none resize-y" rows={3} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ListEditor<T>({ items, onChange, renderItem, newItem }: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, update: (v: T) => void) => React.ReactNode;
  newItem: () => T;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {renderItem(item, i, (v) => onChange(items.map((it, idx) => (idx === i ? v : it))))}
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-secondary hover:text-red-400 shrink-0 mt-2">
            <lucide.Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, newItem()])} className="text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 flex items-center gap-1">
        <lucide.Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  );
}