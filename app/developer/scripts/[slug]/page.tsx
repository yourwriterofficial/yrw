'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/app/components/Header';
import Image from 'next/image';
import BuyModal from '../../BuyModal';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Code2, Download, FileText, ShieldCheck, Tag } from 'lucide-react';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

type Product = {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  tech_stack: string[];
  price: number;
  preview_images: string[];
  license_terms: string | null;
};

export default function ScriptDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('dev_products')
        .select('id, title, slug, category, description, tech_stack, price, preview_images, license_terms')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      if (error || !data) { setNotFound(true); return; }
      setProduct(data as Product);
    })();
  }, [slug]);

  const previewUrl = (path: string) => supabase.storage.from('dev-shop-previews').getPublicUrl(path).data.publicUrl;

  if (notFound) {
    return (
      <div className="min-h-screen bg-primary text-primary font-['Inter']">
        <Header />
        <div className="pt-header-40 pb-20 px-6 text-center">
          <h1 className="text-2xl font-black mb-4">Script not found</h1>
          <p className="text-secondary text-sm mb-8">This script may have been removed or is no longer available.</p>
          <Link href="/developer/shop" className="text-cyan-400 font-bold text-sm">← Back to the shop</Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-cyan-500/30 overflow-x-hidden">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-header-28 sm:pt-header-32 pb-16 sm:pb-24">
        <Link href="/developer/shop" className="inline-flex items-center gap-2 text-xs font-bold text-secondary hover:text-cyan-400 transition mb-6 sm:mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Scripts
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 sm:gap-10">
          {/* Gallery */}
          <div className="lg:col-span-3">
            <div className="aspect-video glass-panel rounded-[20px] sm:rounded-[24px] overflow-hidden mb-3 relative">
              {product.preview_images?.[activeImage] ? (
                <Image src={previewUrl(product.preview_images[activeImage])} alt={product.title} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-secondary">
                  <Code2 className="w-16 h-16 opacity-30" />
                </div>
              )}
            </div>
            {product.preview_images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.preview_images.map((path, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`relative shrink-0 w-24 aspect-video rounded-xl overflow-hidden border-2 transition ${activeImage === i ? 'border-cyan-500' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <Image src={previewUrl(path)} alt="" fill sizes="96px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="lg:col-span-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full mb-4">
              <Tag className="w-3 h-3" /> {product.category}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mb-4">{product.title}</h1>
            <p className="text-sm text-secondary leading-relaxed mb-6">{product.description}</p>

            {product.tech_stack?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {product.tech_stack.map((t, i) => (
                  <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-theme px-2.5 py-1 rounded-full text-secondary">{t}</span>
                ))}
              </div>
            )}

            <div className="glass-panel rounded-2xl p-6 mb-6">
              <div className="text-3xl font-black text-cyan-400 mb-1">{naira(product.price)}</div>
              <p className="text-[10px] uppercase font-black text-secondary tracking-widest mb-5">One-time purchase</p>
              <button
                onClick={() => setBuying(true)}
                className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black uppercase text-xs tracking-widest py-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Buy Now
              </button>
            </div>

            {product.license_terms && (
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-500" /> License Terms
                </h3>
                <p className="text-xs text-secondary leading-relaxed">{product.license_terms}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-secondary mt-6">
              <FileText className="w-4 h-4 shrink-0" /> Downloadable anytime from "My Scripts" in your dashboard after purchase.
            </div>
          </div>
        </div>
      </div>

      {buying && (
        <BuyModal
          product={{ id: product.id, title: product.title, category: product.category, price: product.price }}
          onClose={() => setBuying(false)}
        />
      )}
    </div>
  );
}
