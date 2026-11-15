'use client';

import { useEffect, useState } from 'react';
import { PLANS, PLAN_ORDER, BILLING_PERIODS, priceForPeriod, PRUNE_NOTICE, daysLeft, effectiveTier, type PlanTier } from '@/lib/plans';
import { waLink } from '@/lib/phone';
import { FOUNDER_WA, jsonFetch, type Site } from '../types';

const naira = (n: number) => '₦' + n.toLocaleString('en-NG');

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  admin_reply: string;
  created_at: string;
}

export default function PlanTab({ site }: { site: Site }) {
  const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
  const left = daysLeft(site.plan_expires_at);
  const lapsed = site.plan_tier !== 'free' && tier === 'free';
  const hasPriority = PLANS[tier].prioritySupport;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState(site.whatsapp_number || '');
  const [busy, setBusy] = useState(false);
  const [months, setMonths] = useState(1);
  const [payBusy, setPayBusy] = useState<PlanTier | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!hasPriority) return;
    let active = true;
    jsonFetch<{ requests?: Ticket[] }>(`/api/forums/${site.slug}/support`)
      .then((r) => {
        if (active && r.ok) setTickets(r.data.requests || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [hasPriority, site.slug]);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await jsonFetch<{ request?: Ticket }>(`/api/forums/${site.slug}/support`, {
      method: 'POST',
      body: { subject, message, whatsapp_number: whatsappNumber },
    });
    if (r.ok && r.data.request) {
      setTickets((prev) => [r.data.request!, ...prev]);
      setSubject('');
      setMessage('');
      setMsg({ ok: true, text: 'Request sent. Expected reply within 4 business hours.' });
    } else {
      setMsg({ ok: false, text: r.data.error || 'Could not send request.' });
    }
    setBusy(false);
  };

  const upgrade = (to: PlanTier) =>
    waLink(FOUNDER_WA, `Hello, I want to upgrade my developa site "${site.name}" (${site.slug}.developa.me) to the ${PLANS[to].name} plan for ${months} ${months === 1 ? 'month' : 'months'} (${naira(priceForPeriod(to, months))}).`);

  const payWithPaystack = async (to: PlanTier) => {
    if (to === 'free') return;
    setPayBusy(to);
    setMsg(null);
    const r = await jsonFetch<{ authorization_url?: string }>('/api/developa/pay/init', {
      method: 'POST',
      body: { kind: 'plan', slug: site.slug, plan_tier: to, months },
    });
    if (r.ok && r.data.authorization_url) {
      window.location.assign(r.data.authorization_url);
      return;
    }
    setMsg({ ok: false, text: r.data.error || 'Could not start Paystack checkout.' });
    setPayBusy(null);
  };
  const priorityWa = waLink(FOUNDER_WA, `Priority Business support (${site.name} / ${site.slug}.developa.me): `);

  return (
    <div className="space-y-6">
      <div className="g-card p-5">
        <p className="text-sm text-secondary">Your plan</p>
        <p className="text-2xl font-medium mt-1">{PLANS[tier].name}</p>
        {tier !== 'free' && left !== null && (
          <p className="text-sm text-secondary mt-1">
            {left > 0 ? `Renews or ends in ${left} ${left === 1 ? 'day' : 'days'} (${new Date(site.plan_expires_at!).toLocaleDateString('en-GB')})` : 'Ends today'}
            {left !== null && left <= 7 && left > 0 && <span className="text-warning"> · message us to renew</span>}
          </p>
        )}
        {lapsed && <p className="text-sm text-warning mt-1">Your {PLANS[site.plan_tier].name} plan has ended, so the site is back on Starter. Renew to bring your domain and Pro features back.</p>}
      </div>

      <div className="flex w-fit rounded-full g-tonal-strong p-1 text-sm font-medium" role="tablist" aria-label="Billing period">
        {BILLING_PERIODS.map((b) => (
          <button key={b.months} type="button" role="tab" aria-selected={months === b.months} onClick={() => setMonths(b.months)}
            className={`px-4 py-2 rounded-full transition ${months === b.months ? 'bg-card shadow-sm text-primary' : 'text-secondary'}`}>
            {b.label}{b.discountPct > 0 && <span className="ml-1.5 text-xs text-accent">save {b.discountPct}%</span>}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {PLAN_ORDER.map((t) => {
          const p = PLANS[t];
          const current = t === tier;
          const link = t === 'free' ? null : upgrade(t);
          return (
            <div key={t} className={`g-card p-5 flex flex-col ${current ? 'ring-2 ring-[var(--accent)]' : ''}`}>
              <p className="font-medium">{p.name} {current && <span className="text-xs text-accent font-medium ml-1">Current</span>}</p>
              <p className="text-2xl font-medium mt-2">{p.priceNgn === 0 ? 'Free' : naira(Math.round(priceForPeriod(t, months) / months))}{p.priceNgn > 0 && <span className="text-sm text-secondary font-normal"> / month</span>}</p>
              {p.priceNgn > 0 && months > 1 && <p className="text-xs text-secondary mt-1">{naira(priceForPeriod(t, months))} for {months} months</p>}
              <ul className="mt-4 space-y-2 text-sm text-secondary flex-1">
                {p.highlights.map((h) => <li key={h}>· {h}</li>)}
              </ul>
              {link && !current && (
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={payBusy !== null}
                    onClick={() => payWithPaystack(t)}
                    className="w-full text-center bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-4 h-10 rounded-full disabled:opacity-50"
                  >
                    {payBusy === t ? 'Starting Paystack…' : 'Pay with Paystack'}
                  </button>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-center border border-theme font-medium text-xs px-4 h-9 leading-[2.25rem] rounded-full">
                    {tier === 'free' ? 'Or transfer via WhatsApp' : 'Switch on WhatsApp'}
                  </a>
                </div>
              )}
              {link && current && tier !== 'free' && (
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={payBusy !== null}
                    onClick={() => payWithPaystack(t)}
                    className="w-full text-center bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-4 h-10 rounded-full disabled:opacity-50"
                  >
                    {payBusy === t ? 'Starting Paystack…' : 'Renew with Paystack'}
                  </button>
                  <a href={upgrade(t) || '#'} target="_blank" rel="noopener noreferrer" className="text-center border border-theme font-medium text-xs px-4 h-9 leading-[2.25rem] rounded-full">Renew on WhatsApp</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-secondary">Upgrades are confirmed by us after your payment, usually within a few hours. Your plan switches on as soon as we record it.</p>
      {tier === 'free' && <p className="text-sm text-warning">{PRUNE_NOTICE}</p>}

      <section className="g-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Priority support</h3>
            <p className="text-sm text-secondary mt-0.5">
              Business sites get priority help and setup support within 4 business hours.
            </p>
          </div>
          {hasPriority && priorityWa && (
            <a href={priorityWa} target="_blank" rel="noopener noreferrer" className="px-4 h-10 inline-flex items-center rounded-full border border-theme hover:bg-hover text-xs font-medium">
              Priority WhatsApp
            </a>
          )}
        </div>

        {!hasPriority ? (
          <p className="text-xs text-secondary">Upgrade to the Business plan for priority WhatsApp and ticketed setup support.</p>
        ) : (
          <>
            <form onSubmit={submitTicket} className="space-y-3 text-sm max-w-xl">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-subj" className="block text-xs font-medium mb-1">Subject</label>
                  <input id="sup-subj" required minLength={3} maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Domain help, bulk setup…" className="input-box w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="sup-wa" className="block text-xs font-medium mb-1">Your WhatsApp number</label>
                  <input id="sup-wa" type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="0803…" className="input-box w-full text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="sup-msg" className="block text-xs font-medium mb-1">How can we help?</label>
                <textarea id="sup-msg" required minLength={10} maxLength={3000} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="input-box w-full text-sm" placeholder="Tell us what you want set up or fixed." />
              </div>
              {msg && <p className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`} role="status">{msg.text}</p>}
              <button type="submit" disabled={busy} className="px-5 h-10 rounded-full bg-accent text-[var(--accent-foreground)] text-xs font-medium disabled:opacity-50">
                {busy ? 'Sending…' : 'Send priority request'}
              </button>
            </form>

            {tickets.length > 0 && (
              <div className="pt-3 border-t border-theme space-y-2">
                <p className="text-xs font-medium text-secondary">Recent requests</p>
                {tickets.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-secondary/25 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.subject}</span>
                      <span className="capitalize text-secondary">{t.status.replace('_', ' ')}</span>
                    </div>
                    {t.admin_reply && <p className="text-primary">Reply: {t.admin_reply}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
