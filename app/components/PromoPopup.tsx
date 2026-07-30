'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useActiveAds } from '@/app/hooks/useActiveAds';
import { getPageFromPathname } from '@/lib/adPages';
import { supabase } from '@/lib/supabaseClient';

const SESSION_KEY = 'promo_popup_shown_session';
const SHOW_DELAY_MS = 1500;

export default function PromoPopup() {
  const pathname = usePathname() || '/';
  const currentPage = getPageFromPathname(pathname);
  const { data: ads = [] } = useActiveAds('popup', currentPage);

  const [visible, setVisible] = useState(false);
  const shownThisMount = useRef(false);

  const ad = ads.find(a => {
    try { return localStorage.getItem(`ad_dismissed_${a.id}`) !== 'true'; }
    catch { return true; }
  });

  useEffect(() => {
    if (!ad || shownThisMount.current) return;
    let alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem(SESSION_KEY) === 'true'; } catch {}
    if (alreadyShown) return;

    const t = window.setTimeout(() => {
      shownThisMount.current = true;
      setVisible(true);
      try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch {}
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [ad]);

  const impressionTracked = useRef(false);
  useEffect(() => {
    if (!visible || !ad || impressionTracked.current) return;
    impressionTracked.current = true;
    supabase.rpc('increment_ad_impression', { p_source: ad.source, p_ad_id: ad.id }).then(() => {}, () => {});
  }, [visible, ad]);

  if (!visible || !ad) return null;

  const close = () => setVisible(false);
  const dismiss = () => {
    try { localStorage.setItem(`ad_dismissed_${ad.id}`, 'true'); } catch {}
    setVisible(false);
  };
  const handleClick = () => {
    if (!ad.link_url) return;
    supabase.rpc('increment_ad_click', { p_source: ad.source, p_ad_id: ad.id }).then(() => {}, () => {});
    window.open(ad.link_url, '_blank');
    close();
  };

  const imageUrl = ad.image_url || ad.image_mobile_url;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={close}>
      <div
        className="relative bg-card rounded-2xl shadow-2xl max-w-sm w-full max-h-[85vh] overflow-y-auto overflow-x-hidden border border-theme"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={ad.is_dismissible === false ? close : dismiss}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 bg-secondary/90 hover:bg-secondary rounded-full p-1.5 shadow-md text-secondary hover:text-primary transition"
        >
          <X size={16} />
        </button>

        <div onClick={handleClick} className={ad.link_url ? 'cursor-pointer' : ''}>
          {imageUrl ? (
            <div className="relative w-full aspect-[4/3] max-h-[38vh] bg-secondary/40 overflow-hidden">
              <img src={imageUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-40" />
              <img src={imageUrl} alt={ad.title} className="relative w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-full aspect-[4/3] max-h-[38vh] flex items-center justify-center p-6 bg-emerald-500/10 text-center">
              <div>
                <h3 className="font-bold text-xl text-primary">{ad.title}</h3>
              </div>
            </div>
          )}
          <div className="p-4 text-center">
            {imageUrl && <h3 className="font-bold text-primary mb-1">{ad.title}</h3>}
            {ad.cta_text && (
              <span className="inline-block px-5 py-2 bg-emerald-500 text-black rounded-xl text-sm font-semibold">
                {ad.cta_text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
