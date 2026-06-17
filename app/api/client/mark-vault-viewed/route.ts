import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('final_deliverables')
      .update({
        downloaded_at: new Date().toISOString(),
        // Optionally increment download count? Usually not, because they didn't download.
        // We can leave download_count unchanged.
      })
      .eq('id', fileId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Mark viewed error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}