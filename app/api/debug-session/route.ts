import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  return NextResponse.json({
    hasSession: !!session,
    userEmail: session?.user?.email || null,
    userId: session?.user?.id || null,
    error: error?.message || null,
  })
}