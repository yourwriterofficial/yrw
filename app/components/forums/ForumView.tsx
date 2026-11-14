'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Users, Plus, Pin, Lock, UserPlus, Check, Settings, ShoppingBag, ShieldCheck, X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Button from '@/app/components/ui/Button';
import StorefrontView from '@/app/components/forums/StorefrontView';
import SiteAdSpace from '@/app/components/forums/SiteAdSpace';
import SellerChat from '@/app/components/forums/SellerChat';
import SitePwa from '@/app/components/forums/SitePwa';
import ThreadListThemes, { FORUM_LAYOUTS } from '@/app/components/forums/ThreadListThemes';
import { getTemplateById } from '@/lib/siteTemplates';
import StoreManagerModal from '@/app/components/forums/StoreManagerModal';
import ForumMembershipModal, {
  type MyMembershipStatus,
  type PublicMembershipTier,
} from '@/app/components/forums/ForumMembershipModal';
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
  const [infoPageModal, setInfoPageModal] = useState<{ title: string; body: string } | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isMembersOnly, setIsMembersOnly] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [joining, setJoining] = useState(false);
  const [isSubdomain, setIsSubdomain] = useState(false);
  const [ads, setAds] = useState<PlatformAd[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<PublicMembershipTier[]>([]);
  const [myMembership, setMyMembership] = useState<MyMembershipStatus | null>(null);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);

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

  const loadMemberships = useCallback(async () => {
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/memberships`);
      if (!res.ok) return;
      const data = await res.json();
      const tiers = Array.isArray(data.tiers)
        ? (data.tiers as (PublicMembershipTier & { is_active?: boolean })[]).filter((t) => t.is_active !== false)
        : [];
      setMembershipTiers(tiers);
      setMyMembership(data.myMembership || null);
    } catch {
      // Tolerant if memberships migration is not yet applied
    }
  }, [slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setIsSubdomain(!!extractDevelopaSubdomain(window.location.host));
      await Promise.all([loadForum(), loadMemberships()]);
    })();
    return () => { active = false; };
  }, [loadForum, loadMemberships]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    fetch(`/api/forums/${encodeURIComponent(slug)}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || '',
        utm_source: params.get('utm_source') || '',
      }),
    }).catch(() => {});
  }, [slug]);

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
        body: JSON.stringify({ title, body, is_members_only: isMembersOnly }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(data.error || 'Could not post thread.');
        return;
      }
      setTitle('');
      setBody('');
      setIsMembersOnly(false);
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
      <div className="max-w-6xl mx-auto px-4"><SiteAdSpace slug={slug} placement="banner" /></div>

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
                    {forum.verified && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified seller
                      </span>
                    )}
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
                  {showForum && membershipTiers.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => setMembershipModalOpen(true)}
                    >
                      {myMembership?.status === 'active' ? 'VIP Member' : 'Memberships'}
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
                    {(isOwner || ['owner', 'manager', 'support'].includes(forum.my_role || '')) && membershipTiers.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-secondary select-none">
                        <input
                          type="checkbox"
                          checked={isMembersOnly}
                          onChange={(e) => setIsMembersOnly(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Members-only discussion
                      </label>
                    )}
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
                  ) : FORUM_LAYOUTS.includes(getTemplateById(forum.template_id).layout_style) ? (
                    <ThreadListThemes
                      threads={threads}
                      layout={getTemplateById(forum.template_id).layout_style}
                      accent={forum.accent_color || getTemplateById(forum.template_id).accent_color}
                      threadHref={threadHref}
                    />
                  ) : (
                    threads.map((t) => (
                      <Link
                        key={t.id}
                        href={threadHref(t.id)}
                        className="block bg-card border border-theme hover:border-accent/40 rounded-2xl p-5 transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-primary text-base flex items-center flex-wrap gap-2">
                            {t.is_pinned && <Pin className="w-3.5 h-3.5 text-accent shrink-0" />}
                            {t.is_locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            <span>{t.title}</span>
                            {t.is_members_only && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                                Members only
                              </span>
                            )}
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

            {membershipModalOpen && (
              <ForumMembershipModal
                forum={forum}
                tiers={membershipTiers}
                myMembership={myMembership}
                onClose={() => setMembershipModalOpen(false)}
                onJoined={async () => {
                  await Promise.all([loadForum(), loadMemberships()]);
                }}
              />
            )}
          </>
        )}
      </main>

      <div className="max-w-6xl mx-auto px-4"><SiteAdSpace slug={slug} placement="footer" /></div>
      {forum && siteMode !== 'forum' && <SellerChat slug={slug} siteName={forum.name} />}
      {ads.filter((a) => a.placement === 'footer').slice(0, 1).map((a) => <AdStrip key={a.id} ad={a} />)}

      {forum && (() => {
        const infoPages = [
          { title: 'About', body: forum.page_about?.trim() || '' },
          { title: 'Delivery', body: forum.page_delivery?.trim() || '' },
          { title: 'Returns', body: forum.page_returns?.trim() || '' },
          { title: 'Contact', body: forum.page_contact_note?.trim() || '' },
        ].filter((p) => p.body.length > 0);
        const socialEntries = ([
          ['Instagram', forum.social_links?.instagram],
          ['TikTok', forum.social_links?.tiktok],
          ['Facebook', forum.social_links?.facebook],
          ['X', forum.social_links?.x],
          ['YouTube', forum.social_links?.youtube],
          ['Website', forum.social_links?.website],
        ] as const).filter(([, url]) => typeof url === 'string' && /^https:\/\//i.test(url));
        const showPowered = !(forum.hide_branding && (forum as unknown as { plan_effective?: string }).plan_effective !== 'free');
        if (infoPages.length === 0 && socialEntries.length === 0 && !showPowered) return null;
        return (
          <footer className="w-full border-t border-theme py-6 px-4 text-center text-xs text-secondary bg-card/40 space-y-3">
            {infoPages.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {infoPages.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => setInfoPageModal(p)}
                    className="hover:text-primary font-medium underline-offset-4 hover:underline min-h-9 px-2 cursor-pointer"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}
            {socialEntries.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {socialEntries.map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-medium min-h-9 inline-flex items-center px-1"
                  >
                    {label}
                  </a>
                ))}
              </div>
            )}
            {showPowered && (
              <div>
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
              </div>
            )}
          </footer>
        );
      })()}

      {infoPageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInfoPageModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="g-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <h2 className="g-h3">{infoPageModal.title}</h2>
              <button
                type="button"
                onClick={() => setInfoPageModal(null)}
                aria-label="Close"
                className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center text-secondary hover:text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-primary whitespace-pre-line leading-relaxed">{infoPageModal.body}</p>
          </div>
        </div>
      )}

      {forum && (
        <SitePwa
          slug={slug}
          siteName={forum.name}
          accent={forum.accent_color}
          installEnabled={forum.plugins?.appinstall !== false}
          canPush={
            (isOwner || ['owner', 'manager', 'packer'].includes(forum.my_role || '')) &&
            ['pro', 'business'].includes((forum as unknown as { plan_effective?: string }).plan_effective || '')
          }
        />
      )}
    </div>
  );
}
