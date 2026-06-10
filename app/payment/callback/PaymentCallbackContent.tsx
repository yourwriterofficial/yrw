'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const tx_ref = searchParams.get('tx_ref');

  useEffect(() => {
    if (status === 'successful') {
      alert('Payment successful! Your order will be updated shortly.');
      // Optionally redirect to dashboard after a delay
      setTimeout(() => {
        router.push('/dashboard/client');
      }, 2000);
    } else {
      alert('Payment failed or was cancelled.');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  }, [status, router, tx_ref]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white p-8 text-center">
        <h2 className="text-xl font-bold mb-4">Processing Payment</h2>
        <p className="text-slate-400">Please wait while we confirm your transaction...</p>
      </div>
    </div>
  );
}