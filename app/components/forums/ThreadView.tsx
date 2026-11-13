'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, MessageSquare, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Button from '@/app/components/ui/Button';
import { extractDevelopaSubdomain, type ForumPost, type ForumSummary, type ForumThread } from '@/lib/forums';

export default function ThreadView({ slug, threadId }: { slug: string; threadId: string }) {
  const [forum, setForum] = useState<Pick<ForumSummary, 'id' | 'slug' | 'name' | 'accent_color'> | null>(null);
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [isSubdomain, setIsSubdomain] = useState(false);

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/threads/${encodeURIComponent(threadId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Thread not found.');
        return;
      }
      setError('');
      setForum(data.forum);
      setThread(data.thread);
      setPosts(data.posts || []);
    } catch {
      setError('Failed to load thread.');
    } finally {
      setLoading(false);
    }
  }, [slug, threadId]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setIsSubdomain(!!extractDevelopaSubdomain(window.location.host));
      await loadThread();
    })();
    return () => { active = false; };
  }, [loadThread]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyError('');
    setReplying(true);
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/threads/${encodeURIComponent(threadId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReplyError(data.error || 'Failed to post reply.');
        return;
      }
      setReplyBody('');
      setPosts((prev) => [...prev, data.post]);
    } catch {
      setReplyError('Network error while posting reply.');
    } finally {
      setReplying(false);
    }
  };

  const backHref = isSubdomain ? '/' : `/forums/${slug}`;

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col justify-between">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-16 space-y-6 w-full flex-1">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to {forum?.name || `${slug}.developa.me`}
        </Link>

        {loading ? (
          <div className="h-44 rounded-2xl bg-card border border-theme animate-pulse" />
        ) : error || !thread ? (
          <div className="bg-card border border-theme rounded-2xl p-8 text-center space-y-3">
            <h1 className="text-lg font-bold">{error || 'Thread not found'}</h1>
            <Button href={backHref} variant="secondary">Return to Forum</Button>
          </div>
        ) : (
          <>
            <article className="bg-card border border-theme rounded-2xl p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-cyan-400">{slug}.developa.me</span>
                  {thread.is_locked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-black tracking-tight">{thread.title}</h1>
                <div className="text-xs text-secondary flex items-center gap-2">
                  <span className="font-semibold text-primary/90">{thread.author_name || 'Member'}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="text-sm text-primary/90 whitespace-pre-wrap leading-relaxed pt-2 border-t border-theme">
                {thread.body}
              </div>
            </article>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-secondary flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> {posts.length} {posts.length === 1 ? 'Reply' : 'Replies'}
              </h2>

              {posts.map((p) => (
                <div key={p.id} className="bg-card border border-theme rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-secondary flex items-center gap-2">
                    <span className="font-semibold text-primary/90">{p.author_name || 'Member'}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="text-sm text-primary/90 whitespace-pre-wrap leading-relaxed">{p.body}</div>
                </div>
              ))}
            </section>

            {!thread.is_locked && (
              <form onSubmit={handleReply} className="bg-card border border-theme rounded-2xl p-5 space-y-3">
                <label className="block text-xs font-semibold text-secondary">Add a Reply</label>
                <textarea
                  required
                  rows={3}
                  maxLength={8000}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write your reply..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-primary border border-theme text-sm text-primary focus:outline-none focus:border-cyan-500"
                />
                {replyError && <p className="text-xs text-danger">{replyError}</p>}
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" disabled={replying} icon={<Send className="w-4 h-4" />}>
                    {replying ? 'Posting...' : 'Post Reply'}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </main>

      <footer className="w-full border-t border-theme py-6 text-center text-xs text-secondary bg-card/40">
        <span>Powered by </span>
        <a
          href="https://create.developa.me"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-cyan-400 hover:underline"
        >
          Developa
        </a>
        <span className="text-secondary/60"> · Launch your store in seconds</span>
      </footer>
    </div>
  );
}
