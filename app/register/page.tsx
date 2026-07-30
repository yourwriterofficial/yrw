'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Input } from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import { Checkbox } from '@/app/components/ui/Checkbox';
import { SocialLoginButton } from '@/app/components/ui/SocialLoginButton';
import { Card } from '@/app/components/ui/Card';
import { Shell } from '@/app/components/ui/Shell';
import { showToast } from '@/app/components/ui/Toast';
import { REFERRAL_STORAGE_KEY } from '@/app/components/ReferralCapture';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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
    router.push('/login');
    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const refCode = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const callbackUrl = `${window.location.origin}/auth/callback${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;
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
        <Card elevation={2} padding="lg" className="w-full">
          <div className="flex justify-end mb-4">
            <ThemeToggle compact />
          </div>
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 bg-success-bg text-success border border-success/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              Registration
            </div>
            <h1 className="text-2xl font-black tracking-tight text-primary">Create Account</h1>
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
            <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Processing…">
              Register
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

          <p className="text-center text-xs text-secondary mt-8">
            Already have an account?{' '}
            <a href="/login" className="text-accent hover:text-accent-hover font-bold transition focus-ring rounded">
              Login securely
            </a>
          </p>
        </Card>
      </Shell>
    </div>
  );
}
