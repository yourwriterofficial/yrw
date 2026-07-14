'use client';
import { Suspense } from 'react';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { Terminal } from 'lucide-react';

export default function DevOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center text-primary">Loading...</div>}>
      <ServiceOrderPage
        serviceCategory="DEV"
        pageKey="order_dev"
        orderPrefix="DEV"
        tosKey="dev_tos"
        accent="cyan"
        icon={Terminal}
        vaultStatusDefault="Pending Tech Analysis"
        topicLabel="Project Objective"
        topicPlaceholder="E.g., Inventory management web app with admin dashboard"
        briefLabel="Specs / Wireframes / Reference Files"
        briefHelperText="Attach Specs or Reference Files"
        minProposedBudget={20000}
        additionalInfoLabel="Technical Requirements & Notes"
      />
    </Suspense>
  );
}
