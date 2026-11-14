'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLANS, effectiveTier } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface Convo { buyer_id: string; name: string; email: string; last_body: string; last_at: string; unread: number }
interface Msg { id: string; sender: 'buyer' | 'owner'; body: string; created_at: string }

export default function MessagesTab({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const allowed = PLANS[effectiveTier(site.plan_tier, site.plan_expires_at)].directMessages;
  const [convos, setConvos] = useState<Convo[]>([]);
  const [open, setOpen] = useState<Convo | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const base = `/api/forums/${site.slug}/messages/manage`;

  const loadList = useCallback(async () => {
    const r = await jsonFetch<{ conversations?: Convo[] }>(base);
    if (r.ok) setConvos(r.data.conversations || []);
  }, [base]);
  const loadThread = useCallback(async (buyerId: string) => {
    const r = await jsonFetch<{ messages?: Msg[] }>(`${base}?buyer=${buyerId}`);
    if (r.ok) setThread(r.data.messages || []);
  }, [base]);

  useEffect(() => { if (allowed) Promise.resolve().then(loadList); }, [allowed, loadList]);
  useEffect(() => {
    if (!allowed) return;
    const t = setInterval(() => { loadList(); if (open) loadThread(open.buyer_id); }, 10000);
    return () => clearInterval(t);
  }, [allowed, open, loadList, loadThread]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  if (!allowed) {
    return (
      <div className="g-tonal p-6 max-w-xl">
        <h3 className="g-h3">Chat with your buyers</h3>
        <p className="text-sm text-secondary mt-2">Buyers can message you from your site, and you reply here. They also get your reply by email. Included in the Pro plan.</p>
        <button onClick={goToPlan} className="mt-4 bg-accent text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full">See plans</button>
      </div>
    );
  }

  const choose = async (c: Convo) => { setOpen(c); setErr(''); await loadThread(c.buyer_id); loadList(); };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open || !text.trim()) return;
    const r = await jsonFetch<{ message?: Msg }>(base, { method: 'POST', body: { buyer_id: open.buyer_id, body: text } });
    if (r.ok && r.data.message) { setThread((t) => [...t, r.data.message!]); setText(''); }
    else setErr(r.data.error || 'Could not send.');
  };

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4 min-h-[460px]">
      <section className={`g-card overflow-hidden ${open ? 'hidden md:block' : ''}`}>
        <h3 className="font-medium px-4 py-3 border-b border-theme">Conversations</h3>
        {convos.length === 0 ? <p className="p-4 text-sm text-secondary">No messages yet. Buyers will find a "Message seller" button on your site.</p> : (
          <ul className="divide-y divide-theme max-h-[520px] overflow-y-auto">
            {convos.map((c) => (
              <li key={c.buyer_id}>
                <button onClick={() => choose(c)} className={`w-full text-left px-4 py-3 hover:bg-hover ${open?.buyer_id === c.buyer_id ? 'bg-hover' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    {c.unread > 0 && <span className="text-[11px] bg-[var(--danger)] text-white rounded-full px-1.5 py-0.5">{c.unread}</span>}
                  </div>
                  <p className="text-xs text-secondary truncate mt-0.5">{c.last_body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`g-card flex flex-col overflow-hidden ${open ? '' : 'hidden md:flex'}`}>
        {!open ? <p className="p-6 text-sm text-secondary m-auto">Choose a conversation.</p> : (
          <>
            <div className="px-4 py-3 border-b border-theme flex items-center gap-3">
              <button onClick={() => setOpen(null)} className="md:hidden text-sm text-accent">Back</button>
              <div className="min-w-0"><p className="font-medium text-sm truncate">{open.name}</p><p className="text-xs text-secondary truncate">{open.email}</p></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[420px]">
              {thread.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${m.sender === 'owner' ? 'bg-accent text-[var(--accent-foreground)]' : 'g-tonal'}`}>{m.body}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="p-3 border-t border-theme flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Write a reply" aria-label="Reply" className="input-box flex-1 !py-3 text-sm" />
              <button type="submit" disabled={!text.trim()} className="px-6 h-11 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-medium disabled:opacity-50">Send</button>
            </form>
            {err && <p className="px-4 pb-3 text-xs text-danger" role="alert">{err}</p>}
          </>
        )}
      </section>
    </div>
  );
}
