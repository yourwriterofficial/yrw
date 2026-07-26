import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowRight, Shield, Clock, Lock, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Accent = 'emerald' | 'amber' | 'blue' | 'purple' | 'cyan';

const ACCENT_STYLES: Record<Accent, { text: string; hex: string; badge: string; border: string }> = {
  emerald: { text: 'text-emerald-500', hex: '#10b981', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', border: 'hover:border-emerald-500/30' },
  amber: { text: 'text-amber-500', hex: '#f59e0b', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20', border: 'hover:border-amber-500/30' },
  blue: { text: 'text-blue-500', hex: '#3b82f6', badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20', border: 'hover:border-blue-500/30' },
  purple: { text: 'text-purple-500', hex: '#a855f7', badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20', border: 'hover:border-purple-500/30' },
  cyan: { text: 'text-cyan-500', hex: '#06b6d4', badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', border: 'hover:border-cyan-500/30' },
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
    <div className="min-h-screen bg-primary text-primary font-['Inter'] overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[42rem] h-[42rem] rounded-full opacity-[0.09] blur-3xl pointer-events-none animate-blob"
          style={{ background: `radial-gradient(circle, ${s.hex}, transparent 70%)` }}
        />

        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-6">
          <div className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider ${s.badge}`}>
            <HeroIcon className="w-3.5 h-3.5" /> {badgeLabel}
          </div>

          <h1 className="text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] font-bold tracking-tight">
            {title}
          </h1>

          <p className="text-base sm:text-lg text-secondary max-w-xl mx-auto leading-relaxed">
            {description}
          </p>

          <div className="pt-2">
            <Link
              href={ctaHref}
              className="inline-flex bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all items-center gap-2 shadow-lg shadow-accent/10"
            >
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {bullets.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-theme bg-secondary/50 text-xs font-medium text-secondary">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: s.hex }} />
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{capabilitiesTitle}</h2>
            <p className="text-secondary text-sm max-w-sm">{capabilitiesDescription}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div
                  key={i}
                  className={`group glass-panel p-6 sm:p-7 rounded-2xl border border-theme transition-all duration-300 ${s.border}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl border border-theme flex items-center justify-center mb-4 transition-all duration-300"
                    style={{ color: s.hex }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">{cap.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary/20 border-t border-theme relative">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 text-center sm:text-left">
            <p className="text-xs font-black uppercase text-secondary tracking-wider mb-2">Process</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How it works</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-[22px] left-12 right-12 h-[1px] bg-theme" />
            {processSteps.map((step, i) => (
              <div key={i} className="space-y-4 relative glass-panel p-5 rounded-2xl border border-theme">
                <div className="flex items-center justify-between">
                  <div
                    className="w-11 h-11 rounded-xl bg-primary border border-theme flex items-center justify-center font-black text-sm z-10"
                    style={{ color: s.hex }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                </div>
                <h4 className="font-bold text-sm">{step.title}</h4>
                <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-theme">
            <Shield className="w-5 h-5 mb-4" style={{ color: s.hex }} />
            <h4 className="font-semibold mb-1.5 text-sm">Plagiarism free</h4>
            <p className="text-sm text-secondary leading-relaxed">Every deliverable is passed through originality scanners with verifiable reports.</p>
          </div>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-theme">
            <Lock className="w-5 h-5 mb-4" style={{ color: s.hex }} />
            <h4 className="font-semibold mb-1.5 text-sm">Vault security</h4>
            <p className="text-sm text-secondary leading-relaxed">Final work stays encrypted and locked until your balance is cleared.</p>
          </div>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-theme">
            <Clock className="w-5 h-5 mb-4" style={{ color: s.hex }} />
            <h4 className="font-semibold mb-1.5 text-sm">On-time delivery</h4>
            <p className="text-sm text-secondary leading-relaxed">Strict adherence to deadlines with real-time tracking in your dashboard.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme bg-secondary/30 relative">
        <div className="max-w-3xl mx-auto rounded-[32px] bg-gradient-to-b from-card to-primary border border-theme p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div
            className="absolute inset-0 blur-xl pointer-events-none opacity-[0.04]"
            style={{ background: s.hex }}
          />
          <div className="relative z-10 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to get started?</h2>
            <p className="text-secondary text-sm max-w-md mx-auto">Submit your brief and get a quote within hours.</p>
            <Link
              href={ctaHref}
              className="inline-flex bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all items-center gap-2 shadow-lg shadow-accent/10"
            >
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
