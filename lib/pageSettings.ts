import { supabase } from '@/lib/supabaseClient';

export interface PageSettingRow {
  page: string;
  key: string;
  value: any;
  updated_at: string;
}

/** Fetch every settings row for a page and shallow-merge each `key`'s jsonb value onto a
 * clone of `defaults[key]`. Missing keys/rows fall back to the code default untouched, so an
 * empty or partially-configured page never breaks. */
export async function fetchPageSettings<T extends Record<string, any>>(page: string, defaults: T): Promise<T> {
  const merged = structuredClone(defaults);
  const { data } = await supabase.from('page_settings').select('*').eq('page', page);
  (data as PageSettingRow[] | null)?.forEach(row => {
    if (row.key in merged) {
      const current = (merged as any)[row.key];
      if (Array.isArray(row.value)) {
        (merged as any)[row.key] = row.value;
      } else if (current && typeof current === 'object' && row.value && typeof row.value === 'object') {
        (merged as any)[row.key] = { ...current, ...row.value };
      } else {
        (merged as any)[row.key] = row.value;
      }
    }
  });
  return merged;
}

export async function savePageSetting(page: string, key: string, value: any) {
  return supabase.from('page_settings').upsert({ page, key, value, updated_at: new Date().toISOString() });
}
