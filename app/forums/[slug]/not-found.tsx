import Link from 'next/link';

export const metadata = { title: { absolute: 'Store not found | developa.me' }, robots: { index: false, follow: false } };

/** Shown (with a real 404) when nobody owns the address: a mistyped store name or a store that was removed. */
export default function StoreNotFound() {
  return (
    <main className="min-h-screen bg-primary text-primary flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-5">
        <p className="text-6xl font-black tracking-tight text-accent">404</p>
        <h1 className="text-2xl font-bold">We could not find that store</h1>
        <p className="text-secondary text-sm leading-relaxed">
          The address may be mistyped, or the store may have been removed. Check the spelling, or ask the seller for their link.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a href="https://developa.me" className="h-11 px-6 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-semibold inline-flex items-center">Go to developa.me</a>
          <a href="https://developa.me/shop" className="h-11 px-6 rounded-full border border-theme hover:bg-hover text-sm font-medium inline-flex items-center">Browse stores</a>
        </div>
        <p className="text-xs text-secondary pt-4">Want your own store? <Link href="https://developa.me/create" className="text-accent hover:underline">Create one free</Link>.</p>
      </div>
    </main>
  );
}
