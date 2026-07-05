'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';

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

interface TimelineItem {
  phase: string;
  weeks: string;
  deliverables: string;
}

interface DeliverableCategory {
  category: string;
  items: string[];
}

interface CustomInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  email: string;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  deliverables: DeliverableCategory[];
  additional_services: string[];
  timeline: TimelineItem[];
  exclusions: string[];
  terms: string[];
  payment_structure_type: string;
  total_amount: number;
  milestones: Milestone[];
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
  created_at: string;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceNumber = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<CustomInvoice | null>(null);
  const [contactEmail, setContactEmail] = useState('yourwriterofficial@gmail.com');
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!invoiceNumber) return;
    const fetchInvoice = async () => {
      try {
        supabase.from('invoice_defaults').select('contact_email').eq('id', 1).maybeSingle()
          .then(({ data: d }) => { if (d?.contact_email) setContactEmail(d.contact_email); });

        const { data, error } = await supabase
          .from('custom_invoices')
          .select('*')
          .eq('invoice_number', invoiceNumber)
          .single();

        if (error || !data) {
          setErrorMsg('Invoice or Receipt not found.');
        } else {
          setInvoice(data);
        }
      } catch (err: any) {
        setErrorMsg('Error loading invoice details.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceNumber]);

  const handlePayMilestone = async (milestone: Milestone, index: number) => {
    if (!invoice) return;
    setProcessingIndex(index);
    setErrorMsg('');
    try {
      const response = await fetch('/api/paystack/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: invoice.invoice_number,
          amount: milestone.amount,
          email: invoice.email,
          name: invoice.client_name,
          type: `INDEX-${index}`
        })
      });

      const data = await response.json();
      if (response.ok && data.link) {
        window.location.href = data.link;
      } else {
        setErrorMsg(data.error || 'Failed to initialize payment.');
      }
    } catch (err: any) {
      setErrorMsg('Failed to connect to payment gateway.');
    } finally {
      setProcessingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-primary">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-secondary uppercase tracking-widest">Loading invoice details...</p>
      </div>
    );
  }

  if (errorMsg && !invoice) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6">
          <lucide.AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-primary tracking-tight mb-2">Invoice Not Found</h2>
        <p className="text-secondary text-sm max-w-sm mb-6">The link might be broken or the invoice has been removed.</p>
        <button onClick={() => router.push('/')} className="px-6 py-2.5 bg-secondary border border-theme text-primary font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-white/5 transition">
          Go to Home
        </button>
      </div>
    );
  }

  if (!invoice) return null;

  const milestones = invoice.milestones || [];
  const allPaid = invoice.status === 'PAID' || milestones.every(m => m.paid);
  const nextUnpaidIdx = milestones.findIndex(m => !m.paid);

  return (
    <div className="min-h-screen bg-primary text-primary py-12 px-4 sm:px-6 lg:px-8 print:bg-white print:text-black print:py-0 print:px-0">
      
      {/* Utility Bar (Hidden in Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={() => window.history.back()} 
          className="flex items-center gap-2 text-xs font-bold text-secondary hover:text-primary transition"
        >
          <lucide.ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <lucide.Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Invoice Container */}
      <div className="max-w-4xl mx-auto bg-card border border-theme rounded-[32px] overflow-hidden shadow-2xl print:border-none print:shadow-none print:rounded-none">
        
        {/* Header Ribbon */}
        <div className={`p-8 sm:p-12 border-b border-theme flex flex-col md:flex-row justify-between gap-6 relative ${
          allPaid ? 'bg-gradient-to-r from-emerald-600/10 via-emerald-600/5 to-transparent border-emerald-500/20' : 'bg-gradient-to-r from-purple-600/10 via-purple-600/5 to-transparent'
        }`}>
          
          <div>
            <div className="flex items-center gap-4 mb-3">
              <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                allPaid 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}>
                {allPaid ? 'Official Receipt' : 'Service Agreement & Invoice'}
              </span>
              <span className="text-secondary text-xs font-bold font-mono">
                {invoice.invoice_number}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary tracking-tight mb-2">
              {allPaid ? 'Payment Receipt' : 'Project Proposal & Invoice'}
            </h1>
            <p className="text-secondary text-sm">
              Issued on {new Date(invoice.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-col md:items-end justify-between text-left md:text-right">
            <div>
              <p className="text-xs uppercase font-black tracking-widest text-secondary mb-1">Total Project Budget</p>
              <p className={`text-4xl font-black ${allPaid ? 'text-emerald-500' : 'text-purple-500'}`}>
                ₦{invoice.total_amount.toLocaleString()}
              </p>
            </div>
            {allPaid && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider">
                <lucide.ShieldCheck className="w-4 h-4 animate-pulse" /> Fully Paid & Confirmed
              </div>
            )}
          </div>

          {/* Large stamp background for print */}
          {allPaid && (
            <div className="absolute top-1/2 right-12 -translate-y-1/2 opacity-[0.03] pointer-events-none print:opacity-[0.08] select-none text-emerald-500 font-black text-9xl tracking-tighter uppercase rotate-12">
              Paid
            </div>
          )}
        </div>

        <div className="p-8 sm:p-12 space-y-10">

          {/* Error Message Box */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
              <lucide.AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Client & Contractor Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-theme pb-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-secondary tracking-widest">Client / Bill To</h3>
              <div className="space-y-2 text-sm">
                <p className="font-black text-primary text-base">{invoice.client_name}</p>
                {invoice.company_name && (
                  <p className="text-secondary font-bold flex items-center gap-2">
                    <lucide.Building className="w-4 h-4 text-secondary shrink-0" /> {invoice.company_name}
                  </p>
                )}
                <p className="text-secondary font-medium flex items-center gap-2">
                  <lucide.Mail className="w-4 h-4 text-secondary shrink-0" /> {invoice.email}
                </p>
                {invoice.phone && (
                  <p className="text-secondary font-medium flex items-center gap-2">
                    <lucide.Phone className="w-4 h-4 text-secondary shrink-0" /> {invoice.phone}
                  </p>
                )}
                {invoice.address && (
                  <p className="text-secondary font-medium flex items-center gap-2">
                    <lucide.MapPin className="w-4 h-4 text-secondary shrink-0" /> {invoice.address}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 md:border-l md:border-theme md:pl-8">
              <h3 className="text-xs font-black uppercase text-secondary tracking-widest">Contractor / Issuer</h3>
              <div className="space-y-2 text-sm">
                <p className="font-black text-primary text-base">YourResearchWriter</p>
                <p className="text-secondary font-medium flex items-center gap-2">
                  <lucide.Building className="w-4 h-4 text-secondary shrink-0" /> Tech & Writing Services
                </p>
                <p className="text-secondary font-medium flex items-center gap-2">
                  <lucide.Mail className="w-4 h-4 text-secondary shrink-0" /> {contactEmail}
                </p>
                <p className="text-secondary font-medium flex items-center gap-2">
                  <lucide.MapPin className="w-4 h-4 text-secondary shrink-0" /> Nigeria
                </p>
              </div>
            </div>
          </div>

          {/* Scope of Deliverables */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-secondary tracking-widest flex items-center gap-2">
              <lucide.FileText className="w-4 h-4 text-purple-400" /> Scope of Work & Deliverables
            </h3>
            <div className="bg-secondary/40 border border-theme rounded-2xl p-6 space-y-5">
              {invoice.deliverables && invoice.deliverables.length > 0 ? invoice.deliverables.map((cat, catIdx) => (
                <div key={catIdx}>
                  <p className="text-xs font-black uppercase tracking-wider text-purple-400 mb-2">{cat.category}</p>
                  <ul className="space-y-2 ml-1">
                    {(cat.items || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-primary font-bold">
                        <lucide.Check className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )) : (
                <p className="text-secondary text-sm">Standard system design & academic analysis deliverables.</p>
              )}
            </div>
          </div>

          {/* Additional Services Included */}
          {invoice.additional_services && invoice.additional_services.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-secondary tracking-widest flex items-center gap-2">
                <lucide.PlusCircle className="w-4 h-4 text-emerald-400" /> Additional Services Included
              </h3>
              <div className="bg-secondary/20 border border-theme rounded-2xl p-6">
                <ul className="space-y-2">
                  {invoice.additional_services.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-secondary font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0"></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Sprints Timeline (If development type) */}
          {invoice.timeline && invoice.timeline.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-secondary tracking-widest flex items-center gap-2">
                <lucide.Activity className="w-4 h-4 text-purple-400" /> Sprints & Delivery Schedule
              </h3>
              <div className="border border-theme rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-secondary border-b border-theme text-secondary font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Week(s)</th>
                      <th className="p-4">Phase / Sprint</th>
                      <th className="p-4">Key Scope / Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme text-primary font-bold">
                    {invoice.timeline.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-purple-400">{item.weeks}</td>
                        <td className="p-4 text-primary">{item.phase}</td>
                        <td className="p-4 text-secondary font-medium">{item.deliverables}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exclusions */}
          {invoice.exclusions && invoice.exclusions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-secondary tracking-widest flex items-center gap-2">
                <lucide.AlertCircle className="w-4 h-4 text-amber-400" /> Exclusions / Out of Scope
              </h3>
              <div className="bg-secondary/20 border border-theme rounded-2xl p-6">
                <ul className="space-y-2">
                  {invoice.exclusions.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-secondary font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Payment Milestones (interactive for guest) */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-secondary tracking-widest flex items-center gap-2">
              <lucide.CreditCard className="w-4 h-4 text-purple-400" /> Payment Schedule & Milestones
            </h3>
            <div className="space-y-3">
              {milestones.map((m, idx) => {
                const isNextUnpaid = idx === nextUnpaidIdx;
                return (
                  <div 
                    key={idx} 
                    className={`border rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 ${
                      m.paid 
                        ? 'bg-emerald-500/[0.02] border-emerald-500/20' 
                        : isNextUnpaid
                          ? 'bg-purple-500/[0.02] border-purple-500/30 shadow-lg shadow-purple-500/5'
                          : 'bg-secondary/10 border-theme'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          m.paid
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-secondary text-secondary'
                        }`}>
                          Milestone {idx + 1} ({m.percentage}%)
                        </span>
                        <p className="font-black text-primary text-sm sm:text-base">{m.name}</p>
                      </div>
                      <p className="text-xs text-secondary font-medium">Trigger: {m.trigger}</p>
                      {m.paid_at && (
                        <p className="text-[10px] text-emerald-500 font-bold">
                          ✓ Paid via card reference on {new Date(m.paid_at).toLocaleDateString()} at {new Date(m.paid_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center w-full sm:w-auto gap-4">
                      <div className="text-right">
                        <p className="text-xs text-secondary font-bold">Amount</p>
                        <p className="text-lg font-black text-primary">₦{m.amount.toLocaleString()}</p>
                      </div>

                      {!allPaid && isNextUnpaid && (
                        <button
                          onClick={() => handlePayMilestone(m, idx)}
                          disabled={processingIndex !== null}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/10 disabled:opacity-50 flex items-center gap-2 cursor-pointer print:hidden"
                        >
                          {processingIndex === idx ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                              Connecting...
                            </>
                          ) : (
                            <>
                              <lucide.CreditCard className="w-4 h-4" /> Pay Milestone
                            </>
                          )}
                        </button>
                      )}

                      {!m.paid && !isNextUnpaid && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary bg-secondary border border-theme px-3 py-1.5 rounded-lg cursor-not-allowed select-none">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terms & Conditions */}
          {invoice.terms && invoice.terms.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-theme">
              <h3 className="text-xs font-black uppercase text-secondary tracking-widest">Agreement Terms & Conditions</h3>
              <ol className="text-secondary text-xs leading-relaxed bg-secondary/10 p-5 rounded-2xl border border-theme font-medium space-y-2 list-decimal list-inside">
                {invoice.terms.map((term, idx) => (
                  <li key={idx}>{term}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Signatures & Execution Section */}
          <div className="pt-8 border-t border-theme grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-theme rounded-2xl p-6 bg-secondary/10 text-center relative overflow-hidden">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-8">Client Acceptance</h4>
              {allPaid ? (
                <div className="space-y-2">
                  <p className="text-emerald-400 font-black text-lg tracking-tight font-serif italic">Digitally Signed & Accepted</p>
                  <p className="text-[10px] text-secondary font-bold">Client Email: {invoice.email}</p>
                  <p className="text-[9px] text-secondary uppercase font-mono">Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="py-4 text-xs text-secondary font-bold">
                  Awaiting sign-off via initial deposit payment
                </div>
              )}
            </div>

            <div className="border border-theme rounded-2xl p-6 bg-secondary/10 text-center relative overflow-hidden">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-8">YourWriter Management</h4>
              {allPaid ? (
                <div className="space-y-2">
                  <p className="text-emerald-400 font-black text-lg tracking-tight font-serif italic">Verified & Execution Released</p>
                  <p className="text-[10px] text-secondary font-bold">Signee: Lead Architect</p>
                  <p className="text-[9px] text-secondary uppercase font-mono">Status: COMPLETED / RECEIPT GENERATED</p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <p className="text-purple-400 font-bold text-xs">Awaiting Initial Deposit</p>
                  <p className="text-[10px] text-secondary">Bank Preset: YourWriter Dev & Consulting</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
