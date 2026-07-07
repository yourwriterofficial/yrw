import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId, full_name, is_admin, whatsapp, email } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    
    // Update auth email if provided
    if (email !== undefined) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email });
      if (authError) throw authError;
    }

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (is_admin !== undefined) updates.is_admin = is_admin;
    if (whatsapp !== undefined) updates.whatsapp = whatsapp;
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}