'use client';

import { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeStats from './components/HomeStats';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as lucide from 'lucide-react';
import {
  BookOpen, LineChart, PenTool, Briefcase, Terminal, ArrowRight,
  FileEdit, Users, PackageCheck, Wallet,
  Library, ShoppingBag, ChevronDown, ArrowUpRight, CheckCircle2,
  Lock, Unlock, Eye, Download, ShieldCheck, Sparkles, HelpCircle,
  FileText, ArrowDown
} from 'lucide-react';
import { fetchPageSettings } from '@/lib/pageSettings';
import { HOME_PAGE_DEFAULTS, type HomePageContent } from '@/lib/pageContentDefaults';

const SERVICE_CARDS = [
  {
    href: '/academic-writing',
    icon: BookOpen,
    title: 'Academic Writing & Research',
    badge: 'Research Pipeline',
    description: 'Essays, theses, dissertations, and course papers — formatted to APA/MLA/Harvard guidelines. Includes plagiarism & AI scanner checks.',
    color: '#10b981', // emerald
    hoverBorder: 'hover:border-emerald-500/30',
    hoverBg: 'hover:bg-emerald-500/[0.02]',
    iconColor: 'group-hover:text-emerald-500 group-hover:border-emerald-500',
    accentClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    bullets: ['Instant dynamic word-count quotes', 'APA, MLA, Harvard, Chicago styles', 'Plagiarism & AI reports included'],
  },
  {
    href: '/statistics-fieldwork',
    icon: LineChart,
    title: 'Statistics & Fieldwork',
    badge: 'Quantitative analysis',
    description: 'SPSS dataset analysis, financial forecasting, mathematical modelling, fieldwork, and presentation slide decks.',
    color: '#a855f7', // purple
    hoverBorder: 'hover:border-purple-500/30',
    hoverBg: 'hover:bg-purple-500/[0.02]',
    iconColor: 'group-hover:text-purple-500 group-hover:border-purple-500',
    accentClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    bullets: ['Dataset cleaning & coding', 'SPSS & R-Studio modelling', 'Defense-ready summary decks'],
  },
  {
    href: '/content-writing',
    icon: PenTool,
    title: 'Content & Creative Writing',
    badge: 'SaaS & Marketing Copy',
    description: 'SEO articles, long-form eBooks, web landing page copy, and creative narrative ghostwriting with full copyright transfer.',
    color: '#f59e0b', // amber
    hoverBorder: 'hover:border-amber-500/30',
    hoverBg: 'hover:bg-amber-500/[0.02]',
    iconColor: 'group-hover:text-amber-500 group-hover:border-amber-500',
    accentClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    bullets: ['SEO-optimized word counts', 'Tailored tone & voice matching', '100% Commercial rights transfer'],
  },
  {
    href: '/resume-cv',
    icon: Briefcase,
    title: 'Executive CVs & Resumes',
    badge: 'Career acceleration',
    description: 'ATS-compatible resumes, targeted cover letters, and LinkedIn profile overhauls built to pass automated HR filters.',
    color: '#3b82f6', // blue
    hoverBorder: 'hover:border-blue-500/30',
    hoverBg: 'hover:bg-blue-500/[0.02]',
    iconColor: 'group-hover:text-blue-500 group-hover:border-blue-500',
    accentClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    bullets: ['ATS keyword matching', 'Industry-specific tailoring', 'Recruiter visibility boost'],
  },
  {
    href: '/developer',
    icon: Terminal,
    title: 'Full Stack Development',
    badge: 'Engineering',
    description: 'SaaS platforms, customized microservices, schema architecture, database migration, and source code delivery.',
    color: '#06b6d4', // cyan
    hoverBorder: 'hover:border-cyan-500/30',
    hoverBg: 'hover:bg-cyan-500/[0.02]',
    iconColor: 'group-hover:text-cyan-500 group-hover:border-cyan-500',
    accentClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    bullets: ['MVP prototype builds', 'Complete source code ownership', 'Milestone-based staging'],
  },
] as const;

export default function LandingPage() {
  const [content, setContent] = useState<HomePageContent>(HOME_PAGE_DEFAULTS);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [clickedColor, setClickedColor] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchPageSettings('home', HOME_PAGE_DEFAULTS).then(setContent);
  }, []);

  const handleCardClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, color: string) => {
    e.preventDefault();
    setClickedColor(color);
    setTimeout(() => {
      router.push(href);
    }, 450);
  };

  const { hero, trust_bar, why_us, faqs } = content;

  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-accent/30 overflow-x-hidden">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-header-32 pb-24 md:pb-32 px-4 sm:px-6 md:px-8 border-b border-theme overflow-hidden text-center">
        {/* Dynamic Glowing Aura Background */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[48rem] h-[48rem] rounded-full opacity-[0.08] blur-3xl pointer-events-none transition-all duration-1000 ease-in-out animate-blob"
          style={{ background: `radial-gradient(circle, ${hoveredColor || 'var(--accent)'}, transparent 70%)` }}
        />

        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border border-theme bg-secondary text-secondary text-xs font-semibold tracking-wide mx-auto">
            <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span>{hero.badge}</span>
          </div>
          
          <h1 className="text-[2.75rem] leading-[1.08] sm:text-6xl md:text-[4rem] font-bold tracking-tight text-primary max-w-3xl mx-auto">
            {hero.title_prefix}{' '}
            <span
              className="bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent transition-all duration-700 font-extrabold"
              style={{
                backgroundImage: hoveredColor 
                  ? `linear-gradient(to right, ${hoveredColor}, #a855f7)` 
                  : undefined
              }}
            >
              {hero.title_highlight_1}
            </span>{' '}
            {hero.title_mid} <span className="block mt-2 text-secondary">{hero.title_highlight_2}</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-secondary max-w-2xl mx-auto leading-relaxed">
            {hero.subtitle}
          </p>

          <div className="flex gap-4 justify-center flex-wrap items-center pt-2">
            <a
              href="#services"
              className="bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-accent/10"
            >
              Explore Services <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#process"
              className="border border-theme hover:border-strong bg-secondary/50 px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:bg-secondary flex items-center gap-2 text-primary"
            >
              See How It Works
            </a>
          </div>

          {/* Quick trust metrics */}
          <div className="pt-8 border-t border-theme grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            <div>
              <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                <span>0%</span>
                <span className="text-xs text-accent">Plagiarism</span>
              </div>
              <div className="text-xs text-secondary mt-1">Guaranteed & verified</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                <span>100k+</span>
                <span className="text-xs text-purple-400">Topics</span>
              </div>
              <div className="text-xs text-secondary mt-1"><HomeStats compact={true} /> in stock</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                <span>100%</span>
                <span className="text-xs text-cyan-400">Escrow</span>
              </div>
              <div className="text-xs text-secondary mt-1">Milestone delivery</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                <span>24/7</span>
                <span className="text-xs text-blue-400">Support</span>
              </div>
              <div className="text-xs text-secondary mt-1">WhatsApp documented</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="bg-secondary/40 py-8 border-b border-theme relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <p className="text-center text-[10px] font-black uppercase text-secondary tracking-wider mb-6">
            Guaranteed protection metrics on every order
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trust_bar.map((item, i) => (
              <div key={i} className="glass-panel p-4 rounded-xl border border-theme flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary border border-theme flex items-center justify-center text-accent shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-primary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section (Redesigned Bento Grid) */}
      <section id="services" className="py-24 md:py-32 px-4 sm:px-6 md:px-8 relative">
        {/* Subtle glow background */}
        <div className="absolute right-0 top-1/3 w-[30rem] h-[30rem] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <span className="text-xs font-black uppercase text-accent tracking-wider">Services Matrix</span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">Every order, customized to your brief</h2>
            </div>
            <p className="text-secondary text-sm max-w-md">
              Each pipeline has a dedicated specialist team and a customizable quote module. Select a pipeline to start configuration.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {SERVICE_CARDS.map((card, index) => {
              const Icon = card.icon;
              const isHovered = hoveredColor === card.color;
              
              // Define spanning widths for Bento look
              const spanClass = index === 0 || index === 3
                ? 'md:col-span-7'
                : index === 1 || index === 2
                  ? 'md:col-span-5'
                  : 'md:col-span-12';

              return (
                <Link
                  key={card.href}
                  href={card.href}
                  onMouseEnter={() => setHoveredColor(card.color)}
                  onMouseLeave={() => setHoveredColor(null)}
                  onClick={(e) => handleCardClick(e, card.href, card.color)}
                  className={`group ${spanClass} relative rounded-[28px] border border-theme bg-card hover:bg-secondary/40 p-6 md:p-8 flex flex-col justify-between transition-all duration-300 ${card.hoverBorder} overflow-hidden select-none cursor-pointer`}
                  style={{
                    boxShadow: isHovered ? `0 0 30px ${card.color}0a` : undefined
                  }}
                >
                  {/* Floating card background glow */}
                  <div
                    className="absolute -right-16 -top-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-[0.15] blur-2xl transition-opacity duration-500 pointer-events-none"
                    style={{ backgroundColor: card.color }}
                  />

                  <div className="space-y-6">
                    {/* Badge & Icon header */}
                    <div className="flex justify-between items-start">
                      <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${card.accentClass}`}>
                        {card.badge}
                      </div>
                      <div
                        className={`w-10 h-10 rounded-xl border border-theme flex items-center justify-center text-secondary transition-all duration-300 group-hover:shadow-md ${card.iconColor}`}
                        style={{
                          borderColor: isHovered ? card.color : undefined,
                          boxShadow: isHovered ? `0 0 10px ${card.color}15` : undefined
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Copy */}
                    <div className="space-y-2">
                      <h3
                        className="text-lg md:text-xl font-bold text-primary group-hover:text-primary transition-colors duration-300"
                        style={{ color: isHovered ? card.color : undefined }}
                      >
                        {card.title}
                      </h3>
                      <p className="text-xs md:text-sm text-secondary leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    {/* Bullets */}
                    <ul className="space-y-2 border-t border-theme/60 pt-4">
                      {card.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-secondary font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: card.color }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Arrow element */}
                  <div className="mt-8 pt-4 border-t border-theme/30 flex items-center justify-between text-xs text-secondary font-semibold group-hover:text-primary transition-colors">
                    <span>Configure Service Pipeline</span>
                    <ArrowUpRight
                      className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                      style={{ color: isHovered ? card.color : undefined }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process Flow timeline */}
      <section id="process" className="py-24 md:py-32 px-4 sm:px-6 md:px-8 border-t border-theme relative bg-secondary/20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-black uppercase text-accent tracking-wider font-semibold">Accountability Protocol</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">How the escrow works</h2>
            <p className="text-secondary text-sm max-w-md mx-auto">
              Our structured milestones remove project risk, ensuring the writer is compensated only after original proof reports are uploaded.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Horizontal line for desktop */}
            <div className="hidden md:block absolute top-[22px] left-12 right-12 h-[1px] bg-theme" />

            {[
              { icon: FileEdit, title: '1. Configure & Submit Brief', description: 'Select a custom service pipeline, specify requirements (page/word counts, deadlines), and get an instant quote.' },
              { icon: Wallet, title: '2. Fund Escrow (Milestone 1)', description: 'Pay the deposit (60% standard or customized installments) securely via Paystack card gateway or your wallet balance.' },
              { icon: Users, title: '3. Track Writer Drafts', description: 'Monitor logs and timelines in your client dashboard. Revisions can be submitted directly into the Word document review system.' },
              { icon: PackageCheck, title: '4. Unlock Secure Vault', description: 'Confirm plagiarism reports and original AI scans, clear the remaining balance, and download the fully unlocked docx files.' },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="space-y-4 relative glass-panel p-6 rounded-2xl border border-theme hover:border-strong transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-primary border border-theme flex items-center justify-center text-accent shadow-sm z-10">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <span className="text-xs font-black text-secondary">0{i + 1}</span>
                  </div>
                  <h4 className="font-bold text-primary text-sm">{step.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Instantly Buy Section (Teaser for Projects and Dev shop) */}
      <section className="py-24 md:py-32 px-4 sm:px-6 md:px-8 border-t border-theme relative">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <span className="text-xs font-black uppercase text-accent tracking-wider font-semibold">Immediate Dispatch</span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">No brief, no waiting time</h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">
              Need a verified reference document or ready-made code solution immediately? Skip custom bidding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Projects Card */}
            <Link
              href="/projects"
              onMouseEnter={() => setHoveredColor('#10b981')}
              onMouseLeave={() => setHoveredColor(null)}
              onClick={(e) => handleCardClick(e, '/projects', '#10b981')}
              className="group block relative rounded-[28px] bg-card border border-theme hover:border-emerald-500/30 p-6 sm:p-8 transition-all duration-500 hover:bg-emerald-500/[0.01]"
              style={{
                boxShadow: hoveredColor === '#10b981' ? '0 0 30px rgba(16,185,129,0.05)' : undefined
              }}
            >
              <div className="flex justify-between items-start mb-6">
                <div
                  className="w-12 h-12 rounded-xl bg-primary border border-theme flex items-center justify-center text-secondary transition-all duration-300"
                  style={{
                    borderColor: hoveredColor === '#10b981' ? '#10b981' : undefined,
                    color: hoveredColor === '#10b981' ? '#10b981' : undefined
                  }}
                >
                  <Library className="w-5 h-5" />
                </div>
                <ArrowUpRight
                  className="w-5 h-5 text-secondary transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                  style={{ color: hoveredColor === '#10b981' ? '#10b981' : undefined }}
                />
              </div>

              <h3
                className="text-xl font-bold mb-3 transition-colors duration-300"
                style={{ color: hoveredColor === '#10b981' ? '#10b981' : undefined }}
              >
                Ready-Made Projects
              </h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">
                Browse our indexed repository of 100,000+ pre-defended thesis briefs and reference papers across various academic departments. Download instantly from the dashboard vault.
              </p>

              <div className="border-t border-theme/60 pt-4 mt-6 flex items-center justify-between text-xs text-secondary font-medium">
                <HomeStats />
                <span className="text-emerald-400 font-semibold group-hover:underline">Browse Repository</span>
              </div>
            </Link>

            {/* Script marketplace Card */}
            <Link
              href="/developer/shop"
              onMouseEnter={() => setHoveredColor('#06b6d4')}
              onMouseLeave={() => setHoveredColor(null)}
              onClick={(e) => handleCardClick(e, '/developer/shop', '#06b6d4')}
              className="group block relative rounded-[28px] bg-card border border-theme hover:border-cyan-500/30 p-6 sm:p-8 transition-all duration-500 hover:bg-cyan-500/[0.01]"
              style={{
                boxShadow: hoveredColor === '#06b6d4' ? '0 0 30px rgba(6,182,212,0.05)' : undefined
              }}
            >
              <div className="flex justify-between items-start mb-6">
                <div
                  className="w-12 h-12 rounded-xl bg-primary border border-theme flex items-center justify-center text-secondary transition-all duration-300"
                  style={{
                    borderColor: hoveredColor === '#06b6d4' ? '#06b6d4' : undefined,
                    color: hoveredColor === '#06b6d4' ? '#06b6d4' : undefined
                  }}
                >
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <ArrowUpRight
                  className="w-5 h-5 text-secondary transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                  style={{ color: hoveredColor === '#06b6d4' ? '#06b6d4' : undefined }}
                />
              </div>

              <h3
                className="text-xl font-bold mb-3 transition-colors duration-300"
                style={{ color: hoveredColor === '#06b6d4' ? '#06b6d4' : undefined }}
              >
                Script Marketplace
              </h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">
                Purchase pre-packaged, functional script utilities, landing page templates, and database schemas. Shipped with full documentation, clean source code, and lifetime updates.
              </p>

              <div className="border-t border-theme/60 pt-4 mt-6 flex items-center justify-between text-xs text-secondary font-medium">
                <span>Complete source code ownership</span>
                <span className="text-cyan-400 font-semibold group-hover:underline">Browse Scripts</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Us / Integrity Section */}
      <section className="py-24 md:py-32 px-4 sm:px-6 md:px-8 bg-secondary/30 border-t border-theme relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-black uppercase text-accent tracking-wider font-semibold">Integrity Protocol</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">High-standard project accountability</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-theme rounded-2xl overflow-hidden border border-theme">
            {why_us.map((item, i) => {
              const Icon = (lucide as any)[item.icon] || CheckCircle2;
              return (
                <div key={i} className="bg-primary p-8 hover:bg-secondary/20 transition duration-300 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center text-accent mb-6">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <h4 className="font-bold text-primary mb-2 text-sm">{item.title}</h4>
                    <p className="text-xs text-secondary leading-relaxed">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-24 md:py-32 px-4 sm:px-6 md:px-8 border-t border-theme relative">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-black uppercase text-accent tracking-wider font-semibold">Help Center</span>
            <h2 className="text-3xl font-bold tracking-tight text-primary">Frequently asked questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group border border-theme bg-card hover:bg-secondary/40 rounded-2xl p-5 [&_summary::-webkit-details-marker]:hidden transition-all">
                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-sm text-primary gap-4">
                  <span>{faq.q}</span>
                  <div className="w-6 h-6 rounded-lg bg-secondary border border-theme flex items-center justify-center text-secondary transition-transform duration-300 group-open:rotate-180 shrink-0">
                    <ChevronDown className="w-4 h-4 text-secondary" />
                  </div>
                </summary>
                <div className="border-t border-theme/60 mt-4 pt-4 text-xs text-secondary leading-relaxed whitespace-pre-line">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Redesigned Banner */}
      <section className="py-24 md:py-32 px-4 sm:px-6 md:px-8 border-t border-theme relative bg-secondary/30">
        <div className="max-w-4xl mx-auto rounded-[36px] bg-gradient-to-b from-card to-primary border border-theme p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
          {/* Subtle gradient blob behind content */}
          <div className="absolute inset-0 bg-accent/[0.02] blur-xl pointer-events-none" />

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to get your project done properly?</h2>
            <p className="text-secondary text-sm md:text-base leading-relaxed">
              Submit your detailed requirements now for an instant pipeline quote, or chat with our operations lead on WhatsApp for a custom invoice schedule.
            </p>
            <div className="flex gap-4 justify-center flex-wrap pt-4">
              <a
                href="#services"
                className="bg-accent hover:bg-accent-hover text-black px-8 py-4 rounded-xl text-sm font-bold active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-accent/10"
              >
                Configure Pipeline <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/2348121443666"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-theme hover:border-strong bg-secondary/50 px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:bg-secondary flex items-center gap-2 text-primary"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-theme py-16 px-4 sm:px-6 md:px-8 pb-safe bg-card">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-sm border-b border-theme/60 pb-12 mb-12">
          <div className="col-span-2 space-y-4">
            <Link href="/" className="text-lg font-bold tracking-tight flex items-center gap-2 select-none group">
              <div className="w-8 h-8 bg-primary border border-theme rounded-lg flex items-center justify-center text-primary font-black text-xs group-hover:border-accent transition-colors">
                RW
              </div>
              <span className="text-primary font-bold">ResearchWriter</span>
            </Link>
            <p className="text-xs text-secondary leading-relaxed max-w-xs">
              Secure custom project pipeline scheduling for academic research, SPSS/math fieldwork, SEO creative copywriting, executive career documents, and custom software builds.
            </p>
          </div>
          <div>
            <h5 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Services</h5>
            <ul className="space-y-3 text-xs font-medium">
              <li><Link href="/academic-writing" className="text-secondary hover:text-emerald-400 transition-colors">Academic Writing</Link></li>
              <li><Link href="/statistics-fieldwork" className="text-secondary hover:text-purple-400 transition-colors">Statistics & Fieldwork</Link></li>
              <li><Link href="/content-writing" className="text-secondary hover:text-amber-400 transition-colors">Content Writing</Link></li>
              <li><Link href="/resume-cv" className="text-secondary hover:text-blue-400 transition-colors">Executive Resumes</Link></li>
              <li><Link href="/developer" className="text-secondary hover:text-cyan-400 transition-colors">Software Development</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Buy Instantly</h5>
            <ul className="space-y-3 text-xs font-medium">
              <li><Link href="/projects" className="text-secondary hover:text-primary transition-colors">Ready-Made Projects</Link></li>
              <li><Link href="/developer/shop" className="text-secondary hover:text-primary transition-colors">Script Shop</Link></li>
              <li><Link href="#faq" className="text-secondary hover:text-primary transition-colors">FAQ Support</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Account</h5>
            <ul className="space-y-3 text-xs font-medium">
              <li><Link href="/login" className="text-secondary hover:text-primary transition-colors">Client Login</Link></li>
              <li><Link href="/register" className="text-secondary hover:text-primary transition-colors">Register Account</Link></li>
              <li><Link href="/dashboard/client" className="text-secondary hover:text-primary transition-colors">Dashboard Vault</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-secondary gap-4">
          <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="text-[10px] text-secondary">Paystack Secure Gateway</span>
            <span className="text-[10px] text-secondary">Distributed Vault Escrow v2.4</span>
          </div>
        </div>
      </footer>

      {/* Full-screen transition overlay when a service page is clicked */}
      <div
        className={`fixed inset-0 z-[999] pointer-events-none transition-all duration-500 ease-in-out ${clickedColor ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background: clickedColor
            ? `radial-gradient(circle at center, ${clickedColor}33 0%, var(--bg-primary, #050505) 80%)`
            : 'transparent',
          backdropFilter: clickedColor ? 'blur(4px)' : 'none',
        }}
      />
    </div>
  );
}
