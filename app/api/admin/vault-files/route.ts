import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch all vault files with order details
    const { data, error } = await supabase
      .from('final_deliverables')
      .select(`
        id,
        order_id,
        file_name,
        file_path,
        uploaded_at,
        downloaded_at,
        download_count,
        orders!inner (
          legal_name,
          email
        )
      `)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ files: data });
  } catch (err: any) {
    console.error('Admin vault fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}