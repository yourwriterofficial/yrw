'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Send, MessageCircle, Clock } from 'lucide-react';
import { PLANS, effectiveTier } from '@/lib/plans';
import { FOUNDER_WA, jsonFetch, type Site } from '../types';

interface Msg { id: string; from: 'you' | 'team'; text: string; at: string }

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** A direct line to the Developa team. Messages arrive in the Developa support inbox; replies show up here and by email. */
export default function SupportTab({ site }: { site: Site }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const tier = effectiveTier(site.plan_tier, site.plan_expires_at);
  const priority = PLANS[tier].prioritySupport;

  const load = useCallback(async () => {
    const r = await jsonFetch<{ messages?: Msg[] }>(`/api/forums/${site.slug}/support-chat`);
    if (r.ok) setMessages(r.data.messages || []);
    setLoading(false);
  }, [site.slug]);

  useEffect(() => {
    let alive = true;
    (async () => { await Promise.resolve(); if (alive) await load(); })();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || text.trim().length < 2) return;
    setSending(true); setError('');
    const r = await jsonFetch<{ ok?: boolean; error?: string }>(`/api/forums/${site.slug}/support-chat`, { method: 'POST', body: { message: text.trim() } });
    setSending(false);
    if (r.ok) { setText(''); await load(); } else setError(r.data.error || 'Could not send your message. Please try again.');
  };

  const wa = `https://wa.me/${FOUNDER_WA}?text=${encodeURIComponent(`Hello, I need help with my developa site "${site.name}" (${site.slug}.developa.me): `)}`;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="g-h3 flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-accent" /> Talk to the Developa team</h2>
        <p className="text-sm text-secondary mt-1">Ask a question or tell us what is not working. We reply here and by email.</p>
        <p className="text-xs text-secondary mt-2 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {priority ? 'Priority support: we aim to reply within 4 working hours.' : 'We usually reply within one working day.'}
        </p>
      </div>

      <section className="g-card p-4 sm:p-5">
        <div className="max-h-[26rem] overflow-y-auto space-y-3 pr-1" aria-live="polite">
          {loading ? (
            <p className="text-sm text-secondary py-6 text-center">Loading your messages…</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <span className="mx-auto w-12 h-12 rounded-full g-tonal-strong flex items-center justify-center mb-3"><MessageCircle className="w-5 h-5 text-secondary" /></span>
              <p className="text-sm text-secondary">No messages yet. Write to us below, and we will get back to you.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${m.from === 'you' ? 'bg-[var(--accent)] text-[var(--accent-foreground)] rounded-br-md' : 'g-tonal-strong rounded-bl-md'}`}>
                  <p className={`text-[11px] mb-0.5 ${m.from === 'you' ? 'opacity-80' : 'text-secondary'}`}>{m.from === 'you' ? 'You' : 'Developa team'} · {when(m.at)}</p>
                  {m.text.split('\n-- \n')[0]}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="mt-4 space-y-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="How can we help?"
            className="w-full rounded-xl bg-primary border border-theme px-4 py-3 text-sm text-primary focus:outline-none focus:border-accent resize-y"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={sending || text.trim().length < 2} className="btn-primary !rounded-full px-6 py-2.5 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50">
              <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send message'}
            </button>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:underline inline-flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" /> Prefer WhatsApp?
            </a>
          </div>
        </form>
      </section>
    </div>
  );
}
