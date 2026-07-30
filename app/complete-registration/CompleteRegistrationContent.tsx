'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Shell } from '@/app/components/ui/Shell';

export default function CompleteRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const orderId = searchParams.get('orderId') || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!orderId) {
      router.push('/');
    }
  }, [orderId, router]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Pointing directly to the callback to establish the session and trigger the success banner
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: email.split('@')[0],
          order_id: orderId,
        },
      },
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('An account with this email already exists. Please log in instead.');
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: email.split('@')[0],
        is_admin: false,
      });
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/login?message=Please check your email to verify your account before logging in.');
    }, 3000);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Shell size="sm" className="w-full max-w-md">
          <Card elevation={2} padding="lg" className="text-center">
            <div className="w-16 h-16 bg-success-bg border border-success/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-primary mb-2 tracking-tight">Check Your Email</h2>
            <p className="text-sm text-secondary mb-6 leading-relaxed">
              We&apos;ve sent a secure verification link to <strong className="text-primary">{email}</strong>. Please verify your email address to access your client dashboard.
            </p>
            <p className="text-[10px] uppercase tracking-widest text-tertiary font-bold">Redirecting to login...</p>
          </Card>
        </Shell>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Shell size="sm" className="w-full max-w-md">
        <Card elevation={2} padding="lg" className="w-full">
          <div className="inline-block px-3 py-1 bg-success-bg text-success border border-success/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
            Final Step
          </div>
          <h1 className="text-2xl font-black text-primary mb-2 tracking-tight">Secure Your Account</h1>
          <p className="text-xs text-secondary leading-relaxed mb-8">
            Order <span className="text-accent font-bold">{orderId}</span> is confirmed in our system. Set a password below to track your project&apos;s progress.
          </p>
          <form onSubmit={handleCreateAccount} className="space-y-4">
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
            <Input
              type="password"
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
            />
            {error && (
              <p className="text-danger text-xs font-bold bg-danger-bg p-3 rounded-lg border border-danger/20">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" fullWidth loading={loading} loadingText="Encrypting…">
              Create Account
            </Button>
          </form>
        </Card>
      </Shell>
    </div>
  );
}
