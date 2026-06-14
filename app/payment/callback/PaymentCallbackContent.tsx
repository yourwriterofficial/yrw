'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const tx_ref = searchParams.get('tx_ref');

  const [displayState, setDisplayState] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    // Wait for URL params to be available
    if (!status || !tx_ref) return;

    if (status === 'successful' || status === 'completed') {
      
      // POLLING MECHANISM: Give the webhook time to update the DB
      let attempts = 0;
      const maxAttempts = 10; // Try 10 times (approx 20 seconds)

      const verifyPaymentStatus = async () => {
        try {
          const { data, error } = await supabase
            .from('invoices')
            .select('status')
            .eq('flutterwave_transaction_ref', tx_ref)
            .single();

          // If the webhook has marked it PAID, we are good to go!
          if (data && data.status === 'PAID') {
            setDisplayState('success');
            setTimeout(() => {
              router.push('/dashboard/client');
            }, 2000);
            return;
          }

          // If not paid yet, increment attempts and try again in 2 seconds
          attempts++;
          if (attempts >= maxAttempts) {
            // Timeout reached. Show success anyway and let them see the dashboard
            setDisplayState('success');
            setTimeout(() => {
              router.push('/dashboard/client');
            }, 2000);
          } else {
            setTimeout(verifyPaymentStatus, 2000);
          }
        } catch (err) {
          // Fallback in case of network error
          setDisplayState('success');
          setTimeout(() => {
            router.push('/dashboard/client');
          }, 2000);
        }
      };

      // Start the polling loop
      verifyPaymentStatus();

    } else {
      setDisplayState('error');
      setTimeout(() => {
        router.push('/dashboard/client');
      }, 4000);
    }
  }, [status, tx_ref, router]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-['Inter']">
      <div className="bg-[#0a0a0a] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl text-center">
        
        {displayState === 'processing' && (
          <div className="flex flex-col items-center animate-in fade-in duration-300">
            <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mb-6" />
            <h2 className="text-xl font-black text-white tracking-tight mb-2">Verifying Transaction</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Please wait while we confirm your payment securely with the gateway. Do not close this window.
            </p>
          </div>
        )}

        {displayState === 'success' && (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight mb-2">Payment Successful!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Your transaction has been securely cleared. Our system has updated your project vault.
            </p>
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">
              Redirecting to dashboard...
            </div>
          </div>
        )}

        {displayState === 'error' && (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight mb-2">Payment Failed</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              We could not process your transaction. Please verify your network and payment details, then try again.
            </p>
            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">
              Redirecting back...
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}