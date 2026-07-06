import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { listAllAuthUsers } from '@/lib/adminAuth';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const LEVEL_PRICE: Record<string, number> = { BSc: 3999, MSc: 4500, PhD: 10000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pay-FIRST checkout for a project material. No order is created here — the
 * order is only written by the Paystack webhook after payment is confirmed, so
 * unpaid attempts never persist. Guests may check out without logging in first —
 * they supply an email, we resolve/create the matching account, and the webhook
 * emails them a magic link to log in to the dashboard where their order lands.
 *
 * Body: { topicId?, customTitle?, department?, level?, addonIds?: number[], email? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      topicId,
      customTitle,
      department,
      level,
      addonIds,
      addonWords,
      addonFeatures,
      customLocation,
      email: guestEmailInput,
    } = body;

    let buyerId: string;
    let buyerEmail: string;
    let guestCheckout = false;

    if (user) {
      buyerId = user.id;
      buyerEmail = user.email!;
    } else {
      const email = String(guestEmailInput || '').trim().toLowerCase();
      if (!email || !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'A valid email is required to check out.' }, { status: 400 });
      }
      guestCheckout = true;
      buyerEmail = email;

      const existing = await listAllAuthUsers(admin);
      const match = existing.find((u) => u.email.toLowerCase() === email);
      if (match) {
        buyerId = match.id;
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: email.split('@')[0] },
        });
        if (createErr || !created?.user) {
          return NextResponse.json({ error: 'Could not set up your account for checkout.' }, { status: 500 });
        }
        buyerId = created.user.id;
        await admin.from('profiles').upsert({ id: buyerId, full_name: email.split('@')[0] });
      }
    }

    // Fetch pricing settings (global level prices & department price overrides)
    const { data: settingsData } = await admin.from('project_settings').select('*');
    let levelPrices: Record<string, number> = { BSc: 3999, MSc: 4500, PhD: 10000 };
    let deptPrices: Record<string, number> = {};

    if (settingsData) {
      settingsData.forEach(s => {
        if (s.key === 'level_prices') levelPrices = s.value;
        if (s.key === 'department_prices') deptPrices = s.value;
      });
    }

    const getTopicPrice = (lvl: string, deptName: string) => {
      const deptPrice = deptPrices[deptName];
      if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
      return levelPrices[lvl] || levelPrices.BSc || 3999;
    };

    let title = '';
    let basePrice = levelPrices.BSc;
    let dept = department || 'General';
    let topicRef: string | null = null;
    let lvl = (level && levelPrices[level]) ? level : 'BSc';

    if (topicId) {
      const { data: topic, error } = await admin
        .from('project_topics')
        .select('id, title, department, price, level, is_active')
        .eq('id', topicId)
        .single();
      if (error || !topic || !topic.is_active) {
        return NextResponse.json({ error: 'Topic not found or unavailable.' }, { status: 404 });
      }
      title = topic.title;
      basePrice = Number(topic.price) || getTopicPrice(topic.level, topic.department);
      dept = topic.department;
      lvl = topic.level || 'BSc';
      topicRef = String(topic.id);
    } else if (customTitle && String(customTitle).trim().length >= 5) {
      title = String(customTitle).trim();
      basePrice = getTopicPrice(lvl, dept);
    } else {
      return NextResponse.json({ error: 'Provide a topic to purchase.' }, { status: 400 });
    }

    // Resolve selected add-ons (server-side price authority)
    let addonTotal = 0;
    let addonDescriptions: string[] = [];
    if (Array.isArray(addonIds) && addonIds.length) {
      const { data: addons } = await admin
        .from('project_addons')
        .select('*')
        .in('id', addonIds)
        .eq('is_active', true);

      (addons || []).forEach(a => {
        let addonPrice = Number(a.price) || 0;
        let details = '';

        if (a.price_type === 'per_word') {
          const words = Number(addonWords?.[a.id]) || 1000;
          addonPrice = (Number(a.price) || 0) * words;
          details += ` (${words.toLocaleString()} words @ ₦${a.price}/word = ₦${addonPrice.toLocaleString()})`;
        } else {
          details += ` (₦${addonPrice.toLocaleString()})`;
        }

        // Add sub-features pricing
        if (Array.isArray(a.features) && a.features.length && Array.isArray(addonFeatures?.[a.id])) {
          const selectedFeats = addonFeatures[a.id];
          const subFeats: string[] = [];
          a.features.forEach((f: any) => {
            if (selectedFeats.includes(f.name)) {
              addonPrice += Number(f.price) || 0;
              subFeats.push(`${f.name} (+₦${(Number(f.price) || 0).toLocaleString()})`);
            }
          });
          if (subFeats.length) {
            details += ` [Features: ${subFeats.join(', ')}]`;
          }
        }

        // Add location changer text
        if (a.is_location_changer && customLocation) {
          details += ` [Change Location to: "${customLocation}"]`;
        }

        addonTotal += addonPrice;
        addonDescriptions.push(`${a.name}${details}`);
      });
    }

    const total = Math.round(basePrice + addonTotal);

    const { data: profile } = await admin.from('profiles').select('full_name, whatsapp').eq('id', buyerId).single();
    const reference = `PROJ_${Date.now()}_${buyerId.slice(0, 8)}`;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: buyerEmail,
        amount: total * 100,
        reference,
        callback_url: `${BASE}/payment/callback?tx_ref=${reference}`,
        metadata: {
          type: 'project_material',
          userId: buyerId,
          topicId: topicRef,
          title,
          department: dept,
          level: lvl,
          price: total,
          basePrice,
          addons: addonDescriptions.length ? addonDescriptions.join(', ') : 'None',
          customLocation: customLocation || null,
          name: profile?.full_name || buyerEmail.split('@')[0] || 'Client',
          whatsapp: profile?.whatsapp || null,
          guestCheckout,
          guestEmail: guestCheckout ? buyerEmail : null,
        },
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment init failed' }, { status: 400 });
    }
    return NextResponse.json({ authorization_url: data.data.authorization_url, reference, total });
  } catch (err: any) {
    console.error('Project checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
