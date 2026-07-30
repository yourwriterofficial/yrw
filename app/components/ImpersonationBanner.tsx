'use client';

import { useState, useEffect } from 'react';
import { isCurrentlyImpersonating, getImpersonationTarget, clearImpersonation } from '@/lib/impersonate';
import * as lucide from 'lucide-react';

export default function ImpersonationBanner() {
  const [target, setTarget] = useState<{ id: string; email: string; name: string } | null>(null);

  useEffect(() => {
    // Check on mount and every 30s (for auto-expiry)
    const check = () => {
      if (isCurrentlyImpersonating()) {
        setTarget(getImpersonationTarget());
      } else {
        setTarget(null);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!target) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] bg-amber-500 text-black py-2.5 px-6 flex items-center justify-between gap-4 font-black text-[11px] uppercase tracking-widest shadow-lg select-none">
      <div className="flex items-center gap-2.5">
        <lucide.ShieldAlert className="w-4.5 h-4.5 shrink-0" />
        <span>
          🎭 Impersonating: <span className="underline">{target.name}</span>{' '}
          <span className="font-mono text-[10px] opacity-80">({target.email})</span>
        </span>
      </div>
      <button
        onClick={() => {
          clearImpersonation();
          window.location.href = '/admin/users';
        }}
        className="px-4 py-1.5 bg-black text-white hover:bg-black/80 transition font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer whitespace-nowrap"
      >
        ✕ Stop Impersonation
      </button>
    </div>
  );
}
