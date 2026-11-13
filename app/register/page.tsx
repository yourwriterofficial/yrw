'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import { Checkbox } from '@/app/components/ui/Checkbox';
import { SocialLoginButton } from '@/app/components/ui/SocialLoginButton';
import { NairaguideLoginButton } from '@/app/components/ui/NairaguideLoginButton';
import Card from '@/app/components/ui/Card';
import { Shell } from '@/app/components/ui/Shell';
import { showToast } from '@/app/components/ui/Toast';
import { REFERRAL_STORAGE_KEY } from '@/app/components/ReferralCapture';
import ThemeToggle from '@/app/components/ThemeToggle';
import { Terminal } from 'lucide-react';

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
  const [rememberMe, setRememberMe] = useState(false);
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
              {isDevelopa ? 'Client Engineering Portal' : 'Registration'}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-primary">
              {isDevelopa ? 'Create Client Account' : 'Create Account'}
            </h1>
            {isDevelopa && (
              <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                Register to track custom software sprints, milestone releases & repository handovers.
              </p>
            )}
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              type="text"
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              fullWidth
            />
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label="Remember me on this device"
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
              loadingText="Processing…"
              className={isDevelopa ? '!bg-cyan-500 hover:!bg-cyan-400 !text-black font-black uppercase tracking-wider' : ''}
            >
              {isDevelopa ? 'Create Engineering Account' : 'Register'}
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

          <SocialLoginButton onClick={handleGoogleSignUp} loading={loading} label="Google Authentication" />
          <NairaguideLoginButton developa={isDevelopa} label="Continue with your Nairaguide account" />

          <p className="text-center text-xs text-secondary mt-8">
            Already have an account?{' '}
            <a
              href={isDevelopa ? '/login?brand=developa' : '/login'}
              className={`${isDevelopa ? 'text-cyan-400 hover:text-cyan-300' : 'text-accent hover:text-accent-hover'} font-bold transition focus-ring rounded`}
            >
              Login securely
            </a>
          </p>
        </Card>
      </Shell>
    </div>
  );
}
