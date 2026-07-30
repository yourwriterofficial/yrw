import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { ArrowRight, Shield, Clock, Lock, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { Badge } from './ui/Badge';
import { Shell } from './ui/Shell';

type Accent = 'emerald' | 'amber' | 'blue' | 'purple' | 'cyan';

const ACCENT_STYLES: Record<Accent, { text: string; badge: string; iconBg: string }> = {
  emerald: { text: 'text-[var(--success)]', badge: 'text-[var(--success)] bg-[var(--success-bg)] border-[var(--success)]/20', iconBg: 'bg-[var(--success-bg)]' },
  amber:   { text: 'text-[var(--warning)]', badge: 'text-[var(--warning)] bg-[var(--warning-bg)] border-[var(--warning)]/20', iconBg: 'bg-[var(--warning-bg)]' },
  blue:    { text: 'text-[var(--info)]',    badge: 'text-[var(--info)] bg-[var(--info-bg)] border-[var(--info)]/20',       iconBg: 'bg-[var(--info-bg)]' },
  purple:  { text: 'text-purple-500',        badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20',               iconBg: 'bg-purple-500/10' },
  cyan:    { text: 'text-cyan-500',          badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',                     iconBg: 'bg-cyan-500/10' },
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
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="aurora-bg absolute inset-0 pointer-events-none" />
        <div className="grain-overlay absolute inset-0 pointer-events-none" />

        <Shell size="md" className="text-center relative z-10 space-y-6">
          <Badge variant="default" className={`${s.badge}`}>
            <HeroIcon className={`w-3.5 h-3.5 ${s.text} mr-1.5`} /> {badgeLabel}
          </Badge>

          <h1 className="font-display italic font-medium text-[2.5rem] leading-[1.08] sm:text-5xl sm:leading-[1.08] md:text-6xl">
            {title}
          </h1>

          <p className="text-base sm:text-lg text-secondary max-w-xl mx-auto leading-relaxed">
            {description}
          </p>

          <div className="pt-2">
            <Button href={ctaHref} size="lg">
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {bullets.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-theme bg-secondary text-xs font-medium text-secondary">
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${s.text}`} />
                {b}
              </span>
            ))}
          </div>
        </Shell>
      </section>

      {/* Capabilities */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative bg-card/30">
        <Shell size="lg">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Capabilities</span>
              <h2 className="font-bold tracking-tight text-3xl sm:text-4xl">{capabilitiesTitle}</h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">{capabilitiesDescription}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <Card key={i} padding="lg" interactive className="group">
                  <div className={`w-10 h-10 rounded-xl border border-theme flex items-center justify-center mb-4 transition-all duration-300 ${s.iconBg} ${s.text}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold mb-1.5">{cap.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                </Card>
              );
            })}
          </div>
        </Shell>
      </section>

      {/* Process */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <Shell size="lg">
          <div className="mb-10 text-center sm:text-left space-y-2">
            <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Process</span>
            <h2 className="font-bold tracking-tight text-3xl sm:text-4xl">How it works</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 relative">
            <div className="hidden md:block absolute top-[22px] left-12 right-12 h-[1px] bg-theme" />
            {processSteps.map((step, i) => (
              <Card key={i} padding="lg" className="relative">
                <div className={`w-11 h-11 rounded-xl bg-secondary border border-theme flex items-center justify-center font-black text-sm z-10 ${s.text}`}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h4 className="font-bold text-sm mt-4 mb-2">{step.title}</h4>
                <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
              </Card>
            ))}
          </div>
        </Shell>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme bg-card/30">
        <Shell size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="lg">
              <Shield className={`w-5 h-5 mb-4 ${s.text}`} />
              <h4 className="font-bold mb-1.5 text-sm">Plagiarism free</h4>
              <p className="text-sm text-secondary leading-relaxed">Every deliverable is passed through originality scanners with verifiable reports.</p>
            </Card>
            <Card padding="lg">
              <Lock className={`w-5 h-5 mb-4 ${s.text}`} />
              <h4 className="font-bold mb-1.5 text-sm">Vault security</h4>
              <p className="text-sm text-secondary leading-relaxed">Final work stays encrypted and locked until your balance is cleared.</p>
            </Card>
            <Card padding="lg">
              <Clock className={`w-5 h-5 mb-4 ${s.text}`} />
              <h4 className="font-bold mb-1.5 text-sm">On-time delivery</h4>
              <p className="text-sm text-secondary leading-relaxed">Strict adherence to deadlines with real-time tracking in your dashboard.</p>
            </Card>
          </div>
        </Shell>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="md">
          <Card padding="lg" elevation={3} className="text-center">
            <div className="space-y-6">
              <h2 className="font-bold tracking-tight text-2xl sm:text-3xl">Ready to get started?</h2>
              <p className="text-secondary text-sm max-w-md mx-auto">Submit your brief and get a quote within hours.</p>
              <Button href={ctaHref} size="lg">
                {ctaLabel} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </Shell>
      </section>

      <Footer />
    </div>
  );
}
