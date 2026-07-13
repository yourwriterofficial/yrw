'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import BuyModal from '../BuyModal';
import { ArrowLeft, Code2, Download, Eye, Search, ShoppingBag, Tag } from 'lucide-react';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

type ShopSettings = { shop_title: string; shop_description: string };

const DEFAULT_SETTINGS: ShopSettings = {
  shop_title: 'Ready-Made Scripts',
  shop_description: 'Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.',
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
  created_at: string;
};

type SortOption = 'newest' | 'price_asc' | 'price_desc';

export default function DeveloperShopPage() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [buyProduct, setBuyProduct] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      const { data: settingsRows } = await supabase.from('developer_page_settings').select('*');
      if (settingsRows) {
        const merged = { ...DEFAULT_SETTINGS };
        settingsRows.forEach((row: any) => {
          if (row.key === 'shop_intro') Object.assign(merged, row.value);
        });
        setSettings(merged);
      }

      const { data: productRows } = await supabase
        .from('dev_products')
        .select('id, title, slug, category, description, tech_stack, price, preview_images, created_at')
        .eq('is_active', true)
        .order('sort_order');
      setProducts((productRows as Product[]) || []);
      setLoading(false);
    })();
  }, []);

  const categories = useCallback(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products])();

  const filteredProducts = products
    .filter(p => category === 'all' || p.category === category)
    .filter(p => !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase()) || p.description?.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const previewUrl = (path: string) => supabase.storage.from('dev-shop-previews').getPublicUrl(path).data.publicUrl;

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-cyan-500/30 transition-colors duration-200 overflow-x-hidden">
      <Header />

      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/developer" className="inline-flex items-center gap-2 text-xs font-bold text-secondary hover:text-cyan-400 transition mb-6 sm:mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to Developer Services
          </Link>

          <div className="text-center mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              <ShoppingBag className="w-3 h-3" /> Script Marketplace
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mb-4">{settings.shop_title}</h1>
            <p className="text-secondary text-sm max-w-xl mx-auto px-2">{settings.shop_description}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 justify-center items-center mb-8 max-w-2xl mx-auto">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search scripts…"
                className="w-full glass-panel rounded-full pl-11 pr-4 py-2.5 text-sm text-primary outline-none focus:border-cyan-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="w-full md:w-auto glass-panel rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary outline-none focus:border-cyan-500 cursor-pointer shrink-0"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {categories.length > 1 && (
            <div className="flex gap-2 justify-center flex-wrap mb-10 px-2">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition ${category === c ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black' : 'glass-panel text-secondary hover:border-cyan-500/50'}`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-secondary text-sm">
              No scripts available in this category yet — check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredProducts.map(p => (
                <div key={p.id} className="rounded-[24px] sm:rounded-[28px] glass-panel overflow-hidden hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col">
                  <div className="aspect-video bg-secondary relative overflow-hidden">
                    {p.preview_images?.[0] ? (
                      <Image src={previewUrl(p.preview_images[0])} alt={p.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary">
                        <Code2 className="w-10 h-10 opacity-30" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" /> {p.category}
                    </span>
                  </div>
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <Link href={`/developer/scripts/${p.slug}`} className="hover:text-cyan-400 transition">
                      <h3 className="text-base sm:text-lg font-black mb-2">{p.title}</h3>
                    </Link>
                    <p className="text-xs text-secondary leading-relaxed mb-4 flex-1">{p.description}</p>
                    {p.tech_stack?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {p.tech_stack.map((t, i) => (
                          <span key={i} className="text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-theme px-2 py-0.5 rounded-full text-secondary">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-theme gap-2">
                      <span className="text-base sm:text-lg font-black text-cyan-400">{naira(p.price)}</span>
                      <div className="flex gap-2">
                        <Link
                          href={`/developer/scripts/${p.slug}`}
                          className="bg-white/5 hover:bg-white/10 border border-theme text-primary text-xs font-black uppercase tracking-wider px-3 py-2.5 rounded-xl transition flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setBuyProduct(p)}
                          className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Buy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-theme py-10 sm:py-12 px-4 sm:px-6 text-center text-xs text-secondary pb-safe">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>

      {buyProduct && <BuyModal product={buyProduct} onClose={() => setBuyProduct(null)} />}
    </div>
  );
}
