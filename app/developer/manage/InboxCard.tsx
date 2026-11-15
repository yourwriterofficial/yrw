'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, CheckCircle2, ShieldAlert, X } from 'lucide-react';

interface Announcement { id: string; title: string; body: string; level: 'info' | 'success' | 'warning' | 'critical'; pinned: boolean; created_at: string }
interface SiteNotice { slug: string; name: string; status: 'active' | 'restricted' | 'suspended' | 'banned'; reason: string; restrictions: Record<string, unknown> }

const STYLE: Record<Announcement['level'], { box: string; Icon: typeof Info }> = {
  info: { box: 'g-tonal', Icon: Info },
  success: { box: 'g-tonal', Icon: CheckCircle2 },
  warning: { box: 'border border-warning/40 bg-warning/5', Icon: AlertTriangle },
  critical: { box: 'border border-danger/40 bg-danger/5', Icon: ShieldAlert },
};

const KEY = 'developa_inbox_dismissed';
const readDismissed = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

/**
 * Messages from the developa.me team, and a clear notice if this site has been limited, suspended or banned.
 * Messages can be closed (remembered in this browser); a site status notice stays until it is lifted.
 */
export default function InboxCard({ siteSlug }: { siteSlug: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [notice, setNotice] = useState<SiteNotice | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setDismissed(readDismissed());
    fetch('/api/developa/inbox', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setItems(Array.isArray(j.announcements) ? j.announcements : []);
        const mine = (j.sites || []).find((s: SiteNotice) => s.slug === siteSlug);
        setNotice(mine && mine.status !== 'active' ? mine : null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [siteSlug]);

  const close = (id: string) => {
    const next = [...dismissed, id].slice(-100);
    setDismissed(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  };

  const visible = items.filter((a) => a.pinned || !dismissed.includes(a.id)).filter((a) => !dismissed.includes(a.id)).slice(0, 3);
  if (!notice && visible.length === 0) return null;

  return (
    <div className="space-y-3" aria-label="Messages from developa.me">
      {notice && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 flex gap-3" role="alert">
          <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold capitalize">Your site is {notice.status}</p>
            <p className="text-secondary mt-0.5">{notice.reason || (notice.status === 'restricted' ? 'Some features are switched off for now.' : 'It is not visible to the public right now.')} If you think this is a mistake, contact developa.me support.</p>
          </div>
        </div>
      )}
      {visible.map((a) => {
        const { box, Icon } = STYLE[a.level] || STYLE.info;
        return (
          <article key={a.id} className={`rounded-2xl p-4 flex gap-3 ${box}`}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{a.title}</p>
              <p className="text-secondary mt-1 whitespace-pre-line">{a.body}</p>
              <p className="text-xs text-secondary mt-2">From the developa.me team · {new Date(a.created_at).toLocaleDateString('en-GB')}</p>
            </div>
            <button type="button" onClick={() => close(a.id)} aria-label="Close this message" className="w-8 h-8 rounded-full hover:bg-hover flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
          </article>
        );
      })}
    </div>
  );
}
