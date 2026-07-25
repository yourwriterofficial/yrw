import { createClient } from '@supabase/supabase-js';
import { sendSystemEmail } from './emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type NotificationType = 'order_update' | 'payment' | 'vault_delivery' | 'admin_message' | 'promotion' | 'system';

/**
 * Turns an HTML email body into a short plain-text snippet for the in-app
 * notification bell. Admin-composed messages used to store a fixed
 * "You have a new message — tap to view" string, which made every alert in the
 * bell look identical and told the user nothing.
 */
export function htmlToPreview(html: string, maxLength = 300): string {
  const text = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 'Open to view this message.';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

const EMAIL_PREF_COLUMN: Record<NotificationType, string> = {
  order_update: 'email_order_updates',
  payment: 'email_payments',
  vault_delivery: 'email_vault_delivery',
  admin_message: 'email_admin_messages',
  system: 'email_admin_messages',
  promotion: 'email_promotions',
};

const PUSH_TYPE: Record<NotificationType, string> = {
  order_update: 'order_update',
  payment: 'payment',
  vault_delivery: 'vault_delivery',
  admin_message: 'admin_message',
  system: 'admin_message',
  promotion: 'promotion',
};

const PUSH_PREF_COLUMN: Record<NotificationType, string> = {
  order_update: 'push_order_updates',
  payment: 'push_payments',
  vault_delivery: 'push_vault_delivery',
  admin_message: 'push_admin_messages',
  system: 'push_admin_messages',
  promotion: 'push_promotions',
};

interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  orderDbId?: number;
  /** HTML for the email — if omitted, no email is sent even if the user allows it. */
  emailHtml?: string;
  emailSubject?: string;
  emailAttachments?: { filename: string; content: Buffer | string }[];
  isAdminSent?: boolean;
  batchId?: string;
  /**
   * Bypass the recipient's category preference for email. Use only for direct,
   * admin-initiated one-to-one sends where the admin explicitly chose the
   * recipient — never for broadcasts, which must honour opt-outs.
   */
  forceEmail?: boolean;
}

export type NotifyResult = {
  /** True only if the email actually reached Resend without throwing. */
  emailed: boolean;
  /** Why no email went out — surfaced to admins so "sent" is never a lie. */
  emailSkipReason?: 'no_html' | 'opted_out' | 'no_address' | 'send_failed';
};

/**
 * Single entry point for notifying a user: writes the in-app notification,
 * sends the email (if the user allows that category and emailHtml is provided),
 * and pushes a Web Push notification (if the user allows it and has a subscription).
 * Never throws — a failure in one channel must not block the others or the caller.
 * Returns whether the email leg actually succeeded, so callers can report honestly.
 */
export async function notifyUser(params: NotifyParams): Promise<NotifyResult> {
  const { userId, title, message, type, link, orderDbId, emailHtml, emailSubject, emailAttachments, isAdminSent, batchId, forceEmail } = params;

  let prefs: Record<string, boolean> | null = null;
  try {
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    prefs = data;
  } catch (e) {
    console.warn('[notify] failed to load preferences, defaulting to enabled:', e);
  }

  const emailAllowed = forceEmail || (prefs ? prefs[EMAIL_PREF_COLUMN[type]] !== false : type !== 'promotion');
  const pushAllowed = prefs ? prefs[PUSH_PREF_COLUMN[type]] !== false : type !== 'promotion';

  const willEmail = emailAllowed && !!emailHtml;
  const result: NotifyResult = {
    emailed: false,
    emailSkipReason: !emailHtml ? 'no_html' : !emailAllowed ? 'opted_out' : undefined,
  };

  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link: link || null,
      order_id: orderDbId || null,
      send_email: willEmail,
      send_in_app: true,
      is_admin_sent: !!isAdminSent,
      batch_id: batchId || null,
    });
  } catch (e) {
    console.error('[notify] failed to insert notification:', e);
  }

  if (willEmail) {
    try {
      // Resolve the address from auth (the source of truth). The old code also
      // required a matching `profiles` row and silently sent nothing when it
      // was missing — a profile is not a prerequisite for having an inbox.
      const { data: userRes } = await supabase.auth.admin.getUserById(userId);
      const to = userRes?.user?.email;
      if (to) {
        await sendSystemEmail({
          to,
          subject: emailSubject || title,
          html: emailHtml!,
          attachments: emailAttachments,
          orderId: orderDbId ? String(orderDbId) : undefined,
          batchId: batchId || undefined
        });
        result.emailed = true;
        result.emailSkipReason = undefined;
      } else {
        result.emailSkipReason = 'no_address';
        console.warn(`[notify] no email address on file for user ${userId}`);
      }
    } catch (e) {
      result.emailSkipReason = 'send_failed';
      console.warn('[notify] email send failed (non-fatal):', e);
    }
  }

  if (pushAllowed) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({
          user_ids: [userId],
          title,
          body: message,
          url: link || '/dashboard/client',
          tag: type,
          notification_type: PUSH_TYPE[type],
        }),
      });
    } catch (e) {
      console.warn('[notify] push send failed (non-fatal):', e);
    }
  }

  return result;
}

/**
 * Same as notifyUser but for a batch of recipients (admin mass-notify).
 * Returns per-channel counts so the caller can report what really went out
 * instead of assuming every recipient was emailed.
 */
export async function notifyUsers(
  userIds: string[],
  params: Omit<NotifyParams, 'userId'>
): Promise<{ total: number; emailed: number; optedOut: number; failed: number }> {
  const batchId = params.batchId || `batch_${Date.now()}`;
  const results = await Promise.all(
    userIds.map(userId => notifyUser({ ...params, userId, batchId }))
  );
  return {
    total: userIds.length,
    emailed: results.filter(r => r.emailed).length,
    optedOut: results.filter(r => r.emailSkipReason === 'opted_out').length,
    failed: results.filter(r => r.emailSkipReason === 'send_failed' || r.emailSkipReason === 'no_address').length,
  };
}

/** Notifies all platform admins (in-app, email, and push notifications). */
export async function notifyAdmins(params: Omit<NotifyParams, 'userId'>): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);
    
    const adminIds = (admins || []).map(a => a.id);
    if (adminIds.length > 0) {
      const batchId = params.batchId || `batch_admin_${Date.now()}`;
      await notifyUsers(adminIds, { ...params, batchId });
    } else {
      // Fallback to sending a direct email to the main admin address
      const adminEmail = process.env.ADMIN_EMAIL || 'yourwriterofficial@gmail.com';
      if (params.emailHtml) {
        await sendSystemEmail({
          to: adminEmail,
          subject: params.emailSubject || params.title,
          html: params.emailHtml,
          orderId: params.orderDbId ? String(params.orderDbId) : undefined,
        });
      }
    }
  } catch (e) {
    console.error('[notify] failed to notify admins:', e);
  }
}

