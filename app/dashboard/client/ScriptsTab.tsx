'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import BuyModal from '@/app/developer/BuyModal';
import Card from '@/app/components/ui/Card';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

type Purchase = {
  id: number;
  product_id: number;
  amount_paid: number;
  download_count: number;
  created_at: string;
  dev_products: {
    title: string;
    category: string;
    description: string | null;
    preview_images: string[];
  } | null;
};

type Product = {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  tech_stack: string[];
  price: number;
  preview_images: string[];
};

export default function ScriptsTab({ user }: { user: any }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: purchaseRows }, { data: productRows }] = await Promise.all([
      supabase
        .from('dev_product_purchases')
        .select('id, product_id, amount_paid, download_count, created_at, dev_products(title, category, description, preview_images)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('dev_products')
        .select('id, title, slug, category, description, tech_stack, price, preview_images')
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    setPurchases((purchaseRows as any[]) || []);

    const ownedIds = new Set((purchaseRows || []).map((p: any) => p.product_id));
    setAvailableProducts(((productRows as Product[]) || []).filter(p => !ownedIds.has(p.id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const previewUrl = (path: string) => supabase.storage.from('dev-shop-previews').getPublicUrl(path).data.publicUrl;

  const download = async (productId: number) => {
    setDownloadingId(productId);
    try {
      const res = await fetch('/api/dev-shop/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Download failed.', 'error');
      } else {
        window.location.href = data.signedUrl;
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setDownloadingId(null);
  };

  const categories = ['all', ...Array.from(new Set(availableProducts.map(p => p.category).filter(Boolean)))];
  const filteredAvailable = availableProducts.filter(p => category === 'all' || p.category === category);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {/* === MY SCRIPTS === */}
      <div>
        <header className="mb-10">
          <h2 className="text-3xl font-black text-primary flex items-center gap-3">
            <lucide.ShoppingBag className="text-cyan-500" /> My Scripts
          </h2>
          <p className="text-secondary mt-1">Every script you've purchased, downloadable anytime.</p>
        </header>

        {purchases.length === 0 ? (
          <div className="empty-state">
            <lucide.PackageOpen className="w-12 h-12 text-secondary mx-auto mb-4" />
            <h4 className="text-lg font-bold text-primary mb-2">No scripts yet</h4>
            <p className="text-secondary text-sm mb-6 max-w-md mx-auto">Browse the script marketplace below to find ready-made source code.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchases.map(p => (
              <Card key={p.id} elevation={1} padding="none" className="overflow-hidden flex flex-col">
                <div className="aspect-video bg-secondary relative overflow-hidden">
                  {p.dev_products?.preview_images?.[0] ? (
                    <Image src={previewUrl(p.dev_products.preview_images[0])} alt={p.dev_products.title || 'Script'} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary">
                      <lucide.Code2 className="w-10 h-10 opacity-30" />
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-black mb-1">{p.dev_products?.title || 'Script'}</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-secondary mb-3">{p.dev_products?.category}</p>
                  <p className="text-xs text-secondary leading-relaxed mb-4 flex-1">{p.dev_products?.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-theme">
                    <span className="text-xs font-bold text-secondary">{naira(p.amount_paid)} · {p.download_count} downloads</span>
                    <button
                      onClick={() => download(p.product_id)}
                      disabled={downloadingId === p.product_id}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <lucide.Download className="w-3.5 h-3.5" /> {downloadingId === p.product_id ? 'Preparing...' : 'Download'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* === MORE SCRIPTS FROM THE STORE === */}
      {availableProducts.length > 0 && (
        <div>
          <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-primary flex items-center gap-2">
                <lucide.Store className="text-cyan-500 w-5 h-5" /> More From the Store
              </h2>
              <p className="text-secondary mt-1 text-sm">Ready-made scripts you haven't picked up yet.</p>
            </div>
            {categories.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition ${category === c ? 'bg-cyan-500 text-black' : 'bg-secondary border border-theme text-secondary hover:border-cyan-500/50'}`}
                  >
                    {c === 'all' ? 'All' : c}
                  </button>
                ))}
              </div>
            )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAvailable.map(p => (
              <div key={p.id} className="rounded-[24px] glass-panel overflow-hidden hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <div className="aspect-video bg-secondary relative overflow-hidden">
                  {p.preview_images?.[0] ? (
                    <Image src={previewUrl(p.preview_images[0])} alt={p.title} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary">
                      <lucide.Code2 className="w-10 h-10 opacity-30" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1">
                    <lucide.Tag className="w-2.5 h-2.5" /> {p.category}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-base font-black mb-2">{p.title}</h3>
                  <p className="text-xs text-secondary leading-relaxed mb-4 flex-1 line-clamp-2">{p.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-theme gap-2">
                    <span className="text-base font-black text-cyan-400">{naira(p.price)}</span>
                    <div className="flex gap-2">
                      <a
                        href={`/developer/scripts/${p.slug}`}
                        className="bg-white/5 hover:bg-white/10 border border-theme text-primary text-xs font-black uppercase tracking-wider px-3 py-2.5 rounded-xl transition flex items-center gap-1.5"
                      >
                        <lucide.Eye className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => setBuyProduct(p)}
                        className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
                      >
                        <lucide.Download className="w-3.5 h-3.5" /> Buy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {buyProduct && (
        <BuyModal
          product={buyProduct}
          onClose={() => setBuyProduct(null)}
          onPurchased={() => { load(); }}
        />
      )}
    </div>
  );
}
