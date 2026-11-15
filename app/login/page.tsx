'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/app/components/ui/Button';
import { SocialLoginButton } from '@/app/components/ui/SocialLoginButton';
import { NairaguideLoginButton } from '@/app/components/ui/NairaguideLoginButton';
import { SubskriptionLoginButton } from '@/app/components/ui/SubskriptionLoginButton';
import AuthShell from '@/app/components/AuthShell';

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
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isDevelopa, setIsDevelopa] = useState(false);
  // Seeded from ?message= so an expired or already-used email link explains
  // itself. /auth/callback and /auth/confirm both redirect here with that
  // param on failure, but nothing read it — the user just landed on a blank
  // login form with no idea why their link hadn't worked.
  const [error, setError] = useState(searchParams.get('message') ?? '');
  const resetDone = searchParams.get('reset') === 'success';

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
    } else if (nextPath && nextPath.startsWith('/') && (!isDevelopa || !nextPath.startsWith('/dashboard'))) {
      window.location.href = nextPath;
    } else {
      window.location.href = isDevelopa ? '/create' : '/dashboard/client';
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email above first, then tap "Forgot password?".'); return; }
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });
    if (resetError) setError(resetError.message);
    else setResetSent(true);
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
    <AuthShell
      developa={isDevelopa}
      title="Log in"
      subtitle={isDevelopa ? 'Manage your sites, orders and storefront.' : 'See your orders and download your files.'}
      footer={<>New here? <a href={isDevelopa ? '/register?brand=developa' : '/register'} className="text-accent font-semibold hover:underline">Create a free account</a></>}
    >
      <SocialLoginButton onClick={handleGoogleLogin} loading={loading} label="Continue with Google" />
      <NairaguideLoginButton next={nextPath} developa={isDevelopa} label="Continue with Nairaguide" />
      {isDevelopa && <SubskriptionLoginButton next={nextPath} />}

      <div className="flex items-center gap-3 my-5 text-xs text-secondary">
        <span className="flex-1 h-px bg-[var(--border)]" /> or use email <span className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">Email</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-box w-full" />
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label htmlFor="login-password" className="text-sm font-medium">Password</label>
            <button type="button" onClick={handleForgotPassword} className="text-xs text-accent hover:underline">Forgot password?</button>
          </div>
          <div className="relative">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-box w-full pr-14" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-primary">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {resetDone && !resetSent && <p className="text-sm text-success" role="status">Your password was updated. Log in with the new one.</p>}
        {resetSent && <p className="text-sm text-success">We sent a reset link to {email}. Check your inbox and spam folder.</p>}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}

        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Logging in…">Log in</Button>
      </form>
    </AuthShell>
  );
}
