'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import Button from '@/app/components/ui/Button';
import ManualPaymentModal from '@/app/components/ManualPaymentModal';

type Milestone = { name: string; amount: number; paid: boolean; percentage?: number };
type Invoice = { invoice_number: string; client_name: string; project_title?: string | null; email?: string; total_amount: number; milestones: Milestone[] };

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

/**
 * The page behind the payment link printed on every invoice:
 *   /pay/<invoice number>?m=<step>
 * It shows what is due and opens the bank-transfer details with a reference.
 * The amount always comes from the invoice, never from this URL.
 */
export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <PayInner />
    </Suspense>
  );
}

function PayInner() {
  const { invoice: invoiceNumber } = useParams<{ invoice: string }>();
  const requested = useSearchParams().get('m');

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ isOpen: boolean; reference: string; amount: number; bankDetails: any }>({
    isOpen: false, reference: '', amount: 0, bankDetails: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invoice/${encodeURIComponent(invoiceNumber)}`);
        const json = await res.json();
        if (res.ok && json.invoice) setInvoice(json.invoice);
        else setError('We could not find this invoice.');
      } catch {
        setError('We could not load this invoice. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceNumber]);

  const milestones = invoice?.milestones || [];
  const nextUnpaid = milestones.findIndex((m) => !m.paid);
  const index = requested !== null && Number.isInteger(Number(requested)) ? Number(requested) : nextUnpaid;
  const step = milestones[index];
  const allPaid = milestones.length > 0 && nextUnpaid === -1;
  const outOfOrder = step && !step.paid && index !== nextUnpaid;

  const showBankDetails = async () => {
    if (!invoice || !step) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/paystack/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: invoice.invoice_number,
          amount: step.amount,
          email: invoice.email || 'client@example.com',
          name: invoice.client_name,
          type: `INDEX-${index}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.manual_transfer) {
        setModal({ isOpen: true, reference: data.tx_ref, amount: data.amount, bankDetails: data.bankDetails });
      } else if (res.ok && data.paid_via_wallet) {
        window.location.reload();
        return;
      } else {
        setError(data.error || 'Could not start the payment.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      <header className="max-w-5xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center">
        <Link href="/" className="font-bold tracking-tight">ResearchWriter</Link>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          {loading ? (
            <p className="text-secondary text-sm">Loading…</p>
          ) : !invoice ? (
            <>
              <h1 className="text-2xl font-bold">Invoice not found</h1>
              <p className="text-secondary text-sm mt-2">{error}</p>
            </>
          ) : allPaid ? (
            <>
              <h1 className="text-2xl font-bold">Fully paid</h1>
              <p className="text-secondary text-sm mt-2">Invoice {invoice.invoice_number} has been paid in full. Thank you.</p>
              <Link href={`/invoice/${invoice.invoice_number}`} className="text-accent hover:underline text-sm mt-5 inline-block">View receipt →</Link>
            </>
          ) : !step ? (
            <>
              <h1 className="text-2xl font-bold">Payment step not found</h1>
              <Link href={`/invoice/${invoice.invoice_number}`} className="text-accent hover:underline text-sm mt-3 inline-block">Open the invoice →</Link>
            </>
          ) : step.paid ? (
            <>
              <h1 className="text-2xl font-bold">Already paid</h1>
              <p className="text-secondary text-sm mt-2">&ldquo;{step.name}&rdquo; on invoice {invoice.invoice_number} has been paid.</p>
              <Link href={`/invoice/${invoice.invoice_number}`} className="text-accent hover:underline text-sm mt-5 inline-block">View the invoice →</Link>
            </>
          ) : (
            <>
              <p className="text-xs text-secondary">Invoice {invoice.invoice_number}</p>
              <h1 className="text-2xl font-bold tracking-tight mt-1">Pay {naira(step.amount)}</h1>
              <p className="text-secondary text-sm mt-2">
                {step.name}{invoice.project_title ? ` · ${invoice.project_title}` : ''}
              </p>

              <div className="border border-theme rounded-lg bg-card p-5 mt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Billed to</span>
                  <span className="font-medium">{invoice.client_name}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-secondary">Invoice total</span>
                  <span className="font-medium">{naira(invoice.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-theme">
                  <span className="text-secondary">Paying now</span>
                  <span className="font-semibold">{naira(step.amount)}</span>
                </div>

                {outOfOrder ? (
                  <p className="text-sm text-secondary mt-5">
                    Earlier steps on this invoice need to be paid first.{' '}
                    <Link href={`/pay/${invoice.invoice_number}`} className="text-accent hover:underline">Pay the next step →</Link>
                  </p>
                ) : (
                  <Button size="lg" fullWidth className="mt-5" loading={busy} loadingText="Please wait…" onClick={showBankDetails}>
                    Show bank details
                  </Button>
                )}
                {error && <p className="text-sm text-danger mt-3" role="alert">{error}</p>}
                <p className="text-xs text-secondary mt-4">
                  You will get our account number and a payment reference. Send the transfer, then tell us it is done and we will confirm it.
                </p>
              </div>

              <p className="text-sm text-secondary mt-5">
                <Link href={`/invoice/${invoice.invoice_number}`} className="text-accent hover:underline">Open the full invoice</Link>
              </p>
            </>
          )}
        </div>
      </main>

      {modal.isOpen && modal.bankDetails && invoice && (
        <ManualPaymentModal
          isOpen
          onClose={() => setModal((p) => ({ ...p, isOpen: false }))}
          reference={modal.reference}
          amount={modal.amount}
          bankDetails={modal.bankDetails}
          orderId={invoice.invoice_number}
          invoiceId={invoice.invoice_number}
          milestoneIndex={index}
          paymentType="CUSTOM_INVOICE"
          title={`Payment for invoice ${invoice.invoice_number}`}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
