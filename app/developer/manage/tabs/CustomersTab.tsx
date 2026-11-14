'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface CustomerRow {
  email: string;
  name: string;
  phone: string;
  orders: number;
  paid_orders: number;
  total_spent: number;
  last_order_at: string;
  subscribed: boolean;
}

interface NewsletterLog {
  id: string;
  subject: string;
  sent_count: number;
  month_key: string;
  created_at: string;
}

export default function CustomersTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const canEdit = !site.my_role || site.my_role === 'owner' || site.my_role === 'manager';

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Add subscriber manually
  const [subEmail, setSubEmail] = useState('');
  const [subName, setSubName] = useState('');
  const [subPhone, setSubPhone] = useState('');
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Newsletter state
  const [newsletters, setNewsletters] = useState<NewsletterLog[]>([]);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [limitPerMonth, setLimitPerMonth] = useState(plan.newsletterLimitPerMonth);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cRes, nRes] = await Promise.all([
      jsonFetch<{ customers?: CustomerRow[] }>(`/api/forums/${site.slug}/customers`),
      canEdit
        ? jsonFetch<{
            newsletters?: NewsletterLog[];
            sentThisMonth?: number;
            limitPerMonth?: number;
            subscriberCount?: number;
          }>(`/api/forums/${site.slug}/newsletter`)
        : Promise.resolve(null),
    ]);
    setCustomers(Array.isArray(cRes.data.customers) ? cRes.data.customers : []);
    if (nRes && nRes.ok) {
      setNewsletters(Array.isArray(nRes.data.newsletters) ? nRes.data.newsletters : []);
      setSentThisMonth(Number(nRes.data.sentThisMonth || 0));
      setLimitPerMonth(Number(nRes.data.limitPerMonth ?? plan.newsletterLimitPerMonth));
      setSubscriberCount(Number(nRes.data.subscriberCount || 0));
    }
    setLoading(false);
  }, [site.slug, canEdit, plan.newsletterLimitPerMonth]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [customers, query]);

  const addSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubBusy(true);
    setSubMsg(null);
    const r = await jsonFetch(`/api/forums/${site.slug}/customers`, {
      method: 'POST',
      body: { email: subEmail, name: subName, phone: subPhone, marketing_consent: true },
    });
    if (r.ok) {
      setSubEmail('');
      setSubName('');
      setSubPhone('');
      setSubMsg({ ok: true, text: 'Subscriber added.' });
      await loadAll();
    } else {
      setSubMsg({ ok: false, text: r.data.error || 'Could not add subscriber.' });
    }
    setSubBusy(false);
  };

  const sendNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendBusy(true);
    setSendMsg(null);
    const r = await jsonFetch<{ sent_count?: number }>(`/api/forums/${site.slug}/newsletter`, {
      method: 'POST',
      body: { subject, body },
    });
    if (r.ok) {
      setSubject('');
      setBody('');
      setSendMsg({ ok: true, text: `Sent to ${r.data.sent_count || 0} subscribers.` });
      await loadAll();
    } else {
      setSendMsg({ ok: false, text: r.data.error || 'Could not send newsletter.' });
    }
    setSendBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Customers & subscribers</h3>
          <p className="text-sm text-secondary mt-0.5">
            {customers.length} {customers.length === 1 ? 'person' : 'people'} from orders and email signups
          </p>
        </div>
        {plan.customerExport ? (
          <a
            href={`/api/forums/${encodeURIComponent(site.slug)}/customers?format=csv`}
            className="inline-flex items-center px-5 h-10 rounded-full border border-theme hover:bg-hover text-sm font-medium"
          >
            Export CSV
          </a>
        ) : (
          <button
            type="button"
            onClick={goToPlan}
            className="inline-flex items-center px-5 h-10 rounded-full border border-theme hover:bg-hover text-sm font-medium"
          >
            Upgrade to Pro for CSV export
          </button>
        )}
      </div>

      {canEdit && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={addSubscriber} className="g-card p-5 space-y-3 h-fit">
            <h4 className="font-medium text-sm">Add subscriber</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="sub-email">Email</label>
                <input id="sub-email" type="email" required value={subEmail} onChange={(e) => setSubEmail(e.target.value)} className="input-box w-full text-sm" placeholder="buyer@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="sub-name">Name (optional)</label>
                <input id="sub-name" value={subName} onChange={(e) => setSubName(e.target.value)} className="input-box w-full text-sm" placeholder="Ada Okafor" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor="sub-phone">Phone / WhatsApp (optional)</label>
              <input id="sub-phone" type="tel" value={subPhone} onChange={(e) => setSubPhone(e.target.value)} className="input-box w-full text-sm" placeholder="0803…" />
            </div>
            {subMsg && <p className={`text-xs ${subMsg.ok ? 'text-success' : 'text-danger'}`} role="status">{subMsg.text}</p>}
            <button type="submit" disabled={subBusy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-5 h-10 rounded-full disabled:opacity-50">
              {subBusy ? 'Saving…' : 'Add to email list'}
            </button>
          </form>

          <section className="g-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium text-sm">Email newsletter</h4>
              {limitPerMonth > 0 && (
                <span className="text-xs text-secondary">
                  {sentThisMonth.toLocaleString()} / {limitPerMonth.toLocaleString()} emails this month · {subscriberCount} subscribed
                </span>
              )}
            </div>
            {plan.newsletterLimitPerMonth <= 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-secondary">Send product announcements and restock alerts to opted-in buyers on Pro and Business.</p>
                <button type="button" onClick={goToPlan} className="px-4 h-10 rounded-full border border-theme hover:bg-hover text-xs font-medium">
                  Upgrade to Pro
                </button>
              </div>
            ) : (
              <form onSubmit={sendNewsletter} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" htmlFor="nl-subj">Subject</label>
                  <input id="nl-subj" required minLength={3} maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} className="input-box w-full text-sm" placeholder="New arrivals + weekend offer" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" htmlFor="nl-body">Message</label>
                  <textarea id="nl-body" required minLength={10} maxLength={6000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="input-box w-full text-sm" placeholder="Write your update for opted-in subscribers. An unsubscribe link is added automatically." />
                </div>
                {sendMsg && <p className={`text-xs ${sendMsg.ok ? 'text-success' : 'text-danger'}`} role="status">{sendMsg.text}</p>}
                <button type="submit" disabled={sendBusy || subscriberCount === 0} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-5 h-10 rounded-full disabled:opacity-50">
                  {sendBusy ? 'Sending…' : `Send to ${subscriberCount} ${subscriberCount === 1 ? 'subscriber' : 'subscribers'}`}
                </button>
              </form>
            )}
            {newsletters.length > 0 && (
              <div className="pt-3 border-t border-theme space-y-1.5">
                <p className="text-xs font-medium text-secondary">Recent campaigns</p>
                <ul className="space-y-1 text-xs">
                  {newsletters.slice(0, 4).map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-2 text-secondary">
                      <span className="truncate text-primary">{n.subject}</span>
                      <span className="shrink-0">{n.sent_count} sent</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      <div className="g-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-medium text-sm">Directory</h4>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search customers"
            className="input-box w-full sm:w-64 !py-2 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-secondary">Loading customers…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-secondary">No customers match yet.</p>
        ) : (
          <div className="divide-y divide-theme">
            {filtered.map((c) => (
              <div key={c.email} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {c.name || c.email}
                    {c.subscribed && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] bg-accent/15 text-accent font-medium">
                        Subscribed
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-secondary truncate">
                    {c.email}{c.phone ? ` · ${c.phone}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium">{formatMoney(c.total_spent, site.currency)}</p>
                  <p className="text-xs text-secondary">{c.orders} {c.orders === 1 ? 'order' : 'orders'} ({c.paid_orders} paid)</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
