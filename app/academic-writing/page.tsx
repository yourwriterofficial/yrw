import ServiceLandingTemplate from '@/app/components/ServiceLandingTemplate';
import { BookOpen, FileCheck, Award, Users, Clock, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Premium Academic Writing & Research | ResearchWriter',
  description: 'Essays, dissertations, term papers, and research projects — rigorously referenced, plagiarism-checked, and delivered by subject-matter writers.',
};

export default function AcademicWritingPage() {
  return (
    <ServiceLandingTemplate
      accent="emerald"
      badgeLabel="Academic Writing Pipeline"
      icon={BookOpen}
      title="Premium Academic Writing & Research"
      description="Essays, dissertations, term papers, and research projects — rigorously referenced, plagiarism-checked, and delivered by subject-matter writers."
      ctaHref="/order/academic"
      ctaLabel="Start Your Order"
      bullets={['Instant dynamic quotes', 'APA, MLA, Harvard formatting', 'Plagiarism & AI reports included']}
      capabilitiesTitle="What We Cover"
      capabilitiesDescription="From a single essay to a full dissertation — scoped and quoted instantly."
      capabilities={[
        { icon: BookOpen, title: 'Essays & Term Papers', description: 'Standard university assignments with automated volume discounts.' },
        { icon: Award, title: 'Dissertations & Theses', description: 'Full-length academic work with chapter-by-chapter structuring.' },
        { icon: FileCheck, title: 'Referencing & Formatting', description: 'APA, MLA, Harvard, Chicago — matched to your institution\'s guidelines.' },
        { icon: ShieldCheck, title: 'Plagiarism & AI Reports', description: 'Every deliverable ships with verifiable originality and AI-detection reports.' },
        { icon: Users, title: 'Subject-Matter Writers', description: 'Matched to a writer experienced in your specific field of study.' },
        { icon: Clock, title: 'Volume Discounts', description: 'Automatic pricing breaks for longer page counts and bulk orders.' },
      ]}
      processSteps={[
        { title: 'Submit Brief', description: 'Share your topic, level, and page count for an instant quote.' },
        { title: 'Writer Assigned', description: 'A subject-matter writer is matched to your topic.' },
        { title: 'Draft & Review', description: 'Track progress and request revisions through your dashboard.' },
        { title: 'Vault Delivery', description: 'Final work with reports lands securely in your vault.' },
      ]}
    />
  );
}
