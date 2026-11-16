import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ForumView from '@/app/components/forums/ForumView';
import { supabaseAdmin, readSeo } from '@/lib/forumServer';

type Props = { params: Promise<{ slug: string }> };

/** Title and description come from what the owner set under Settings, with sensible fallbacks. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, description, hero_headline, hero_subheadline, logo_url, is_public, custom_domain, custom_domain_verified, plan_tier')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();
  if (!site) return { title: { absolute: 'Store not found | developa.me' }, robots: { index: false } };

  const seo = await readSeo(site.id);
  const title = seo.seo_title || (site.hero_headline ? `${site.name}: ${site.hero_headline}` : site.name);
  const description = (seo.seo_description || site.description || site.hero_subheadline || `Shop or join ${site.name} on developa.me`).slice(0, 170);
  const canonical =
    site.custom_domain && site.custom_domain_verified && site.plan_tier !== 'free'
      ? `https://${site.custom_domain}`
      : `https://${site.slug}.developa.me`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: site.is_public ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.name,
      type: 'website',
      ...(site.logo_url ? { images: [{ url: site.logo_url }] } : {}),
    },
    twitter: { card: site.logo_url ? 'summary_large_image' : 'summary', title, description },
  };
}

export default async function ForumSlugPage({ params }: Props) {
  const { slug } = await params;
  // An address nobody owns answers with a real 404 (and the store-not-found page), not a blank 200.
  const { data: exists } = await supabaseAdmin.from('forums').select('id').eq('slug', slug.toLowerCase().trim()).maybeSingle();
  if (!exists) notFound();
  return <ForumView slug={slug} />;
}
