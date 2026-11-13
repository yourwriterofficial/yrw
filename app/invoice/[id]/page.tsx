'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ManualPaymentModal from '@/app/components/ManualPaymentModal';
import PaymentQR from '@/app/components/PaymentQR';

interface Milestone {
  name: string;
  percentage: number;
  amount: number;
  paid: boolean;
  delivered: boolean;
  paid_at: string | null;
  tx_ref: string | null;
  trigger: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  email: string;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  project_title?: string | null;
  project_description?: string | null;
  deliverables: { category: string; items: string[] }[];
  additional_services: string[];
  timeline: { phase: string; weeks: string; deliverables: string }[];
  exclusions: string[];
  terms: string[];
  payment_details?: { bank_name?: string; account_name?: string; account_number?: string } | null;
  total_amount: number;
  milestones: Milestone[];
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
  created_at: string;
}

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const dateOf = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function looksLikeSoftware(inv: Invoice | null, brandParam: string | null) {
  if (brandParam === 'developa') return true;
  if (!inv) return false;
  const t = `${inv.project_title || ''} ${inv.company_name || ''}`.toLowerCase();
  return inv.invoice_number?.startsWith('DEV') || /software|script|developa|full stack|mobile app|\bapi\b/.test(t) || (inv.timeline?.length ?? 0) > 0;
}

