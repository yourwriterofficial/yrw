'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import xss from 'xss';
import type { CreateOrderServerActionResponse } from '@/lib/types';
import { emailTemplates } from '@/lib/emailTemplates';

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
  client_company: z.string().optional(),
  client_address: z.string().optional(),
  client_phone: z.string().optional(),
  payment_structure_type: z.enum(['60/40', 'CUSTOM']).optional(),
  payment_milestones: z.array(z.any()).optional(),
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

  // Calculate quote
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

  // 🛡️ SANITIZE ALL USER INPUTS (XSS protection)
  const sanitized = {
    legal_name: xss(orderData.legal_name.trim()),
    email: xss(orderData.email.toLowerCase().trim()),
    topic: xss(orderData.topic.trim()),
    additional_info: xss(orderData.additional_info || ''),
    media_link: xss(orderData.media_link || ''),
    reference_style: xss(orderData.reference_style || ''),
    font_specification: xss(orderData.font_specification || ''),
    guest_name: xss(orderData.guest_name || ''),
    guest_email: xss(orderData.guest_email || ''),
    guest_whatsapp: xss(orderData.guest_whatsapp || ''),
    whatsapp_sync: xss(orderData.whatsapp_sync || ''),
    vault_status: xss(orderData.vault_status || 'Secured in Vault'),
    corrections_status: xss(orderData.corrections_status || 'None'),
    workflow_status: xss(orderData.workflow_status || 'Briefing Received'),
    client_company: xss(orderData.client_company || ''),
    client_address: xss(orderData.client_address || ''),
    client_phone: xss(orderData.client_phone || ''),
  };

  const secureOrderData = {
    ...orderData,
    ...sanitized,
    financial_quote: finalQuote,
    client_id: null, // No user ID for guests initially
    // Override with sanitized values
    legal_name: sanitized.legal_name,
    email: sanitized.email,
    topic: sanitized.topic,
    additional_info: sanitized.additional_info,
    media_link: sanitized.media_link,
    reference_style: sanitized.reference_style,
    font_specification: sanitized.font_specification,
    guest_name: sanitized.guest_name,
    guest_email: sanitized.guest_email,
    guest_whatsapp: sanitized.guest_whatsapp,
    whatsapp_sync: sanitized.whatsapp_sync,
    vault_status: sanitized.vault_status,
    corrections_status: sanitized.corrections_status,
    workflow_status: sanitized.workflow_status,
    client_company: sanitized.client_company,
    client_address: sanitized.client_address,
    client_phone: sanitized.client_phone,
    payment_structure_type: orderData.payment_structure_type || '60/40',
    payment_milestones: orderData.payment_milestones || [],
  };

  if (!secureOrderData.order_id) {
    secureOrderData.order_id = 'RW-' + Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Insert into database
  const { data, error } = await supabase
    .from('orders')
    .insert(secureOrderData)
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    return { success: false, error: error.message };
  }

  // Send emails (unchanged)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const orderEmailData = {
    order_id: data.order_id,
    legal_name: data.legal_name,
    email: data.email,
    topic: data.topic,
    financial_quote: finalQuote,
    service_tier: data.service_tier,
    deadline: data.deadline,
  };

  // 1. Send confirmation to client
  const clientTemplate = emailTemplates.clientOrderConfirmation(orderEmailData);
  fetch(`${baseUrl}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: data.email,
      orderId: data.order_id,
      subject: clientTemplate.subject,
      html: clientTemplate.html,
    }),
  }).catch(e => console.warn('Client email failed', e));

  // 2. Send notification to admin
  const adminTemplate = emailTemplates.adminNewOrder(orderEmailData);
  fetch(`${baseUrl}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'subskription.noreply@gmail.com',
      orderId: data.order_id,
      subject: adminTemplate.subject,
      html: adminTemplate.html,
    }),
  }).catch(e => console.warn('Admin email failed', e));

  return { success: true, orderDbId: data.id, orderStringId: data.order_id, finalQuote };
}