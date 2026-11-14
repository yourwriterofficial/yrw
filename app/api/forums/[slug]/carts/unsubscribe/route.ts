import { supabaseAdmin } from '@/lib/forumServer';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const token = (searchParams.get('token') || '').trim();

  if (!token) {
    return new Response('<html><body style="font-family:system-ui;padding:40px">Missing unsubscribe link.</body></html>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, name')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (site) {
    await supabaseAdmin
      .from('site_carts')
      .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
      .eq('site_id', site.id)
      .eq('unsubscribe_token', token);
  }

  const storeName = (site?.name || 'this store').replace(/[<>&"]/g, '');
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;max-width:460px;margin:64px auto;padding:24px;text-align:center"><h2>You have been unsubscribed</h2><p style="color:#555">You will no longer receive cart reminder emails from ${storeName}.</p></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
