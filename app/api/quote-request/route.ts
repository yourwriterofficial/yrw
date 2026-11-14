import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyAdmins } from '@/lib/notify';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!);

const SERVICES: Record<string, string> = {
  academic: 'Academic Writing & Research',
  statistics: 'Statistics & Fieldwork',
  content: 'Content Writing',
  resume: 'Resume & CV',
  dev: 'Software Development',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Simple per-IP throttle: 5 requests / 10 min. Resets on server restart, which is fine for a public form.
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (tooMany(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // Honeypot: real users never fill this in. Pretend success for bots.
    if (body.website) return NextResponse.json({ success: true });

    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    const whatsapp = String(body.whatsapp || '').trim().slice(0, 40);
    const service = String(body.service || '');
    const deadline = String(body.deadline || '').trim().slice(0, 40);
    const details = String(body.details || '').trim().slice(0, 4000);
    const brand = body.brand === 'developa' ? 'developa' : 'yourresearchwriter';

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter your name and a valid email.' }, { status: 400 });
    }
    if (!SERVICES[service]) {
      return NextResponse.json({ error: 'Please choose a service.' }, { status: 400 });
    }
    if (details.length < 10) {
      return NextResponse.json({ error: 'Please describe what you need in a sentence or two.' }, { status: 400 });
    }

    const serviceLabel = SERVICES[service];
    const rows = `
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>WhatsApp:</strong> ${esc(whatsapp) || '—'}</p>
      <p><strong>Service:</strong> ${esc(serviceLabel)}</p>
      <p><strong>Deadline:</strong> ${esc(deadline) || '—'}</p>
      <p><strong>Details:</strong></p>
      <blockquote>${esc(details).replace(/\n/g, '<br/>')}</blockquote>`;

    // 1. Save first. The request must survive even if every email fails.
    const { data: saved, error: saveError } = await db
      .from('quote_requests')
      .insert({ name, email, whatsapp: whatsapp || null, service, deadline: deadline || null, details, brand })
      .select('id')
      .single();
    if (saveError) console.error('quote_requests insert failed:', saveError.message);

    // 2. Tell the admins. If this throws we still have the saved row.
    let notified = false;
    try {
      await notifyAdmins({
      title: `Quote request: ${serviceLabel}`,
      message: `${name} (${email}) asked for a quote. ${details.slice(0, 120)}`,
      type: 'admin_message',
      link: '/admin',
      emailSubject: `[QUOTE REQUEST] ${serviceLabel} — ${name}`,
      emailHtml: emailShell(`<h2>New quote request</h2>${rows}`, undefined, undefined, brand),
      isAdminSent: false,
      });
      notified = true;
    } catch (e) {
      console.error('quote notification failed:', e);
    }
    if (saved?.id && notified) await db.from('quote_requests').update({ notified: true }).eq('id', saved.id);

    // Only report failure when nothing at all was recorded or sent.
    if (!saved?.id && !notified) {
      return NextResponse.json({ error: 'We could not send your request. Please try again or message us on WhatsApp.' }, { status: 502 });
    }

    // Confirmation to the requester; failure here shouldn't fail the request.
    sendSystemEmail({
      to: email,
      subject: 'We received your quote request',
      html: emailShell(
        `<h2>Thanks, ${esc(name)}</h2>
         <p>We have your request for <strong>${esc(serviceLabel)}</strong> and will send a quote within 24 hours.</p>
         <p>Here is what you sent us:</p>
         <blockquote>${esc(details).replace(/\n/g, '<br/>')}</blockquote>`,
        undefined,
        undefined,
        brand
      ),
    }).catch((e) => console.warn('Quote confirmation email failed', e));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Quote request error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
