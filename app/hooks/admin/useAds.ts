'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Ad } from '../useActiveAds';

export type { Ad };

export interface UserAdPurchase {
  id: string;
  user_id: string;
  title: string;
  image_url: string | null;
  image_mobile_url: string | null;
  link_url: string | null;
  cta_text: string | null;
  position: string;
  pages: string[];
  duration_days: number;
  amount_paid: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'paused' | 'queued';
  rejection_reason: string | null;
  capacity_wait: boolean;
  paused_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  billing_model: 'per_day' | 'metered';
  budget: number | null;
  spent: number;
  cpm_rate: number | null;
  cpc_rate: number | null;
  is_boost: boolean;
  product_id: string | null;
  created_at: string;
}

export interface AdPricing {
  id: string;
  position: string;
  label: string;
  price_per_day: number;
  boost_price_per_day: number;
  min_days: number;
  max_days: number;
  description: string | null;
  is_active: boolean;
  billing_model: 'per_day' | 'metered';
  cpm_rate: number | null;
  cpc_rate: number | null;
  slot_cap: number;
  created_at: string;
}

export function useAdminAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAds(data || []);
    } catch (err) {
      console.error('Failed to fetch admin ads:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  return { data: ads, isLoading, refetch: fetchAds };
}

export function useUserAdPurchases() {
  const [purchases, setPurchases] = useState<UserAdPurchase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_ad_purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPurchases(data || []);
    } catch (err) {
      console.error('Failed to fetch user ad purchases:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  return { data: purchases, isLoading, refetch: fetchPurchases };
}

export function useAdPricing() {
  const [pricing, setPricing] = useState<AdPricing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPricing = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_pricing')
        .select('*')
        .order('price_per_day', { ascending: false });
      if (error) throw error;
      setPricing(data || []);
    } catch (err) {
      console.error('Failed to fetch ad pricing:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  return { data: pricing, isLoading, refetch: fetchPricing };
}
