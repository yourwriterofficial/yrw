// /app/dashboard/client/order/new/academic/page.tsx
'use client';
import { Suspense } from 'react';
import OrderForm from '@/app/components/OrderForm';

export default function AcademicOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center text-primary">Loading...</div>}>
      <OrderForm />
    </Suspense>
  );
}