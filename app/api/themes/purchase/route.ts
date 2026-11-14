import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';
import { loadCatalog } from '@/lib/themeCatalog';
import { overLimit } from '@/lib/rateLimit';

const schema = z.object({ template_id: z.string().trim().min(1).max(60) });

/**
 * A person asks to buy a premium theme. The price comes from the server, never from the page.
 * The request waits as "pending" with a reference; the founder confirms the bank transfer in the
 * admin and the theme unlocks for that person's account.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to buy a theme.' }, { status: 401 });
  if (overLimit(`theme-buy:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a theme.' }, { status: 400 });

  const theme = (await loadCatalog(user.id)).find((t) => t.id === parsed.data.template_id);
  if (!theme || !theme.is_active) return NextResponse.json({ error: 'That theme is not available.' }, { status: 404 });
  if (theme.price_ngn <= 0 || theme.owned) return NextResponse.json({ error: 'You can already use this theme.' }, { status: 400 });

  // One open request per theme: asking again just returns the same reference.
  const { data: open } = await supabaseAdmin
    .from('theme_purchases')
    .select('id, reference, amount')
    .eq('user_id', user.id)
    .eq('template_id', theme.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (open) return NextResponse.json({ reference: open.reference, amount: open.amount, theme: theme.label });

  const reference = `TH-${randomBytes(4).toString('hex').toUpperCase()}`;
  const { error } = await supabaseAdmin.from('theme_purchases').insert({
    user_id: user.id,
    template_id: theme.id,
    amount: theme.price_ngn,
    reference,
  });
  if (error) return NextResponse.json({ error: 'Theme sales are not switched on yet. Please try again soon.' }, { status: 503 });
  return NextResponse.json({ reference, amount: theme.price_ngn, theme: theme.label }, { status: 201 });
}
