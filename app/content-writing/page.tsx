import ServiceLandingTemplate from '@/app/components/ServiceLandingTemplate';
import { PenTool, BookMarked, Megaphone, Mic2, Palette, Copyright } from 'lucide-react';

export const metadata = {
  title: 'Content & Creative Writing | ResearchWriter',
  description: 'eBooks, web copy, fictional narratives, and SEO articles — tailored tone of voice, distinct stylistic requirements, full commercial rights.',
};

export default function ContentWritingPage() {
  return (
    <ServiceLandingTemplate
      accent="amber"
      badgeLabel="Content Pipeline"
      icon={PenTool}
      title="Content & Creative Writing"
      description="eBooks, web copy, fictional narratives, and SEO articles — tailored tone of voice, distinct stylistic requirements, and full commercial rights on delivery."
      ctaHref="/order/content"
      ctaLabel="Start Your Order"
      bullets={['SEO-optimized structuring', 'Commercial copyright transfer', 'Any tone of voice, matched']}
      capabilitiesTitle="What We Write"
      capabilitiesDescription="From a single blog post to a full eBook — every piece matched to your voice."
      capabilities={[
        { icon: BookMarked, title: 'eBooks & Long-form', description: 'Full-length non-fiction or guides, structured and edited for readability.' },
        { icon: Megaphone, title: 'Web & SEO Copy', description: 'Landing pages, product copy, and articles optimized for search.' },
        { icon: Mic2, title: 'Fiction & Narrative', description: 'Short stories, novellas, and scripted dialogue in your chosen style.' },
        { icon: Palette, title: 'Brand Voice Matching', description: 'Consistent tone and style guide adherence across every piece.' },
        { icon: Copyright, title: 'Commercial Rights Transfer', description: 'Full ownership and copyright pass to you on final payment.' },
        { icon: PenTool, title: 'Unlimited Revisions Window', description: 'Refinement rounds included before final sign-off.' },
      ]}
      processSteps={[
        { title: 'Submit Brief', description: 'Share your topic, tone, and target word count.' },
        { title: 'Writer Assigned', description: 'Matched to a writer experienced in your niche and style.' },
        { title: 'Draft & Review', description: 'Track progress and request edits through your dashboard.' },
        { title: 'Vault Delivery', description: 'Final copy lands securely in your vault, rights included.' },
      ]}
    />
  );
}
