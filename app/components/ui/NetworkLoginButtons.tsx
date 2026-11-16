'use client';

/**
 * "Continue with <app>" buttons for the other apps in our network, one per line under the Google button,
 * in the same order in every app: Subskription, NairaGuide, ProsePen (Developa itself is left out).
 * Apps whose sign-in is not live yet are shown disabled with a "Soon" tag. Developa brand only.
 */

interface NetApp { id: string; name: string; logo: string; href: string | null }

export function NetworkLoginButtons({ next }: { next?: string | null }) {
  const q = new URLSearchParams();
  if (next && next.startsWith('/')) q.set('next', next);
  const qs = q.toString();
  const ng = new URLSearchParams(q);
  ng.set('brand', 'developa');

  const apps: NetApp[] = [
    { id: 'subskription', name: 'Subskription', logo: '/network/subskription.svg', href: `/api/auth/subskription/start${qs ? `?${qs}` : ''}` },
    { id: 'nairaguide', name: 'NairaGuide', logo: '/network/nairaguide.svg', href: `/api/auth/nairaguide/start?${ng}` },
    { id: 'prosepen', name: 'ProsePen', logo: '/network/prosepen.svg', href: `/api/auth/prosepen/start${qs ? `?${qs}` : ''}` },
  ];

  const base = 'relative mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-theme bg-card py-3 text-sm font-bold shadow-sm transition';

  return (
    <>
      {apps.map((a) => {
        const logo = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.logo} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-[4px]" />
        );
        return a.href ? (
          <a key={a.id} href={a.href} className={`${base} px-4 hover:opacity-90 focus-ring`}>
            {logo}
            Continue with {a.name}
          </a>
        ) : (
          <button key={a.id} type="button" disabled title={`Sign in with ${a.name} is coming soon`} className={`${base} pl-4 pr-14 opacity-60 cursor-not-allowed`}>
            {logo}
            Continue with {a.name}
            <span className="absolute right-3 text-[10px] font-bold uppercase tracking-wide text-secondary">Soon</span>
          </button>
        );
      })}
    </>
  );
}
