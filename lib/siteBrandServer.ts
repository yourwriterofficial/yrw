import { createClient } from '@supabase/supabase-js';
import { siteBrand, type SiteBrand } from './emailTemplates';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!);

/**
 * The site's look for email to its customers (name, logo, accent colour, "Powered by Developa").
 * Never throws: when the site cannot be read the mail still goes out, in plain Developa colours.
 */
export async function loadSiteBrand(site: { slug: string; name: string }): Promise<SiteBrand> {
  try {
    const { data } = await admin
      .from('forums')
      .select('name, slug, accent_color, logo_url, hide_branding, custom_domain, custom_domain_verified')
      .eq('slug', site.slug)
      .maybeSingle();
    if (data) {
      const url = data.custom_domain && data.custom_domain_verified ? `https://${data.custom_domain}` : undefined;
      return siteBrand({ ...data, name: data.name || site.name }, url);
    }
  } catch {
    // fall through to the plain brand
  }
  return siteBrand({ name: site.name, slug: site.slug });
}
