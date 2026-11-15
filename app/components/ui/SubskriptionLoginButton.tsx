'use client';

/** "Continue with Subskription": one account across Subskription and Developa. */
export function SubskriptionLoginButton({ next, label = 'Continue with Subskription' }: { next?: string | null; label?: string }) {
  const q = new URLSearchParams();
  if (next && next.startsWith('/')) q.set('next', next);
  return (
    <a
      href={`/api/auth/subskription/start${q.toString() ? `?${q}` : ''}`}
      className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-theme bg-card px-4 py-3 text-sm font-bold transition hover:opacity-90 focus-ring"
    >
      <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded bg-[#7c3aed] text-[10px] font-black text-white">S</span>
      {label}
    </a>
  );
}
