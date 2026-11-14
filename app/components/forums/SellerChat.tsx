'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

interface Msg { id: string; sender: 'buyer' | 'owner'; body: string; created_at: string }

/**
 * A "Message the seller" button and chat window for stores on plans that include chat.
 * Renders nothing when the seller's plan does not include it (those sellers use WhatsApp).
 */
export default function SellerChat({ slug, siteName }: { slug: string; siteName: string }) {
  const [enabled, setEnabled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const url = `/api/forums/${encodeURIComponent(slug)}/messages`;

  const load = useCallback(async () => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    setEnabled(!!j.enabled);
    setSignedIn(!!j.signed_in);
    setMessages(j.messages || []);
  }, [url]);

  useEffect(() => { Promise.resolve().then(load); }, [load]);
  // While the window is open, check for the seller's reply every few seconds.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [open, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, open]);

  if (!enabled) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true); setErr('');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok && j.message) { setMessages((m) => [...m, j.message]); setText(''); }
    else setErr(j.error || 'Could not send.');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-4 z-[80] inline-flex items-center gap-2 h-12 px-5 rounded-full bg-accent text-[var(--accent-foreground)] font-medium shadow-lg"
      >
        <MessageCircle className="w-5 h-5" /> Message seller
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center sm:justify-start sm:pl-6 p-0" role="dialog" aria-modal="true" aria-label={`Chat with ${siteName}`}>
          <div className="bg-card w-full sm:w-[400px] h-[80vh] sm:h-[560px] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-theme flex items-center justify-between">
              <div>
                <p className="font-medium">{siteName}</p>
                <p className="text-xs text-secondary">Usually replies within a few hours</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="p-2 -m-2 text-secondary hover:text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-primary">
              {!signedIn ? (
                <div className="text-center text-sm text-secondary pt-10">
                  <p>Sign in to message this seller.</p>
                  <a href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`} className="inline-flex mt-4 bg-accent text-[var(--accent-foreground)] font-medium px-6 h-11 items-center rounded-full">Sign in</a>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-secondary pt-10">Ask about a product, delivery or price. The seller will reply here and by email.</p>
              ) : messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${m.sender === 'buyer' ? 'bg-accent text-[var(--accent-foreground)]' : 'bg-card border border-theme'}`}>{m.body}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {signedIn && (
              <form onSubmit={send} className="p-3 border-t border-theme flex items-center gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message" aria-label="Message" className="input-box flex-1 !py-3 text-sm" />
                <button type="submit" disabled={sending || !text.trim()} aria-label="Send" className="h-11 w-11 rounded-full bg-accent text-[var(--accent-foreground)] flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </form>
            )}
            {err && <p className="px-4 pb-3 text-xs text-danger" role="alert">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
