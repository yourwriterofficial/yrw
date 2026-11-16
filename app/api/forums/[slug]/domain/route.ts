import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';
import crypto from 'crypto';
import { supabaseAdmin, requireOwnedSite } from '@/lib/forumServer';
import { CNAME_TARGET, VERIFY_TXT_PREFIX, normalizeDomain, planFor } from '@/lib/plans';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

function view(site: {
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
  domain_verify_token?: string | null;
  plan_tier?: string | null;
  plan_expires_at?: string | null;
}) {
  const domain = site.custom_domain || null;
  return {
    domain,
    verified: !!site.custom_domain_verified,
    txt_name: domain ? `${VERIFY_TXT_PREFIX}.${domain}` : null,
    txt_value: site.domain_verify_token || null,
    cname_target: CNAME_TARGET,
    plan_allows_domain: planFor(site.plan_tier, site.plan_expires_at).customDomain,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const r = await requireOwnedSite((await ctx.params).slug);
  if ('error' in r) return r.error;
  return NextResponse.json(view(r.site));
}

/** Add (or change) the custom domain. It stays unverified until the DNS record is found. */
export async function POST(req: Request, ctx: Ctx) {
  const r = await requireOwnedSite((await ctx.params).slug);
  if ('error' in r) return r.error;

  const body = await req.json().catch(() => null);
  const domain = normalizeDomain(String(body?.domain || ''));
  if (!domain) {
    return NextResponse.json({ error: 'Enter a domain like shop.yourbrand.com (without https://).' }, { status: 400 });
  }

  const { data: taken } = await supabaseAdmin.from('forums').select('id').eq('custom_domain', domain).neq('id', r.site.id).maybeSingle();
  if (taken) return NextResponse.json({ error: 'That domain is already connected to another site.' }, { status: 409 });

  const token = crypto.randomBytes(16).toString('hex');
  const { data, error } = await supabaseAdmin
    .from('forums')
    .update({ custom_domain: domain, custom_domain_verified: false, domain_verify_token: token, domain_checked_at: null })
    .eq('id', r.site.id)
    .select('custom_domain, custom_domain_verified, domain_verify_token, plan_tier, plan_expires_at')
    .single();
  if (error) {
    return NextResponse.json(
      { error: /column|schema/i.test(error.message) ? 'This is not available right now. Please try again in a few minutes.' : error.message },
      { status: /column|schema/i.test(error.message) ? 503 : 500 }
    );
  }
  return NextResponse.json(view(data));
}

/** Check DNS for the ownership record, and report whether traffic already points here. */
export async function PUT(_req: Request, ctx: Ctx) {
  const r = await requireOwnedSite((await ctx.params).slug);
  if ('error' in r) return r.error;
  const { custom_domain: domain, domain_verify_token: token } = r.site;
  if (!domain || !token) return NextResponse.json({ error: 'Add a domain first.' }, { status: 400 });

  let ownership = false;
  try {
    const records = await dns.resolveTxt(`${VERIFY_TXT_PREFIX}.${domain}`);
    ownership = records.some((chunks) => chunks.join('').trim() === token);
  } catch { /* record not found yet */ }

  let pointing = false;
  try {
    const cnames = await dns.resolveCname(domain);
    pointing = cnames.some((c) => c.toLowerCase().replace(/\.$/, '') === CNAME_TARGET.toLowerCase());
  } catch {
    try {
      const target = await dns.resolve4(CNAME_TARGET);
      const mine = await dns.resolve4(domain);
      pointing = mine.some((ip) => target.includes(ip));
    } catch { /* not pointing yet */ }
  }

  if (ownership) {
    await supabaseAdmin.from('forums').update({ custom_domain_verified: true, domain_checked_at: new Date().toISOString() }).eq('id', r.site.id);
  } else {
    await supabaseAdmin.from('forums').update({ domain_checked_at: new Date().toISOString() }).eq('id', r.site.id);
  }
  return NextResponse.json({ ...view({ ...r.site, custom_domain_verified: ownership }), ownership_found: ownership, pointing });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await requireOwnedSite((await ctx.params).slug);
  if ('error' in r) return r.error;
  await supabaseAdmin
    .from('forums')
    .update({ custom_domain: null, custom_domain_verified: false, domain_verify_token: null, domain_checked_at: null })
    .eq('id', r.site.id);
  return NextResponse.json({ ok: true });
}
