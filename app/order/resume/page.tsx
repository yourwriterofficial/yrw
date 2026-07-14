'use client';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { Briefcase } from 'lucide-react';

export default function ResumeOrderForm() {
  return (
    <ServiceOrderPage
      serviceCategory="RESUME"
      pageKey="order_resume"
      orderPrefix="CV"
      tosKey="resume_tos"
      accent="blue"
      icon={Briefcase}
      vaultStatusDefault="Pending Profile Review"
      topicLabel="Target Role / Position"
      topicPlaceholder="E.g., Senior Product Manager"
      briefLabel="Current CV / Resume"
      briefHelperText="Attach Your Current CV"
      minProposedBudget={10000}
      additionalInfoLabel="Career Notes & Instructions"
      extraFields={[
        { type: 'select', key: 'experienceLevel', label: 'Experience Level', defaultValue: 'Mid-Level (3-8 years)', options: ['Entry-Level (0-2 years)', 'Mid-Level (3-8 years)', 'Senior (9-15 years)', 'Executive (15+ years)'] },
        { type: 'text', key: 'linkedInUrl', label: 'LinkedIn Profile URL (Optional)', placeholder: 'https://linkedin.com/in/...' },
      ]}
    />
  );
}
