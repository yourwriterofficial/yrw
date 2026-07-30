'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import BuyModal from '../BuyModal';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Badge } from '@/app/components/ui/Badge';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Shell } from '@/app/components/ui/Shell';
import { Select } from '@/app/components/ui/Select';
import { ArrowLeft, Code2, Download, Eye, Search, ShoppingBag, Tag } from 'lucide-react';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

type ShopSettings = { shop_title: string; shop_description: string };

const DEFAULT_SETTINGS: ShopSettings = {
  shop_title: 'Ready-Made Scripts',
  shop_description: 'Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

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
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <Header />

      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <Shell size="xl">
          <Link href="/developer" className="inline-flex items-center gap-2 text-xs font-bold text-secondary hover:text-info transition mb-6 sm:mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to Developer Services
          </Link>

          <div className="text-center mb-10 sm:mb-12">
            <Badge variant="info" className="mb-4">
              <ShoppingBag className="w-3 h-3 mr-1.5" /> Script Marketplace
            </Badge>
            <h1 className="font-display italic font-medium text-2xl sm:text-3xl md:text-4xl mb-4">{settings.shop_title}</h1>
            <p className="text-secondary text-sm max-w-xl mx-auto px-2">{settings.shop_description}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 justify-center items-center mb-8 max-w-2xl mx-auto">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search scripts…"
              iconLeft={<Search className="w-4 h-4" />}
              fullWidth
              className="rounded-full"
            />
            <Select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              options={SORT_OPTIONS}
              className="w-full md:w-44 rounded-full"
            />
          </div>

          {categories.length > 1 && (
            <div className="flex gap-2 justify-center flex-wrap mb-10 px-2">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition ${
                    category === c
                      ? 'bg-accent text-[var(--accent-foreground)] border-accent'
                      : 'bg-secondary border-theme text-secondary hover:border-strong'
                  }`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-info/20 border-t-info rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-5 h-5" />}
              title="No scripts found"
              description="Try a different search or category."
              action={{ label: 'Clear filters', onClick: () => { setSearch(''); setCategory('all'); } }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredProducts.map(p => (
                <Card key={p.id} padding="none" interactive className="overflow-hidden flex flex-col group">
                  <div className="aspect-video bg-secondary relative overflow-hidden">
                    {p.preview_images?.[0] ? (
                      <Image
                        src={previewUrl(p.preview_images[0])}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary">
                        <Code2 className="w-10 h-10 opacity-30" />
                      </div>
                    )}
                    <Badge variant="default" className="absolute top-3 left-3">
                      <Tag className="w-2.5 h-2.5 mr-1" /> {p.category}
                    </Badge>
                  </div>
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <Link href={`/developer/scripts/${p.slug}`} className="hover:text-info transition">
                      <h3 className="text-base sm:text-lg font-bold mb-2">{p.title}</h3>
                    </Link>
                    <p className="text-xs text-secondary leading-relaxed mb-4 flex-1">{p.description}</p>
                    {p.tech_stack?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {p.tech_stack.map((t, i) => (
                          <Badge key={i} variant="default" size="sm">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-theme gap-2">
                      <span className="text-base sm:text-lg font-bold text-info">{naira(p.price)}</span>
                      <div className="flex gap-2">
                        <Button href={`/developer/scripts/${p.slug}`} variant="secondary" size="sm" className="px-3">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => setBuyProduct(p)}>
                          <Download className="w-3.5 h-3.5" /> Buy
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Shell>
      </section>

      <footer className="border-t border-theme py-10 sm:py-12 px-4 sm:px-6 text-center text-xs text-secondary pb-safe">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>

      {buyProduct && <BuyModal product={buyProduct} onClose={() => setBuyProduct(null)} />}
    </div>
  );
}
