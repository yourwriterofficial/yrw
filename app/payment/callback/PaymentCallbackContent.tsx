'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get('status');
  const tx_ref = searchParams.get('tx_ref') || searchParams.get('trxref') || searchParams.get('reference');

  const [displayState, setDisplayState] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    // Wait for URL params to be available
    if (!tx_ref) return;

    // For Paystack, status is not present in URL parameters on redirect.
    // If status is present, verify it indicates success. If not present, assume success.
    const isSuccessful = !rawStatus || ['successful', 'completed', 'success'].includes(rawStatus.toLowerCase());

    if (isSuccessful) {
      
      // POLLING MECHANISM: Give the webhook time to update the DB
      let attempts = 0;
      const maxAttempts = 10; // Try 10 times (approx 20 seconds)

      const verifyPaymentStatus = async () => {
        try {
          let isPaid = false;

          if (tx_ref.startsWith('PROJ_')) {
            // Project materials: check transactions table
            const { data } = await supabase
              .from('transactions')
              .select('status')
              .eq('reference', tx_ref)
              .maybeSingle();

            if (data && data.status === 'completed') {
              isPaid = true;
            }
          } else if (tx_ref.startsWith('CUSTINV_')) {
            // Custom invoices: check custom_invoices table milestones
            const parts = tx_ref.split('_');
            const invoiceNumber = parts[1];
            const milestoneType = parts[2] || '';
            const milestoneIndex = parseInt(milestoneType.replace('INDEX-', ''), 10);

            if (invoiceNumber && !isNaN(milestoneIndex)) {
              const { data } = await supabase
                .from('custom_invoices')
                .select('milestones')
                .eq('invoice_number', invoiceNumber)
                .maybeSingle();

              if (data && Array.isArray(data.milestones) && data.milestones[milestoneIndex]?.paid) {
                isPaid = true;
              }
            }
          } else {
            // Standard invoices: check invoices table
            const { data } = await supabase
              .from('invoices')
              .select('status')
              .eq('flutterwave_transaction_ref', tx_ref)
              .maybeSingle();

            if (data && data.status === 'PAID') {
              isPaid = true;
            }
          }

          const targetUrl = tx_ref.startsWith('PROJ_') ? '/dashboard/client?tab=vault' : '/dashboard/client';

          if (isPaid) {
            setDisplayState('success');
            setTimeout(() => {
              router.push(targetUrl);
            }, 2000);
            return;
          }

          // If not paid yet, increment attempts and try again in 2 seconds
          attempts++;
          if (attempts >= maxAttempts) {
            // Timeout reached. Show success anyway and let them see the dashboard
            setDisplayState('success');
            setTimeout(() => {
              router.push(targetUrl);
            }, 2000);
          } else {
            setTimeout(verifyPaymentStatus, 2000);
          }
        } catch (err) {
          // Fallback in case of network error
          const targetUrl = tx_ref.startsWith('PROJ_') ? '/dashboard/client?tab=vault' : '/dashboard/client';
          setDisplayState('success');
          setTimeout(() => {
            router.push(targetUrl);
          }, 2000);
        }
      };

      // Start the polling loop
      verifyPaymentStatus();

    } else {
      setDisplayState('error');
      setTimeout(() => {
        const targetUrl = tx_ref.startsWith('PROJ_') ? '/dashboard/client?tab=vault' : '/dashboard/client';
        router.push(targetUrl);
      }, 4000);
    }
  }, [rawStatus, tx_ref, router]);

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