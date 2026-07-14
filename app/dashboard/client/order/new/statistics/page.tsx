'use client';
import { Suspense } from 'react';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { LineChart } from 'lucide-react';

export default function StatisticsOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center text-primary">Loading...</div>}>
      <ServiceOrderPage
        serviceCategory="CUSTOM"
        pageKey="order_statistics"
        orderPrefix="STAT"
        tosKey="academic_tos"
        accent="purple"
        icon={LineChart}
        vaultStatusDefault="Pending Analysis"
        topicLabel="Project Topic / Objective"
        topicPlaceholder="E.g., Fieldwork Analysis of Consumer Patterns"
        briefLabel="Datasets / Brief Files"
        briefHelperText="Attach Brief or Dataset"
        minProposedBudget={20000}
        additionalInfoLabel="Methodologies & Data Guidelines"
      />
    </Suspense>
  );
}
