'use client';

import { useState } from 'react';
import { formatMoney, type SiteProduct } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

const BLANK = { title: '', description: '', category: 'General', product_type: 'physical', price: '', compare_at_price: '', stock_qty: '', image_url: '', digital_url: '' };

export default function ProductsTab({ site, products, reload }: { site: Site; products: SiteProduct[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const atLimit = plan.maxProducts !== null && products.length >= plan.maxProducts && !editing;
  const categories = Array.from(new Set(products.map((p) => p.category || 'General'))).sort();
  const shown = products.filter((p) => (cat === 'All' || (p.category || 'General') === cat) && (!q.trim() || `${p.title} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  const set = (k: keyof typeof BLANK, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload/drive', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) set('image_url', data.url);
      else setMsg(data.error || 'Upload failed.');
    } catch {
      setMsg('Upload failed. Check your connection.');
    }
    setUploading(false);
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
      image_url: form.image_url,
      digital_url: form.product_type === 'digital' ? form.digital_url : '',
    };
    const r = editing
      ? await jsonFetch(`/api/forums/${site.slug}/products/${editing}`, { method: 'PATCH', body: payload })
      : await jsonFetch(`/api/forums/${site.slug}/products`, { method: 'POST', body: payload });
    if (r.ok) {
      setForm({ ...BLANK });
      setEditing(null);
      await reload();
    } else {
      setMsg(r.data.error || 'Could not save the product.');
    }
    setBusy(false);
  };

  const edit = (p: SiteProduct) => {
    setEditing(p.id);
    setForm({
      title: p.title, description: p.description || '', category: p.category || 'General', product_type: p.product_type,
      price: String(p.price), compare_at_price: p.compare_at_price == null ? '' : String(p.compare_at_price),
      stock_qty: p.stock_qty == null ? '' : String(p.stock_qty), image_url: p.image_url || '', digital_url: p.digital_url || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="p-cat">Category</label>
          <input id="p-cat" list="p-cat-list" value={form.category} onChange={(e) => set('category', e.target.value)} className="input-box w-full" />
          <datalist id="p-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        {form.product_type === 'digital' && (
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="p-dl">Download link</label>
            <input id="p-dl" type="url" placeholder="https://…" value={form.digital_url} onChange={(e) => set('digital_url', e.target.value)} className="input-box w-full" />
            <p className="text-xs text-secondary mt-1">Buyers only receive this after you mark their order as paid.</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">Photo</label>
          {form.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image_url} alt="" className="w-24 h-24 rounded-2xl object-cover mb-2 border border-theme" />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => upload(e.target.files?.[0])} className="text-sm" />
          {uploading && <p className="text-xs text-secondary mt-1">Uploading…</p>}
        </div>
        {msg && <p className="text-sm text-danger" role="alert">{msg}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy || atLimit || uploading} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm({ ...BLANK }); }} className="text-sm px-4 h-11 rounded-full border border-theme">Cancel</button>
          )}
        </div>
      </form>

      <div className="lg:col-span-3 space-y-3">
        <p className="text-sm text-secondary">
          {products.length} {products.length === 1 ? 'product' : 'products'}
          {plan.maxProducts !== null && ` of ${plan.maxProducts} on the ${plan.name} plan`}
        </p>
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
        {shown.map((p) => (
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
                {!p.is_active && ' · hidden'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0 text-sm">
              <button onClick={() => edit(p)} className="px-3 h-9 rounded-full hover:bg-hover text-accent font-medium">Edit</button>
              <button onClick={() => toggle(p)} className="px-3 h-9 rounded-full hover:bg-hover">{p.is_active ? 'Hide' : 'Show'}</button>
              <button onClick={() => remove(p)} className="px-3 h-9 rounded-full hover:bg-hover text-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
