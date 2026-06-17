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

    // Get the file path
    const { data: file, error: fetchError } = await supabase
      .from('final_deliverables')
      .select('id, file_path, download_count')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      console.error('File not found:', fetchError);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Generate signed URL (valid 60 seconds)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('final-deliverables')
      .createSignedUrl(file.file_path, 60);

    if (signedError) {
      console.error('Signed URL error:', signedError);
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    // Update downloaded_at and increment download_count
    const { error: updateError } = await supabase
      .from('final_deliverables')
      .update({
        downloaded_at: new Date().toISOString(),
        download_count: (file.download_count || 0) + 1,
      })
      .eq('id', fileId);

    if (updateError) {
      console.error('Update error:', updateError);
      // Non-critical – we still return the URL
    }

    return NextResponse.json({ signedUrl: signedData.signedUrl });
  } catch (err: any) {
    console.error('Download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}