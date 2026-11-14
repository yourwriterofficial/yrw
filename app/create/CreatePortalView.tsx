'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers, Terminal, ShoppingBag, Check,
  LogOut, ExternalLink, Globe, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import CreateForumForm from '@/app/components/forums/CreateForumForm';
import { getForumHref, type ForumSummary } from '@/lib/forums';

export default function CreatePortalView() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [mySites, setMySites] = useState<ForumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
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

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col justify-between selection:bg-accent selection:text-black">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0c1017]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-mono font-bold text-xs">
              <Terminal className="w-4 h-4 text-accent" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-0.5 leading-none">
                <span className="font-black text-lg tracking-tight text-white">developa</span>
                <span className="text-accent font-bold text-sm">.me</span>
              </div>
              <span className="text-[9px] font-mono text-white/50 tracking-wider">
                Store & Community Builder
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-white/60 hidden sm:inline font-mono">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs flex items-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            ) : (
              <span className="text-xs text-accent font-mono">developa.me</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12 w-full flex-1">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-mono font-semibold">
            <Layers className="w-3.5 h-3.5" /> Zero-Code Mini SaaS Platform
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Launch Your Store or Community in Seconds
          </h1>
          <p className="text-sm sm:text-base text-white/70">
            Pick a Jumia, Temu, or Retail template. Sell products, accept manual bank transfers and pay-on-delivery, and connect your custom domain.
          </p>
        </div>

        {/* Auth Box (if not signed in) */}
        {!user && !loading && (
          <div className="max-w-md mx-auto bg-[#0d121c] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex gap-4 text-sm font-bold">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`pb-1 transition border-b-2 ${
                    authMode === 'signin' ? 'border-accent text-accent' : 'border-transparent text-white/50'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`pb-1 transition border-b-2 ${
                    authMode === 'signup' ? 'border-accent text-accent' : 'border-transparent text-white/50'
                  }`}
                >
                  Create Account
                </button>
              </div>
              <span className="text-[10px] font-mono text-accent">Direct Access</span>
            </div>

            <form onSubmit={handleAuth} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-white/60 mb-1 font-semibold">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-white/60 mb-1 font-semibold">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-accent"
                />
              </div>

              {authError && <p className="text-danger text-xs">{authError}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-accent hover:bg-accent text-black font-bold text-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? 'Authenticating...' : authMode === 'signup' ? 'Create Account & Continue' : 'Sign in to Builder'}
              </button>
            </form>
          </div>
        )}

        {/* Existing Stores Section (if signed in) */}
        {user && mySites.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-accent" /> My Live Stores & Communities ({mySites.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mySites.map((site) => {
                const href = getForumHref(site.slug, host);
                return (
                  <div key={site.id} className="bg-[#0d121c] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-white">{site.name}</h3>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-accent">
                          {site.site_mode}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-accent">{site.slug}.developa.me</p>
                      {site.custom_domain && (
                        <p className="text-xs font-mono text-accent flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {site.custom_domain}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="text-xs text-white/50">{site.member_count} members</span>
                      <div className="flex items-center gap-4">
                        <a
                          href={`/developer/manage?site=${site.slug}`}
                          className="text-xs font-bold text-white bg-accent hover:bg-accent-hover px-3 py-1.5 rounded-full"
                        >
                          Manage
                        </a>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-accent hover:text-accent flex items-center gap-1"
                        >
                          Visit <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Builder Form (Available for all, signs in upon submission if needed) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Plus className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-black">Launch a New Storefront</h2>
          </div>
          <CreateForumForm onCreated={() => { if (user) loadMySites(); }} />
        </div>

        {/* Pricing / Monetization Grid */}
        <div className="pt-8 border-t border-white/10 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold">Developa Mini SaaS Plans</h2>
            <p className="text-xs text-white/60">Choose the plan that fits your business scale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-[#0d121c] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Free Starter</span>
                <p className="text-2xl font-black">₦0 <span className="text-xs text-white/50 font-normal">/ month</span></p>
              </div>
              <ul className="text-xs space-y-2 text-white/70">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> Free [name].developa.me subdomain</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> Jumia, Temu, and Retail layouts</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> Manual Bank Transfer & Pay on Delivery</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-accent" /> Up to 5 product listings</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-accent/40 via-[#0d121c] to-amber-950/30 border border-amber-500/40 rounded-2xl p-6 space-y-4 relative overflow-hidden">
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                Popular
              </span>
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Developa Pro</span>
                <p className="text-2xl font-black">₦7,500 <span className="text-xs text-white/50 font-normal">/ month</span></p>
              </div>
              <ul className="text-xs space-y-2 text-white/80">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-amber-400" /> Connect your own Custom Domain (mystore.com)</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-amber-400" /> Unlimited product listings</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-amber-400" /> Google Drive high-resolution photo uploads</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-amber-400" /> 0% transaction commission</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-amber-400" /> Priority WhatsApp setup assistance</li>
              </ul>
              <a
                href="https://wa.me/2348121443666?text=Hi,%20I%20want%20to%20upgrade%20to%20Developa%20Pro."
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                Upgrade to Pro on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50 bg-[#07090e]">
        Powered by <strong className="text-accent">developa.me</strong> · The Zero-Code Store & Community Engine
      </footer>
    </div>
  );
}
