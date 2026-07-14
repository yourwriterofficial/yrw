import Header from '@/app/components/Header';
import Link from 'next/link';
import { ArrowRight, Shield, Clock, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Accent = 'emerald' | 'amber' | 'blue' | 'purple';

const ACCENT_STYLES: Record<Accent, { text: string }> = {
  emerald: { text: 'text-emerald-500' },
  amber: { text: 'text-amber-500' },
  blue: { text: 'text-blue-500' },
  purple: { text: 'text-purple-500' },
};

export type ServiceCapability = { icon: LucideIcon; title: string; description: string };

export default function ServiceLandingTemplate({
  accent,
  badgeLabel,
  icon: HeroIcon,
  title,
  description,
  ctaHref,
  ctaLabel,
  bullets,
  capabilitiesTitle,
  capabilitiesDescription,
  capabilities,
  processSteps,
}: {
  accent: Accent;
  badgeLabel: string;
  icon: LucideIcon;
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
  bullets: string[];
  capabilitiesTitle: string;
  capabilitiesDescription: string;
  capabilities: ServiceCapability[];
  processSteps: { title: string; description: string }[];
}) {
  const s = ACCENT_STYLES[accent];

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter']">
      <Header />

      {/* Hero */}
      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className={`text-xs font-medium tracking-wide mb-5 flex items-center justify-center gap-2 ${s.text}`}>
            <HeroIcon className="w-3.5 h-3.5" /> {badgeLabel}
          </p>
          <h1 className="text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] font-semibold tracking-tight mb-6">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-secondary mb-9 max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
          <Link
            href={ctaHref}
            className="inline-flex bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all items-center gap-2"
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-9 text-sm text-secondary">
            {bullets.map((b, i) => (
              <span key={i}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{capabilitiesTitle}</h2>
            <p className="text-secondary text-sm max-w-sm">{capabilitiesDescription}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-theme border border-theme rounded-2xl overflow-hidden">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div key={i} className="bg-primary p-6 sm:p-7">
                  <Icon className={`w-5 h-5 mb-4 ${s.text}`} />
                  <h3 className="text-base font-semibold mb-1.5">{cap.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-medium text-secondary tracking-wide mb-2">Process</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {processSteps.map((step, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-secondary">{String(i + 1).padStart(2, '0')}</span>
                  <div className="h-px flex-1 bg-theme" />
                </div>
                <h4 className="font-semibold mb-1.5 text-sm">{step.title}</h4>
                <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-px bg-theme border border-theme rounded-2xl overflow-hidden">
          <div className="bg-primary p-6 sm:p-8">
            <Shield className={`w-5 h-5 mb-4 ${s.text}`} />
            <h4 className="font-semibold mb-1.5 text-sm">Plagiarism free</h4>
            <p className="text-sm text-secondary leading-relaxed">Every deliverable is passed through originality scanners with verifiable reports.</p>
          </div>
          <div className="bg-primary p-6 sm:p-8">
            <Lock className={`w-5 h-5 mb-4 ${s.text}`} />
            <h4 className="font-semibold mb-1.5 text-sm">Vault security</h4>
            <p className="text-sm text-secondary leading-relaxed">Final work stays encrypted and locked until your balance is cleared.</p>
          </div>
          <div className="bg-primary p-6 sm:p-8">
            <Clock className={`w-5 h-5 mb-4 ${s.text}`} />
            <h4 className="font-semibold mb-1.5 text-sm">On-time delivery</h4>
            <p className="text-sm text-secondary leading-relaxed">Strict adherence to deadlines with real-time tracking in your dashboard.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary border-t border-theme">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Ready to get started?</h2>
          <p className="text-secondary text-sm mb-8">Submit your brief and get a quote within hours.</p>
          <Link
            href={ctaHref}
            className="inline-flex bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all items-center gap-2"
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-theme py-8 px-4 sm:px-6 text-center text-xs text-secondary pb-safe">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>
    </div>
  );
}
