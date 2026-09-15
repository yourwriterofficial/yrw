'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import { SocialLoginButton } from '@/app/components/ui/SocialLoginButton';
import Card from '@/app/components/ui/Card';
import { Shell } from '@/app/components/ui/Shell';
import ThemeToggle from '@/app/components/ThemeToggle';
import { Terminal } from 'lucide-react';

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
  const [isDevelopa, setIsDevelopa] = useState(false);
  // Seeded from ?message= so an expired or already-used email link explains
  // itself. /auth/callback and /auth/confirm both redirect here with that
  // param on failure, but nothing read it — the user just landed on a blank
  // login form with no idea why their link hadn't worked.
  const [error, setError] = useState(searchParams.get('message') ?? '');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const brand = searchParams.get('brand');
      const ref = document.referrer;
      const savedBrand = localStorage.getItem('developa_brand');
      if (
        host.includes('developa.me') ||
        host.includes('developa.local') ||
        brand === 'developa' ||
        nextPath?.includes('dev') ||
        ref.includes('developa.me') ||
        ref.includes('/developer') ||
        ref.includes('/order/dev') ||
        savedBrand === 'developa'
      ) {
        setIsDevelopa(true);
        localStorage.setItem('developa_brand', 'developa');
      }
    }
  }, [searchParams, nextPath]);

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

    const isBootstrapAdminEmail = user.email?.toLowerCase() === 'yourwriterofficial@gmail.com';

    // Best-effort profile sync — never block or error the login on this. Only ever
    // force is_admin TRUE for the bootstrap email (self-healing on first login);
    // never force it false, or every login by an admin promoted via /admin/users
    // would silently downgrade them back to a regular client on their next visit.
    let isAdmin = isBootstrapAdminEmail;
    try {
      const upsertPayload: { id: string; full_name: string; is_admin?: boolean } = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
      };
      if (isBootstrapAdminEmail) upsertPayload.is_admin = true;
      await supabase.from('profiles').upsert(upsertPayload, { onConflict: 'id' });
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      isAdmin = profile?.is_admin === true;
    } catch { /* non-fatal */ }

    await new Promise(resolve => setTimeout(resolve, 400));

    if (isAdmin) {
      window.location.href = '/admin';
    } else if (nextPath && nextPath.startsWith('/')) {
      window.location.href = nextPath;
    } else {
      window.location.href = isDevelopa ? '/dashboard/client?brand=developa' : '/dashboard/client';
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const callbackRedirect = isDevelopa
      ? `${window.location.origin}/auth/callback?brand=developa`
      : `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackRedirect },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Shell size="sm" className="w-full max-w-md">
        <Card elevation={2} padding="lg" className={`w-full ${isDevelopa ? 'border-cyan-500/20 shadow-xl shadow-cyan-950/20' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            {isDevelopa ? (
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-black">
                <Terminal className="w-4 h-4" />
                <span>developa.me</span>
              </div>
            ) : <div />}
            <ThemeToggle compact />
          </div>
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 ${
              isDevelopa
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono'
                : 'bg-success-bg text-success border border-success/20'
            }`}>
              {isDevelopa ? 'Client Engineering Portal' : 'Client Portal'}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-primary">
              {isDevelopa ? 'Engineering Sign-In' : 'Welcome Back'}
            </h1>
            {isDevelopa && (
              <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                Log in to review architecture sprints, repository releases & milestone deliverables.
              </p>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            {error && (
              <p className="text-danger text-xs font-bold bg-danger-bg p-3 rounded-lg border border-danger/20">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              loadingText="Authenticating…"
              className={isDevelopa ? '!bg-cyan-500 hover:!bg-cyan-400 !text-black font-black uppercase tracking-wider' : ''}
            >
              {isDevelopa ? 'Access Engineering Portal' : 'Secure Login'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-theme" />
            </div>
            <div className="relative flex justify-center text-[10px] font-black tracking-widest uppercase">
              <span className="bg-card px-4 text-secondary">Or Continue With</span>
            </div>
          </div>

          <SocialLoginButton onClick={handleGoogleLogin} loading={loading} label="Google Authentication" />

          <p className="text-center text-xs text-secondary mt-8">
            Don&apos;t have an account?{' '}
            <a
              href={isDevelopa ? '/register?brand=developa' : '/register'}
              className={`${isDevelopa ? 'text-cyan-400 hover:text-cyan-300' : 'text-accent hover:text-accent-hover'} font-bold transition focus-ring rounded`}
            >
              {isDevelopa ? 'Create client account' : 'Create one'}
            </a>
          </p>
        </Card>
      </Shell>
    </div>
  );
}
