// /app/dashboard/client/order/new/academic/page.tsx
'use client';
import { Suspense } from 'react';
import OrderForm from '@/app/components/OrderForm';

export default function AcademicOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center">Loading...</div>}>
      <OrderForm />
    </Suspense>
  );
}