'use client';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { LineChart } from 'lucide-react';

export default function StatisticsOrderForm() {
  return (
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
  );
}
