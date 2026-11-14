'use client';

import { useState } from 'react';
import type { ForumThread } from '@/lib/forums';
import { jsonFetch, type Site } from '../types';

export default function CommunityTab({ site, threads, reload }: { site: Site; threads: ForumThread[]; reload: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const patch = async (t: ForumThread, body: { is_pinned?: boolean; is_locked?: boolean }) => {
    setBusyId(t.id);
    const r = await jsonFetch(`/api/forums/${site.slug}/threads/${t.id}`, { method: 'PATCH', body });
    if (!r.ok) setError(r.data.error || 'Could not update the thread.');
    await reload();
    setBusyId(null);
  };

  const remove = async (t: ForumThread) => {
    if (!confirm(`Delete "${t.title}" and all its replies? This cannot be undone.`)) return;
    setBusyId(t.id);
    const r = await jsonFetch(`/api/forums/${site.slug}/threads/${t.id}`, { method: 'DELETE' });
    if (!r.ok) setError(r.data.error || 'Could not delete the thread.');
    await reload();
    setBusyId(null);
  };

  if (site.site_mode === 'store') {
    return (
      <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">
        This site is a store without a community. You can turn the community on in Settings.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-secondary">{site.member_count} members · {threads.length} {threads.length === 1 ? 'discussion' : 'discussions'}</p>
        <a href={`/forums/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:underline">Open the community</a>
      </div>
      {error && <p className="text-sm text-danger mb-4" role="alert">{error}</p>}
      {threads.length === 0 ? (
        <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">No discussions yet. Start one on your community page to welcome people.</p>
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={t.id} className="g-card p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {t.is_pinned && <span className="text-accent">Pinned · </span>}
                  {t.is_locked && <span className="text-warning">Locked · </span>}
                  {t.title}
                </p>
                <p className="text-sm text-secondary">{t.author_name || 'Member'} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}</p>
              </div>
              <div className="flex gap-1 text-sm shrink-0">
                <button disabled={busyId === t.id} onClick={() => patch(t, { is_pinned: !t.is_pinned })} className="px-3 h-9 rounded-full hover:bg-hover">{t.is_pinned ? 'Unpin' : 'Pin'}</button>
                <button disabled={busyId === t.id} onClick={() => patch(t, { is_locked: !t.is_locked })} className="px-3 h-9 rounded-full hover:bg-hover">{t.is_locked ? 'Unlock' : 'Lock'}</button>
                <button disabled={busyId === t.id} onClick={() => remove(t)} className="px-3 h-9 rounded-full hover:bg-hover text-danger">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
