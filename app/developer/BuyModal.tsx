'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';
import ManualPaymentModal from '@/app/components/ManualPaymentModal';
import { BankDetails } from '@/lib/bankDetails';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BuyProduct = { id: number; title: string; category: string; price: number };

export default function BuyModal({ product, onClose, onPurchased }: { product: BuyProduct; onClose: () => void; onPurchased?: () => void }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [manualModal, setManualModal] = useState<{
    isOpen: boolean;
    reference: string;
    amount: number;
    bankDetails: BankDetails | null;
  }>({
    isOpen: false,
    reference: '',
    amount: 0,
    bankDetails: null,
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    })();
  }, []);

  const purchase = async () => {
    if (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim())) {
      setMsg('Please enter a valid email — your download access goes there.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/dev-shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          email: isLoggedIn === false ? guestEmail.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not start checkout.');
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else if (data.paid_via_wallet) {
        setMsg('Purchased! Find it under "My Scripts" in your dashboard.');
        onPurchased?.();
      } else if (data.manual_transfer && data.bankDetails) {
        setManualModal({
          isOpen: true,
          reference: data.tx_ref,
          amount: data.amount || product.price,
          bankDetails: data.bankDetails,
        });
      }
    } catch {
      setMsg('Network error. Please try again.');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-panel-strong rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 max-w-md w-full shadow-2xl pb-safe max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-full flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg sm:text-xl font-semibold mb-1 pr-8">{product.title}</h3>
        <p className="text-xs text-secondary mb-6">{product.category}</p>

        {isLoggedIn === false && (
          <div className="mb-4 space-y-1">
            <label className="text-[11px] font-semibold text-secondary ml-1 block">Email Address</label>
            <input
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-secondary border border-theme p-3.5 rounded-xl text-sm text-primary focus:border-accent outline-none font-bold"
            />
            <p className="text-[11px] text-secondary ml-1">We'll set up a dashboard account for you — your scripts library lives there.</p>
          </div>
        )}

        {msg && <p className="text-xs font-bold text-amber-500 mb-4">{msg}</p>}

        <div className="bg-accent/10 p-5 rounded-2xl border border-accent/20 text-center mb-6">
          <div className="text-3xl font-semibold text-accent">{naira(product.price)}</div>
          <p className="text-[11px] font-semibold text-secondary mt-1">One-time purchase</p>
        </div>

        <button
          onClick={purchase}
          disabled={busy}
          className="w-full font-bold text-sm py-3.5 rounded-xl transition disabled:opacity-50 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)]"
        >
          {busy ? 'Processing...' : 'Buy now'}
        </button>
      </div>

      {manualModal.isOpen && manualModal.bankDetails && (
        <ManualPaymentModal
          isOpen={manualModal.isOpen}
          onClose={() => {
            setManualModal(prev => ({ ...prev, isOpen: false }));
            onClose();
          }}
          reference={manualModal.reference}
          amount={manualModal.amount}
          bankDetails={manualModal.bankDetails}
          paymentType="DEV_PRODUCT"
          title={`Developa: ${product.title}`}
          onSuccess={() => {
            setMsg('Transfer recorded! Once verified, this script will appear in your account.');
            onPurchased?.();
          }}
        />
      )}
    </div>
  );
}
