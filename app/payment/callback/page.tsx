import { Suspense } from 'react';
import PaymentCallbackContent from './PaymentCallbackContent';

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="text-white p-8">Loading...</div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}