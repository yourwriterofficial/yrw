import { supabaseAdmin } from '@/lib/forumServer';

/** Which plugins the owner has switched off. A missing entry means on. Server only. */
export async function readPluginSettings(siteId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.from('forums').select('plugins').eq('id', siteId).maybeSingle();
  if (error) return {};
  return ((data as { plugins?: Record<string, unknown> } | null)?.plugins) || {};
}
