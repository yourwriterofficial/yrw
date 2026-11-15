'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/app/components/ui/Button';
import { SocialLoginButton } from '@/app/components/ui/SocialLoginButton';
import { NairaguideLoginButton } from '@/app/components/ui/NairaguideLoginButton';
import { NetworkLoginButtons } from '@/app/components/ui/NetworkLoginButtons';
import AuthShell from '@/app/components/AuthShell';
import { showToast } from '@/app/components/ui/Toast';
import { REFERRAL_STORAGE_KEY } from '@/app/components/ReferralCapture';

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDevelopa, setIsDevelopa] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const brand = searchParams.get('brand');
      const ref = document.referrer;
      if (
        host.includes('developa.me') ||
        host.includes('developa.local') ||
        brand === 'developa' ||
        ref.includes('developa.me') ||
        ref.includes('/developer') ||
        ref.includes('/order/dev')
      ) {
        setIsDevelopa(true);
      }
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Please use a password of at least 8 characters.'); return; }
    setLoading(true);
    setError('');

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        full_name: fullName,
        is_admin: false,
      });

      const refCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (refCode) {
        await fetch('/api/auth/apply-referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authData.user.id, refCode }),
        }).catch(() => {});
      }
    }

    showToast('Registration successful! Please check your email to confirm.', 'success');
    router.push(isDevelopa ? '/login?brand=developa' : '/login');
    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const refCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const query = new URLSearchParams();
    if (refCode) query.set('ref', refCode);
    if (isDevelopa) query.set('brand', 'developa');
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const callbackUrl = `${window.location.origin}/auth/callback${queryString}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <AuthShell
      developa={isDevelopa}
      title="Create your account"
      subtitle={isDevelopa ? 'Track your project, milestones and files in one place.' : 'It takes a minute. You only pay when you order.'}
      footer={<>Already registered? <a href={isDevelopa ? '/login?brand=developa' : '/login'} className="text-accent font-semibold hover:underline">Log in</a></>}
      reassurances={['Free to join, no card needed', 'Your work and details stay private', 'Message us on WhatsApp any time']}
    >
      <SocialLoginButton onClick={handleGoogleSignUp} loading={loading} label="Continue with Google" />
      {isDevelopa ? (
        <NetworkLoginButtons />
      ) : (
        <NairaguideLoginButton developa={false} label="Continue with Nairaguide" />
      )}

      <div className="flex items-center gap-3 my-5 text-xs text-secondary">
        <span className="flex-1 h-px bg-[var(--border)]" /> or use email <span className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium mb-1.5">Full name</label>
          <input id="reg-name" type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-box w-full" />
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium mb-1.5">Email</label>
          <input id="reg-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-box w-full" />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium mb-1.5">Password <span className="text-secondary font-normal">(8+ characters)</span></label>
          <div className="relative">
            <input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input-box w-full pr-14" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-primary">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-danger" role="alert">{error}</p>}

        <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Creating account…">Create account</Button>
        <p className="text-xs text-secondary text-center">We&apos;ll email you a link to confirm your address.</p>
      </form>
    </AuthShell>
  );
}