export default function InvoicePage() {
  const { id: invoiceNumber } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contactEmail, setContactEmail] = useState('yourwriterofficial@gmail.com');
  const [origin, setOrigin] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [manualModal, setManualModal] = useState<{ isOpen: boolean; reference: string; amount: number; bankDetails: any; milestoneIndex?: number }>({
    isOpen: false, reference: '', amount: 0, bankDetails: null,
  });

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!invoiceNumber) return;
    (async () => {
      try {
        supabase.from('invoice_defaults').select('contact_email').eq('id', 1).maybeSingle()
          .then(({ data }) => { if (data?.contact_email) setContactEmail(data.contact_email); });
        const res = await fetch(`/api/invoice/${encodeURIComponent(invoiceNumber)}`);
        const json = await res.json();
        if (!res.ok || !json.invoice) setError('Invoice not found.');
        else setInvoice(json.invoice);
      } catch {
        setError('We could not load this invoice.');
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceNumber]);

  const payByTransfer = async (m: Milestone, index: number) => {
    setBusy(`bank-${index}`);
    setError('');
    try {
      const res = await fetch('/api/paystack/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: invoice!.invoice_number, amount: m.amount, email: invoice!.email, name: invoice!.client_name, type: `INDEX-${index}` }),
      });
      const data = await res.json();
      if (res.ok && data.manual_transfer) {
        setManualModal({ isOpen: true, reference: data.tx_ref, amount: data.amount, bankDetails: data.bankDetails, milestoneIndex: index });
      } else if (res.ok && data.paid_via_wallet) {
        window.location.reload();
        return;
      } else {
        setError(data.error || 'Could not start the payment.');
      }
    } catch {
      setError('Could not reach the payment service.');
    }
    setBusy(null);
  };

  const copyLink = async (link: string) => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center text-secondary text-sm">Loading invoice…</div>;

  if (!invoice) {
    return (
      <div className="min-h-screen bg-primary text-primary flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-2xl font-bold">Invoice not found</h1>
        <p className="text-secondary text-sm mt-2 max-w-sm">The link may be wrong, or the invoice was removed.</p>
        <button onClick={() => router.push('/')} className="mt-5 text-accent font-semibold hover:underline text-sm">Go to the home page</button>
      </div>
    );
  }

  const software = looksLikeSoftware(invoice, searchParams?.get('brand') ?? null);
  const brand = software ? 'developa.me' : 'ResearchWriter';
  const milestones = invoice.milestones || [];
  const allPaid = invoice.status === 'PAID' || (milestones.length > 0 && milestones.every((m) => m.paid));
  const nextUnpaid = milestones.findIndex((m) => !m.paid);
  const paidTotal = milestones.filter((m) => m.paid).reduce((s, m) => s + Number(m.amount), 0);
  const balance = Math.max(0, Number(invoice.total_amount) - paidTotal);
  const bank = invoice.payment_details;
  const linkFor = (i: number) => `${origin}/pay/${encodeURIComponent(invoice.invoice_number)}?m=${i}`;

  const h = 'text-[11px] font-semibold uppercase tracking-wider text-neutral-500';

  return (
    <div className="min-h-screen bg-primary py-8 px-4 print:bg-white print:p-0">
      {/* Toolbar: screen only */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <button onClick={() => window.history.back()} className="text-sm text-secondary hover:text-primary">← Back</button>
        <button onClick={() => window.print()} className="text-sm font-semibold rounded-lg border border-theme bg-card px-4 py-2 hover:border-strong">
          Print or save as PDF
        </button>
      </div>

      {/* The paper */}
      <article className="max-w-3xl mx-auto bg-white text-neutral-900 rounded-lg border border-theme shadow-sm print:border-0 print:shadow-none print:rounded-none p-6 sm:p-10 print:p-0">
        <header className="flex flex-col sm:flex-row sm:justify-between gap-4 pb-6 border-b border-neutral-200">
          <div>
            <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>{brand}</p>
            <p className="text-xs text-neutral-500 mt-1">{contactEmail} · Nigeria</p>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-bold tracking-tight">{allPaid ? 'Receipt' : 'Invoice'}</p>
            <p className="text-sm text-neutral-600 mt-1 font-mono">{invoice.invoice_number}</p>
            <p className="text-xs text-neutral-500">Issued {dateOf(invoice.created_at)}</p>
          </div>
        </header>

        <section className="grid sm:grid-cols-2 gap-6 py-6 border-b border-neutral-200">
          <div>
            <p className={h}>Billed to</p>
            <p className="font-semibold mt-1">{invoice.client_name}</p>
            {invoice.company_name && <p className="text-sm text-neutral-600">{invoice.company_name}</p>}
            <p className="text-sm text-neutral-600">{invoice.email}</p>
            {invoice.phone && <p className="text-sm text-neutral-600">{invoice.phone}</p>}
            {invoice.address && <p className="text-sm text-neutral-600">{invoice.address}</p>}
          </div>
          <div className="sm:text-right">
            <p className={h}>Project</p>
            <p className="font-semibold mt-1">{invoice.project_title || 'Project'}</p>
            <p className={`${h} mt-4`}>Status</p>
            <p className="font-semibold mt-1">
              {allPaid ? 'Paid in full' : invoice.status === 'PARTIALLY_PAID' ? 'Part paid' : 'Awaiting payment'}
            </p>
          </div>
        </section>

        {invoice.project_description && (
          <section className="py-6 border-b border-neutral-200">
            <p className={h}>Description</p>
            <p className="text-sm mt-2 whitespace-pre-line text-neutral-700">{invoice.project_description}</p>
          </section>
        )}

        {invoice.deliverables?.length > 0 && (
          <section className="py-6 border-b border-neutral-200">
            <p className={h}>What is included</p>
            <div className="mt-3 space-y-4">
              {invoice.deliverables.map((cat, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold">{cat.category}</p>
                  <ul className="mt-1 text-sm text-neutral-700 list-disc pl-5 space-y-0.5">
                    {(cat.items || []).map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {invoice.additional_services?.length > 0 && (
          <section className="py-6 border-b border-neutral-200">
            <p className={h}>Also included</p>
            <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-0.5">
              {invoice.additional_services.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>
        )}

        {invoice.timeline?.length > 0 && (
          <section className="py-6 border-b border-neutral-200">
            <p className={h}>Schedule</p>
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-neutral-500 text-xs">
                  <th className="py-1.5 pr-3 font-medium">When</th>
                  <th className="py-1.5 pr-3 font-medium">Phase</th>
                  <th className="py-1.5 font-medium">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {invoice.timeline.map((t, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 whitespace-nowrap">{t.weeks}</td>
                    <td className="py-2 pr-3 font-medium">{t.phase}</td>
                    <td className="py-2 text-neutral-600">{t.deliverables}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Payment schedule */}
        <section className="py-6 border-b border-neutral-200">
          <p className={h}>Payments</p>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mt-3 print:hidden" role="alert">{error}</p>}

          <div className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
            {milestones.map((m, i) => {
              const isNext = !allPaid && i === nextUnpaid;
              return (
                <div key={i} className="py-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm">{i + 1}. {m.name} <span className="text-neutral-500 font-normal">({m.percentage}%)</span></p>
                      {m.trigger && <p className="text-xs text-neutral-500 mt-0.5">Due: {m.trigger}</p>}
                      {m.paid && m.paid_at && <p className="text-xs text-neutral-500 mt-0.5">Paid on {dateOf(m.paid_at)}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{naira(m.amount)}</p>
                      <p className={`text-xs mt-0.5 ${m.paid ? 'text-green-700 font-semibold' : 'text-neutral-500'}`}>{m.paid ? 'Paid' : isNext ? 'Due now' : 'Later'}</p>
                    </div>
                  </div>

                  {/* Payment link: on screen and on the printed copy */}
                  {!m.paid && origin && (
                    <div className="mt-3 flex gap-4 items-center rounded-md bg-neutral-50 border border-neutral-200 p-3">
                      <PaymentQR value={linkFor(i)} size={84} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">Pay this step</p>
                        <p className="text-xs text-neutral-600 mt-0.5">Scan the code or open the link to see the bank details and reference.</p>
                        <p className="text-xs font-mono break-all mt-1.5" style={{ color: 'var(--accent)' }}>{linkFor(i)}</p>
                        {isNext && (
                          <div className="flex flex-wrap gap-2 mt-2.5 print:hidden">
                            <button
                              onClick={() => payByTransfer(m, i)}
                              disabled={busy !== null}
                              className="text-sm font-semibold rounded-md px-4 py-2 text-white disabled:opacity-60"
                              style={{ background: 'var(--accent)' }}
                            >
                              {busy === `bank-${i}` ? 'Please wait…' : 'Pay by bank transfer'}
                            </button>
                            <button onClick={() => copyLink(linkFor(i))} className="text-sm text-neutral-600 hover:text-neutral-900 px-2">
                              {copied ? 'Copied' : 'Copy link'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 ml-auto max-w-xs text-sm space-y-1">
            <div className="flex justify-between"><span className="text-neutral-600">Total</span><span className="font-semibold">{naira(invoice.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-600">Paid</span><span>{naira(paidTotal)}</span></div>
            <div className="flex justify-between border-t border-neutral-200 pt-1"><span className="font-semibold">Balance</span><span className="font-bold">{naira(balance)}</span></div>
          </div>
        </section>

        {!allPaid && bank?.account_number && (
          <section className="py-6 border-b border-neutral-200">
            <p className={h}>Bank transfer</p>
            <p className="text-sm mt-2">
              {bank.bank_name} · {bank.account_name} · <span className="font-mono font-semibold">{bank.account_number}</span>
            </p>
            <p className="text-xs text-neutral-500 mt-1">Use <span className="font-mono">{invoice.invoice_number}</span> as the payment reference, then send us the receipt.</p>
          </section>
        )}

        {invoice.exclusions?.length > 0 && (
          <section className="py-6 border-b border-neutral-200">
            <p className={h}>Not included</p>
            <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-0.5">
              {invoice.exclusions.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </section>
        )}

        {invoice.terms?.length > 0 && (
          <section className="pt-6">
            <p className={h}>Terms</p>
            <ol className="mt-2 text-xs text-neutral-600 list-decimal pl-5 space-y-1">
              {invoice.terms.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </section>
        )}
      </article>

      {manualModal.isOpen && manualModal.bankDetails && (
        <ManualPaymentModal
          isOpen
          onClose={() => setManualModal((p) => ({ ...p, isOpen: false }))}
          reference={manualModal.reference}
          amount={manualModal.amount}
          bankDetails={manualModal.bankDetails}
          orderId={invoice.invoice_number}
          invoiceId={invoice.invoice_number}
          milestoneIndex={manualModal.milestoneIndex}
          paymentType="CUSTOM_INVOICE"
          title={`Payment for invoice ${invoice.invoice_number}`}
          onSuccess={() => alert('Transfer proof submitted. We will update this invoice once it is confirmed.')}
        />
      )}
    </div>
  );
}
