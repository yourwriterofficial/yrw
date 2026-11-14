import { sendSystemEmail } from './emailService';

/**
 * Email for developa sites (order updates, ad requests, reminders).
 *
 * It goes through the Google Apps Script mailer first (free, sent from your own Gmail or Workspace
 * address, see scripts/google-apps-script-mailer.gs). If the script is not set up, is over its daily
 * quota, or fails, the message goes out through the normal email service instead, so a mail problem
 * never loses a message.
 *
 * Env: GOOGLE_APPS_SCRIPT_MAIL_URL and MAIL_SECRET. Server only.
 */
export async function sendSiteEmail(params: {
  to: string;
  subject: string;
  html: string;
  orderId?: string;
  attachments?: { filename: string; content: Buffer | string }[];
}): Promise<unknown> {
  const url = process.env.GOOGLE_APPS_SCRIPT_MAIL_URL;
  const secret = process.env.MAIL_SECRET;
  const hasAttachments = !!params.attachments?.length;

  if (url && secret && url.startsWith('https://script.google.com/') && !hasAttachments) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, to: params.to, subject: params.subject, html: params.html }),
        redirect: 'follow',
      });
      const json = res.ok ? ((await res.json().catch(() => null)) as { ok?: boolean } | null) : null;
      if (json?.ok) return { provider: 'apps_script' };
      console.warn('Apps Script mailer did not send, using the email service instead.');
    } catch (err) {
      console.warn('Apps Script mailer failed, using the email service instead:', err);
    }
  }
  return sendSystemEmail({ ...params, fromName: 'developa.me' });
}
