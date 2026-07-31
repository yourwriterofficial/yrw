import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Public page-load metadata for /projects (pricing settings, department list,
 * add-ons). Same anon-RLS gap as /api/projects/topics — these tables only
 * grant SELECT to the authenticated role, so logged-out visitors got silent
 * empty results. Read-only, non-sensitive catalogue data.
 */
export async function GET() {
  try {
    const [{ data: settingsData }, { data: depts }, { data: addons }] = await Promise.all([
      admin.from('project_settings').select('*'),
      admin.from('project_topic_departments').select('*'),
      admin.from('project_addons').select('id, name, description, price, price_type, features, is_location_changer').eq('is_active', true).order('sort_order'),
    ]);

    let levelPrices = { OND: 4999, HND: 5999, BSc: 5999, MSc: 4500, PhD: 10000 };
    let deptPrices = {};
    let pageSettings: Record<string, any> = {};
    (settingsData || []).forEach((s: any) => {
      if (s.key === 'level_prices') levelPrices = s.value;
      if (s.key === 'department_prices') deptPrices = s.value;
      if (s.key === 'page_settings') pageSettings = { ...pageSettings, ...s.value };
    });

    return NextResponse.json({ levelPrices, deptPrices, pageSettings, depts: depts || [], addons: addons || [] });
  } catch (err: any) {
    console.error('GET /api/projects/meta failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to load project metadata' }, { status: 500 });
  }
}
