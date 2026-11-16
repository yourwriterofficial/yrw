'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import Button from '@/app/components/ui/Button';
import { showToast } from '@/app/components/ui/Toast';

type Product = {
  id?: number;
  title: string;
  slug: string;
  category: string;
  description: string;
  tech_stack: string[];
  price: number;
  preview_images: string[];
  file_path: string | null;
  license_terms: string;
  is_active: boolean;
  sort_order: number;
};

type Capability = { icon: string; title: string; description: string };

const ICON_OPTIONS = ['Code2', 'Smartphone', 'Server', 'Database', 'Rocket', 'Layers', 'Terminal', 'ShoppingBag'];

const DEFAULT_LICENSE = 'Single-project use license: you may use this script in one live project. Redistribution or resale of the source code itself is not permitted.';

const BLANK: Product = {
  title: '', slug: '', category: 'General', description: '', tech_stack: [],
  price: 0, preview_images: [], file_path: null, license_terms: DEFAULT_LICENSE, is_active: true, sort_order: 0,
};

const slugify = (title: string) =>
  title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

export default function AdminDevShopPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'settings'>('products');
  const [shopQuery, setShopQuery] = useState('');
  const [shopCat, setShopCat] = useState('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [techInput, setTechInput] = useState('');

  const [heroTitle, setHeroTitle] = useState('');
  const [heroDescription, setHeroDescription] = useState('');
  const [shopTitle, setShopTitle] = useState('Ready-Made Scripts');
  const [shopDescription, setShopDescription] = useState('');
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [newCap, setNewCap] = useState<Capability>({ icon: 'Code2', title: '', description: '' });

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return router.push('/dashboard/client');

    const { data: productsData } = await supabase.from('dev_products').select('*').order('sort_order');
    setProducts((productsData as Product[]) || []);

    const { data: settingsData } = await supabase.from('developer_page_settings').select('*');
    if (settingsData) {
      settingsData.forEach((row: any) => {
        if (row.key === 'hero') {
          setHeroTitle(row.value.hero_title || '');
          setHeroDescription(row.value.hero_description || '');
        }
        if (row.key === 'shop_intro') {
          setShopTitle(row.value.shop_title || 'Ready-Made Scripts');
          setShopDescription(row.value.shop_description || '');
        }
        if (row.key === 'capabilities' && Array.isArray(row.value)) {
          setCapabilities(row.value);
        }
      });
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const saveSetting = async (key: string, value: any) => {
    setSaving(true);
    const { error } = await supabase.from('developer_page_settings').upsert({
      key, value, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return showToast(error.message, 'error');
    showToast('Settings saved', 'success');
  };

  const saveProduct = async () => {
    if (!editing) return;
    if (!editing.title.trim()) return showToast('Title is required.', 'error');
    setSaving(true);
    const payload = {
      title: editing.title.trim(),
      slug: editing.slug.trim() || slugify(editing.title),
      category: editing.category.trim() || 'General',
      description: editing.description || null,
      tech_stack: editing.tech_stack,
      price: Number(editing.price) || 0,
      preview_images: editing.preview_images,
      file_path: editing.file_path,
      license_terms: editing.license_terms || null,
      is_active: editing.is_active,
      sort_order: Number(editing.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from('dev_products').update(payload).eq('id', editing.id)
      : await supabase.from('dev_products').insert(payload);
    setSaving(false);
    if (error) return showToast(error.message, 'error');
    showToast(editing.id ? 'Script updated' : 'Script created', 'success');
    setEditing(null);
    load();
  };

  const removeProduct = async (p: Product) => {
    const { count } = await supabase
      .from('dev_product_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', p.id);

    if (count && count > 0) {
      const deactivateInstead = confirm(
        `"${p.title}" has ${count} purchase(s) — deleting it would break those buyers' download library, so it can't be removed.\n\nHide it from the shop instead?`
      );
      if (deactivateInstead) {
        await supabase.from('dev_products').update({ is_active: false }).eq('id', p.id);
        showToast('Script hidden from the shop', 'success');
        load();
      }
      return;
    }

    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('dev_products').delete().eq('id', p.id);
    if (error) return showToast(error.message, 'error');
    showToast('Script deleted', 'success');
    load();
  };

  const toggleActive = async (p: Product) => {
    await supabase.from('dev_products').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  };

  const uploadPreviews = async (files: FileList) => {
    if (!editing) return;
    setUploadingPreview(true);
    const slug = editing.slug.trim() || slugify(editing.title) || 'script';
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${slug}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
      const { error } = await supabase.storage.from('dev-shop-previews').upload(path, file);
      if (error) { showToast(error.message, 'error'); continue; }
      uploaded.push(path);
    }
    setEditing({ ...editing, preview_images: [...editing.preview_images, ...uploaded] });
    setUploadingPreview(false);
  };

  const uploadZip = async (file: File) => {
    if (!editing) return;
    setUploadingFile(true);
    const slug = editing.slug.trim() || slugify(editing.title) || 'script';
    const ext = file.name.split('.').pop();
    const path = `${slug}/source_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('dev-shop-files').upload(path, file);
    setUploadingFile(false);
    if (error) return showToast(error.message, 'error');
    setEditing({ ...editing, file_path: path });
    showToast('Source file uploaded', 'success');
  };

  const previewUrl = (path: string) => supabase.storage.from('dev-shop-previews').getPublicUrl(path).data.publicUrl;

  if (loading) return <LoadingScreen label="Loading dev shop..." accent="brand" />;

  return (
    <div className="p-6 md:p-10 max-w-6xl">
      <PageHeader
        title="Script Shop"
        description="The ready-made scripts you sell on developa.me, and the text on the /developer page."
        icon={<lucide.ShoppingBag className="w-7 h-7 text-accent" />}
        actions={
          tab === 'products' ? (
            <Button size="sm" onClick={() => { setEditing({ ...BLANK }); setTechInput(''); }}>
              <lucide.Plus className="w-4 h-4" /> New Script
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-secondary/60 border border-theme w-full sm:w-fit mb-6" role="tablist">
        <button role="tab" aria-selected={tab === 'products'} onClick={() => setTab('products')} className={`h-9 px-5 rounded-lg text-sm font-semibold ${tab === 'products' ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>Scripts ({products.length})</button>
        <button role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')} className={`h-9 px-5 rounded-lg text-sm font-semibold ${tab === 'settings' ? 'bg-card shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}>Page text</button>
      </div>

      {tab === 'products' && (() => {
        const cats = Array.from(new Set(products.map((x) => x.category).filter(Boolean)));
        const shownProducts = products.filter((x) => (shopCat === 'all' || x.category === shopCat) && (!shopQuery.trim() || x.title.toLowerCase().includes(shopQuery.trim().toLowerCase())));
        const live = products.filter((x) => x.is_active).length;
        const missing = products.filter((x) => !x.file_path).length;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Scripts', value: products.length },
                { label: 'On sale (shown)', value: live },
                { label: 'No source file yet', value: missing, warn: missing > 0 },
              ].map((x) => (
                <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
                  <p className="text-xs font-semibold text-secondary truncate">{x.label}</p>
                  <p className={`text-xl font-black mt-1 tabular-nums ${x.warn ? 'text-warning' : ''}`}>{x.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input value={shopQuery} onChange={(e) => setShopQuery(e.target.value)} placeholder="Search scripts" aria-label="Search scripts" className="h-10 flex-1 min-w-[180px] rounded-xl border border-theme bg-card px-3 text-sm" />
              <select value={shopCat} onChange={(e) => setShopCat(e.target.value)} aria-label="Category" className="h-10 rounded-xl border border-theme bg-card px-3 text-sm font-medium">
                <option value="all">All categories</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="bg-card border border-theme rounded-2xl overflow-hidden">
              {shownProducts.length === 0 ? (
                <p className="p-10 text-center text-secondary text-sm">{products.length === 0 ? 'No scripts yet. Add your first one.' : 'No scripts match.'}</p>
              ) : (
                <ul className="divide-y divide-theme">
                  {shownProducts.map((p) => (
                    <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="text-sm font-semibold line-clamp-2">{p.title}</p>
                        <p className="text-xs text-secondary">{p.category}</p>
                      </div>
                      <p className="text-sm font-black tabular-nums whitespace-nowrap shrink-0">₦{Number(p.price).toLocaleString()}</p>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md shrink-0 ${p.file_path ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{p.file_path ? 'File uploaded' : 'File missing'}</span>
                      <button onClick={() => toggleActive(p)} role="switch" aria-checked={p.is_active} aria-label={`${p.title} ${p.is_active ? 'shown' : 'hidden'}`} className="flex items-center gap-2 text-xs font-semibold shrink-0">
                        <span className={`relative w-10 h-5 rounded-full transition ${p.is_active ? 'bg-accent' : 'bg-secondary border border-theme'}`}><span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.is_active ? 'translate-x-5' : ''}`} /></span>
                        <span className="w-12 text-left text-secondary">{p.is_active ? 'Shown' : 'Hidden'}</span>
                      </button>
                      <div className="flex gap-2 shrink-0">
                        <Button size="icon" variant="secondary" aria-label={`Edit ${p.title}`} onClick={() => { setEditing({ ...p, tech_stack: [...p.tech_stack], license_terms: p.license_terms || '' }); setTechInput(''); }}><lucide.Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="danger" aria-label={`Delete ${p.title}`} onClick={() => removeProduct(p)}><lucide.Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })()}

      {tab === 'settings' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-secondary border border-theme rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black uppercase text-cyan-400 mb-2 flex items-center gap-2">
              <lucide.FileText className="w-5 h-5" /> Hero Content
            </h2>
            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Hero Title</label>
              <input type="text" value={heroTitle} onChange={e => setHeroTitle(e.target.value)} className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Hero Description</label>
              <textarea rows={3} value={heroDescription} onChange={e => setHeroDescription(e.target.value)} className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary resize-y" />
            </div>
            <button
              onClick={() => saveSetting('hero', { hero_title: heroTitle, hero_description: heroDescription })}
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              Save Hero
            </button>
          </div>

          <div className="bg-secondary border border-theme rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black uppercase text-cyan-400 mb-2 flex items-center gap-2">
              <lucide.ShoppingBag className="w-5 h-5" /> Shop Section Intro
            </h2>
            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Shop Title</label>
              <input type="text" value={shopTitle} onChange={e => setShopTitle(e.target.value)} className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Shop Description</label>
              <textarea rows={2} value={shopDescription} onChange={e => setShopDescription(e.target.value)} className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary resize-y" />
            </div>
            <button
              onClick={() => saveSetting('shop_intro', { shop_title: shopTitle, shop_description: shopDescription })}
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              Save Shop Intro
            </button>
          </div>

          <div className="bg-secondary border border-theme rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-black uppercase text-cyan-400 mb-2 flex items-center gap-2">
              <lucide.Layers className="w-5 h-5" /> Capability Cards
            </h2>
            {capabilities.length > 0 && (
              <div className="space-y-2">
                {capabilities.map((cap, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-primary border border-theme rounded-xl p-3">
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-white/5 text-secondary shrink-0">{cap.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary">{cap.title}</p>
                      <p className="text-xs text-secondary">{cap.description}</p>
                    </div>
                    <button onClick={() => setCapabilities(capabilities.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 shrink-0"><lucide.Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-theme/20 pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={newCap.icon} onChange={e => setNewCap({ ...newCap, icon: e.target.value })} className="bg-primary border border-theme rounded-xl p-3 text-sm text-primary">
                  {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input type="text" placeholder="Card title" value={newCap.title} onChange={e => setNewCap({ ...newCap, title: e.target.value })} className="md:col-span-2 bg-primary border border-theme rounded-xl p-3 text-sm text-primary" />
              </div>
              <textarea rows={2} placeholder="Card description" value={newCap.description} onChange={e => setNewCap({ ...newCap, description: e.target.value })} className="w-full bg-primary border border-theme rounded-xl p-3 text-sm text-primary resize-y" />
              <button
                onClick={() => {
                  if (!newCap.title.trim()) return showToast('Card title is required.', 'error');
                  setCapabilities([...capabilities, newCap]);
                  setNewCap({ icon: 'Code2', title: '', description: '' });
                }}
                className="bg-white/5 hover:bg-white/10 text-primary border border-theme px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
              >
                Add Card
              </button>
            </div>

            <button
              onClick={() => saveSetting('capabilities', capabilities)}
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
            >
              Save Capability Cards
            </button>
          </div>
        </div>
      )}

      {/* Product editor modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-primary border border-theme rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-primary">{editing.id ? 'Edit Script' : 'New Script'}</h2>
              <button onClick={() => setEditing(null)}><lucide.X className="w-5 h-5 text-secondary hover:text-primary" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Title *</label>
                <input
                  className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary"
                  value={editing.title}
                  onChange={e => setEditing({ ...editing, title: e.target.value, slug: editing.slug || slugify(e.target.value) })}
                  placeholder="e.g. Subskriptions Starter Kit"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Slug</label>
                <input className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-mono" value={editing.slug} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Category</label>
                  <input
                    className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary"
                    list="dev-shop-categories"
                    value={editing.category}
                    onChange={e => setEditing({ ...editing, category: e.target.value })}
                    placeholder="e.g. Subskriptions"
                  />
                  <datalist id="dev-shop-categories">
                    {Array.from(new Set(products.map(p => p.category))).map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Price (₦)</label>
                  <input type="number" className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary font-mono" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Description</label>
                <textarea rows={3} className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary resize-y" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-2">Tech Stack Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editing.tech_stack.map((t, i) => (
                    <span key={i} className="bg-white/5 border border-theme text-primary text-xs px-3 py-1 rounded-full flex items-center gap-2">
                      {t}
                      <button onClick={() => setEditing({ ...editing, tech_stack: editing.tech_stack.filter((_, ix) => ix !== i) })} className="text-red-400 hover:text-red-500 font-bold">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Next.js"
                    value={techInput}
                    onChange={e => setTechInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && techInput.trim()) {
                        e.preventDefault();
                        setEditing({ ...editing, tech_stack: [...editing.tech_stack, techInput.trim()] });
                        setTechInput('');
                      }
                    }}
                    className="flex-1 bg-secondary border border-theme rounded-xl px-3 py-2 text-xs text-primary"
                  />
                  <button
                    onClick={() => { if (techInput.trim()) { setEditing({ ...editing, tech_stack: [...editing.tech_stack, techInput.trim()] }); setTechInput(''); } }}
                    className="bg-white/5 hover:bg-white/10 text-primary border border-theme px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-2">Preview Screenshots</label>
                {editing.preview_images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {editing.preview_images.map((path, i) => (
                      <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-theme">
                        <Image src={previewUrl(path)} alt="" fill sizes="33vw" className="object-cover" />
                        <button
                          onClick={() => setEditing({ ...editing, preview_images: editing.preview_images.filter((_, ix) => ix !== i) })}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white text-xs"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="border-2 border-dashed border-theme hover:border-cyan-500/50 bg-secondary rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition">
                  <lucide.Upload className="w-5 h-5 text-secondary mb-1" />
                  <span className="text-xs font-bold text-secondary">{uploadingPreview ? 'Uploading...' : 'Upload Screenshots'}</span>
                  <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingPreview} onChange={e => e.target.files && uploadPreviews(e.target.files)} />
                </label>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-2">Source Code File (.zip)</label>
                {editing.file_path && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/20 mb-2">
                    <lucide.FileArchive className="w-4 h-4 shrink-0" /> <span className="truncate">{editing.file_path.split('/').pop()}</span>
                  </div>
                )}
                <label className="border-2 border-dashed border-theme hover:border-cyan-500/50 bg-secondary rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition">
                  <lucide.Upload className="w-5 h-5 text-secondary mb-1" />
                  <span className="text-xs font-bold text-secondary">{uploadingFile ? 'Uploading...' : editing.file_path ? 'Replace Source File' : 'Upload Source File'}</span>
                  <input type="file" className="hidden" disabled={uploadingFile} onChange={e => e.target.files?.[0] && uploadZip(e.target.files[0])} />
                </label>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">License Terms (shown on product detail page)</label>
                <textarea rows={3} className="w-full bg-secondary border border-theme rounded-xl p-3 text-sm text-primary resize-y" value={editing.license_terms} onChange={e => setEditing({ ...editing, license_terms: e.target.value })} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-primary font-bold">
                <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 accent-cyan-500" /> Visible in shop
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-primary py-3 rounded-xl text-xs font-black uppercase tracking-wider transition">Cancel</button>
              <button onClick={saveProduct} disabled={saving} className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-3 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Script'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
