import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendSystemEmail } from './emailService';
import { emailTemplates } from './emailTemplates';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Generates a Supabase email-OTP link (magiclink or recovery) and rewrites
 * it to our own /auth/confirm route using its token_hash, instead of the
 * raw action_link Supabase returns. The raw action_link points at
 * Supabase's hosted /verify endpoint and redirects with a PKCE `code` —
 * but admin.generateLink() links never actually produce a usable `code`
 * (a known supabase-js gap: there's no client-side PKCE verifier for a
 * server-generated link), so our /auth/callback route (which expects
 * `code`) can never complete it and silently bounces the user to /login.
 * /auth/confirm verifies via token_hash + verifyOtp() instead, which is
 * Supabase's documented pattern for server/admin-generated email links.
 */
async function buildAuthConfirmLink(params: {
  email: string;
  type: 'magiclink' | 'recovery';
  next: string;
  client?: SupabaseClient;
}): Promise<string | null> {
  const { email, type, next, client } = params;
  const supabase = client || admin;

  const { data, error } = await supabase.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: `${BASE}${next}` },
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.warn('[magicLink] failed to generate link:', error);
    return null;
  }

  return `${BASE}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&next=${encodeURIComponent(next)}`;
}

/**
 * Generates an auth link (magiclink or recovery) and emails it using our
 * branded template.
 */
export async function sendAuthLinkEmail(params: {
  email: string;
  name: string;
  type: 'magiclink' | 'recovery';
  next: string;
  title?: string;
  introHtml?: string;
  ctaText?: string;
  client?: SupabaseClient;
}): Promise<string | null> {
  const { email, name, type, next, title, introHtml, ctaText, client } = params;
  const actionLink = await buildAuthConfirmLink({ email, type, next, client });
  if (!actionLink) return null;

  const tpl = emailTemplates.magicLinkLogin({ name, actionLink, title, introHtml, ctaText });
  await sendSystemEmail({ to: email, subject: tpl.subject, html: tpl.html });
  return actionLink;
}

/**
 * Passwordless sign-in link — used for guest checkout, where the buyer
 * never sets a password and instead logs in via a one-click emailed link.
 */
export async function sendMagicLinkEmail(params: {
  email: string;
  name: string;
  next: string;
  title?: string;
  introHtml?: string;
  client?: SupabaseClient;
}): Promise<string | null> {
  return sendAuthLinkEmail({ ...params, type: 'magiclink' });
}
