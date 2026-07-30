'use client';

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useActiveAds, type ActiveAd } from '@/app/hooks/useActiveAds';
import { getPageFromPathname } from '@/lib/adPages';
import { X } from 'lucide-react';

interface PromoBannerProps {
  position: 'header' | 'footer' | 'sidebar' | 'inline' | 'popup';
  className?: string;
  limit?: number;
}

const AdImage = memo(({ ad, boxClass, compact = false }: {
  ad: { title?: string; image_url?: string | null; image_mobile_url?: string | null };
  boxClass: string;
  compact?: boolean;
}) => {
  const desktop = ad.image_url || ad.image_mobile_url || '';
  const mobile = ad.image_mobile_url || ad.image_url || '';
  const fg = compact ? mobile : desktop;

  return (
    <div className={`relative w-full overflow-hidden bg-secondary/40 rounded-xl ${boxClass}`}>
      <img
        src={fg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-40"
      />
      {compact ? (
        <img
          src={mobile}
          alt={ad.title || 'Advertisement'}
          className="relative block w-full h-full object-contain"
          loading="lazy"
        />
      ) : (
        <picture className="relative block w-full h-full">
          <source media="(max-width: 767px)" srcSet={mobile} />
          <img
            src={desktop}
            alt={ad.title || 'Advertisement'}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </picture>
      )}
    </div>
  );
});
AdImage.displayName = 'AdImage';

const PromoBanner = memo(({ position, className = '', limit = 3 }: PromoBannerProps) => {
  const pathname = usePathname() || '/';
  const currentPage = useMemo(() => getPageFromPathname(pathname), [pathname]);

  const { data: ads = [], isLoading } = useActiveAds(position, currentPage);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotBase, setRotBase] = useState(0);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const impressionTracked = useRef<Set<string>>(new Set());

  const rotationPool = useMemo(() => {
    const now = new Date();
    const activeList = ads.filter(ad => {
      if (ad.start_date && new Date(ad.start_date) > now) return false;
      if (ad.end_date && new Date(ad.end_date) < now) return false;
      return true;
    });
    return [...activeList.slice(0, 9)].sort(() => 0.5 - Math.random());
  }, [ads]);

  const activeAds = useMemo(() => rotationPool.slice(0, limit), [rotationPool, limit]);

  const rowPool = useMemo(
    () => rotationPool.filter(a => !dismissed[a.id]),
    [rotationPool, dismissed]
  );

  useEffect(() => {
    if (position !== 'header' && position !== 'footer') return;
    if (rowPool.length <= 1) return;
    const id = window.setInterval(() => {
      setRotBase(prev => (prev + 1) % rowPool.length);
    }, 6000);
    return () => clearInterval(id);
  }, [position, rowPool.length]);

  const adIds = useMemo(() => activeAds.map(ad => ad.id).join(','), [activeAds]);
  useEffect(() => {
    if (!adIds) return;
    try {
      const state: Record<string, boolean> = {};
      activeAds.forEach(ad => {
        if (typeof window !== 'undefined' && localStorage.getItem(`ad_dismissed_${ad.id}`) === 'true') {
          state[ad.id] = true;
        }
      });
      setDismissed(state);
    } catch {
      // Ignored if localStorage blocked
    }
  }, [adIds, activeAds]);

  useEffect(() => {
    if (activeAds.length <= 1 || isHovering) return;
    const speed = activeAds[currentIndex]?.autoplay_speed || 5;
    intervalRef.current = window.setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeAds.length);
    }, speed * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeAds, currentIndex, isHovering]);

  useEffect(() => {
    if (activeAds.length === 0) return;
    const ad = activeAds[currentIndex];
    if (!ad || impressionTracked.current.has(ad.id)) return;
    impressionTracked.current.add(ad.id);
    supabase
      .rpc('increment_ad_impression', { p_source: ad.source, p_ad_id: ad.id })
      .then(() => {}, () => {});
  }, [activeAds, currentIndex]);

  const handleDismiss = useCallback((adId: string) => {
    setDismissed(prev => ({ ...prev, [adId]: true }));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ad_dismissed_${adId}`, 'true');
      }
    } catch {
      // Ignored
    }
  }, []);

  const handleClick = useCallback(async (adLink: string | null | undefined, adId: string, source: ActiveAd['source']) => {
    if (!adLink) return;
    supabase
      .rpc('increment_ad_click', { p_source: source, p_ad_id: adId })
      .then(() => {}, () => {});
    window.open(adLink, '_blank');
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovering(true), []);
  const handleMouseLeave = useCallback(() => setIsHovering(false), []);

  if (isLoading || activeAds.length === 0) return null;

  if (position === 'header' || position === 'footer') {
    if (rowPool.length === 0) return null;
    const slotCount = Math.min(limit, rowPool.length, 2);
    const colClass = slotCount >= 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1';
    return (
      <div className={`grid grid-cols-1 ${colClass} gap-3 w-full ${className}`}>
        {Array.from({ length: slotCount }, (_, slot) => {
          const a = rowPool[(rotBase + slot) % rowPool.length];
          const img = a.image_url || a.image_mobile_url;
          return (
            <div key={slot} onClick={() => handleClick(a.link_url, a.id, a.source)}
              className={`relative overflow-hidden rounded-2xl bg-card border border-theme cursor-pointer hover:border-emerald-500/40 transition shadow-md ${slot === 0 ? '' : 'hidden lg:block'}`}>
              {img ? (
                <AdImage ad={a} boxClass="aspect-[3/1]" compact />
              ) : (
                <div className="w-full aspect-[3/1] flex items-center justify-center p-3 bg-emerald-500/10 text-center">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-primary">{a.title}</h3>
                    {a.cta_text && <span className="text-xs text-emerald-500 font-semibold">{a.cta_text}</span>}
                  </div>
                </div>
              )}
              {a.is_dismissible && (
                <button onClick={(e) => { e.stopPropagation(); handleDismiss(a.id); }}
                  className="absolute top-1.5 right-1.5 z-10 bg-secondary/80 hover:bg-secondary rounded-full p-1 shadow">
                  <X size={13} className="text-secondary" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (position === 'inline') {
    const a = activeAds.find(x => !dismissed[x.id]);
    if (!a) return null;
    return (
      <div onClick={() => a.link_url && handleClick(a.link_url, a.id, a.source)}
        className={`rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 flex items-center gap-2.5 ${a.link_url ? 'cursor-pointer hover:bg-emerald-500/15' : ''} ${className}`}>
        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 text-[10px] font-bold tracking-wide uppercase">Ad</span>
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-primary">{a.title}</span>
        {a.cta_text && (
          <span className="shrink-0 text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
            {a.cta_text} <span aria-hidden="true">&rarr;</span>
          </span>
        )}
      </div>
    );
  }

  const ad = activeAds[currentIndex];
  if (!ad || dismissed[ad.id]) return null;

  const imageUrl = ad.image_url || ad.image_mobile_url;
  const isSidebar = position === 'sidebar';
  const boxClass = isSidebar ? 'aspect-[4/3] max-h-[250px]' : 'h-[84px] sm:h-[120px]';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-card border border-theme shadow-md ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {activeAds.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {activeAds.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-emerald-500 w-4' : 'bg-secondary w-2'
              }`}
            />
          ))}
        </div>
      )}

      <div
        className="relative cursor-pointer"
        onClick={() => handleClick(ad.link_url, ad.id, ad.source)}
      >
        {imageUrl ? (
          <AdImage ad={ad} boxClass={boxClass} />
        ) : (
          <div className={`w-full ${boxClass} flex items-center justify-center p-4 bg-emerald-500/10 text-center`}>
            <div>
              <h3 className="font-bold text-base text-primary">{ad.title}</h3>
              {ad.cta_text && <span className="text-sm text-emerald-500 mt-1">{ad.cta_text}</span>}
            </div>
          </div>
        )}
      </div>

      {ad.is_dismissible && (
        <button
          onClick={() => handleDismiss(ad.id)}
          className="absolute top-2 right-2 z-10 bg-secondary/80 hover:bg-secondary rounded-full p-1 shadow"
        >
          <X size={16} className="text-secondary" />
        </button>
      )}
    </div>
  );
});

PromoBanner.displayName = 'PromoBanner';

export default PromoBanner;
