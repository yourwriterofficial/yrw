'use client';

import { useMemo } from 'react';
import { type SiteTemplate } from '@/lib/siteTemplates';
import { brandFor, demoProducts } from '@/lib/demoContent';

/** A miniature of the finished site, built from the same sample content as the live preview. */
export default function TemplateThumb({ t }: { t: SiteTemplate }) {
  const brand = brandFor(t);
  const items = useMemo(() => demoProducts(t).slice(0, 3), [t]);
  const isForum = t.site_mode === 'forum';
  return (
    <div className="relative aspect-[4/3] overflow-hidden" style={{ background: `linear-gradient(160deg, ${t.accent_color}26, ${t.accent_color}08)` }}>
      <div className="absolute inset-x-4 top-4 bottom-0 rounded-t-xl bg-white shadow-[0_8px_30px_rgba(0,0,0,.12)] overflow-hidden text-[#202124]">
        <div className="h-6 flex items-center gap-1 px-2 border-b border-black/5">
          <i className="w-1.5 h-1.5 rounded-full bg-red-400" /><i className="w-1.5 h-1.5 rounded-full bg-amber-400" /><i className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="ml-1 text-[7px] text-black/40 truncate">{brand.toLowerCase().replace(/[^a-z0-9]+/g, '')}.developa.me</span>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[9px] font-bold" style={{ color: t.accent_color }}>{brand}</span>
          <span className="flex gap-1.5 text-[7px] text-black/40"><span>Home</span><span>{isForum ? 'Community' : 'Shop'}</span><span>About</span></span>
        </div>
        <div className="mx-3 rounded-md px-2.5 py-2 text-white" style={{ background: `linear-gradient(135deg, ${t.accent_color}, ${t.accent_color}b8)` }}>
          <p className="text-[9px] font-bold leading-tight line-clamp-2">{t.hero_headline}</p>
          <span className="inline-block mt-1 text-[6px] px-1.5 py-0.5 rounded-full bg-white/90 text-black font-semibold">{isForum ? 'Join now' : 'Shop now'}</span>
        </div>
        {isForum ? (
          <div className="px-3 mt-2 space-y-1">{[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-black/[.05] flex items-center gap-1 px-1.5"><i className="w-2 h-2 rounded-full" style={{ background: t.accent_color }} /><i className="h-1 rounded bg-black/15" style={{ width: `${70 - i * 12}%` }} /></div>)}</div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 px-3 mt-2">
            {items.map((p) => (
              <div key={p.id} className="rounded overflow-hidden bg-white border border-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" />
                <div className="p-1"><i className="block h-1 rounded bg-black/15 w-4/5" /><i className="block h-1 rounded mt-0.5 w-1/3" style={{ background: t.accent_color }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
