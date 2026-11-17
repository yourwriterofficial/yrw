'use client';

import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { DevelopaMark, DevelopaIcons } from './DevelopaMark';

/**
 * Shared frame for login and register: logo, a short heading, a card, and a few
 * plain reassurances underneath. developa clients get the cyan accent via .brand-developa.
 */
export default function AuthShell({
  developa,
  title,
  subtitle,
  children,
  footer,
  reassurances,
}: {
  developa: boolean;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  reassurances?: string[];
}) {
  return (
    <div className={`${developa ? 'brand-developa' : ''} min-h-screen bg-primary text-primary flex flex-col`}>
      <header className="max-w-5xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {developa && <DevelopaIcons />}
        <Link href={developa ? '/developer' : '/'} className="font-bold tracking-tight flex items-center gap-2.5">
          {developa && <DevelopaMark className="w-8 h-8 rounded-[9px]" />}
          {developa ? 'developa.me' : 'ResearchWriter'}
        </Link>
        <ThemeToggle compact />
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-secondary mt-2 mb-6">{subtitle}</p>

          <div className="border border-theme rounded-lg bg-card p-5 sm:p-6">{children}</div>

          <p className="text-sm text-secondary text-center mt-5">{footer}</p>

          {reassurances && reassurances.length > 0 && (
            <ul className="mt-8 space-y-1.5 text-xs text-secondary">
              {reassurances.map((r) => (
                <li key={r}>✓ {r}</li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
