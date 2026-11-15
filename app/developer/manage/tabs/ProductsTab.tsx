'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { formatMoney, type SiteProduct } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';
import VariantEditorModal from './VariantEditorModal';
import ReviewsPanel from './ReviewsPanel';
import ProductCsvImportModal from './ProductCsvImportModal';

const BLANK = {
  title: '',
  description: '',
  category: 'General',
  product_type: 'physical',
  price: '',
  compare_at_price: '',
  stock_qty: '',
  low_stock_at: '3',
  digital_url: '',
};

export default function ProductsTab({ site, products, reload }: { site: Site; products: SiteProduct[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ ...BLANK });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [variantProduct, setVariantProduct] = useState<SiteProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const atLimit = plan.maxProducts !== null && products.length >= plan.maxProducts && !editing;
  const categories = Array.from(new Set(products.map((p) => p.category || 'General'))).sort();
  const shown = products.filter((p) => (cat === 'All' || (p.category || 'General') === cat) && (!q.trim() || `${p.title} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  const set = (k: keyof typeof BLANK, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (imageUrls.length >= plan.maxProductPhotos) {
      setMsg(
        plan.maxProductPhotos === 1
          ? 'The Starter plan allows 1 photo per product. Upgrade to Pro for up to 6 photos.'
          : `Maximum ${plan.maxProductPhotos} photos per product.`
      );
      return;
    }
    setUploading(true);
    setMsg('');
    const next = [...imageUrls];
    for (const file of Array.from(files)) {
      if (next.length >= plan.maxProductPhotos) break;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/upload/drive', { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok && data.url) next.push(data.url);
        else setMsg(data.error || 'Upload failed.');
      } catch {
        setMsg('Upload failed. Check your connection.');
      }
    }
    setImageUrls(next);
    setUploading(false);
  };

  const movePhoto = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= imageUrls.length) return;
    const copy = [...imageUrls];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setImageUrls(copy);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category || 'General',
      product_type: form.product_type,
      price: Number(form.price),
      compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
      low_stock_at: form.low_stock_at === '' ? 3 : Number(form.low_stock_at),
      image_url: imageUrls[0] || '',
      image_urls: imageUrls,
      digital_url: form.product_type === 'digital' ? form.digital_url : '',
    };
    const r = editing
      ? await jsonFetch(`/api/forums/${site.slug}/products/${editing}`, { method: 'PATCH', body: payload })
      : await jsonFetch(`/api/forums/${site.slug}/products`, { method: 'POST', body: payload });
    if (r.ok) {
      setForm({ ...BLANK });
      setImageUrls([]);
      setEditing(null);
      await reload();
    } else {
      setMsg(r.data.error || 'Could not save the product.');
    }
    setBusy(false);
  };

  const populateForm = (p: SiteProduct, asCopy = false) => {
    setEditing(asCopy ? null : p.id);
    setForm({
      title: asCopy ? `${p.title} (Copy)` : p.title,
      description: p.description || '',
      category: p.category || 'General',
      product_type: p.product_type,
      price: String(p.price),
      compare_at_price: p.compare_at_price == null ? '' : String(p.compare_at_price),
      stock_qty: p.stock_qty == null ? '' : String(p.stock_qty),
      low_stock_at: String(p.low_stock_at ?? 3),
      digital_url: p.digital_url || '',
    });
    const urls = Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls : p.image_url ? [p.image_url] : [];
    setImageUrls(urls);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const edit = (p: SiteProduct) => populateForm(p, false);
  const duplicate = (p: SiteProduct) => populateForm(p, true);

  const toggle = async (p: SiteProduct) => {
    await jsonFetch(`/api/forums/${site.slug}/products/${p.id}`, { method: 'PATCH', body: { is_active: !p.is_active } });
    await reload();
  };
  const remove = async (p: SiteProduct) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await jsonFetch(`/api/forums/${site.slug}/products/${p.id}`, { method: 'DELETE' });
    await reload();
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <form onSubmit={save} className="lg:col-span-2 g-card p-5 space-y-4 h-fit">
        <h3 className="font-medium">{editing ? 'Edit product' : 'Add a product'}</h3>
        {atLimit && (
          <p className="text-sm text-warning">The {plan.name} plan allows {plan.maxProducts} products. Upgrade to Pro for unlimited products.</p>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="p-title">Name</label>
          <input id="p-title" required value={form.title} onChange={(e) => set('title', e.target.value)} className="input-box w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="p-desc">Description</label>
          <textarea id="p-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="input-box w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-price">Price</label>
            <input id="p-price" type="number" min={0} required value={form.price} onChange={(e) => set('price', e.target.value)} className="input-box w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-was">Old price <span className="text-secondary font-normal">(optional)</span></label>
            <input id="p-was" type="number" min={0} value={form.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} className="input-box w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-type">Type</label>
            <select id="p-type" value={form.product_type} onChange={(e) => set('product_type', e.target.value)} className="input-box w-full">
              <option value="physical">Physical item</option>
              <option value="digital">Digital download</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-stock">Stock <span className="text-secondary font-normal">(blank = unlimited)</span></label>
            <input id="p-stock" type="number" min={0} value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} className="input-box w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-cat">Category</label>
            <input id="p-cat" list="p-cat-list" value={form.category} onChange={(e) => set('category', e.target.value)} className="input-box w-full" />
            <datalist id="p-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-low">Low-stock alert at</label>
            <input id="p-low" type="number" min={0} max={1000} value={form.low_stock_at} onChange={(e) => set('low_stock_at', e.target.value)} className="input-box w-full" />
          </div>
        </div>
        {form.product_type === 'digital' && (
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-dl">Download link</label>
            <input id="p-dl" type="url" placeholder="https://…" value={form.digital_url} onChange={(e) => set('digital_url', e.target.value)} className="input-box w-full" />
            <p className="text-xs text-secondary mt-1">Buyers only receive this after you mark their order as paid.</p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium">Photos ({imageUrls.length}/{plan.maxProductPhotos})</label>
            {plan.maxProductPhotos === 1 && <span className="text-xs text-secondary">Up to 6 on Pro</span>}
          </div>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {imageUrls.map((url, idx) => (
                <div key={url + idx} className="relative group w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-theme" />
                  <div className="flex items-center justify-between gap-0.5 mt-1">
                    <button type="button" onClick={() => movePhoto(idx, -1)} disabled={idx === 0} aria-label="Move photo left" className="p-1 rounded border border-theme disabled:opacity-30"><ArrowLeft className="w-3 h-3" /></button>
                    <button type="button" onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove photo" className="p-1 rounded border border-theme text-danger"><X className="w-3 h-3" /></button>
                    <button type="button" onClick={() => movePhoto(idx, 1)} disabled={idx === imageUrls.length - 1} aria-label="Move photo right" className="p-1 rounded border border-theme disabled:opacity-30"><ArrowRight className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            multiple={plan.maxProductPhotos > 1}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => upload(e.target.files)}
            className="text-sm w-full"
          />
          {uploading && <p className="text-xs text-secondary mt-1">Uploading…</p>}
        </div>
        {msg && <p className="text-sm text-danger" role="alert">{msg}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy || atLimit || uploading} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm({ ...BLANK }); setImageUrls([]); }} className="text-sm px-4 h-11 rounded-full border border-theme">Cancel</button>
          )}
        </div>
      </form>

      <div className="lg:col-span-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-secondary">
            {products.length} {products.length === 1 ? 'product' : 'products'}
            {plan.maxProducts !== null && ` of ${plan.maxProducts} on the ${plan.name} plan`}
          </p>
          <button
            type="button"
            onClick={() => {
              if (plan.bulkImport) setImportOpen(true);
              else setMsg('CSV bulk product import is available on Pro and Business plans.');
            }}
            className="text-xs font-medium px-3.5 h-9 rounded-full border border-theme hover:bg-hover"
          >
            Import CSV
          </button>
        </div>
        {products.length === 0 && <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No products yet. Add your first one on the left.</p>}
        {products.length > 4 && (
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products" aria-label="Search your products" className="input-box flex-1 min-w-[180px] !py-2.5 text-sm" />
            {categories.length > 1 && (
              <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category" className="input-box !py-2.5 text-sm">
                <option value="All">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        )}
        {products.length > 0 && shown.length === 0 && <p className="text-sm text-secondary">No products match.</p>}
        {shown.map((p) => {
          const photoCount = Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls.length : p.image_url ? 1 : 0;
          return (
            <div key={p.id} className="g-card p-4 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-xl bg-secondary overflow-hidden shrink-0 flex items-center justify-center text-secondary text-xs">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                ) : 'No photo'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-sm text-secondary">
                  {formatMoney(p.price, site.currency)} · {p.product_type}
                  {p.stock_qty != null && ` · ${p.stock_qty} in stock`}
                  {photoCount > 1 && ` · ${photoCount} photos`}
                  {(p.variants?.length ?? 0) > 0 && ` · ${p.variants!.length} variants`}
                  {!p.is_active && ' · hidden'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 shrink-0 text-sm">
                <button onClick={() => setVariantProduct(p)} className="px-3 h-9 rounded-full hover:bg-hover font-medium">Variants</button>
                <button onClick={() => duplicate(p)} className="px-3 h-9 rounded-full hover:bg-hover">Duplicate</button>
                <button onClick={() => edit(p)} className="px-3 h-9 rounded-full hover:bg-hover text-accent font-medium">Edit</button>
                <button onClick={() => toggle(p)} className="px-3 h-9 rounded-full hover:bg-hover">{p.is_active ? 'Hide' : 'Show'}</button>
                <button onClick={() => remove(p)} className="px-3 h-9 rounded-full hover:bg-hover text-danger">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {variantProduct && (
        <VariantEditorModal
          site={site}
          product={variantProduct}
          onClose={() => setVariantProduct(null)}
          onSaved={reload}
        />
      )}
      {importOpen && (
        <ProductCsvImportModal
          site={site}
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}
      <ReviewsPanel site={site} products={products} />
    </div>
  );
}
