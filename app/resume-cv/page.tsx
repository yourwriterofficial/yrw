import ServiceLandingTemplate from '@/app/components/ServiceLandingTemplate';
import { Briefcase, ScanSearch, Mail, Globe, User, KeyRound } from 'lucide-react';

export const metadata = {
  title: 'Executive CVs & Resumes | ResearchWriter',
  description: 'ATS-friendly resumes, cover letters, and LinkedIn profile optimization designed to bypass automated filters and secure interviews.',
};

export default function ResumeCvPage() {
  return (
    <ServiceLandingTemplate
      accent="blue"
      badgeLabel="Career Services"
      icon={Briefcase}
      title="Executive CVs & Resumes"
      description="ATS-friendly resumes, cover letters, and LinkedIn profile optimization designed to bypass automated filters and secure interviews."
      ctaHref="/order/resume"
      ctaLabel="Start Your Order"
      bullets={['ATS compatibility', 'Industry-specific keywords', 'Interview-ready formatting']}
      capabilitiesTitle="What We Build"
      capabilitiesDescription="From entry-level resumes to executive bios — built to pass the filter and land the interview."
      capabilities={[
        { icon: ScanSearch, title: 'ATS-Optimized Resumes', description: 'Structured and keyword-matched to pass applicant tracking systems.' },
        { icon: Mail, title: 'Cover Letters', description: 'Tailored to the specific role and company you\'re applying to.' },
        { icon: Globe, title: 'LinkedIn Profile Overhaul', description: 'Headline, summary, and experience rewritten for recruiter visibility.' },
        { icon: User, title: 'Executive Bios', description: 'Polished third-person bios for leadership and board positions.' },
        { icon: KeyRound, title: 'Industry-Specific Keywords', description: 'Matched to the exact terminology recruiters in your field search for.' },
        { icon: Briefcase, title: 'Interview-Ready Formatting', description: 'Clean, scannable layouts that read well on-screen and on paper.' },
      ]}
      processSteps={[
        { title: 'Submit Brief', description: 'Share your work history, target role, and industry.' },
        { title: 'Writer Assigned', description: 'Matched to a writer experienced in your career field.' },
        { title: 'Draft & Review', description: 'Track progress and request edits through your dashboard.' },
        { title: 'Vault Delivery', description: 'Final documents land securely in your vault, ready to send.' },
      ]}
    />
  );
}
