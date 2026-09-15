'use client';

import { useState, useEffect, useRef } from 'react';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import BuildCanvas from '@/app/components/BuildCanvas';
import { supabase } from '@/lib/supabaseClient';
import {
  Terminal, ArrowRight, Shield, Clock, Code2,
  Database, Smartphone, Server, Layers, Rocket,
  GitBranch, ShoppingBag,
} from 'lucide-react';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Shell } from '@/app/components/ui/Shell';

const ICONS: Record<string, any> = { Code2, Smartphone, Server, Database, Rocket, Layers, Terminal, ShoppingBag };

type Capability = { icon: string; title: string; description: string };

type PageSettings = {
  hero_title: string;
  hero_description: string;
  capabilities: Capability[];
};

const DEFAULT_SETTINGS: PageSettings = {
  hero_title: 'Full Stack & Custom Software',
  hero_description: 'Web apps, mobile builds, API integrations, database architecture, and MVP prototypes — engineered end-to-end, with complete source code and IP transfer on delivery.',
  capabilities: [
    { icon: 'Code2', title: 'Web Applications', description: 'Dashboards, internal tools, e-commerce, and client portals built with modern frameworks.' },
    { icon: 'Smartphone', title: 'Mobile Development', description: 'Cross-platform apps for iOS and Android from a single codebase.' },
    { icon: 'Server', title: 'API Integrations', description: 'Payment gateways, third-party services, and internal microservices wired up securely.' },
    { icon: 'Database', title: 'Database Design', description: 'Schema architecture, migrations, and query optimization for scale.' },
    { icon: 'Rocket', title: 'MVP Prototypes', description: 'Fast, functional builds to validate an idea before full-scale investment.' },
    { icon: 'Layers', title: 'Custom Scripts', description: 'Automation, data processing, and one-off tooling built to spec.' },
  ],
};

const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]';

/** Splits a headline so the last two words can be accent-colored, e.g. "Full Stack & Custom Software" → base "Full Stack &", accent "Custom Software". Falls back gracefully for short titles. */
function splitHeadline(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return { base: '', accent: title };
  return { base: words.slice(0, -2).join(' '), accent: words.slice(-2).join(' ') };
}

