import webpush from 'web-push';
import { isMissingRelationError, readExtendedSite, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { readPluginSettings } from '@/lib/pluginsServer';

// Same public key the main site's push hook falls back to when the env var is not set.
const FALLBACK_VAPID_PUBLIC_KEY = 'BA8RM3ej0pbVl5vx_DBKyv7GECKHji3F6oCCbzUjola1Uf0tLuh8nuDqwURDkJ_cgK8zhhNM-kq_-pAkLYtS3Y4';

export function vapidPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.length === 87 ? key : FALLBACK_VAPID_PUBLIC_KEY;
}

export interface SitePushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

let configured = false;
let warned = false;

function configure(): boolean {
  if (configured) return true;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    if (!warned) {
      warned = true;
      console.warn('Site push is off: VAPID_PRIVATE_KEY is not set.');
    }
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@developa.me', vapidPublicKey(), privateKey);
  configured = true;
  return true;
}

/** Sends a phone alert to a site's owner and staff, or to one buyer. Never throws; quietly does nothing when push is not available. */
export async function sendSitePush(
  siteId: string,
  audience: 'owner' | 'buyer',
  payload: SitePushPayload,
  opts?: { buyerEmail?: string }
): Promise<void> {
  try {
    if (!configure()) return;

    const { data: site } = await supabaseAdmin.from('forums').select('plan_tier').eq('id', siteId).maybeSingle();
    if (!site) return;
    const ext = await readExtendedSite(siteId);
    if (!planFor(site.plan_tier, ext?.plan_expires_at).pushNotifications) return;
    if ((await readPluginSettings(siteId)).push === false) return;   // the owner switched phone alerts off

    let query = supabaseAdmin
      .from('site_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('site_id', siteId)
      .eq('audience', audience);
    if (audience === 'buyer') {
      const email = (opts?.buyerEmail || '').toLowerCase().trim();
      if (!email) return;
      query = query.eq('buyer_email', email);
    }
    const { data: subs, error } = await query;
    if (error) {
      if (!isMissingRelationError(error)) console.warn('Site push lookup failed:', error.message);
      return;
    }

    const message = JSON.stringify(payload);
    await Promise.all(
      (subs || []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabaseAdmin.from('site_push_subscriptions').delete().eq('site_id', siteId).eq('endpoint', s.endpoint);
          }
        }
      })
    );
  } catch (err) {
    console.warn('Site push failed:', err);
  }
}
