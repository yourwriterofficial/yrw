'use client';

import { useEffect, useState } from 'react';
import { PLANS, effectiveTier } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface Bank { name: string; code: string }

export default function SubaccountCard({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
  const eligible = PLANS[tier].onlinePayments;

  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [linked, setLinked] = useState<{ code: string; name: string; fee: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    jsonFetch<{
      eligible?: boolean;
      split_fee_pct?: number;
      subaccount_code?: string | null;
      bank_code?: string | null;
      account_name?: string | null;
      banks?: Bank[];
    }>(`/api/forums/${site.slug}/subaccount`).then((r) => {
      if (!r.ok) return;
      if (r.data.banks) setBanks(r.data.banks);
      if (r.data.bank_code) setBankCode(r.data.bank_code);
      if (r.data.subaccount_code && r.data.account_name) {
        setLinked({
          code: r.data.subaccount_code,
          name: r.data.account_name,
          fee: Number(r.data.split_fee_pct ?? PLANS[tier].splitFeePct),
        });
      }
    });
  }, [site.slug, tier]);

  if (!eligible) {
    return (
      <section className="g-tonal p-6 space-y-2">
        <h3 className="font-medium">Paystack split payouts (direct to your bank)</h3>
        <p className="text-sm text-secondary">Accept cards, transfers and USSD on your store and let Paystack settle earnings directly into your bank account. Included on Student/Lite and above.</p>
        <button type="button" onClick={goToPlan} className="mt-2 bg-accent text-[var(--accent-foreground)] text-xs font-medium px-5 h-9 rounded-full">
          See plans
        </button>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await jsonFetch<{ subaccount_code?: string; account_name?: string; split_fee_pct?: number }>(
      `/api/forums/${site.slug}/subaccount`,
      { method: 'POST', body: { bank_code: bankCode, account_number: accountNumber } }
    );
    setBusy(false);
    if (r.ok && r.data.subaccount_code && r.data.account_name) {
      setLinked({
        code: r.data.subaccount_code,
        name: r.data.account_name,
        fee: Number(r.data.split_fee_pct ?? PLANS[tier].splitFeePct),
      });
      setMsg({ ok: true, text: `Linked to ${r.data.account_name}. Buyers can now pay online and Paystack settles directly to you.` });
    } else {
      setMsg({ ok: false, text: r.data.error || 'Could not link bank account.' });
    }
  };

  return (
    <section className="g-card p-6 space-y-4">
      <div>
        <h3 className="font-medium">Paystack split payouts (direct to your bank)</h3>
        <p className="text-sm text-secondary mt-1">
          Buyers pay via Paystack and your share settles directly to your bank account ({PLANS[tier].splitFeePct}% platform split fee on {PLANS[tier].name}).
        </p>
      </div>

      {linked && (
        <div className="p-3 rounded-xl bg-secondary/30 text-sm">
          <p className="font-medium text-primary">Active payout account: {linked.name}</p>
          <p className="text-xs text-secondary mt-0.5">Subaccount: {linked.code} · Platform split fee: {linked.fee}%</p>
        </div>
      )}

      <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3 items-end">
        <label className="text-xs font-medium">Bank
          <select required value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="input-box w-full mt-1 text-sm">
            <option value="">Select Nigerian bank…</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium">10-digit account number
          <input required pattern="\d{10}" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" className="input-box w-full mt-1 text-sm" />
        </label>
        <button type="submit" disabled={busy || !bankCode} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-5 h-11 rounded-full disabled:opacity-50">
          {busy ? 'Verifying…' : linked ? 'Update payout bank' : 'Connect bank'}
        </button>
      </form>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </section>
  );
}
