import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendSystemEmail } from './emailService';
import { emailTemplates } from './emailTemplates';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generates a Supabase magic-link (passwordless) sign-in link and emails it
 * using our own branded template — used for guest checkout, where the buyer
 * never sets a password and instead logs in via a one-click emailed link.
 */
export async function sendMagicLinkEmail(params: {
  email: string;
  name: string;
  redirectTo: string;
  title?: string;
  introHtml?: string;
  client?: SupabaseClient;
}): Promise<string | null> {
  const { email, name, redirectTo, title, introHtml } = params;
  const supabase = params.client || admin;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    console.warn('[magicLink] failed to generate link:', error);
    return null;
  }

  const actionLink = data.properties.action_link;
  const tpl = emailTemplates.magicLinkLogin({ name, actionLink, title, introHtml });
  await sendSystemEmail({ to: email, subject: tpl.subject, html: tpl.html });
  return actionLink;
}
