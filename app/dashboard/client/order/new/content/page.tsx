'use client';
import { Suspense } from 'react';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { PenTool } from 'lucide-react';

export default function ContentOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center text-primary">Loading...</div>}>
      <ServiceOrderPage
        serviceCategory="CONTENT"
        pageKey="order_content"
        orderPrefix="CT"
        tosKey="content_tos"
        accent="amber"
        icon={PenTool}
        vaultStatusDefault="Pending Outline"
        topicLabel="Project Title / Topic"
        topicPlaceholder="E.g., SEO Article on Digital Marketing Trends"
        briefLabel="Brand Guidelines / References"
        briefHelperText="Attach Brand Guidelines or References"
        minProposedBudget={15000}
        additionalInfoLabel="Stylistic Context & Instructions"
        extraFields={[
          { type: 'select', key: 'contentType', label: 'Content Category', defaultValue: 'Website Copy / Landing Page', options: ['Website Copy / Landing Page', 'SEO Blog Article', 'eBook / Ghostwriting', 'Fictional Narrative', 'Business Plan'] },
          { type: 'select', key: 'tone', label: 'Tone of Voice', defaultValue: 'Professional & Corporate', options: ['Professional & Corporate', 'Conversational & Friendly', 'Persuasive & Sales-Driven', 'Humorous & Witty', 'Academic & Technical'] },
          { type: 'text', key: 'audience', label: 'Target Audience', placeholder: 'Who is your target audience? (e.g., Tech startups, Gen Z shoppers)', required: true, helperText: 'Detailing your target audience helps us draft in the correct tone.' },
        ]}
      />
    </Suspense>
  );
}
