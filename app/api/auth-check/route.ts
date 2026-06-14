import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  return NextResponse.json({
    hasSession: !!session,
    user: session?.user?.email || null,
    error: error?.message || null,
  });
}