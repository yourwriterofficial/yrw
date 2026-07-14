'use client';

import { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeStats from './components/HomeStats';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import {
  BookOpen, LineChart, PenTool, Briefcase, Terminal, ArrowRight,
  FileEdit, Users, PackageCheck, Wallet,
  Library, ShoppingBag, ChevronDown, ArrowUpRight,
} from 'lucide-react';
import { fetchPageSettings } from '@/lib/pageSettings';
import { HOME_PAGE_DEFAULTS, type HomePageContent } from '@/lib/pageContentDefaults';

const SERVICE_CARDS = [
  {
    href: '/academic-writing', icon: BookOpen,
    title: 'Academic writing & research',
    description: 'Essays, term papers, and university assignments — with automated volume discounts and plagiarism checks.',
  },
  {
    href: '/statistics-fieldwork', icon: LineChart,
    title: 'Statistics, maths & fieldwork',
    description: 'SPSS analysis, mathematical modelling, financial computation, fieldwork, and presentation decks.',
  },
  {
    href: '/content-writing', icon: PenTool,
    title: 'Content & creative writing',
    description: 'eBooks, web copy, and SEO articles — tailored tone of voice and stylistic requirements.',
  },
  {
    href: '/resume-cv', icon: Briefcase,
    title: 'Executive CVs & resumes',
    description: 'ATS-friendly resumes, cover letters, and LinkedIn optimization built to pass automated filters.',
  },
  {
    href: '/developer', icon: Terminal,
    title: 'Full stack & custom software',
    description: 'Web applications, mobile builds, database design, and a marketplace of ready-made scripts.',
  },
] as const;

export default function LandingPage() {
  const [content, setContent] = useState<HomePageContent>(HOME_PAGE_DEFAULTS);

  useEffect(() => {
    fetchPageSettings('home', HOME_PAGE_DEFAULTS).then(setContent);
  }, []);

  const { hero, trust_bar, why_us, faqs } = content;

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-accent/30">
      <Header />

      {/* Hero */}
      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-medium text-secondary tracking-wide mb-5">{hero.badge}</p>
          <h1 className="text-[2.5rem] leading-[1.1] sm:text-6xl sm:leading-[1.08] font-semibold tracking-tight mb-6">
            {hero.title_prefix} <span className="text-accent">{hero.title_highlight_1}</span> {hero.title_mid} {hero.title_highlight_2}
          </h1>
          <p className="text-base sm:text-lg text-secondary mb-9 max-w-xl mx-auto leading-relaxed">
            {hero.subtitle}
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="#services"
              className="bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all flex items-center gap-2"
            >
              Explore services <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/projects"
              className="border border-theme hover:border-strong px-6 py-3 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 text-primary"
            >
              Browse ready-made projects
            </Link>
          </div>
        </div>

        {/* Stat strip */}
        <div className="max-w-4xl mx-auto mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-4 border-y border-theme divide-y sm:divide-y-0 sm:divide-x divide-theme">
          <div className="px-4 py-4 sm:py-5 text-center">
            <div className="text-lg sm:text-2xl font-semibold text-primary"><HomeStats className="tabular-nums" /></div>
          </div>
          {trust_bar.slice(0, 3).map((item, i) => (
            <div key={i} className="px-4 py-4 sm:py-5 text-center">
              <div className="text-sm text-secondary">{item}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <p className="text-xs font-medium text-secondary tracking-wide mb-2">Custom order services</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Every service, scoped to your brief</h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">Each service has its own page — see what's included, then get a quote when you're ready.</p>
          </div>

          <div className="border-t border-theme">
            {SERVICE_CARDS.map(card => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-center gap-5 sm:gap-8 py-6 border-b border-theme hover:bg-secondary/60 transition-colors -mx-4 px-4 sm:-mx-6 sm:px-6"
                >
                  <div className="w-9 h-9 rounded-lg border border-theme flex items-center justify-center shrink-0 text-secondary group-hover:text-accent group-hover:border-accent transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-primary mb-0.5">{card.title}</h3>
                    <p className="text-sm text-secondary leading-relaxed hidden sm:block">{card.description}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-secondary group-hover:text-primary transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Buy instantly */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-medium text-secondary tracking-wide mb-2">Buy instantly</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">No brief, no wait</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/projects" className="group block p-6 sm:p-8 rounded-2xl bg-card border border-theme hover:border-strong transition-colors">
              <div className="flex items-start justify-between mb-6">
                <div className="w-9 h-9 rounded-lg border border-theme flex items-center justify-center text-secondary">
                  <Library className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ready-made projects</h3>
              <p className="text-sm text-secondary mb-5 leading-relaxed">Thousands of completed project topics across every department — Chapters 1–5, delivered to your vault within hours.</p>
              <p className="text-sm text-secondary"><HomeStats /></p>
            </Link>

            <Link href="/developer/shop" className="group block p-6 sm:p-8 rounded-2xl bg-card border border-theme hover:border-strong transition-colors">
              <div className="flex items-start justify-between mb-6">
                <div className="w-9 h-9 rounded-lg border border-theme flex items-center justify-center text-secondary">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Script marketplace</h3>
              <p className="text-sm text-secondary mb-5 leading-relaxed">Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.</p>
              <p className="text-sm text-secondary">Complete source code, yours to keep</p>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="process" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-medium text-secondary tracking-wide mb-2">Process</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {[
              { icon: FileEdit, title: 'Submit a brief', description: 'Pick a service, share your requirements, and get an instant or custom quote.' },
              { icon: Wallet, title: 'Pay securely', description: 'Pay in full or in milestones — by card, transfer, or wallet balance.' },
              { icon: Users, title: 'We get to work', description: 'A specialist is assigned; progress is tracked live in your dashboard.' },
              { icon: PackageCheck, title: 'Vault delivery', description: 'Final work lands encrypted in your vault, ready to download.' },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-secondary">{String(i + 1).padStart(2, '0')}</span>
                    <div className="h-px flex-1 bg-theme" />
                    <Icon className="w-4 h-4 text-secondary" />
                  </div>
                  <h4 className="font-semibold mb-1.5 text-sm">{step.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-secondary border-t border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-medium text-secondary tracking-wide mb-2">Why ResearchWriter</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Built for accountability</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-theme rounded-2xl overflow-hidden border border-theme">
            {why_us.map((item, i) => {
              const Icon = (lucide as any)[item.icon] || lucide.CheckCircle2;
              return (
                <div key={i} className="bg-secondary p-6">
                  <Icon className="w-5 h-5 text-accent mb-4" />
                  <h4 className="font-semibold mb-1.5 text-sm">{item.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-medium text-secondary tracking-wide mb-2">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          </div>
          <div className="border-t border-theme">
            {faqs.map((faq, i) => (
              <details key={i} className="group border-b border-theme py-4">
                <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-sm text-primary gap-4">
                  {faq.q}
                  <ChevronDown className="w-4 h-4 text-secondary transition-transform duration-200 group-open:rotate-180 shrink-0" />
                </summary>
                <p className="text-sm text-secondary leading-relaxed mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Ready to get started?</h2>
          <p className="text-secondary text-sm mb-8">Order custom work, or grab something ready-made — either way, it lands in your secure vault.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="#services"
              className="bg-accent hover:bg-accent-hover text-black px-6 py-3 rounded-full text-sm font-semibold active:scale-[0.98] transition-all flex items-center gap-2"
            >
              Explore services <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/projects"
              className="border border-theme hover:border-strong px-6 py-3 rounded-full text-sm font-semibold transition-colors text-primary"
            >
              Browse ready-made projects
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-theme py-14 px-4 sm:px-6 pb-safe">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-base font-semibold tracking-tight flex items-center gap-2 mb-3">
              <div className="w-6 h-6 border border-theme rounded-md flex items-center justify-center text-xs font-bold">RW</div>
              ResearchWriter
            </Link>
            <p className="text-xs text-secondary leading-relaxed">Academic writing, software, and creative services.</p>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-secondary mb-3">Custom services</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/academic-writing" className="text-secondary hover:text-primary transition-colors">Academic writing</Link></li>
              <li><Link href="/content-writing" className="text-secondary hover:text-primary transition-colors">Content writing</Link></li>
              <li><Link href="/resume-cv" className="text-secondary hover:text-primary transition-colors">CVs & resumes</Link></li>
              <li><Link href="/statistics-fieldwork" className="text-secondary hover:text-primary transition-colors">Statistics & fieldwork</Link></li>
              <li><Link href="/developer" className="text-secondary hover:text-primary transition-colors">Full stack dev</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-secondary mb-3">Buy instantly</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/projects" className="text-secondary hover:text-primary transition-colors">Ready-made projects</Link></li>
              <li><Link href="/developer/shop" className="text-secondary hover:text-primary transition-colors">Script shop</Link></li>
              <li><Link href="#faq" className="text-secondary hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-semibold text-secondary mb-3">Account</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/login" className="text-secondary hover:text-primary transition-colors">Client login</Link></li>
              <li><Link href="/register" className="text-secondary hover:text-primary transition-colors">Register</Link></li>
              <li><Link href="/dashboard/client" className="text-secondary hover:text-primary transition-colors">Dashboard</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto border-t border-theme mt-10 pt-6 text-xs text-secondary">
          <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
