'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?message=Your session has expired. Please log in or request a new link.');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleUpdate = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ 
      password,
      data: { password_is_email: false }
    });
    if (error) alert(error.message);
    else {
      alert('Password updated. Please log in again.');
      await supabase.auth.signOut();
      router.push('/login');
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60 text-sm">Verifying your link…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-[#0a0a0a] p-8 rounded-2xl w-full max-w-md">
        <h1 className="text-2xl font-black mb-6">Set New Password</h1>
        <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 mb-4 text-white" />
        <button onClick={handleUpdate} disabled={loading} className="w-full bg-emerald-500 text-black font-black py-3 rounded-xl">Update Password</button>
      </div>
    </div>
  );
}