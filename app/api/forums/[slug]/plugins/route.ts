import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSiteAccess, supabaseAdmin, isMissingColumnError } from '@/lib/forumServer';
import { PLUGINS, pluginOn } from '@/lib/plugins';
import { readPluginSettings } from '@/lib/pluginsServer';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await requireSiteAccess(slug, ['owner', 'manager']);
  if ('error' in a) return a.error;
  return NextResponse.json({ plugins: await readPluginSettings(a.site.id) });
}

const schema = z.object({ id: z.string().min(1).max(40), enabled: z.boolean() });

/** Switch a plugin on or off. Only plugins marked as switchable, and only if the plan includes them. */
export async function PUT(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await requireSiteAccess(slug, ['owner']);
  if ('error' in a) return a.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const def = PLUGINS.find((p) => p.id === parsed.data.id);
  if (!def || !def.toggle) return NextResponse.json({ error: 'That plugin cannot be switched.' }, { status: 400 });
  const site = a.site as { plan_tier?: string; plan_expires_at?: string | null };
  if (!pluginOn(def.id, site.plan_tier, site.plan_expires_at, {})) {
    return NextResponse.json({ error: `${def.name} is not part of your plan.` }, { status: 403 });
  }
  const current = await readPluginSettings(a.site.id);
  const next = { ...current, [def.id]: parsed.data.enabled };
  const { error } = await supabaseAdmin.from('forums').update({ plugins: next }).eq('id', a.site.id);
  if (error) {
    return NextResponse.json({ error: isMissingColumnError(error) ? 'Plugin switches need the latest database update first.' : 'Could not save.' }, { status: 503 });
  }
  return NextResponse.json({ plugins: next });
}
