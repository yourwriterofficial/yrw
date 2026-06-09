'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentCallback() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const tx_ref = searchParams.get('tx_ref');

  useEffect(() => {
    if (status === 'successful') {
      alert('Payment successful! Your order will be updated shortly.');
    } else {
      alert('Payment failed or was cancelled.');
    }
  }, [status]);

  return <div className="text-white p-8">Payment callback. You may close this window.</div>;
}