const PROCESS_STEPS = [
  { n: '01', title: 'Brief', desc: 'Submit your project scope through the intake form — objectives, platform, and technical requirements.' },
  { n: '02', title: 'Scope call', desc: 'The dev lead reviews your brief personally and returns a fixed-fee quote within 24 hours.' },
  { n: '03', title: 'Milestones', desc: 'Build starts against a milestone schedule, tracked live in your client dashboard.' },
  { n: '04', title: 'Delivery', desc: 'Complete source code, repository access, and IP transfer on final handover.' },
];

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function ProcessStep({ n, title, desc, isLast }: { n: string; title: string; desc: string; isLast: boolean }) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`relative flex-1 transition-all duration-700 ${EASE} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-mono text-sm font-bold flex items-center justify-center shrink-0">
          {n}
        </span>
        {!isLast && (
          <div className="hidden sm:block flex-1 h-px bg-theme relative overflow-hidden">
            <div className={`absolute inset-y-0 left-0 bg-cyan-500 transition-all duration-700 ${EASE} ${visible ? 'w-full' : 'w-0'}`} />
          </div>
        )}
      </div>
      <h3 className="text-base font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-secondary leading-relaxed pr-4">{desc}</p>
    </div>
  );
}

function FeatureCapabilityCard({ capability }: { capability: Capability }) {
  const Icon = ICONS[capability.icon] || Code2;
  return (
    <Card padding="lg" interactive className="flex flex-col justify-between group">
      <div>
        <div className="w-10 h-10 rounded-xl border border-theme bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold mb-1.5">{capability.title}</h3>
        <p className="text-sm text-secondary leading-relaxed mb-6">{capability.description}</p>
      </div>
      <div className="rounded-xl border border-theme bg-primary overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-theme">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
        </div>
        <div className="p-3 space-y-1.5">
          <div className="h-2.5 w-16 rounded-full bg-cyan-500/10 border border-cyan-500/30" />
          <div className="h-2.5 w-4/5 rounded bg-theme" />
          <div className="h-2.5 w-3/5 rounded bg-theme" />
          <div className="flex gap-1.5 pt-1">
            <div className="h-4 w-12 rounded-full bg-cyan-500" />
            <div className="h-4 w-10 rounded-full border border-strong" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function DeveloperPage() {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_SETTINGS);
  const headline = splitHeadline(settings.hero_title);

  useEffect(() => {
    (async () => {
      const { data: settingsRows } = await supabase.from('developer_page_settings').select('*');
      if (settingsRows) {
        const merged = { ...DEFAULT_SETTINGS };
        settingsRows.forEach((row: any) => {
          if (row.key === 'hero') Object.assign(merged, row.value);
          if (row.key === 'capabilities' && Array.isArray(row.value)) merged.capabilities = row.value;
        });
        setSettings(merged);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <DevelopaHeader />

      {/* Hero */}
      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <Shell size="lg">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <Badge variant="info" className="mb-6">
                <Terminal className="w-3.5 h-3.5 mr-1.5" /> Development Pipeline
              </Badge>
              <h1 className="font-display italic font-semibold tracking-tight text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] md:text-6xl mb-6">
                {headline.base && <>{headline.base}{' '}</>}
                <span className="text-cyan-500">{headline.accent}</span>
              </h1>
              <p className="text-base sm:text-lg text-secondary max-w-lg leading-relaxed mb-8">
                {settings.hero_description}
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button href="/order/dev" size="lg">
                  Start a project <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/developer/shop" variant="secondary" size="lg">
                  <ShoppingBag className="w-4 h-4" /> Browse scripts
                </Button>
              </div>
            </div>
            <BuildCanvas />
          </div>
        </Shell>
      </section>

      {/* Process */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="mb-14 space-y-2">
            <span className="text-[10px] font-bold uppercase text-cyan-500 tracking-widest">How it works</span>
            <h2 className="font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl">From brief to production</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-10 sm:gap-6">
            {PROCESS_STEPS.map((step, i) => (
              <ProcessStep key={step.n} n={step.n} title={step.title} desc={step.desc} isLast={i === PROCESS_STEPS.length - 1} />
            ))}
          </div>
        </Shell>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-cyan-500 tracking-widest">What we build</span>
              <h2 className="font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl">Engineering services</h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">Scoped, quoted, and delivered by the dev lead — from prototype to production.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {settings.capabilities[0] && <FeatureCapabilityCard capability={settings.capabilities[0]} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:col-span-2 gap-4">
              {settings.capabilities.slice(1).map((cap, i) => {
                const Icon = ICONS[cap.icon] || Code2;
                return (
                  <Card key={i} padding="lg" interactive className="group">
                    <div className="w-10 h-10 rounded-xl border border-theme bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold mb-1.5">{cap.title}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </Shell>
      </section>

      {/* Proof strip */}
      <section className="py-10 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-center text-xs sm:text-sm font-medium text-secondary">
            <span>Fixed-fee milestones</span>
            <span className="text-secondary/30">·</span>
            <span>Full source & IP transfer on delivery</span>
            <span className="text-secondary/30">·</span>
            <span>Dev lead reviews every brief personally</span>
            <span className="text-secondary/30">·</span>
            <span>Structured escrow, no upfront lump sum</span>
          </div>
        </Shell>
      </section>

      {/* Script Shop teaser */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-card/30 border-t border-theme">
        <Shell size="sm" className="text-center">
          <Badge variant="info" className="mb-4">
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> Script marketplace
          </Badge>
          <h2 className="font-bold tracking-tight text-2xl sm:text-3xl mb-4">Ready-made scripts</h2>
          <p className="text-secondary text-sm max-w-xl mx-auto mb-8">
            Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.
          </p>
          <Button href="/developer/shop" size="lg">
            Browse scripts <ArrowRight className="w-4 h-4" />
          </Button>
        </Shell>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="lg">
              <Shield className="w-5 h-5 mb-4 text-cyan-500" />
              <h4 className="font-bold mb-1.5 text-sm">Complete IP transfer</h4>
              <p className="text-sm text-secondary leading-relaxed">Full source code, repository access, and ownership rights delivered with every completed project.</p>
            </Card>
            <Card padding="lg">
              <GitBranch className="w-5 h-5 mb-4 text-cyan-500" />
              <h4 className="font-bold mb-1.5 text-sm">Milestone payments</h4>
              <p className="text-sm text-secondary leading-relaxed">Structured payment plans tied to build milestones — no large upfront commitment.</p>
            </Card>
            <Card padding="lg">
              <Clock className="w-5 h-5 mb-4 text-cyan-500" />
              <h4 className="font-bold mb-1.5 text-sm">On-time delivery</h4>
              <p className="text-sm text-secondary leading-relaxed">Realistic deadlines with real-time status tracking inside your client dashboard.</p>
            </Card>
          </div>
        </Shell>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 border-t border-theme">
        <Shell size="md" className="text-center">
          <h2 className="font-display italic font-medium text-3xl sm:text-4xl md:text-5xl mb-6">Ready to build?</h2>
          <p className="text-secondary text-sm sm:text-base max-w-md mx-auto mb-8">Submit your project brief and hear back from the dev lead within 24 hours.</p>
          <Button href="/order/dev" size="lg">
            Start your software request <ArrowRight className="w-4 h-4" />
          </Button>
        </Shell>
      </section>

      <DevelopaFooter />
    </div>
  );
}
