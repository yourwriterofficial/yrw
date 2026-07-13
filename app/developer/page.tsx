'use client';

import { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Terminal, ArrowRight, CheckCircle2, Shield, Clock, Code2,
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
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-cyan-500/30 transition-colors duration-200 overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-header-32 sm:pt-header-40 pb-16 sm:pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-[60%] w-72 h-72 sm:w-[500px] sm:h-[500px] bg-cyan-500/25 blur-[100px] rounded-full pointer-events-none animate-blob" />
        <div className="absolute top-40 left-1/2 translate-x-[10%] w-64 h-64 sm:w-[420px] sm:h-[420px] bg-blue-500/15 blur-[100px] rounded-full pointer-events-none animate-blob animation-delay-2000" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block glass-panel border-cyan-500/30 text-cyan-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">
            Development Pipeline
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 sm:mb-8 leading-[1.15] sm:leading-[1.1] flex items-center justify-center gap-3 sm:gap-4 flex-wrap px-2">
            <Terminal className="w-9 h-9 sm:w-14 sm:h-14 md:w-16 md:h-16 text-cyan-400 shrink-0" />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{settings.hero_title}</span>
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-secondary mb-10 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-2">
            {settings.hero_description}
          </p>
          <div className="flex gap-3 justify-center flex-wrap px-2">
            <Link
              href="/order/dev"
              className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              Start a Project <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/developer/shop"
              className="glass-panel px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider hover:border-cyan-500/50 transition-all duration-200 flex items-center gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Browse Scripts
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-16 sm:py-24 px-4 sm:px-6 bg-secondary border-y border-theme relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">What We Build</h2>
            <p className="text-secondary text-sm">Scoped, quoted, and delivered by the dev lead — from prototype to production.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {settings.capabilities.map((cap, i) => {
              const Icon = ICONS[cap.icon] || Code2;
              return (
                <div key={i} className="p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20">
                    <Icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black mb-3">{cap.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Script Shop teaser */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center glass-panel rounded-[32px] sm:rounded-[40px] p-8 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              <ShoppingBag className="w-3 h-3" /> Script Marketplace
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-4">Ready-Made Scripts</h2>
            <p className="text-secondary text-sm max-w-xl mx-auto mb-8">Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.</p>
            <Link
              href="/developer/shop"
              className="inline-flex bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 items-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              Browse Scripts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-secondary border-y border-theme">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-8">
          <div className="glass-panel rounded-[24px] p-6 sm:p-8 text-center">
            <Shield className="w-9 h-9 sm:w-10 sm:h-10 text-cyan-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">Complete IP Transfer</h4>
            <p className="text-xs text-secondary leading-relaxed">Full source code, repository access, and ownership rights delivered with every completed project.</p>
          </div>
          <div className="glass-panel rounded-[24px] p-6 sm:p-8 text-center">
            <GitBranch className="w-9 h-9 sm:w-10 sm:h-10 text-cyan-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">Milestone Payments</h4>
            <p className="text-xs text-secondary leading-relaxed">Structured payment plans tied to build milestones — no large upfront commitment.</p>
          </div>
          <div className="glass-panel rounded-[24px] p-6 sm:p-8 text-center">
            <Clock className="w-9 h-9 sm:w-10 sm:h-10 text-cyan-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">On-Time Delivery</h4>
            <p className="text-xs text-secondary leading-relaxed">Realistic deadlines with real-time status tracking inside your client dashboard.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center glass-panel rounded-[32px] sm:rounded-[40px] p-8 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">Ready to build?</h2>
            <p className="text-secondary text-sm mb-8">Submit your project brief and get a quote within hours.</p>
            <Link
              href="/order/dev"
              className="inline-flex bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 items-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              Initialize Software Request <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <ul className="flex flex-wrap justify-center gap-x-6 sm:gap-x-8 gap-y-2 mt-8 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" /> Web apps, APIs & Database setup</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" /> Complete source code & IP transfer</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-theme py-10 sm:py-12 px-4 sm:px-6 text-center text-xs text-secondary pb-safe">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>
    </div>
  );
}
