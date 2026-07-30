'use client';

import { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Terminal, ArrowRight, Shield, Clock, Code2,
  Database, Smartphone, Server, Layers, Rocket, GitBranch,
  ShoppingBag,
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

export default function DeveloperPage() {
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
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="aurora-bg absolute inset-0 pointer-events-none" />
        <div className="grain-overlay absolute inset-0 pointer-events-none" />

        <Shell size="md" className="text-center relative z-10 space-y-6">
          <Badge variant="info">
            <Terminal className="w-3.5 h-3.5 mr-1.5" /> Development Pipeline
          </Badge>

          <h1 className="font-display italic font-medium text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] md:text-6xl">
            {settings.hero_title}
          </h1>

          <p className="text-base sm:text-lg text-secondary max-w-xl mx-auto leading-relaxed">
            {settings.hero_description}
          </p>

          <div className="flex gap-3 justify-center flex-wrap pt-2">
            <Button href="/order/dev" size="lg">
              Start a project <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="/developer/shop" variant="secondary" size="lg">
              <ShoppingBag className="w-4 h-4" /> Browse scripts
            </Button>
          </div>
        </Shell>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <Shell size="lg">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-accent tracking-widest">What we build</span>
              <h2 className="font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl">Engineering services</h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">Scoped, quoted, and delivered by the dev lead — from prototype to production.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.capabilities.map((cap, i) => {
              const Icon = ICONS[cap.icon] || Code2;
              return (
                <Card key={i} padding="lg" interactive className="group">
                  <div className="w-10 h-10 rounded-xl border border-theme bg-info/10 text-info flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-105">
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

      {/* Script Shop teaser */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-card/30 border-t border-theme relative">
        <Shell size="sm" className="text-center">
          <Card padding="lg" elevation={3} className="relative overflow-hidden">
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
          </Card>
        </Shell>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <Shell size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="lg">
              <Shield className="w-5 h-5 mb-4 text-info" />
              <h4 className="font-bold mb-1.5 text-sm">Complete IP transfer</h4>
              <p className="text-sm text-secondary leading-relaxed">Full source code, repository access, and ownership rights delivered with every completed project.</p>
            </Card>
            <Card padding="lg">
              <GitBranch className="w-5 h-5 mb-4 text-info" />
              <h4 className="font-bold mb-1.5 text-sm">Milestone payments</h4>
              <p className="text-sm text-secondary leading-relaxed">Structured payment plans tied to build milestones — no large upfront commitment.</p>
            </Card>
            <Card padding="lg">
              <Clock className="w-5 h-5 mb-4 text-info" />
              <h4 className="font-bold mb-1.5 text-sm">On-time delivery</h4>
              <p className="text-sm text-secondary leading-relaxed">Realistic deadlines with real-time status tracking inside your client dashboard.</p>
            </Card>
          </div>
        </Shell>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme bg-card/30 relative">
        <Shell size="md">
          <Card padding="lg" elevation={3} className="text-center relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <h2 className="font-bold tracking-tight text-2xl sm:text-3xl">Ready to build?</h2>
              <p className="text-secondary text-sm max-w-md mx-auto">Submit your project brief and get a quote within hours.</p>
              <Button href="/order/dev" size="lg">
                Start your software request <ArrowRight className="w-4 h-4" />
              </Button>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 text-sm text-secondary">
                <span>Web apps, APIs & database setup</span>
                <span>Complete source code & IP transfer</span>
              </div>
            </div>
          </Card>
        </Shell>
      </section>

      <Footer />
    </div>
  );
}
