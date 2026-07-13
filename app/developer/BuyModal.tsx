'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BuyProduct = { id: number; title: string; category: string; price: number };

export default function BuyModal({ product, onClose, onPurchased }: { product: BuyProduct; onClose: () => void; onPurchased?: () => void }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

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
        <h3 className="text-lg sm:text-xl font-black mb-1 pr-8">{product.title}</h3>
        <p className="text-xs text-secondary mb-6">{product.category}</p>

        {isLoggedIn === false && (
          <div className="mb-4 space-y-1">
            <label className="text-[10px] uppercase font-black text-secondary ml-1 block">Email Address</label>
            <input
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-secondary border border-theme p-3.5 rounded-xl text-sm text-primary focus:border-cyan-500 outline-none font-bold"
            />
            <p className="text-[9px] text-secondary ml-1">We'll set up a dashboard account for you — your scripts library lives there.</p>
          </div>
        )}

        {msg && <p className="text-xs font-bold text-amber-500 mb-4">{msg}</p>}

        <div className="bg-cyan-500/10 p-5 rounded-2xl border border-cyan-500/20 text-center mb-6">
          <div className="text-3xl font-black text-cyan-400">{naira(product.price)}</div>
          <p className="text-[9px] uppercase font-black text-secondary mt-1 tracking-widest">One-time purchase</p>
        </div>

        <button
          onClick={purchase}
          disabled={busy}
          className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black uppercase text-xs tracking-widest py-4 rounded-2xl transition disabled:opacity-50"
        >
          {busy ? 'Processing...' : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}
