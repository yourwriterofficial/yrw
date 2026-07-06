import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Pay-FIRST checkout for a project material. No order is created here — the
 * order is only written by the Paystack webhook after payment is confirmed, so
 * unpaid attempts never persist. The buyer MUST be logged in.
 *
 * Body: { topicId?: number, customTitle?: string, department?: string }
 *  - topicId: buy an existing catalogue topic
 *  - customTitle: request a topic not in the catalogue (admin fulfils chapters 4-5)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must be logged in to purchase.' }, { status: 401 });

    const { topicId, customTitle, department } = await request.json();

    let title = '';
    let price = 3000;
    let dept = department || 'General';
    let topicRef: string | null = null;

    if (topicId) {
      const { data: topic, error } = await admin
        .from('project_topics')
        .select('id, title, department, price, is_active')
        .eq('id', topicId)
        .single();
      if (error || !topic || !topic.is_active) {
        return NextResponse.json({ error: 'Topic not found or unavailable.' }, { status: 404 });
      }
      title = topic.title;
      price = Number(topic.price) || 3000;
      dept = topic.department;
      topicRef = String(topic.id);
    } else if (customTitle && String(customTitle).trim().length >= 5) {
      title = String(customTitle).trim();
      price = 3000; // custom requests are the standard chapters 4-5 rate
    } else {
      return NextResponse.json({ error: 'Provide a topic to purchase.' }, { status: 400 });
    }

    const { data: profile } = await admin.from('profiles').select('full_name, whatsapp').eq('id', user.id).single();
    const reference = `PROJ_${Date.now()}_${user.id.slice(0, 8)}`;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(price * 100),
        reference,
        callback_url: `${BASE}/payment/callback?tx_ref=${reference}`,
        metadata: {
          type: 'project_material',
          userId: user.id,
          topicId: topicRef,
          title,
          department: dept,
          price,
          name: profile?.full_name || user.email?.split('@')[0] || 'Client',
          whatsapp: profile?.whatsapp || null,
        },
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment init failed' }, { status: 400 });
    }
    return NextResponse.json({ authorization_url: data.data.authorization_url, reference });
  } catch (err: any) {
    console.error('Project checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
