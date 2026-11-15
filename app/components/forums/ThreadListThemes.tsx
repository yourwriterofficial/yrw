'use client';

import Link from 'next/link';
import { Pin, Lock, MessageCircle, ThumbsUp, Share2, Repeat2, Heart, BadgeCheck, Globe, Bookmark, Image as ImageIcon, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ForumThread } from '@/lib/forums';
import type { StoreLayoutStyle } from '@/lib/siteTemplates';

/**
 * How a forum's posts are laid out. The "standard" layout stays in ForumView; every other theme
 * (discussion board, newspaper, social feed, microblog, short-video wall) is drawn here and aims to feel
 * like the thing it is named after: a dense text board, a feed with reactions, a timeline, a video wall.
 */

interface Props {
  threads: ForumThread[];
  layout: StoreLayoutStyle;
  accent: string;
  threadHref: (id: string) => string;
  /** Optional cover art per post (used by the reels wall; theme previews supply it). */
  coverFor?: (t: ForumThread) => string | undefined;
  /** Opens the "write a post" form where the host page has one. */
  onCompose?: () => void;
}

const ago = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });
const initial = (n?: string) => (n || 'M').trim().charAt(0).toUpperCase();
const handle = (n?: string) => '@' + (n || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Stable pseudo numbers so a demo post always shows the same counts.
const seed = (id: string) => Array.from(id).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export const FORUM_LAYOUTS: StoreLayoutStyle[] = ['board', 'newspaper', 'feed', 'micro', 'reels'];

function Avatar({ name, accent, size = 40 }: { name?: string; accent: string; size?: number }) {
  return (
    <span className="shrink-0 rounded-full flex items-center justify-center text-white font-semibold" style={{ width: size, height: size, background: accent, fontSize: size * 0.4 }}>
      {initial(name)}
    </span>
  );
}

function Composer({ accent, label, onCompose, rounded = 'rounded-xl' }: { accent: string; label: string; onCompose?: () => void; rounded?: string }) {
  return (
    <div className={`bg-card border border-theme ${rounded} p-3 flex items-center gap-3 shadow-sm`}>
      <Avatar name="You" accent={accent} />
      <button type="button" onClick={onCompose} className="flex-1 text-left text-sm text-secondary bg-secondary/40 hover:bg-secondary/60 rounded-full px-4 h-10 transition">{label}</button>
      <ImageIcon className="w-5 h-5 text-secondary hidden sm:block" />
    </div>
  );
}

export default function ThreadListThemes({ threads, layout, accent, threadHref, coverFor, onCompose }: Props) {
  if (layout === 'board') {
    // Dense, text-first board: small type, blue links, posts and views counts, page links.
    return (
      <div className="bg-card border border-theme text-[13px] leading-snug" style={{ fontFamily: 'Tahoma, Verdana, sans-serif' }}>
        <div className="px-3 py-1.5 text-xs font-bold text-white flex items-center justify-between" style={{ background: accent }}>
          <span>Latest topics</span>
          <span className="font-normal opacity-90">{threads.length} shown</span>
        </div>
        <ul>
          {threads.map((t) => {
            const s = seed(t.id);
            const posts = t.reply_count + 1;
            const views = posts * 23 + (s % 400);
            const pages = Math.ceil(posts / 20);
            return (
              <li key={t.id} className="px-3 py-2 border-t border-dotted border-theme first:border-t-0">
                <Link href={threadHref(t.id)} className="block">
                  <span className="font-bold underline-offset-2 hover:underline" style={{ color: '#0b3d91' }}>
                    {t.is_pinned && <span className="mr-1.5 text-[10px] font-bold uppercase px-1 py-px bg-red-600 text-white align-middle">Sticky</span>}
                    {t.is_locked && <Lock className="inline w-3 h-3 mr-1 text-secondary" />}
                    {t.title}
                  </span>
                  {pages > 1 && <span className="text-[11px] text-secondary"> (1 2 {pages > 3 ? '… ' : ''}{pages > 2 ? pages : ''} <span className="font-bold">Last</span>)</span>}
                  <span className="block text-[11px] text-secondary mt-0.5">
                    by <span className="font-bold" style={{ color: '#0b3d91' }}>{t.author_name || 'Member'}</span>. <b>{posts}</b> posts &amp; <b>{views}</b> views. Last: {ago(t.last_activity_at)}
                  </span>
                </Link>
              </li>
            );
          })}
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
    // Facebook-like: composer on top, posts with a reactions line and a Like / Comment / Share bar.
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        <Composer accent={accent} label="What's on your mind?" onCompose={onCompose} />
        {threads.map((t) => {
          const likes = 8 + (seed(t.id) % 90);
          return (
            <article key={t.id} className="bg-card border border-theme rounded-xl shadow-sm">
              <div className="p-4 flex items-center gap-3">
                <Avatar name={t.author_name} accent={accent} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{t.author_name || 'Member'}</p>
                  <p className="text-xs text-secondary flex items-center gap-1">{ago(t.created_at)} · <Globe className="w-3 h-3" /></p>
                </div>
                {t.is_pinned && <Pin className="w-4 h-4 text-secondary ml-auto" />}
              </div>
              <Link href={threadHref(t.id)} className="block px-4 pb-3">
                <p className="text-[15px]">{t.title}</p>
                {t.body && t.body !== t.title && <p className="text-sm text-secondary mt-1 line-clamp-4 whitespace-pre-line">{t.body}</p>}
              </Link>
              <div className="px-4 py-2 flex items-center justify-between text-xs text-secondary">
                <span className="flex items-center gap-1.5"><span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white" style={{ background: accent }}><ThumbsUp className="w-2.5 h-2.5" /></span>{likes}</span>
                <span>{t.reply_count} {t.reply_count === 1 ? 'comment' : 'comments'} · {seed(t.id) % 7} shares</span>
              </div>
              <div className="mx-4 border-t border-theme grid grid-cols-3 text-sm font-semibold text-secondary">
                <button type="button" className="py-2 flex items-center justify-center gap-2 hover:bg-secondary/40 rounded-md my-1"><ThumbsUp className="w-4 h-4" /> Like</button>
                <Link href={threadHref(t.id)} className="py-2 flex items-center justify-center gap-2 hover:bg-secondary/40 rounded-md my-1"><MessageCircle className="w-4 h-4" /> Comment</Link>
                <button type="button" className="py-2 flex items-center justify-center gap-2 hover:bg-secondary/40 rounded-md my-1"><Share2 className="w-4 h-4" /> Share</button>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (layout === 'micro') {
    // Twitter-like: For you / Following tabs, compose row, then compact posts with an icon action row.
    return (
      <div className="max-w-xl mx-auto border border-theme bg-card overflow-hidden">
        <div className="grid grid-cols-2 text-center text-[15px] font-bold border-b border-theme">
          <span className="py-3 relative">For you<span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-14 rounded-full" style={{ background: accent }} /></span>
          <span className="py-3 text-secondary font-medium">Following</span>
        </div>
        <div className="p-4 flex gap-3 border-b border-theme">
          <Avatar name="You" accent={accent} size={40} />
          <div className="flex-1">
            <button type="button" onClick={onCompose} className="w-full text-left text-xl text-secondary py-2">What is happening?</button>
            <div className="flex justify-end"><span className="h-8 px-4 rounded-full text-white text-sm font-bold flex items-center opacity-60" style={{ background: accent }}>Post</span></div>
          </div>
        </div>
        <div className="divide-y divide-theme">
          {threads.map((t) => {
            const s = seed(t.id);
            return (
              <Link key={t.id} href={threadHref(t.id)} className="flex gap-3 px-4 py-3 hover:bg-secondary/20 transition">
                <Avatar name={t.author_name} accent={accent} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] truncate flex items-center gap-1">
                    <span className="font-bold truncate">{t.author_name || 'Member'}</span>
                    {s % 3 === 0 && <BadgeCheck className="w-4 h-4 shrink-0" style={{ color: accent }} />}
                    <span className="text-secondary truncate">{handle(t.author_name)} · {ago(t.created_at).replace('about ', '').replace(' ago', '')}</span>
                  </p>
                  <p className="mt-0.5 text-[15px] whitespace-pre-line break-words">{t.title}</p>
                  {t.body && t.body !== t.title && <p className="text-[15px] text-secondary mt-1 line-clamp-3 whitespace-pre-line">{t.body}</p>}
                  <div className="mt-2 flex items-center justify-between max-w-sm text-[13px] text-secondary">
                    <span className="flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> {t.reply_count}</span>
                    <span className="flex items-center gap-1.5"><Repeat2 className="w-4 h-4" /> {s % 12}</span>
                    <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> {20 + (s % 240)}</span>
                    <span className="flex items-center gap-1.5"><Bookmark className="w-4 h-4" /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // reels: TikTok-like, tall full-bleed clips one after another with a side action rail
  return (
    <div className="rounded-3xl bg-black p-3 sm:p-4">
      <div className="flex justify-center gap-6 text-white text-[15px] font-bold pb-3">
        <span className="border-b-2 border-white pb-1">For You</span>
        <span className="text-white/60 font-semibold pb-1">Following</span>
      </div>
      <div className="mx-auto max-w-sm space-y-4">
        {threads.map((t, i) => {
          const s = seed(t.id);
          return (
            <div
              key={t.id}
              className="relative aspect-[9/14] rounded-2xl overflow-hidden"
              style={coverFor?.(t) ? { backgroundImage: `url("${coverFor(t)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(${160 + (i % 5) * 30}deg, ${accent}, #111 70%)` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
              <Link href={threadHref(t.id)} className="absolute inset-0" aria-label={t.title} />
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white text-[11px] font-semibold">
                <span className="flex flex-col items-center gap-1"><Heart className="w-7 h-7" fill="currentColor" />{(s % 90) + 3}K</span>
                <span className="flex flex-col items-center gap-1"><MessageCircle className="w-7 h-7" fill="currentColor" />{t.reply_count}</span>
                <span className="flex flex-col items-center gap-1"><Bookmark className="w-7 h-7" fill="currentColor" />{s % 40}</span>
                <span className="flex flex-col items-center gap-1"><Share2 className="w-7 h-7" />Share</span>
              </div>
              <div className="absolute bottom-0 left-0 right-16 p-4 text-white pointer-events-none">
                <p className="font-bold text-sm flex items-center gap-2"><Avatar name={t.author_name} accent={accent} size={26} /> {handle(t.author_name)} <span className="ml-1 px-2 py-0.5 rounded border border-white/70 text-[10px] font-semibold flex items-center gap-0.5"><Plus className="w-3 h-3" />Follow</span></p>
                <p className="mt-2 text-sm leading-snug line-clamp-3">{t.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
