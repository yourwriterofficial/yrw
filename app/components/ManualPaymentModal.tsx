'use client';

import React, { useState } from 'react';
import * as lucide from 'lucide-react';
import { BankDetails } from '@/lib/bankDetails';
import { showToast } from '@/app/components/ui/Toast';

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: string;
  amount: number;
  bankDetails: BankDetails;
  orderId?: string | null;
  invoiceId?: string | null;
  milestoneIndex?: number | null;
  paymentType?: 'ORDER_DEPOSIT' | 'ORDER_MILESTONE' | 'CUSTOM_INVOICE' | 'WALLET_TOPUP' | 'DEV_PRODUCT';
  title?: string;
  onSuccess?: () => void;
}

export default function ManualPaymentModal({
  isOpen,
  onClose,
  reference,
  amount,
  bankDetails,
  orderId,
  invoiceId,
  milestoneIndex,
  paymentType = 'ORDER_DEPOSIT',
  title = 'Direct Bank Transfer',
  onSuccess,
}: ManualPaymentModalProps) {
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'acc' | 'ref') => {
    navigator.clipboard.writeText(text);
    if (type === 'acc') {
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
      showToast('Account number copied!', 'success');
    } else {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
      showToast('Payment reference copied!', 'success');
    }
  };

  const formattedAmount = `₦${Math.round(amount).toLocaleString('en-NG')}`;

  const getWhatsAppMessage = () => {
    const lines = [
      `*PAYMENT CONFIRMATION NOTIFICATION*`,
      `Reference: ${reference}`,
      orderId ? `Order ID: #${orderId}` : '',
      invoiceId ? `Invoice: #${invoiceId}` : '',
      `Amount Transferred: ${formattedAmount}`,
      `Bank: ${bankDetails.bank_name}`,
      `Account: ${bankDetails.account_number} (${bankDetails.account_name})`,
      senderName ? `Sender Name: ${senderName}` : '',
      `\nHello Support, I have just completed the bank transfer. Please verify and activate my account/order.`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(getWhatsAppMessage());
    window.open(`https://wa.me/2348121443666?text=${text}`, '_blank');
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/manual-payment/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          orderId,
          invoiceId,
          milestoneIndex,
          paymentType,
          amount,
          senderName: senderName.trim(),
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        showToast('Payment details recorded. Please notify us on WhatsApp for fastest activation.', 'success');
        if (onSuccess) onSuccess();
      } else {
        showToast(data.error || 'Failed to record payment.', 'error');
      }
    } catch {
      showToast('Network error submitting payment proof.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card border border-theme rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <lucide.Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-primary">{title}</h2>
              <p className="text-xs text-secondary">Pay securely via your mobile banking app</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-hover rounded-xl transition"
            aria-label="Close"
          >
            <lucide.X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="my-5 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">Exact Amount to Pay</span>
            <p className="text-2xl sm:text-3xl font-black text-primary mt-0.5">{formattedAmount}</p>
          </div>
          <span className="text-xs font-bold text-secondary bg-secondary/40 px-3 py-1.5 rounded-lg border border-theme">
            0% Gateway Fee
          </span>
        </div>

        {/* Bank Account Details Card */}
        <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-theme">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary font-medium">Bank Name</span>
            <span className="text-sm font-bold text-primary">{bankDetails.bank_name}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-theme/60">
            <span className="text-xs text-secondary font-medium">Account Name</span>
            <span className="text-sm font-bold text-primary text-right">{bankDetails.account_name}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-theme/60">
            <div>
              <span className="text-xs text-secondary font-medium block">Account Number</span>
              <span className="text-lg font-black tracking-wider text-primary">{bankDetails.account_number}</span>
            </div>
            <button
              onClick={() => copyToClipboard(bankDetails.account_number, 'acc')}
              type="button"
              className="px-3 py-1.5 bg-primary border border-theme hover:border-emerald-500/50 text-xs font-bold text-primary rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedAcc ? (
                <>
                  <lucide.Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <lucide.Copy className="w-3.5 h-3.5 text-secondary" /> Copy
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-theme/60">
            <div>
              <span className="text-xs text-secondary font-medium block">Transfer Reference (Narration)</span>
              <span className="text-xs font-mono font-bold text-purple-400 break-all">{reference}</span>
            </div>
            <button
              onClick={() => copyToClipboard(reference, 'ref')}
              type="button"
              className="px-3 py-1.5 bg-primary border border-theme hover:border-purple-500/50 text-xs font-bold text-primary rounded-lg transition flex items-center gap-1.5 cursor-pointer shrink-0 ml-2"
            >
              {copiedRef ? (
                <>
                  <lucide.Check className="w-3.5 h-3.5 text-purple-400" /> Copied
                </>
              ) : (
                <>
                  <lucide.Copy className="w-3.5 h-3.5 text-secondary" /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-secondary mt-3 leading-relaxed">
          <lucide.Info className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
          Please paste the reference code above in your bank transfer remark/narration so your payment can be matched immediately.
        </p>

        {/* Submission / Confirmation Form */}
        {!submitted ? (
          <form onSubmit={handleSubmitProof} className="mt-5 space-y-4 pt-4 border-t border-theme">
            <div>
              <label className="block text-xs font-bold text-primary mb-1.5">
                Your Sender Name / Bank (Optional, helps match fast)
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. John Okon - GTBank"
                className="w-full bg-secondary border border-theme rounded-xl px-4 py-2.5 text-sm text-primary placeholder:text-secondary/50 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <lucide.CheckCircle className="w-4 h-4" /> I Have Transferred
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="py-3 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-black text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#25D366]/10"
              >
                <lucide.Send className="w-4 h-4" /> Notify on WhatsApp
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <lucide.CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-black text-primary">Transfer Submission Received!</h3>
            <p className="text-xs text-secondary max-w-sm mx-auto">
              Our operations lead will verify the bank alert and activate your order shortly. Click below to speed up confirmation via WhatsApp.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-black text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <lucide.Send className="w-4 h-4" /> Open WhatsApp Confirmation
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-secondary hover:bg-hover border border-theme text-xs font-bold text-primary rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
