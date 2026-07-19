'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { pageMatches } from '@/lib/adPages';

export type Ad = {
  id: string;
  title: string;
  image_url: string | null;
  image_mobile_url: string | null;
  link_url: string | null;
  cta_text: string | null;
  start_date: string | null;
  end_date: string | null;
  position: string;
  pages: string[];
  priority: number;
  is_active: boolean;
  is_dismissible: boolean;
  autoplay_speed: number;
  impressions: number;
  clicks: number;
  created_at: string;
};

export type ActiveAd = Ad & { source: 'ads' | 'user_ad_purchases' };

function normalizePages(pages: unknown): string[] {
  let p = pages;
  if (typeof p === 'string') {
    try { p = JSON.parse(p); } catch { p = [p]; }
  }
  return Array.isArray(p) ? p : [];
}

export function useActiveAds(position?: string, page?: string) {
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchAds() {
      try {
        setLoading(true);
        let adsQuery = supabase
          .from('ads')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: true });
        if (position) adsQuery = adsQuery.eq('position', position);

        let purchasesQuery = supabase
          .from('user_ad_purchases')
          .select('*')
          .eq('status', 'approved')
          .eq('is_boost', false)
          .is('paused_at', null);
        if (position) purchasesQuery = purchasesQuery.eq('position', position);

        const [adsRes, purchasesRes] = await Promise.all([adsQuery, purchasesQuery]);

        const rawAds = adsRes.error ? [] : (adsRes.data || []);
        const rawPurchases = purchasesRes.error ? [] : (purchasesRes.data || []);

        const now = new Date();

        const fromAds: ActiveAd[] = rawAds
          .filter(ad => {
            if (ad.start_date && new Date(ad.start_date) > now) return false;
            if (ad.end_date && new Date(ad.end_date) < now) return false;
            return true;
          })
          .map(ad => ({
            ...ad,
            pages: normalizePages(ad.pages),
            source: 'ads' as const,
          }));

        const fromPurchases: ActiveAd[] = rawPurchases
          .filter(p => {
            if (p.starts_at && new Date(p.starts_at) > now) return false;
            if (p.ends_at && new Date(p.ends_at) < now) return false;
            return true;
          })
          .map(p => ({
            id: p.id,
            title: p.title,
            image_url: p.image_url,
            image_mobile_url: p.image_mobile_url,
            link_url: p.link_url,
            cta_text: p.cta_text,
            start_date: p.starts_at,
            end_date: p.ends_at,
            position: p.position,
            pages: normalizePages(p.pages),
            priority: 100,
            is_active: true,
            is_dismissible: false,
            autoplay_speed: 5,
            impressions: p.impressions || 0,
            clicks: p.clicks || 0,
            created_at: p.created_at,
            source: 'user_ad_purchases' as const,
          }));

        const combined = [...fromAds, ...fromPurchases].filter(ad => {
          if (page === 'landing' && ad.source === 'user_ad_purchases') return false;
          return pageMatches(ad.position, ad.pages, page);
        });

        if (isMounted) {
          setAds(combined);
        }
      } catch (err) {
        console.error('Failed to fetch active ads:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAds();

    return () => {
      isMounted = false;
    };
  }, [position, page]);

  return { data: ads, isLoading: loading };
}
