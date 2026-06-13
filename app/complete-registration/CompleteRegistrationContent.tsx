'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-['Inter']">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-8 rounded-3xl max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Check Your Email</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            We've sent a secure verification link to <strong className="text-white">{email}</strong>. Please verify your email address to access your client dashboard.
          </p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-['Inter']">
      <div className="bg-[#0a0a0a] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
        <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Final Step</div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Secure Your Account</h1>
        <p className="text-xs text-zinc-400 leading-relaxed mb-8">
          Order <span className="text-emerald-400 font-bold">{orderId}</span> is confirmed in our system. Set a password below to track your project's progress.
        </p>
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition"
              required
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Password</label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-black font-black uppercase text-[11px] tracking-[1.5px] py-4 rounded-xl hover:bg-emerald-400 transition mt-2 disabled:opacity-50"
          >
            {loading ? 'Encrypting...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}