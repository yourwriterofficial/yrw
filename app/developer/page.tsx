'use client';

import { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Terminal, ArrowRight, Shield, Clock, Code2,
  Database, Smartphone, Server, Layers, Rocket, GitBranch,
  ShoppingBag,
} from 'lucide-react';

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
    <div className="min-h-screen bg-primary text-primary font-['Inter']">
      <Header />

      {/* Hero */}
      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-medium tracking-wide mb-5 flex items-center justify-center gap-2 text-cyan-500">
            <Terminal className="w-3.5 h-3.5" /> Development Pipeline
          </p>
          <h1 className="text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] font-semibold tracking-tight mb-6">
            {settings.hero_title}
          </h1>
          <p className="text-base sm:text-lg text-secondary mb-9 max-w-xl mx-auto leading-relaxed">
            {settings.hero_description}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/order/dev"
              className="inline-flex bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all items-center gap-2"
            >
              Start a project <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/developer/shop"
              className="inline-flex border border-theme hover:border-strong px-6 py-3 rounded-full text-sm font-semibold transition-colors items-center gap-2 text-primary"
            >
              <ShoppingBag className="w-4 h-4" /> Browse scripts
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">What we build</h2>
            <p className="text-secondary text-sm max-w-sm">Scoped, quoted, and delivered by the dev lead — from prototype to production.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-theme border border-theme rounded-2xl overflow-hidden">
            {settings.capabilities.map((cap, i) => {
              const Icon = ICONS[cap.icon] || Code2;
              return (
                <div key={i} className="bg-primary p-6 sm:p-7">
                  <Icon className="w-5 h-5 mb-4 text-cyan-500" />
                  <h3 className="text-base font-semibold mb-1.5">{cap.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Script Shop teaser */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary border-t border-theme">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-medium tracking-wide mb-2 flex items-center justify-center gap-2 text-cyan-500">
            <ShoppingBag className="w-3.5 h-3.5" /> Script marketplace
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Ready-made scripts</h2>
          <p className="text-secondary text-sm max-w-xl mx-auto mb-8">Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.</p>
          <Link
            href="/developer/shop"
            className="inline-flex bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all items-center gap-2"
          >
            Browse scripts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-px bg-theme border border-theme rounded-2xl overflow-hidden">
          <div className="bg-primary p-6 sm:p-8">
            <Shield className="w-5 h-5 mb-4 text-cyan-500" />
            <h4 className="font-semibold mb-1.5 text-sm">Complete IP transfer</h4>
            <p className="text-sm text-secondary leading-relaxed">Full source code, repository access, and ownership rights delivered with every completed project.</p>
          </div>
          <div className="bg-primary p-6 sm:p-8">
            <GitBranch className="w-5 h-5 mb-4 text-cyan-500" />
            <h4 className="font-semibold mb-1.5 text-sm">Milestone payments</h4>
            <p className="text-sm text-secondary leading-relaxed">Structured payment plans tied to build milestones — no large upfront commitment.</p>
          </div>
          <div className="bg-primary p-6 sm:p-8">
            <Clock className="w-5 h-5 mb-4 text-cyan-500" />
            <h4 className="font-semibold mb-1.5 text-sm">On-time delivery</h4>
            <p className="text-sm text-secondary leading-relaxed">Realistic deadlines with real-time status tracking inside your client dashboard.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary border-t border-theme">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Ready to build?</h2>
          <p className="text-secondary text-sm mb-8">Submit your project brief and get a quote within hours.</p>
          <Link
            href="/order/dev"
            className="inline-flex bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all items-center gap-2"
          >
            Start your software request <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-secondary">
            <span>Web apps, APIs & database setup</span>
            <span>Complete source code & IP transfer</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-theme py-8 px-4 sm:px-6 text-center text-xs text-secondary pb-safe">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>
    </div>
  );
}
