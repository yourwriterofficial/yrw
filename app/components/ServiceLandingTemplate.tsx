import Header from '@/app/components/Header';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Shield, Clock, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Accent = 'emerald' | 'amber' | 'blue' | 'purple';

const ACCENT_STYLES: Record<Accent, {
  badge: string; iconWrap: string; icon: string; button: string; shadow: string;
  blob1: string; blob2: string; ring: string; text: string; gradientText: string; numberGlow: string;
}> = {
  emerald: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    iconWrap: 'bg-emerald-500/10 border-emerald-500/20',
    icon: 'text-emerald-400',
    button: 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400',
    shadow: 'shadow-emerald-500/25',
    blob1: 'bg-emerald-500/25',
    blob2: 'bg-teal-500/20',
    ring: 'hover:border-emerald-500/50',
    text: 'text-emerald-500',
    gradientText: 'bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent',
    numberGlow: 'shadow-[0_0_30px_-8px] shadow-emerald-500/50',
  },
  amber: {
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    iconWrap: 'bg-amber-500/10 border-amber-500/20',
    icon: 'text-amber-400',
    button: 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400',
    shadow: 'shadow-amber-500/25',
    blob1: 'bg-amber-500/25',
    blob2: 'bg-orange-500/20',
    ring: 'hover:border-amber-500/50',
    text: 'text-amber-500',
    gradientText: 'bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent',
    numberGlow: 'shadow-[0_0_30px_-8px] shadow-amber-500/50',
  },
  blue: {
    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    iconWrap: 'bg-blue-500/10 border-blue-500/20',
    icon: 'text-blue-400',
    button: 'bg-gradient-to-r from-blue-400 to-indigo-500 hover:from-blue-300 hover:to-indigo-400',
    shadow: 'shadow-blue-500/25',
    blob1: 'bg-blue-500/25',
    blob2: 'bg-indigo-500/20',
    ring: 'hover:border-blue-500/50',
    text: 'text-blue-500',
    gradientText: 'bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent',
    numberGlow: 'shadow-[0_0_30px_-8px] shadow-blue-500/50',
  },
  purple: {
    badge: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    iconWrap: 'bg-purple-500/10 border-purple-500/20',
    icon: 'text-purple-400',
    button: 'bg-gradient-to-r from-purple-400 to-fuchsia-500 hover:from-purple-300 hover:to-fuchsia-400',
    shadow: 'shadow-purple-500/25',
    blob1: 'bg-purple-500/25',
    blob2: 'bg-fuchsia-500/20',
    ring: 'hover:border-purple-500/50',
    text: 'text-purple-500',
    gradientText: 'bg-gradient-to-r from-purple-400 to-fuchsia-500 bg-clip-text text-transparent',
    numberGlow: 'shadow-[0_0_30px_-8px] shadow-purple-500/50',
  },
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
    <div className="min-h-screen bg-primary text-primary font-['Inter'] transition-colors duration-200 overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-header-36 sm:pt-header-40 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className={`absolute top-10 left-1/2 -translate-x-[60%] w-72 h-72 sm:w-[500px] sm:h-[500px] ${s.blob1} blur-[100px] rounded-full pointer-events-none animate-blob`} />
        <div className={`absolute top-40 left-1/2 translate-x-[10%] w-64 h-64 sm:w-[420px] sm:h-[420px] ${s.blob2} blur-[100px] rounded-full pointer-events-none animate-blob animation-delay-2000`} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className={`inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 glass-panel ${s.badge}`}>
            {badgeLabel}
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 sm:mb-8 leading-[1.15] flex items-center justify-center gap-3 sm:gap-4 flex-wrap px-2">
            <HeroIcon className={`w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 ${s.icon} shrink-0`} />
            <span className={s.gradientText}>{title}</span>
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-secondary mb-10 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-2">
            {description}
          </p>
          <Link
            href={ctaHref}
            className={`inline-flex text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 items-center gap-2 shadow-lg ${s.button} ${s.shadow}`}
          >
            {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-secondary border-y border-theme relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">{capabilitiesTitle}</h2>
            <p className="text-secondary text-sm px-2">{capabilitiesDescription}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div key={i} className={`p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel transition-all duration-300 hover:-translate-y-1 ${s.ring}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${s.iconWrap}`}>
                    <Icon className={`w-6 h-6 ${s.icon}`} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black mb-3">{cap.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">How It Works</h2>
            <p className="text-secondary text-sm">A straightforward pipeline from brief to delivery.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {processSteps.map((step, i) => (
              <div key={i} className="text-center">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 font-black text-base sm:text-lg glass-panel ${s.text} ${s.numberGlow}`}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h4 className="font-bold mb-2 text-sm sm:text-base">{step.title}</h4>
                <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-secondary border-y border-theme">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-8">
          <div className="glass-panel rounded-[24px] p-6 sm:p-8 text-center">
            <Shield className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto mb-4 ${s.text}`} />
            <h4 className="font-bold mb-2">Plagiarism Free</h4>
            <p className="text-xs text-secondary leading-relaxed">Every deliverable is passed through originality scanners with verifiable reports.</p>
          </div>
          <div className="glass-panel rounded-[24px] p-6 sm:p-8 text-center">
            <Lock className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto mb-4 ${s.text}`} />
            <h4 className="font-bold mb-2">Vault Security</h4>
            <p className="text-xs text-secondary leading-relaxed">Final work stays encrypted and locked until your balance is cleared.</p>
          </div>
          <div className="glass-panel rounded-[24px] p-6 sm:p-8 text-center">
            <Clock className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto mb-4 ${s.text}`} />
            <h4 className="font-bold mb-2">On-Time Delivery</h4>
            <p className="text-xs text-secondary leading-relaxed">Strict adherence to deadlines with real-time tracking in your dashboard.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className={`max-w-3xl mx-auto text-center glass-panel rounded-[32px] sm:rounded-[40px] p-8 sm:p-14 relative overflow-hidden`}>
          <div className={`absolute -top-20 -right-20 w-64 h-64 ${s.blob1} blur-[80px] rounded-full pointer-events-none`} />
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">Ready to get started?</h2>
            <p className="text-secondary text-sm mb-8">Submit your brief and get a quote within hours.</p>
            <Link
              href={ctaHref}
              className={`inline-flex text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 items-center gap-2 shadow-lg ${s.button} ${s.shadow}`}
            >
              {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <ul className="flex flex-wrap justify-center gap-x-6 sm:gap-x-8 gap-y-2 mt-8 text-xs font-medium text-secondary">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-2"><CheckCircle2 className={`w-4 h-4 shrink-0 ${s.text}`} /> {b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-theme py-10 sm:py-12 px-4 sm:px-6 text-center text-xs text-secondary pb-safe">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>
    </div>
  );
}
