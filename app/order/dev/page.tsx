'use client';
import ServiceOrderPage from '@/app/components/ServiceOrderPage';
import { Terminal } from 'lucide-react';

export default function DevOrderForm() {
  return (
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
  );
}
