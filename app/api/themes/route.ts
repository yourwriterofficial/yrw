import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/themeCatalog';

export const dynamic = 'force-dynamic';

/** The theme list with prices. When signed in, each theme also says whether you can already use it. */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const themes = (await loadCatalog(user?.id)).filter((t) => t.is_active);
  return NextResponse.json({ themes });
}
