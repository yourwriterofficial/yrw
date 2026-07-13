'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import PageHeader from '@/app/components/ui/PageHeader';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
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

  if (loading) return <LoadingScreen label="Loading dev shop..." accent="purple" />;

  return (
    <div className="p-6 md:p-10">
      <PageHeader
        title="Dev Shop"
        description="Manage the /developer page content and the script marketplace catalogue."
        breadcrumb="Admin / Dev Shop"
        icon={<lucide.ShoppingBag className="w-8 h-8 text-cyan-500" />}
        actions={
          tab === 'products' ? (
            <button onClick={() => { setEditing({ ...BLANK }); setTechInput(''); }} className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <lucide.Plus className="w-4 h-4" /> New Script
            </button>
          ) : null
        }
      />

      <div className="flex bg-secondary border border-theme rounded-full p-1 w-fit mb-6">
        <button onClick={() => setTab('products')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${tab === 'products' ? 'bg-cyan-500 text-black' : 'text-secondary hover:text-primary'}`}>Scripts ({products.length})</button>
        <button onClick={() => setTab('settings')} className={`px-6 py-2 rounded-full text-xs font-bold transition ${tab === 'settings' ? 'bg-cyan-500 text-black' : 'text-secondary hover:text-primary'}`}>Page Content</button>
      </div>

      {tab === 'products' && (
        <div className="bg-secondary border border-theme rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card border-b border-theme text-secondary text-[10px] uppercase tracking-wider">
                <tr><th className="p-4">Script</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Source File</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="p-4 font-bold text-primary max-w-sm"><span className="line-clamp-2">{p.title}</span></td>
                    <td className="p-4 text-secondary">{p.category}</td>
                    <td className="p-4 font-black text-cyan-500">₦{Number(p.price).toLocaleString()}</td>
                    <td className="p-4">
                      {p.file_path ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Uploaded</span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/10 text-red-400">Missing</span>
                      )}
                    </td>
                    <td className="p-4">
                      <button onClick={() => toggleActive(p)} className={`text-[10px] font-black uppercase px-2 py-1 rounded ${p.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-secondary'}`}>{p.is_active ? 'Active' : 'Hidden'}</button>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditing({ ...p, tech_stack: [...p.tech_stack], license_terms: p.license_terms || '' }); setTechInput(''); }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-primary"><lucide.Pencil className="w-4 h-4" /></button>
                        <button onClick={() => removeProduct(p)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"><lucide.Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-secondary text-sm">No scripts yet — add your first one.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
