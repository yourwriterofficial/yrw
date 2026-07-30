'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Input } from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Shell } from '@/app/components/ui/Shell';
import { showToast } from '@/app/components/ui/Toast';

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
      data: { password_is_email: false },
    });
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Password updated. Please log in again.', 'success');
      await supabase.auth.signOut();
      router.push('/login');
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Shell size="sm" className="w-full max-w-md text-center">
          <p className="text-secondary text-sm">Verifying your link…</p>
        </Shell>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Shell size="sm" className="w-full max-w-md">
        <Card elevation={2} padding="lg" className="w-full">
          <h1 className="text-2xl font-black text-primary mb-6">Set New Password</h1>
          <div className="space-y-4">
            <Input
              type="password"
              label="New password"
              placeholder="Enter a new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Button type="button" size="lg" fullWidth loading={loading} onClick={handleUpdate}>
              Update Password
            </Button>
          </div>
        </Card>
      </Shell>
    </div>
  );
}
