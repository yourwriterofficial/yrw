'use client';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { GraduationCap } from 'lucide-react';

export default function AcademicOrderPage() {
  return (
    <ServiceOrderPage
      serviceCategory="ACADEMIC"
      pageKey="order_academic"
      orderPrefix="RW"
      tosKey="academic_tos"
      accent="emerald"
      icon={GraduationCap}
      vaultStatusDefault="Secured in Vault"
      topicLabel="Research Topic"
      topicPlaceholder="E.g., Impact of Monetary Policy on Small Businesses"
      briefLabel="Project Brief / Rubric"
      briefHelperText="Attach Project Brief or Rubric"
      minProposedBudget={15000}
      additionalInfoLabel="Additional Instructions"
      extraFields={[
        { type: 'select', key: 'referenceStyle', label: 'Reference Style', defaultValue: 'APA 7th Edition', options: ['APA 7th Edition', 'MLA 9th Edition', 'Harvard', 'Chicago / Turabian', 'IEEE', 'OSCOLA'] },
        { type: 'select', key: 'fontStyle', label: 'Font Preference', defaultValue: 'Times New Roman (12pt)', options: ['Times New Roman (12pt)', 'Arial (12pt)', 'Calibri (12pt)', 'Georgia (12pt)'] },
      ]}
    />
  );
}
