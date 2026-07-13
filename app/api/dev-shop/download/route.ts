import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { productId } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: purchase, error: purchaseErr } = await admin
      .from('dev_product_purchases')
      .select('id, download_count')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (purchaseErr || !purchase) {
      return NextResponse.json({ error: 'You have not purchased this script.' }, { status: 403 });
    }

    const { data: product, error: productErr } = await admin
      .from('dev_products')
      .select('file_path, title')
      .eq('id', productId)
      .single();

    if (productErr || !product?.file_path) {
      return NextResponse.json({ error: 'File not available yet — contact support.' }, { status: 404 });
    }

    const { data: signedData, error: signedError } = await admin.storage
      .from('dev-shop-files')
      .createSignedUrl(product.file_path, 60);

    if (signedError) {
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    await admin
      .from('dev_product_purchases')
      .update({ download_count: (purchase.download_count || 0) + 1 })
      .eq('id', purchase.id);

    return NextResponse.json({ signedUrl: signedData.signedUrl, fileName: product.title });
  } catch (err: any) {
    console.error('Dev shop download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
