'use client';

import { useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError('No user returned');
      setLoading(false);
      return;
    }

    const isAdminEmail = user.email?.toLowerCase() === 'yourwriterofficial@gmail.com';

    // Best-effort profile sync — never block or error the login on this.
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        is_admin: isAdminEmail,
      }, { onConflict: 'id' });
    } catch { /* non-fatal */ }

    await new Promise(resolve => setTimeout(resolve, 400));

    if (isAdminEmail) {
      window.location.href = '/admin';
    } else if (nextPath && nextPath.startsWith('/')) {
      window.location.href = nextPath;
    } else {
      window.location.href = '/dashboard/client';
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary text-primary flex items-center justify-center p-4 font-['Inter']">
      <div className="bg-secondary border border-theme p-8 rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 bg-accent/10 text-accent border border-accent/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
            Client Portal
          </div>
          <h1 className="text-2xl font-black tracking-tight">Welcome Back</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2 ml-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-box"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-secondary mb-2 ml-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-box"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-xl hover:bg-accent-hover transition mt-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-theme"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-black tracking-widest uppercase">
            <span className="bg-secondary px-4 text-secondary">Or Continue With</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-black font-black uppercase tracking-widest text-[11px] py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google Authentication
        </button>

        <p className="text-center text-xs text-secondary mt-8">
          Don't have an account?{' '}
          <a href="/register" className="text-accent hover:text-accent-hover font-bold transition">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}