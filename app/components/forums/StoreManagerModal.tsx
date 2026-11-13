'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, Plus, Trash2, Check, Package, ShoppingBag, Settings, Globe, Upload, ShieldCheck } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { formatMoney, type ForumSummary, type SiteOrder, type SiteProduct, validateCustomDomain } from '@/lib/forums';
import { SITE_TEMPLATES, type ProductType, type SiteMode } from '@/lib/siteTemplates';

export default function StoreManagerModal({
  site,
  products,
  onClose,
  onUpdated,
}: {
  site: ForumSummary;
  products: SiteProduct[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [tab, setTab] = useState<'products' | 'orders' | 'settings'>('products');
  const [orders, setOrders] = useState<SiteOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Add product form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [productType, setProductType] = useState<ProductType>('physical');
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProd, setSavingProd] = useState(false);

  // Settings form
  const [siteMode, setSiteMode] = useState<SiteMode>(site.site_mode || 'store');
  const [templateId, setTemplateId] = useState<string>(site.template_id || 'retail-store');
  const [customDomain, setCustomDomain] = useState(site.custom_domain || '');
  const [domainError, setDomainError] = useState('');
  const [heroHeadline, setHeroHeadline] = useState(site.hero_headline || '');
  const [heroSubheadline, setHeroSubheadline] = useState(site.hero_subheadline || '');
  const [currency, setCurrency] = useState<'NGN' | 'USD' | 'GBP'>((site.currency as 'NGN' | 'USD' | 'GBP') || 'NGN');
  const [whatsapp, setWhatsapp] = useState(site.whatsapp_number || '');
  const [bankName, setBankName] = useState(site.bank_name || '');
  const [bankAcctNo, setBankAcctNo] = useState(site.bank_account_number || '');
  const [bankAcctName, setBankAcctName] = useState(site.bank_account_name || '');
  const [payNote, setPayNote] = useState(site.payment_instructions || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/orders`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } finally {
      setLoadingOrders(false);
    }
  }, [site.slug]);

  useEffect(() => {
    if (tab !== 'orders') return;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoadingOrders(true);
      await loadOrders();
    })();
    return () => { active = false; };
  }, [tab, loadOrders]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setFeedback('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/drive', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        setFeedback(data.provider === 'google_drive' ? 'Uploaded to Google Drive.' : 'Image attached.');
      } else {
        setFeedback(data.error || 'Upload failed.');
      }
    } catch {
      setFeedback('Error uploading image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProd(true);
    setFeedback('');
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          product_type: productType,
          price: Number(price || 0),
          stock_qty: stockQty ? Number(stockQty) : null,
          image_url: imageUrl,
        }),
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        setPrice('');
        setStockQty('');
        setImageUrl('');
        setFeedback('Product added.');
        onUpdated();
      }
    } finally {
      setSavingProd(false);
    }
  };

  const handleToggleProduct = async (p: SiteProduct) => {
    await fetch(`/api/forums/${encodeURIComponent(site.slug)}/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    onUpdated();
  };

  const handleDeleteProduct = async (p: SiteProduct) => {
    await fetch(`/api/forums/${encodeURIComponent(site.slug)}/products/${p.id}`, { method: 'DELETE' });
    onUpdated();
  };

  const handleOrderStatus = async (orderId: string, updates: Record<string, string>) => {
    const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) loadOrders();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setDomainError('');
    if (customDomain.trim()) {
      const err = validateCustomDomain(customDomain.trim());
      if (err) {
        setDomainError(err);
        return;
      }
    }
    setSavingSettings(true);
    setFeedback('');
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_mode: siteMode,
          template_id: templateId,
          custom_domain: customDomain.trim().toLowerCase() || null,
          hero_headline: heroHeadline,
          hero_subheadline: heroSubheadline,
          currency,
          whatsapp_number: whatsapp,
          bank_name: bankName,
          bank_account_number: bankAcctNo,
          bank_account_name: bankAcctName,
          payment_instructions: payNote,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback('Store settings saved.');
        onUpdated();
      } else {
        setFeedback(data.error || 'Failed to save settings.');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-primary border border-theme rounded-2xl overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between">
          <div>
            <h2 className="font-black text-lg">Manage {site.name}</h2>
            <p className="text-xs font-mono text-cyan-400">{site.slug}.developa.me</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-card text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-3 border-b border-theme">
          {[
            { id: 'products', label: `Products (${products.length})`, Icon: Package },
            { id: 'orders', label: 'Orders', Icon: ShoppingBag },
            { id: 'settings', label: 'Bank & Settings', Icon: Settings },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as typeof tab)}
              className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition ${
                tab === id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {feedback && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> {feedback}
            </div>
          )}

          {tab === 'products' && (
            <>
              <form onSubmit={handleAddProduct} className="bg-card border border-theme rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-cyan-400" /> Add Product / Service
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Product Title"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  />
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                    className="px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  >
                    <option value="physical">Physical Item</option>
                    <option value="digital">Digital Download</option>
                    <option value="service">Service / Booking</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="number"
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={`Price (${currency})`}
                    className="px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  />
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category"
                    className="px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder="Stock (blank = unlimited)"
                    className="px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-2 rounded-lg bg-primary border border-theme hover:border-cyan-500 text-xs text-secondary hover:text-primary flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{uploadingImage ? 'Uploading to Drive...' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                  {imageUrl && (
                    <div className="flex items-center gap-2">
                      <Image src={imageUrl} alt="Preview" width={28} height={28} unoptimized className="w-7 h-7 rounded object-cover border border-theme" />
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Image attached</span>
                    </div>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description..."
                  className="w-full px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                />
                <Button type="submit" variant="primary" disabled={savingProd}>
                  {savingProd ? 'Adding...' : 'Add Product'}
                </Button>
              </form>

              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-card border border-theme flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.title}</p>
                      <p className="text-xs text-secondary">
                        {formatMoney(p.price, currency)} · {p.product_type} · {p.is_active ? 'Visible' : 'Hidden'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="secondary" onClick={() => handleToggleProduct(p)}>
                        {p.is_active ? 'Hide' : 'Show'}
                      </Button>
                      <button type="button" onClick={() => handleDeleteProduct(p)} className="p-1.5 text-danger hover:bg-primary rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'orders' && (
            <div className="space-y-3">
              {loadingOrders ? (
                <p className="text-xs text-secondary">Loading orders...</p>
              ) : orders.length === 0 ? (
                <p className="text-xs text-secondary py-6 text-center">No orders received yet.</p>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="p-4 rounded-xl bg-card border border-theme space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-cyan-400">{o.order_code}</span> ·{' '}
                        <span className="font-bold text-primary">{o.buyer_name}</span> ({o.buyer_phone})
                      </div>
                      <span className="font-black text-sm">{formatMoney(o.total_amount, currency)}</span>
                    </div>
                    <p className="text-secondary">
                      Items: {o.items.map((i) => `${i.title} ×${i.qty}`).join(', ')}
                    </p>
                    {(o.payment_reference || o.payment_proof_note) && (
                      <p className="text-amber-400">
                        Transfer Ref: {o.payment_reference || '—'} {o.payment_proof_note ? `(${o.payment_proof_note})` : ''}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-theme">
                      <span className="font-mono text-[11px] text-secondary">
                        Payment: <strong>{o.payment_status}</strong> · Fulfillment: <strong>{o.fulfillment_status}</strong>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {o.payment_status !== 'paid' && (
                          <Button variant="primary" onClick={() => handleOrderStatus(o.id, { payment_status: 'paid' })}>
                            Mark Paid
                          </Button>
                        )}
                        {o.fulfillment_status !== 'completed' && (
                          <Button variant="secondary" onClick={() => handleOrderStatus(o.id, { fulfillment_status: 'completed' })}>
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-secondary mb-1">Storefront Theme</label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-card border border-theme"
                  >
                    {SITE_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-secondary mb-1">Site Mode</label>
                  <select
                    value={siteMode}
                    onChange={(e) => setSiteMode(e.target.value as SiteMode)}
                    className="w-full px-3 py-2 rounded-lg bg-card border border-theme"
                  >
                    <option value="store">Storefront Only</option>
                    <option value="both">Store + Community Forum</option>
                    <option value="forum">Forum Only</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-secondary mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'NGN' | 'USD' | 'GBP')}
                    className="w-full px-3 py-2 rounded-lg bg-card border border-theme"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
              <input
                type="text"
                value={heroHeadline}
                onChange={(e) => setHeroHeadline(e.target.value)}
                placeholder="Store Hero Headline"
                className="w-full px-3 py-2 rounded-lg bg-card border border-theme"
              />
              <input
                type="text"
                value={heroSubheadline}
                onChange={(e) => setHeroSubheadline(e.target.value)}
                placeholder="Store Hero Subheadline"
                className="w-full px-3 py-2 rounded-lg bg-card border border-theme"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-theme">
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank Name"
                  className="px-3 py-2 rounded-lg bg-card border border-theme"
                />
                <input
                  type="text"
                  value={bankAcctNo}
                  onChange={(e) => setBankAcctNo(e.target.value)}
                  placeholder="Account Number"
                  className="px-3 py-2 rounded-lg bg-card border border-theme font-mono"
                />
                <input
                  type="text"
                  value={bankAcctName}
                  onChange={(e) => setBankAcctName(e.target.value)}
                  placeholder="Account Name"
                  className="px-3 py-2 rounded-lg bg-card border border-theme"
                />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp Number (e.g. 23480...)"
                  className="px-3 py-2 rounded-lg bg-card border border-theme"
                />
              </div>
              <textarea
                rows={2}
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Payment instructions shown at checkout..."
                className="w-full px-3 py-2 rounded-lg bg-card border border-theme"
              />

              {/* Custom Domain Settings */}
              <div className="p-3.5 rounded-xl bg-card border border-theme space-y-2 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" /> Custom Domain
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                    Pro Feature
                  </span>
                </div>
                <p className="text-secondary text-[11px]">
                  Point your own domain (e.g. <span className="font-mono text-primary">shop.mybrand.ng</span> or <span className="font-mono text-primary">mystore.com</span>) to this storefront.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="shop.mybrand.ng"
                    className="flex-1 px-3 py-2 rounded-lg bg-primary border border-theme font-mono text-xs"
                  />
                </div>
                {domainError && <p className="text-danger text-[11px]">{domainError}</p>}
                <div className="p-2.5 rounded-lg bg-primary/80 border border-theme text-[11px] text-secondary space-y-1">
                  <p className="font-semibold text-primary">DNS Setup Instructions:</p>
                  <p>In your domain registrar (GoDaddy, Namecheap, Whois, Whogohost):</p>
                  <p className="font-mono text-cyan-400">Type: CNAME | Name: shop (or @) | Value: developa.me</p>
                </div>
              </div>

              {/* Mini SaaS Plan & Monetization Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-primary border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Developa Pro Plan · ₦7,500 / month
                  </span>
                  <p className="text-[11px] text-secondary">
                    Unlock unlimited products, custom domain connection, verified trust badge, and zero commission.
                  </p>
                </div>
                <a
                  href={`https://wa.me/2348121443666?text=${encodeURIComponent(
                    `Hi, I want to upgrade my store (${site.slug}.developa.me) to Developa Pro.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0 text-center"
                >
                  Upgrade to Pro
                </a>
              </div>

              <Button type="submit" variant="primary" disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
