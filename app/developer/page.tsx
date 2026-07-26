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

const ICONS: Record<string, any> = { Code2, Smartphone, Server, Database, Rocket, Layers, Terminal, ShoppingBag };
const CYAN = '#06b6d4';

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
    <div className="min-h-screen bg-primary text-primary font-['Inter'] overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[42rem] h-[42rem] rounded-full opacity-[0.09] blur-3xl pointer-events-none animate-blob"
          style={{ background: `radial-gradient(circle, ${CYAN}, transparent 70%)` }}
        />

        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
            <Terminal className="w-3.5 h-3.5" /> Development Pipeline
          </div>

          <h1 className="text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] font-bold tracking-tight">
            {settings.hero_title}
          </h1>

          <p className="text-base sm:text-lg text-secondary max-w-xl mx-auto leading-relaxed">
            {settings.hero_description}
          </p>

          <div className="flex gap-3 justify-center flex-wrap pt-2">
            <Link
              href="/order/dev"
              className="inline-flex bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all items-center gap-2 shadow-lg shadow-accent/10"
            >
              Start a project <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/developer/shop"
              className="inline-flex border border-theme hover:border-strong bg-secondary/50 px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:bg-secondary items-center gap-2 text-primary"
            >
              <ShoppingBag className="w-4 h-4" /> Browse scripts
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">What we build</h2>
            <p className="text-secondary text-sm max-w-sm">Scoped, quoted, and delivered by the dev lead — from prototype to production.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.capabilities.map((cap, i) => {
              const Icon = ICONS[cap.icon] || Code2;
              return (
                <div key={i} className="glass-panel p-6 sm:p-7 rounded-2xl border border-theme hover:border-cyan-500/30 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl border border-theme flex items-center justify-center mb-4 text-cyan-500">
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

      {/* Script Shop teaser */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary/20 border-t border-theme relative">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border-cyan-500/20 mb-4">
            <ShoppingBag className="w-3.5 h-3.5" /> Script marketplace
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Ready-made scripts</h2>
          <p className="text-secondary text-sm max-w-xl mx-auto mb-8">Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.</p>
          <Link
            href="/developer/shop"
            className="inline-flex bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all items-center gap-2 shadow-lg shadow-accent/10"
          >
            Browse scripts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme relative">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-theme">
            <Shield className="w-5 h-5 mb-4 text-cyan-500" />
            <h4 className="font-semibold mb-1.5 text-sm">Complete IP transfer</h4>
            <p className="text-sm text-secondary leading-relaxed">Full source code, repository access, and ownership rights delivered with every completed project.</p>
          </div>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-theme">
            <GitBranch className="w-5 h-5 mb-4 text-cyan-500" />
            <h4 className="font-semibold mb-1.5 text-sm">Milestone payments</h4>
            <p className="text-sm text-secondary leading-relaxed">Structured payment plans tied to build milestones — no large upfront commitment.</p>
          </div>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-theme">
            <Clock className="w-5 h-5 mb-4 text-cyan-500" />
            <h4 className="font-semibold mb-1.5 text-sm">On-time delivery</h4>
            <p className="text-sm text-secondary leading-relaxed">Realistic deadlines with real-time status tracking inside your client dashboard.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme bg-secondary/30 relative">
        <div className="max-w-3xl mx-auto rounded-[32px] bg-gradient-to-b from-card to-primary border border-theme p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 blur-xl pointer-events-none opacity-[0.04]" style={{ background: CYAN }} />
          <div className="relative z-10 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to build?</h2>
            <p className="text-secondary text-sm max-w-md mx-auto">Submit your project brief and get a quote within hours.</p>
            <Link
              href="/order/dev"
              className="inline-flex bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all items-center gap-2 shadow-lg shadow-accent/10"
            >
              Start your software request <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 text-sm text-secondary">
              <span>Web apps, APIs & database setup</span>
              <span>Complete source code & IP transfer</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
