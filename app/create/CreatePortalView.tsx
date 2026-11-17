'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Check, LogOut, ExternalLink, ArrowRight, Store, MessageSquare,
  MousePointerClick, Palette, Rocket, Settings2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
const GuidedSetup = dynamic(() => import('@/app/create/GuidedSetup'), { loading: () => <div className="g-card p-7 text-center text-sm text-secondary">Loading your setup…</div> });
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import { getForumHref, type ForumSummary } from '@/lib/forums';
import { PLANS, BILLING_PERIODS, priceForPeriod, TRIAL_DAYS, PRUNE_NOTICE, type PlanTier } from '@/lib/plans';
import { PICKABLE_TEMPLATES as SITE_TEMPLATES } from '@/lib/siteTemplates';
import TemplateThumb from '@/app/developer/TemplateThumb';
import { HomeStyles, Reveal, RotatingWord, HeroBackdrop, PhoneMockup, FeatureMarquee, SignupBanner, StickySignupBar } from '@/app/create/HomeMotion';

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
  const [months, setMonths] = useState(1);

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
  const tiers: PlanTier[] = ['free', 'lite', 'pro', 'business', 'corporate'];

  return (
    <div className="g-font dv-theme min-h-screen bg-primary text-primary pb-20 sm:pb-0">
      <DevelopaHeader />

      <HomeStyles />
      {/* Hero */}
      <section className="relative g-section pb-8 sm:pb-12 overflow-hidden" style={{ paddingTop: '7rem' }}>
        <HeroBackdrop />
        <div className="g-wrap relative grid lg:grid-cols-[1.15fr_.85fr] gap-10 lg:gap-6 items-center">
          <div className="text-center lg:text-left">
            <p className="dv-pop inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full g-tonal-strong text-xs sm:text-sm font-medium text-accent mb-6" style={{ animation: 'dv-pop .6s ease both' }}>
              No coding. No designer. {TRIAL_DAYS} days of Pro free.
            </p>
            <h1 className="g-h1 max-w-3xl mx-auto lg:mx-0">
              Build your <RotatingWord words={['online store', 'community', 'booking site', 'digital shop']} /> even without knowing how to code
            </h1>
            <p className="g-lead max-w-xl mx-auto lg:mx-0 mt-5">
              Pick a look, add your products, and share your own address. Your site can be live in minutes, and customers can pay you online.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <button type="button" onClick={scrollToStart} className="dv-cta btn-primary inline-flex items-center justify-center gap-2 !rounded-full px-7 py-3.5 text-base font-medium">
                Start free <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#how" className="btn-secondary inline-flex items-center justify-center !rounded-full px-7 py-3.5 text-base font-medium">See how it works</a>
            </div>
            <p className="text-xs sm:text-sm text-secondary mt-5">Your address will look like <span className="font-mono text-primary">yourname.developa.me</span></p>
          </div>
          <PhoneMockup />
        </div>
      </section>

      <FeatureMarquee items={['Pay online with card or transfer', 'Orders on WhatsApp', 'Your own yourname.developa.me address', 'Ready-made themes', 'Coupons and discounts', 'Order emails and receipts', 'Bookings and memberships', 'Works great on phones']} />

      {/* Templates */}
      <section id="templates" className="pb-10 sm:pb-14 scroll-mt-20">
        <div className="g-wrap">
          <Reveal><h2 className="g-h2 text-center">Pick a look</h2></Reveal>
          <p className="g-lead text-center max-w-xl mx-auto mt-3 mb-8">Every theme is a fully working site you can try before you choose.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {SITE_TEMPLATES.slice(0, 8).map((t) => (
              <Link key={t.id} href={`/developer/preview/${t.id}`} className="g-card dv-lift overflow-hidden text-left block">
                <TemplateThumb t={t} />
                <div className="p-3.5">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-secondary mt-1 line-clamp-2">{t.tagline}</p>
                  <p className="text-xs font-medium text-accent mt-2">Preview this site</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/developer/templates" className="btn-secondary inline-flex items-center gap-2 !rounded-full px-7 py-3.5 text-base font-medium">
              Browse all {SITE_TEMPLATES.length} themes <ArrowRight className="w-4 h-4" />
            </Link>
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
              { icon: Rocket, t: 'Share your link', d: 'Send your address on WhatsApp and Instagram. Customers order and pay online.' },
            ].map((x, n) => (
              <Reveal key={x.t} delay={n * 120}><div className="g-card dv-lift p-6 h-full">
                <span className="w-11 h-11 rounded-full g-tonal-strong flex items-center justify-center text-accent"><x.icon className="w-5 h-5" /></span>
                <p className="text-xs text-secondary mt-4">Step {n + 1}</p>
                <h3 className="g-h3 mt-1">{x.t}</h3>
                <p className="text-sm text-secondary mt-2 leading-relaxed">{x.d}</p>
              </div></Reveal>
            ))}
          </div>
        </div>
      </section>

      <SignupBanner trialDays={TRIAL_DAYS} onStart={scrollToStart} />

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

              <div>
                <h3 className="g-h3 mb-4">{mySites.length > 0 ? 'Create another site' : 'Create your first site'}</h3>
                <GuidedSetup onCreated={() => { if (user) loadMySites(); }} />
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
          <Reveal><h2 className="g-h2 text-center">Simple monthly pricing</h2></Reveal>
          <p className="g-lead text-center mt-3">Start free, with {TRIAL_DAYS} days of Pro to try everything. Pay month by month, or pay for longer and save.</p>
          <div className="mt-6 mx-auto flex w-fit rounded-full g-tonal-strong p-1 text-sm font-medium" role="tablist" aria-label="Billing period">
            {BILLING_PERIODS.map((b) => (
              <button
                key={b.months}
                type="button"
                role="tab"
                aria-selected={months === b.months}
                onClick={() => setMonths(b.months)}
                className={`px-3 sm:px-5 py-2 rounded-full transition whitespace-nowrap flex flex-col sm:flex-row items-center leading-tight ${months === b.months ? 'bg-card shadow-sm text-primary' : 'text-secondary'}`}
              >
                {b.label}{b.discountPct > 0 && <span className="sm:ml-1.5 text-[10px] sm:text-xs text-accent">save {b.discountPct}%</span>}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mt-10">
            {tiers.map((t) => {
              const p = PLANS[t];
              const featured = t === 'pro';
              return (
                <div key={t} className={`g-card dv-lift relative p-6 sm:p-7 flex flex-col ${featured ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                  {featured && <span className="absolute -top-3 left-6 rounded-full bg-[var(--accent)] text-white text-[11px] font-semibold px-3 py-1">Most popular</span>}
                  <h3 className="g-h3">{p.name}</h3>
                  <p className="mt-3">
                    <span className="text-3xl sm:text-4xl font-normal">{p.priceNgn === 0 ? 'Free' : naira(Math.round(priceForPeriod(t, months) / months))}</span>
                    {p.priceNgn > 0 && <span className="text-sm text-secondary"> / month</span>}
                  </p>
                  {p.priceNgn > 0 && months > 1 && (
                    <p className="text-xs text-secondary mt-1">{naira(priceForPeriod(t, months))} billed for {months} months</p>
                  )}
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
          <p className="text-xs text-secondary text-center mt-6">Pay for a paid plan monthly, with no long contract. When customers pay you online, a small processing fee applies.</p>
          <p className="text-xs text-secondary text-center mt-2 max-w-xl mx-auto">{PRUNE_NOTICE}</p>
        </div>
      </section>

      <StickySignupBar onStart={scrollToStart} trialDays={TRIAL_DAYS} />
      <DevelopaFooter />
    </div>
  );
}
