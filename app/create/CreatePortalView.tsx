'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Check, LogOut, ExternalLink, ArrowRight, Store, MessageSquare, Sparkles,
  MousePointerClick, Palette, Rocket, Settings2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import CreateForumForm from '@/app/components/forums/CreateForumForm';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import { getForumHref, type ForumSummary } from '@/lib/forums';
import { PLANS, type PlanTier } from '@/lib/plans';
import { SITE_TEMPLATES } from '@/lib/siteTemplates';

export default function CreatePortalView() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [mySites, setMySites] = useState<ForumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [host, setHost] = useState('');

  const loadMySites = useCallback(async () => {
    try {
      const res = await fetch('/api/forums?mine=1');
      if (res.ok) {
        const json = await res.json();
        setMySites((json.forums as ForumSummary[]) || []);
      }
    } catch (err) {
      console.warn('Failed to load user sites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setHost(window.location.host);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!active) return;
      if (currentUser) {
        setUser({ id: currentUser.id, email: currentUser.email });
        loadMySites();
      } else {
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        loadMySites();
      } else {
        setUser(null);
        setMySites([]);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadMySites]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: email.split('@')[0] },
          },
        });
        if (error) throw error;
        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email });
          loadMySites();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email });
          loadMySites();
        }
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMySites([]);
  };

  const scrollToStart = () => document.getElementById('start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const naira = (n: number) => '₦' + n.toLocaleString('en-NG');
  const tiers: PlanTier[] = ['free', 'pro', 'business'];

  return (
    <div className="g-font min-h-screen bg-primary text-primary">
      <DevelopaHeader />

      {/* Hero */}
      <section className="g-section pb-10 sm:pb-14">
        <div className="g-wrap text-center">
          <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full g-tonal-strong text-xs sm:text-sm font-medium text-accent mb-6">
            <Sparkles className="w-4 h-4" /> No coding. No designer. Free to start.
          </p>
          <h1 className="g-h1 max-w-3xl mx-auto">Create a website without coding experience</h1>
          <p className="g-lead max-w-xl mx-auto mt-5">
            Pick a look, add your products or topics, and share your own address. Your online store or community can be live in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button type="button" onClick={scrollToStart} className="btn-primary inline-flex items-center justify-center gap-2 !rounded-full px-7 py-3.5 text-base font-medium">
              Start free <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#how" className="btn-secondary inline-flex items-center justify-center !rounded-full px-7 py-3.5 text-base font-medium">See how it works</a>
          </div>
          <p className="text-xs sm:text-sm text-secondary mt-5">Your address will look like <span className="font-mono text-primary">yourname.developa.me</span></p>
        </div>
      </section>

      {/* Templates */}
      <section className="pb-10 sm:pb-14">
        <div className="g-wrap">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {SITE_TEMPLATES.slice(0, 4).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={scrollToStart}
                className="g-card overflow-hidden text-left hover:shadow-md transition"
              >
                <div className="h-20 sm:h-24 flex items-end p-3" style={{ background: `linear-gradient(135deg, ${t.accent_color}33, ${t.accent_color}0d)` }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: t.accent_color }}>
                    {t.site_mode === 'forum' ? <MessageSquare className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                  </span>
                </div>
                <div className="p-3.5">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-secondary mt-1 line-clamp-2">{t.tagline}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="g-wrap">
        <div className="g-tonal g-section px-5 sm:px-10">
          <h2 className="g-h2 text-center">Three steps. No technical skills.</h2>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mt-10">
            {[
              { icon: Palette, t: 'Choose a look', d: 'Start from a ready-made store or community design. Change colours and text anytime.' },
              { icon: MousePointerClick, t: 'Add your content', d: 'Type in your products, prices and bank details. Photos upload from your phone.' },
              { icon: Rocket, t: 'Share your link', d: 'Send your address on WhatsApp and Instagram. Customers order and pay by transfer.' },
            ].map((x, n) => (
              <div key={x.t} className="g-card p-6">
                <span className="w-11 h-11 rounded-full g-tonal-strong flex items-center justify-center text-accent"><x.icon className="w-5 h-5" /></span>
                <p className="text-xs text-secondary mt-4">Step {n + 1}</p>
                <h3 className="g-h3 mt-1">{x.t}</h3>
                <p className="text-sm text-secondary mt-2 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Start: sign in + create */}
      <section id="start" className="g-section scroll-mt-16">
        <div className="g-wrap-narrow">
          <h2 className="g-h2 text-center">{user ? 'Your sites' : 'Start your site'}</h2>
          <p className="g-lead text-center mt-3">
            {user ? `Signed in as ${user.email ?? 'your account'}.` : 'Create a free account, then launch your first site in a few clicks.'}
          </p>

          {!user && !loading && (
            <form onSubmit={handleAuth} className="g-card p-5 sm:p-7 mt-8 space-y-4">
              <div className="flex rounded-full g-tonal-strong p-1 text-sm font-medium">
                {(['signup', 'signin'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setAuthMode(m); setAuthError(''); }}
                    className={`flex-1 rounded-full py-2 transition ${authMode === m ? 'bg-card shadow-sm text-primary' : 'text-secondary'}`}
                  >
                    {m === 'signup' ? 'Create account' : 'Sign in'}
                  </button>
                ))}
              </div>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="input-box w-full bg-primary border border-theme text-primary focus:outline-none focus:border-accent" />
              <input type="password" required minLength={6} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="input-box w-full bg-primary border border-theme text-primary focus:outline-none focus:border-accent" />
              {authError && <p className="text-sm text-danger">{authError}</p>}
              <button type="submit" disabled={authLoading} className="btn-primary w-full !rounded-full py-3.5 text-base font-medium">
                {authLoading ? 'Please wait…' : authMode === 'signup' ? 'Create free account' : 'Sign in'}
              </button>
              <p className="text-xs text-secondary text-center">
                <Link href="/login" className="text-accent hover:underline">Forgot your password?</Link>
              </p>
            </form>
          )}

          {user && (
            <div className="mt-8 space-y-6">
              {mySites.length > 0 && (
                <div className="space-y-3">
                  {mySites.map((site) => (
                    <div key={site.id} className="g-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{site.name}</p>
                        <p className="text-xs text-secondary font-mono truncate">{site.slug}.developa.me</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link href={`/developer/manage?site=${site.slug}`} className="btn-primary inline-flex items-center gap-1.5 !rounded-full px-5 py-2.5 text-sm font-medium">
                          <Settings2 className="w-4 h-4" /> Admin
                        </Link>
                        <a href={getForumHref(site.slug, host)} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-1.5 !rounded-full px-5 py-2.5 text-sm font-medium">
                          Visit <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="g-card p-5 sm:p-7">
                <h3 className="g-h3 mb-4">{mySites.length > 0 ? 'Create another site' : 'Create your first site'}</h3>
                <CreateForumForm onCreated={() => { if (user) loadMySites(); }} />
              </div>

              <button type="button" onClick={handleSignOut} className="mx-auto flex items-center gap-1.5 text-sm text-secondary hover:text-primary">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="g-section pt-0">
        <div className="g-wrap">
          <h2 className="g-h2 text-center">Simple pricing</h2>
          <p className="g-lead text-center mt-3">Start free. Upgrade only when your shop grows.</p>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mt-10">
            {tiers.map((t) => {
              const p = PLANS[t];
              const featured = t === 'pro';
              return (
                <div key={t} className={`g-card p-6 sm:p-7 flex flex-col ${featured ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                  <h3 className="g-h3">{p.name}</h3>
                  <p className="mt-3">
                    <span className="text-3xl sm:text-4xl font-normal">{p.priceNgn === 0 ? 'Free' : naira(p.priceNgn)}</span>
                    {p.priceNgn > 0 && <span className="text-sm text-secondary"> / month</span>}
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm flex-1">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-2.5"><Check className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>{h}</span></li>
                    ))}
                  </ul>
                  <button type="button" onClick={scrollToStart} className={`${featured ? 'btn-primary' : 'btn-secondary'} mt-6 w-full !rounded-full py-3 text-sm font-medium`}>
                    {t === 'free' ? 'Start free' : 'Start free, upgrade later'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-secondary text-center mt-6">Paid plans are paid by bank transfer and activated by our team. We take no commission on your sales.</p>
        </div>
      </section>

      <DevelopaFooter />
    </div>
  );
}
