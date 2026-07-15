import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const admin = guard.admin;

  try {
    const { type, mapping } = await request.json();
    if (!type || !mapping) {
      return NextResponse.json({ error: 'Type and mapping are required.' }, { status: 400 });
    }

    const updates = Object.entries(mapping).map(async ([lvl, val]) => {
      if (type === 'prices') {
        return admin.from('project_topics').update({ price: Number(val), updated_at: new Date().toISOString() }).eq('level', lvl);
      } else {
        return admin.from('project_topics').update({ pages: Number(val), updated_at: new Date().toISOString() }).eq('level', lvl);
      }
    });

    const results = await Promise.all(updates);
    const errors = results.map(r => r.error).filter(Boolean);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.map(e => e?.message || 'Unknown error').join(', ') }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Bulk update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
