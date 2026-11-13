'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Button from '@/app/components/ui/Button';
import AuthShell from '@/app/components/AuthShell';

type Phase = 'checking' | 'ready' | 'expired' | 'done';

/**
 * Last step of "forgot password" / "set a password".
 *
 * The email link normally goes through /auth/confirm, which signs the person in on
 * the server and lands them here. This page also copes with the older link styles
 * (a ?code= from the client flow, or tokens in the URL hash) and, if nothing
 * produces a session, lets them ask for a fresh link right here instead of
 * bouncing them to the login page with an error.
 */
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordInner />
    </Suspense>
  );
}

function UpdatePasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // request-a-new-link form (shown when the link is expired)
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (ok: boolean) => { if (!cancelled) setPhase(ok ? 'ready' : 'expired'); };

    (async () => {
      // 1. Already signed in (the normal path after /auth/confirm).
      const { data: first } = await supabase.auth.getSession();
      if (first.session) return settle(true);

      // 2. Client-flow link: ?code=... still needs exchanging in this browser.
      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) return settle(true);
      }

      // 3. Hash-token or slow session restore: give the client a few seconds to produce one.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          sub.subscription.unsubscribe();
          settle(true);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      timer = setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        sub.subscription.unsubscribe();
        settle(!!data.session);
      }, 4000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unsubscribe) unsubscribe();
    };
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { password_is_email: false } });
    if (updateError) {
      setError(
        /same|different/i.test(updateError.message)
          ? 'Choose a password you have not used before.'
          : /session/i.test(updateError.message)
          ? 'This link has expired. Please request a new one.'
          : updateError.message
      );
      if (/session/i.test(updateError.message)) setPhase('expired');
      setBusy(false);
      return;
    }

    setPhase('done');
    await supabase.auth.signOut();
    setTimeout(() => router.push('/login?reset=success'), 1200);
  };

  const requestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });
    if (resetError) setError(resetError.message);
    else setSent(true);
    setBusy(false);
  };

  if (phase === 'checking') {
    return (
      <AuthShell developa={false} title="One moment" subtitle="Checking your link…" footer="">
        <div className="h-6" />
      </AuthShell>
    );
  }

  if (phase === 'done') {
    return (
      <AuthShell developa={false} title="Password updated" subtitle="Taking you to the sign-in page…" footer="">
        <p className="text-sm text-secondary">You can now log in with your new password.</p>
      </AuthShell>
    );
  }

  if (phase === 'expired') {
    return (
      <AuthShell
        developa={false}
        title="This link has expired"
        subtitle="Reset links work once and expire after a while. Enter your email and we will send a new one."
        footer={<a href="/login" className="text-accent font-semibold hover:underline">Back to log in</a>}
      >
        {sent ? (
          <p className="text-sm">We sent a new link to <strong>{email}</strong>. Open it on this device, and check your spam folder if it does not arrive.</p>
        ) : (
          <form onSubmit={requestNewLink} className="space-y-4">
            <div>
              <label htmlFor="np-email" className="block text-sm font-medium mb-1.5">Email</label>
              <input id="np-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-box w-full" />
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" size="lg" fullWidth loading={busy} loadingText="Sending…">Send a new link</Button>
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      developa={false}
      title="Set a new password"
      subtitle="Choose a password you will remember. You will use it to log in."
      footer={<a href="/login" className="text-accent font-semibold hover:underline">Back to log in</a>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="np-pass" className="block text-sm font-medium mb-1.5">New password <span className="text-secondary font-normal">(8+ characters)</span></label>
          <div className="relative">
            <input id="np-pass" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input-box w-full pr-14" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-primary">{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div>
          <label htmlFor="np-confirm" className="block text-sm font-medium mb-1.5">Confirm password</label>
          <input id="np-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input-box w-full" />
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" size="lg" fullWidth loading={busy} loadingText="Saving…">Save password</Button>
      </form>
    </AuthShell>
  );
}
