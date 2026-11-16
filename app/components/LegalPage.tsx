import type { ReactNode } from 'react';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';

/** Shared frame for Developa's legal pages: the site header and footer around readable, narrow text. */
export default function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      <DevelopaHeader />
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Developa</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">{title}</h1>
          <p className="text-sm text-secondary mt-2">Last updated {updated}</p>
          {intro && <p className="mt-6 text-base leading-relaxed text-secondary">{intro}</p>}
          <div className="mt-8 space-y-8 text-[15px] leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:text-primary [&_p]:text-secondary [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ul]:text-secondary [&_a]:text-accent [&_a]:underline [&_strong]:text-primary">
            {children}
          </div>
        </article>
      </main>
      <DevelopaFooter />
    </div>
  );
}
