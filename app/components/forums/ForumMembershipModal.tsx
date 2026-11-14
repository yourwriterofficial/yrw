'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { formatMoney, type ForumSummary } from '@/lib/forums';

export interface PublicMembershipTier {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
}

export interface MyMembershipStatus {
  id: string;
  tier_id: string;
  status: 'pending' | 'active' | 'expired' | 'rejected';
  expires_at: string | null;
}

export default function ForumMembershipModal({
  forum,
  tiers,
  myMembership,
  onClose,
  onJoined,
}: {
  forum: ForumSummary;
  tiers: PublicMembershipTier[];
  myMembership: MyMembershipStatus | null;
  onClose: () => void;
  onJoined: () => Promise<void>;
}) {
  const [tierId, setTierId] = useState(tiers[0]?.id || '');
  const [paymentRef, setPaymentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const selectedTier = tiers.find((t) => t.id === tierId) || tiers[0];
  const needsTransfer = Number(selectedTier?.price || 0) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    setBusy(true);
    setError('');
    setDoneMsg('');
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(forum.slug)}/memberships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_join',
          tier_id: selectedTier.id,
          payment_reference: paymentRef.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit membership request.');
        setBusy(false);
        return;
      }
      setDoneMsg(
        data.membership?.status === 'active'
          ? 'Your membership is active.'
          : 'Request submitted. Access unlocks as soon as the community owner confirms your payment.'
      );
      await onJoined();
    } catch {
      setError('Network error while submitting request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="g-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <h3 className="font-bold text-base">Community memberships</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {myMembership && (
          <div className="p-3 rounded-xl bg-secondary/30 border border-theme text-xs">
            Current status: <strong className="capitalize">{myMembership.status}</strong>
            {myMembership.expires_at && ` · Valid until ${new Date(myMembership.expires_at).toLocaleDateString('en-GB')}`}
          </div>
        )}

        <div className="space-y-2">
          {tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierId(t.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition ${
                tierId === t.id ? 'border-accent bg-accent/10' : 'border-theme bg-card'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>{t.name}</span>
                <span>{Number(t.price) > 0 ? `${formatMoney(t.price, forum.currency)} / ${t.duration_days}d` : 'Free'}</span>
              </div>
              {t.description && <p className="text-xs text-secondary mt-1">{t.description}</p>}
            </button>
          ))}
        </div>

        {needsTransfer && forum.bank_account_number && (
          <div className="p-3 rounded-xl bg-card border border-theme text-xs space-y-1">
            <p className="font-semibold">Transfer to unlock access</p>
            <p>{forum.bank_name} · <span className="font-mono">{forum.bank_account_number}</span></p>
            {forum.bank_account_name && <p className="text-secondary">{forum.bank_account_name}</p>}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 text-xs">
          {needsTransfer && (
            <div>
              <label htmlFor="mem-ref" className="block font-medium mb-1">Transfer reference or sender name</label>
              <input
                id="mem-ref"
                required
                minLength={2}
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. Sent from GTB - Ada"
                className="input-box w-full text-xs"
              />
            </div>
          )}
          {error && <p className="text-danger" role="alert">{error}</p>}
          {doneMsg && <p className="text-success" role="status">{doneMsg}</p>}
          <button
            type="submit"
            disabled={busy || !selectedTier}
            className="w-full h-11 rounded-full bg-accent text-[var(--accent-foreground)] font-medium text-sm disabled:opacity-50"
          >
            {busy ? 'Submitting…' : needsTransfer ? 'Submit payment for approval' : 'Activate membership'}
          </button>
        </form>
      </div>
    </div>
  );
}
