'use client';

import { Suspense } from 'react';
import PaymentCallbackContent from './PaymentCallbackContent';

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-['Inter']">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 animate-pulse">Verifying Payment Gateway...</div>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}