import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const supabase = guard.admin;

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