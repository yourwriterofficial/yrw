'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { CreateOrderServerActionResponse } from '@/lib/types';

// Use service role key to bypass RLS entirely (safe for server actions)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_RATES = { GOLD: 100, SILVER: 80, BRONZE: 70, STANDARD: 60 };
const PLAN_DISCOUNTS = { GOLD: 15, SILVER: 10, BRONZE: 8, STANDARD: 6 };
const MIN_CUSTOM_QUOTE = 10000;

const orderDataSchema = z.object({
  service_tier: z.enum(['GOLD', 'SILVER', 'BRONZE', 'STANDARD', 'CUSTOM']),
  financial_quote: z.number().optional(),
  word_count: z.number().optional(),
  deadline: z.string().optional(),
  legal_name: z.string().min(1),
  email: z.string().email(),
  topic: z.string().min(5),
  reference_style: z.string().optional(),
  font_specification: z.string().optional(),
  additional_info: z.string().optional(),
  media_link: z.string().optional(),
  order_id: z.string().optional(),
  guest_name: z.string().optional(),
  guest_email: z.string().optional(),
  guest_whatsapp: z.string().optional(),
  page_count: z.number().optional(),
  workflow_status: z.string().optional(),
  sixty_percent_paid: z.boolean().optional(),
  forty_percent_paid: z.boolean().optional(),
  work_submitted: z.boolean().optional(),
  corrections_status: z.string().optional(),
  vault_status: z.string().optional(),
  whatsapp_sync: z.string().optional(),
  last_activity: z.string().optional(),
});

export async function createSecureOrder(
  orderData: z.infer<typeof orderDataSchema>,
  promoCode: string
): Promise<CreateOrderServerActionResponse> {
  let finalQuote = 0;

  // Validate deadline
  if (orderData.deadline && new Date(orderData.deadline) <= new Date()) {
    return { success: false, error: 'Deadline must be in the future.' };
  }

  if (orderData.service_tier === 'CUSTOM') {
    const customQuote = Number(orderData.financial_quote);
    if (isNaN(customQuote) || customQuote < MIN_CUSTOM_QUOTE) {
      return { success: false, error: `Custom quote must be at least ₦${MIN_CUSTOM_QUOTE.toLocaleString()}` };
    }
    finalQuote = customQuote;
  } else {
    const words = orderData.word_count;
    if (!words || words < 50) {
      return { success: false, error: 'Word count must be at least 50.' };
    }
    const plan = orderData.service_tier as keyof typeof PLAN_RATES;
    const base = words * PLAN_RATES[plan];
    const volumeDiscount = words >= 10000 ? PLAN_DISCOUNTS[plan] : 0;
    let afterVolume = base * (1 - volumeDiscount / 100);

    if (promoCode) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('discount_percent')
        .eq('code', promoCode.toUpperCase())
        .eq('active', true)
        .single();
      if (promo) afterVolume *= (1 - promo.discount_percent / 100);
    }
    finalQuote = Math.round(afterVolume);
  }

  const secureOrderData = {
    ...orderData,
    financial_quote: finalQuote,
    client_id: null, // No user ID for guests
    legal_name: orderData.legal_name.trim(),
    email: orderData.email.toLowerCase().trim(),
    topic: orderData.topic.trim(),
  };

  // Remove order_id if you want the trigger to generate it; but if you provide one, it's fine
  // If the trigger fails, you can also generate it here manually:
  if (!secureOrderData.order_id) {
    secureOrderData.order_id = 'RW-' + Math.floor(100000 + Math.random() * 900000).toString();
  }

  console.log('Inserting order with service role:', secureOrderData);

  const { data, error } = await supabase
    .from('orders')
    .insert(secureOrderData)
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, orderDbId: data.id, orderStringId: data.order_id, finalQuote };
}