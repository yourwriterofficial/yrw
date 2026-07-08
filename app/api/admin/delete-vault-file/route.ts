import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const supabase = guard.admin;

  try {
    const { fileId } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    // Get the file record to find the storage path
    const { data: file, error: fetchError } = await supabase
      .from('final_deliverables')
      .select('file_path')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('final-deliverables')
      .remove([file.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue to delete the record anyway
    }

    // Delete the record
    const { error: deleteError } = await supabase
      .from('final_deliverables')
      .delete()
      .eq('id', fileId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete vault file error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}