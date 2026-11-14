'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Users, Plus, Pin, Lock, UserPlus, Check, Settings, ShoppingBag,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Button from '@/app/components/ui/Button';
import StorefrontView from '@/app/components/forums/StorefrontView';
import StoreManagerModal from '@/app/components/forums/StoreManagerModal';
import {
  extractDevelopaSubdomain, type ForumSummary, type ForumThread, type SiteProduct,
} from '@/lib/forums';

interface PlatformAd { id: string; title: string; body: string; link_url: string; image_url: string; placement: 'banner' | 'footer' }

function AdStrip({ ad }: { ad: PlatformAd }) {
  const inner = (
    <span className="flex items-center justify-center gap-3 text-sm">
      {ad.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
      )}
      <span><strong className="font-medium">{ad.title}</strong>{ad.body ? <span className="text-secondary"> · {ad.body}</span> : null}</span>
      <span className="text-[11px] text-secondary border border-theme rounded px-1.5 py-0.5">Ad</span>
    </span>
  );
  return ad.link_url ? (
    <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block px-4 py-2.5 bg-card hover:bg-hover transition-colors border-b border-theme">{inner}</a>
  ) : (
    <div className="px-4 py-2.5 bg-card border-b border-theme">{inner}</div>
  );
}

export default function ForumView({ slug }: { slug: string }) {
  const [forum, setForum] = useState<ForumSummary | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'store' | 'forum'>('forum');
  const [managerOpen, setManagerOpen] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [joining, setJoining] = useState(false);
  const [isSubdomain, setIsSubdomain] = useState(false);
  const [ads, setAds] = useState<PlatformAd[]>([]);

  const loadForum = useCallback(async () => {
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Site not found.');
        return;
      }
      setError('');
      setForum(data.forum);
      setThreads(data.threads || []);
      setProducts(data.products || []);
      setAds(data.ads || []);
      setIsMember(!!data.isMember);
      setIsOwner(!!data.isOwner);
      setActiveTab(data.forum?.site_mode === 'forum' ? 'forum' : 'store');
    } catch {
      setError('Failed to load site.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setIsSubdomain(!!extractDevelopaSubdomain(window.location.host));
      await loadForum();
    })();
    return () => { active = false; };
  }, [loadForum]);

  const handleJoinToggle = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsMember(!!data.joined);
        loadForum();
      } else {
        setPostError(data.error || 'Sign in to join.');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError('');
    setPosting(true);
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(data.error || 'Could not post thread.');
        return;
      }
      setTitle('');
      setBody('');
      setShowComposer(false);
      setThreads((prev) => [data.thread, ...prev]);
      setForum((prev) => (prev ? { ...prev, thread_count: prev.thread_count + 1 } : prev));
    } catch {
      setPostError('Network error while creating thread.');
    } finally {
      setPosting(false);
    }
  };

  const threadHref = (threadId: string) => (isSubdomain ? `/t/${threadId}` : `/forums/${slug}/t/${threadId}`);
  const directoryHref = isSubdomain ? 'https://developa.me/forums' : '/forums';
  const siteMode = forum?.site_mode || 'forum';
  const showStore = siteMode === 'store' || (siteMode === 'both' && activeTab === 'store');
  const showForum = siteMode === 'forum' || (siteMode === 'both' && activeTab === 'forum');

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col justify-between">
      {(forum as unknown as { announcement_active?: boolean; announcement?: string })?.announcement_active &&
        (forum as unknown as { announcement?: string })?.announcement && (
          <div className="px-4 py-2.5 text-center text-sm font-medium text-white" style={{ background: forum?.accent_color || 'var(--accent)' }}>
            {(forum as unknown as { announcement?: string }).announcement}
          </div>
        )}
      {ads.filter((a) => a.placement === 'banner').slice(0, 1).map((a) => <AdStrip key={a.id} ad={a} />)}

      {/* Store Owner Toolbar */}
      {isOwner && (
        <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-accent/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="font-bold text-primary">Store Owner Mode</span>
            <span className="hidden sm:inline text-secondary">· You are viewing your live site</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="px-3 py-1 rounded-lg bg-accent hover:bg-accent text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Manage Store & Products
            </button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-6 w-full flex-1">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-card border border-theme animate-pulse" />
            <div className="h-24 rounded-2xl bg-card border border-theme animate-pulse" />
          </div>
        ) : error || !forum ? (
          <div className="bg-card border border-theme rounded-2xl p-8 text-center space-y-3">
            <h1 className="text-xl font-bold">{error || 'Site not found'}</h1>
            <p className="text-sm text-secondary">
              Want to claim <span className="font-mono text-accent">{slug}.developa.me</span>?
            </p>
            <Button href={directoryHref} variant="primary">
              Launch Store or Forum
            </Button>
          </div>
        ) : (
          <>
            <header className="bg-card border border-theme rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: forum.accent_color || '#06b6d4' }}
                    />
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{forum.name}</h1>
                    {!forum.is_public && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold">
                        <Lock className="w-3 h-3" /> Private
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-accent">{forum.slug}.developa.me</p>
                  {forum.description && (
                    <p className="text-sm text-secondary pt-1">{forum.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {isOwner && (
                    <Button
                      variant="secondary"
                      onClick={() => setManagerOpen(true)}
                      icon={<Settings className="w-4 h-4 text-accent" />}
                    >
                      Manage Site
                    </Button>
                  )}
                  {!isOwner && forum.is_public && (
                    <Button
                      variant="secondary"
                      onClick={handleJoinToggle}
                      disabled={joining}
                      icon={isMember ? <Check className="w-4 h-4 text-emerald-400" /> : <UserPlus className="w-4 h-4" />}
                    >
                      {isMember ? 'Joined' : 'Join'}
                    </Button>
                  )}
                  {showForum && (
                    <Button
                      variant="primary"
                      onClick={() => setShowComposer((prev) => !prev)}
                      icon={<Plus className="w-4 h-4" />}
                    >
                      New Thread
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-theme">
                <div className="flex items-center gap-5 text-xs text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {forum.member_count} members
                  </span>
                  {siteMode !== 'store' && (
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> {forum.thread_count} threads
                    </span>
                  )}
                  {siteMode !== 'forum' && (
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" /> {products.filter((p) => p.is_active).length} products
                    </span>
                  )}
                </div>

                {siteMode === 'both' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('store')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        activeTab === 'store' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-secondary hover:text-primary'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Storefront
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('forum')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        activeTab === 'forum' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-secondary hover:text-primary'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Community
                    </button>
                  </div>
                )}
              </div>
            </header>

            {showStore && <StorefrontView site={forum} products={products} />}

            {showForum && (
              <>
                {showComposer && (
                  <form onSubmit={handleCreateThread} className="bg-card border border-accent/30 rounded-2xl p-6 space-y-4">
                    <h2 className="font-bold text-base">Start a Discussion</h2>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Thread title"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-primary border border-theme text-sm text-primary focus:outline-none focus:border-accent"
                    />
                    <textarea
                      required
                      rows={4}
                      maxLength={8000}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your post..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-primary border border-theme text-sm text-primary focus:outline-none focus:border-accent"
                    />
                    {postError && <p className="text-xs text-danger">{postError}</p>}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setShowComposer(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" disabled={posting}>
                        {posting ? 'Posting...' : 'Publish Thread'}
                      </Button>
                    </div>
                  </form>
                )}

                <section className="space-y-3">
                  {threads.length === 0 ? (
                    <div className="bg-card border border-theme rounded-2xl p-8 text-center text-sm text-secondary">
                      No discussions yet. Start the first thread above.
                    </div>
                  ) : (
                    threads.map((t) => (
                      <Link
                        key={t.id}
                        href={threadHref(t.id)}
                        className="block bg-card border border-theme hover:border-accent/40 rounded-2xl p-5 transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-primary text-base flex items-center gap-2">
                            {t.is_pinned && <Pin className="w-3.5 h-3.5 text-accent shrink-0" />}
                            {t.is_locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            <span>{t.title}</span>
                          </h3>
                          <span className="text-xs text-secondary flex items-center gap-1 shrink-0">
                            <MessageSquare className="w-3.5 h-3.5" /> {t.reply_count}
                          </span>
                        </div>
                        <p className="text-xs text-secondary line-clamp-2">{t.body}</p>
                        <div className="text-[11px] text-secondary/80 flex items-center gap-2 pt-1">
                          <span className="font-medium text-primary/90">{t.author_name || 'Member'}</span>
                          <span>·</span>
                          <span>{formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </section>
              </>
            )}

            {managerOpen && (
              <StoreManagerModal
                site={forum}
                products={products}
                onClose={() => setManagerOpen(false)}
                onUpdated={loadForum}
              />
            )}
          </>
        )}
      </main>

      {ads.filter((a) => a.placement === 'footer').slice(0, 1).map((a) => <AdStrip key={a.id} ad={a} />)}

      {/* Powered by Developa Footer. Hiding it is a paid feature, so it is enforced here too. */}
      {!(forum?.hide_branding && (forum as unknown as { plan_effective?: string })?.plan_effective !== 'free') && (
        <footer className="w-full border-t border-theme py-6 text-center text-xs text-secondary bg-card/40">
          <span>Powered by </span>
          <a
            href="https://developa.me"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-accent hover:underline"
          >
            Developa
          </a>
          <span className="text-secondary/60"> · Launch your store in seconds</span>
        </footer>
      )}
    </div>
  );
}
