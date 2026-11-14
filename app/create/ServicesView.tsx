'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import QuoteRequestForm from '@/app/components/QuoteRequestForm';
import { supabase } from '@/lib/supabaseClient';
import Button from '@/app/components/ui/Button';
import { Check } from 'lucide-react';

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

const tonal = 'var(--g-tonal)';
const tonalStrong = 'var(--g-tonal-strong)';

const STEPS = [
  { title: 'Send your brief', text: 'Tell us what you want built, the platform, and any deadline.' },
  { title: 'Get a fixed quote', text: 'The dev lead reads every brief and replies with a fixed-fee quote within 24 hours.' },
  { title: 'Build in milestones', text: 'Pay in stages as milestones are completed. Track progress in your dashboard.' },
  { title: 'Take ownership', text: 'You get the full source code, repository access and IP on final handover.' },
];

export default function ServicesView() {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_SETTINGS);

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
    <div className="g-font min-h-screen bg-primary text-primary overflow-x-hidden">
      <DevelopaHeader />

      <main>
        {/* Hero */}
        <section className="px-[var(--page-gutter)] pt-header-28 sm:pt-header-32 pb-16 text-center">
          <h1 className="mx-auto max-w-3xl g-h1">{settings.hero_title}</h1>
          <p className="mx-auto max-w-2xl g-lead mt-6">{settings.hero_description}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            <Button href="#quote" size="lg">Get a quote</Button>
            <Button href="/developer/shop" variant="soft" color="info" size="lg">Browse scripts</Button>
          </div>
          <p className="text-sm text-secondary mt-6">Fixed-fee milestones · Full source and IP transfer · Brief reviewed by the dev lead</p>
        </section>

        {/* What we build */}
        <section id="capabilities" className="px-[var(--page-gutter)] pb-16 scroll-mt-20">
          <div className="max-w-[1100px] mx-auto">
            <h2 className="g-h2 text-center">What we build</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {settings.capabilities.map((cap, i) => (
                <div key={i} className="rounded-[var(--radius-card)] p-6" style={{ background: tonal }}>
                  <h3 className="font-medium text-lg">{cap.title}</h3>
                  <p className="text-sm text-secondary mt-2 leading-relaxed">{cap.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quote */}
        <section id="quote" className="px-[var(--page-gutter)] pb-16 scroll-mt-20">
          <div className="max-w-[1100px] mx-auto rounded-[var(--radius-panel)] p-6 sm:p-10 grid lg:grid-cols-2 gap-8 lg:gap-12" style={{ background: tonal }}>
            <div>
              <h2 className="g-h3">Have a project in mind?</h2>
              <p className="text-secondary mt-3 leading-relaxed">Send a short brief and we will reply with a fixed-fee quote within 24 hours. No payment needed.</p>
              <ul className="mt-6 space-y-3 text-[15px]">
                {['Fixed-fee quote, paid in milestones', 'Full source code and ownership at handover', 'Your brief is read by the dev lead'].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-accent text-[var(--accent-foreground)] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-primary rounded-[var(--radius-card)] p-6 sm:p-7 shadow-sm">
              <h3 className="text-lg font-medium">Get a quote</h3>
              <p className="text-sm text-secondary mt-1 mb-5">We reply within 24 hours.</p>
              <QuoteRequestForm brand="developa" defaultService="dev" services={['dev']} bare />
            </div>
          </div>
        </section>

        {/* Process */}
        <section id="trust" className="px-[var(--page-gutter)] py-[var(--section-y)] scroll-mt-20" style={{ background: tonal }}>
          <div className="max-w-[1100px] mx-auto">
            <h2 className="g-h2 text-center">How it works</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STEPS.map((step, i) => (
                <div key={i} className="bg-primary rounded-[var(--radius-card)] p-6 shadow-sm">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-accent" style={{ background: tonalStrong }}>{i + 1}</div>
                  <div className="font-medium mt-4">{step.title}</div>
                  <p className="text-sm text-secondary mt-2 leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Scripts + privacy */}
        <section id="confidentiality" className="px-[var(--page-gutter)] py-[var(--section-y)]">
          <div className="max-w-[1100px] mx-auto grid md:grid-cols-2 gap-5">
            <div className="rounded-[var(--radius-card)] p-8 border border-theme">
              <h3 className="g-h3">Ready-made scripts</h3>
              <p className="text-secondary mt-3 leading-relaxed">Source-available scripts and templates. Buy once and download any time from your dashboard.</p>
              <div className="mt-6"><Button href="/developer/shop" variant="soft" color="info">Browse the shop</Button></div>
            </div>
            <div className="rounded-[var(--radius-card)] p-8" style={{ background: tonal }}>
              <h3 className="g-h3">Your work stays private</h3>
              <p className="text-secondary mt-3 leading-relaxed">We never publish or show client work. Your brief, drafts and files are visible only to you and the people working on your order.</p>
            </div>
          </div>
        </section>

        <p className="px-[var(--page-gutter)] pb-10 text-center text-sm text-secondary">
          Need an essay, thesis, data analysis or CV instead?{' '}
          <Link href="/" className="text-accent hover:underline">ResearchWriter does that →</Link>
        </p>
      </main>

      <DevelopaFooter />
    </div>
  );
}
