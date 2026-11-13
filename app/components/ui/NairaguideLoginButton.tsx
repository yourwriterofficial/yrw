'use client';

/** "Login/Sign-in with your Nairaguide account": one account across Nairaguide and its partner sites. */
export function NairaguideLoginButton({ next, developa, label = 'Login/Sign-in with your Nairaguide account' }: { next?: string | null; developa?: boolean; label?: string }) {
  const q = new URLSearchParams();
  if (next && next.startsWith('/')) q.set('next', next);
  if (developa) q.set('brand', 'developa');
  return (
    <a
      href={`/api/auth/nairaguide/start${q.toString() ? `?${q}` : ''}`}
      className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-theme bg-card px-4 py-3 text-sm font-bold transition hover:opacity-90 focus-ring"
    >
      <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded bg-[#059669] text-[10px] font-black text-white">N</span>
      {label}
    </a>
  );
}
