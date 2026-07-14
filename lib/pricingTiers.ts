import { supabase } from '@/lib/supabaseClient';

export type ServicePricingCategory = 'ACADEMIC' | 'CONTENT' | 'DEV' | 'RESUME' | 'CUSTOM';

export interface PricingTier {
  id: string;
  service_category: ServicePricingCategory;
  tier_key: string;
  name: string;
  tagline: string | null;
  price_model: 'PER_WORD' | 'FLAT';
  rate_per_word: number | null;
  flat_price: number | null;
  volume_discount_percent: number;
  volume_discount_threshold_words: number;
  correction_cycles: number | null;
  features: string[];
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
}

export async function fetchPricingTiers(category: ServicePricingCategory): Promise<PricingTier[]> {
  const { data } = await supabase
    .from('service_pricing_tiers')
    .select('*')
    .eq('service_category', category)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  return (data as PricingTier[]) || [];
}
