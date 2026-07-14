'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import xss from 'xss';
import type { CreateOrderServerActionResponse } from '@/lib/types';
import { emailTemplates } from '@/lib/emailTemplates';
import { notifyUser, notifyAdmins } from '@/lib/notify';
import { sendSystemEmail } from '@/lib/emailService';
import { upsertInvoiceForOrder } from '@/lib/invoices';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  client_id: z.string().uuid().optional().nullable(),
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

  // Validate deadline — minimum 2-week (14 day) lead time required for all orders
  if (orderData.deadline) {
    const minDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    minDeadline.setHours(0, 0, 0, 0);
    if (new Date(orderData.deadline) < minDeadline) {
      return { success: false, error: 'We require a minimum 2-week (14 day) lead time to guarantee quality work. Please choose a later date.' };
    }
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
    const { data: tier } = await supabase
      .from('service_pricing_tiers')
      .select('rate_per_word, volume_discount_percent, volume_discount_threshold_words')
      .eq('service_category', 'ACADEMIC')
      .eq('tier_key', orderData.service_tier)
      .eq('is_active', true)
      .single();
    if (!tier || !tier.rate_per_word) {
      return { success: false, error: 'Selected plan is no longer available. Please refresh and choose another plan.' };
    }
    const base = words * tier.rate_per_word;
    const volumeDiscount = words >= tier.volume_discount_threshold_words ? tier.volume_discount_percent : 0;
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
    client_id: orderData.client_id || null,
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

  // Auto-generate an invoice mirroring this order (idempotent; invoice_number = order_id)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const invoiceUrl = `${baseUrl}/invoice/${data.order_id}`;
  upsertInvoiceForOrder(supabase, data, { autoGenerated: true }).catch(e => console.warn('Auto-invoice failed', e));

  // Notify client + admin (email + in-app + push for logged-in users; email-only for guests)
  const orderEmailData = {
    order_id: data.order_id,
    legal_name: data.legal_name,
    email: data.email,
    topic: data.topic,
    financial_quote: finalQuote,
    service_tier: data.service_tier,
    deadline: data.deadline,
  };
  const invoiceTemplate = emailTemplates.invoiceIssued({
    legal_name: data.legal_name,
    invoice_number: data.order_id,
    total_amount: finalQuote,
    invoice_url: invoiceUrl,
    project_title: data.topic,
  });
  const adminTemplate = emailTemplates.adminNewOrder(orderEmailData);
  const clientLink = `/invoice/${data.order_id}`;

  // 1. Notify the client — this email IS the invoice
  if (data.client_id) {
    notifyUser({
      userId: data.client_id,
      title: 'Order Received — Your Invoice is Ready',
      message: `We've received your order "${data.topic}" (${data.order_id}). Tap to view your invoice.`,
      type: 'order_update',
      link: clientLink,
      orderDbId: data.id,
      emailHtml: invoiceTemplate.html,
      emailSubject: invoiceTemplate.subject,
    }).catch(e => console.warn('Client notification failed', e));
  } else {
    sendSystemEmail({ to: data.email, orderId: data.order_id, subject: invoiceTemplate.subject, html: invoiceTemplate.html })
      .catch(e => console.warn('Client email failed', e));
  }

  // 2. Notify the admin
  (async () => {
    try {
      await notifyAdmins({
        title: 'New Order Received',
        message: `${data.legal_name} placed a new order: "${data.topic}" (${data.order_id}).`,
        type: 'order_update',
        link: `/admin/orders?open=${data.order_id}`,
        orderDbId: data.id,
        isAdminSent: false,
        emailHtml: adminTemplate.html,
        emailSubject: adminTemplate.subject,
      });
    } catch (e) {
      console.warn('Admin notification failed', e);
    }
  })();

  return { success: true, orderDbId: data.id, orderStringId: data.order_id, finalQuote };
}