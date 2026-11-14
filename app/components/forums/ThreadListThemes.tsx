'use client';

import Link from 'next/link';
import { Pin, Lock, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ForumThread } from '@/lib/forums';
import type { StoreLayoutStyle } from '@/lib/siteTemplates';

/**
 * How a forum's posts are laid out. The "standard" layout stays in ForumView; every other theme
 * (discussion board, newspaper, social feed, microblog, short-video wall) is drawn here.
 */

interface Props {
  threads: ForumThread[];
  layout: StoreLayoutStyle;
  accent: string;
  threadHref: (id: string) => string;
}

const ago = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });
const initial = (n?: string) => (n || 'M').trim().charAt(0).toUpperCase();
const handle = (n?: string) => '@' + (n || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '');

export const FORUM_LAYOUTS: StoreLayoutStyle[] = ['board', 'newspaper', 'feed', 'micro', 'reels'];

function Avatar({ name, accent, size = 40 }: { name?: string; accent: string; size?: number }) {
  return (
    <span className="shrink-0 rounded-full flex items-center justify-center text-white font-semibold" style={{ width: size, height: size, background: accent, fontSize: size * 0.4 }}>
      {initial(name)}
    </span>
  );
}

export default function ThreadListThemes({ threads, layout, accent, threadHref }: Props) {
  if (layout === 'board') {
    return (
      <div className="border border-theme rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-white" style={{ background: accent }}>Latest topics</div>
        <ul>
          {threads.map((t, i) => (
            <li key={t.id} className={`px-4 py-3 border-t border-theme first:border-t-0 ${i % 2 ? 'bg-secondary/20' : ''}`}>
              <Link href={threadHref(t.id)} className="block">
                <p className="text-[15px] font-bold leading-snug hover:underline" style={{ color: accent }}>
                  {t.is_pinned && <span className="mr-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-600 text-white align-middle">Featured</span>}
                  {t.is_locked && <Lock className="inline w-3.5 h-3.5 mr-1 text-secondary" />}
                  {t.title}
                </p>
                <p className="text-xs text-secondary mt-1">
                  by <span className="font-semibold text-primary">{t.author_name || 'Member'}</span> · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'} · last post {ago(t.last_activity_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (layout === 'newspaper') {
    const [lead, ...rest] = threads;
    const second = rest.slice(0, 2);
    const more = rest.slice(2);
    return (
      <div>
        <div className="border-t-4 border-b border-primary py-1 mb-5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest" style={{ borderTopColor: accent }}>
          <span>Top stories</span>
          <span className="text-secondary font-medium normal-case tracking-normal">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        {lead && (
          <Link href={threadHref(lead.id)} className="block group pb-5 border-b border-theme">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>{lead.is_pinned ? 'Lead story' : 'Latest'}</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight group-hover:underline underline-offset-4">{lead.title}</h2>
            <p className="text-secondary mt-3 line-clamp-3 max-w-3xl">{lead.body}</p>
            <p className="text-xs text-secondary mt-3">By {lead.author_name || 'Staff'} · {ago(lead.created_at)} · {lead.reply_count} comments</p>
          </Link>
        )}
        {second.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-6 py-5 border-b border-theme">
            {second.map((t) => (
              <Link key={t.id} href={threadHref(t.id)} className="block group">
                <h3 className="font-serif text-xl font-bold leading-snug group-hover:underline underline-offset-4">{t.title}</h3>
                <p className="text-sm text-secondary mt-2 line-clamp-3">{t.body}</p>
                <p className="text-xs text-secondary mt-2">{ago(t.created_at)} · {t.reply_count} comments</p>
              </Link>
            ))}
          </div>
        )}
        {more.length > 0 && (
          <ul className="divide-y divide-theme">
            {more.map((t) => (
              <li key={t.id}>
                <Link href={threadHref(t.id)} className="flex items-baseline justify-between gap-4 py-3 group">
                  <span className="font-serif text-base font-semibold group-hover:underline underline-offset-4">{t.title}</span>
                  <span className="text-xs text-secondary shrink-0">{ago(t.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (layout === 'feed') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        {threads.map((t) => (
          <article key={t.id} className="bg-card border border-theme rounded-xl shadow-sm">
            <div className="p-4 flex items-center gap-3">
              <Avatar name={t.author_name} accent={accent} />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{t.author_name || 'Member'}</p>
                <p className="text-xs text-secondary">{ago(t.created_at)}</p>
              </div>
              {t.is_pinned && <Pin className="w-4 h-4 text-secondary ml-auto" />}
            </div>
            <Link href={threadHref(t.id)} className="block px-4 pb-3">
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-secondary mt-1 line-clamp-4 whitespace-pre-line">{t.body}</p>
            </Link>
            <div className="px-4 py-2.5 border-t border-theme flex items-center justify-between text-sm text-secondary">
              <span>{t.reply_count} {t.reply_count === 1 ? 'comment' : 'comments'}</span>
              <Link href={threadHref(t.id)} className="font-medium hover:text-primary flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Comment</Link>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (layout === 'micro') {
    return (
      <div className="max-w-2xl mx-auto border border-theme rounded-2xl bg-card divide-y divide-theme overflow-hidden">
        {threads.map((t) => (
          <Link key={t.id} href={threadHref(t.id)} className="flex gap-3 p-4 hover:bg-secondary/20 transition">
            <Avatar name={t.author_name} accent={accent} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">
                <span className="font-bold">{t.author_name || 'Member'}</span>
                <span className="text-secondary"> {handle(t.author_name)} · {ago(t.created_at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-line break-words">{t.title}</p>
              {t.body && t.body !== t.title && <p className="text-sm text-secondary mt-1 line-clamp-3 whitespace-pre-line">{t.body}</p>}
              <p className="mt-2 text-xs text-secondary flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {t.reply_count}</p>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  // reels: a dark wall of tall cards
  return (
    <div className="rounded-3xl bg-black p-3 sm:p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {threads.map((t, i) => (
          <Link
            key={t.id}
            href={threadHref(t.id)}
            className="relative block aspect-[9/14] rounded-2xl overflow-hidden group"
            style={{ background: `linear-gradient(${160 + (i % 5) * 30}deg, ${accent}, #111 70%)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
              <p className="font-semibold leading-snug line-clamp-3 text-sm sm:text-base">{t.title}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-white/80">
                <span className="flex items-center gap-1.5 min-w-0"><Avatar name={t.author_name} accent={accent} size={22} /> <span className="truncate">{t.author_name || 'Creator'}</span></span>
                <span className="flex items-center gap-1 shrink-0"><MessageSquare className="w-3.5 h-3.5" /> {t.reply_count}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
