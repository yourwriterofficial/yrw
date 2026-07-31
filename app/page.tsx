'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from './components/Header';
import HomeStats from './components/HomeStats';
import PromoBanner from './components/PromoBanner';
import Footer from './components/Footer';
import * as lucide from 'lucide-react';
import {
  BookOpen, LineChart, PenTool, Briefcase, Terminal, ArrowRight,
  FileEdit, Users, PackageCheck, Wallet, ArrowUpRight, CheckCircle2, Sparkles,
  ShieldCheck, Quote, Zap, Globe2, Library, ShoppingBag, ChevronDown,
} from 'lucide-react';
import Button from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import Card from './components/ui/Card';
import { fetchPageSettings } from '@/lib/pageSettings';
import { HOME_PAGE_DEFAULTS, type HomePageContent } from '@/lib/pageContentDefaults';
import { SERVICE_ACCENTS } from '@/lib/serviceAccents';

const SERVICE_CARDS = SERVICE_ACCENTS.map((s) => ({
  ...s,
  Icon: ({ BookOpen, LineChart, PenTool, Briefcase, Terminal } as any)[s.iconName],
  description: {
    academic: 'Essays, theses, dissertations, and course papers — formatted to APA, MLA, Harvard, Chicago guidelines. Includes plagiarism & AI scanner checks.',
    statistics: 'SPSS dataset analysis, financial forecasting, mathematical modelling, fieldwork, and presentation slide decks.',
    content: 'SEO articles, long-form eBooks, web landing page copy, and creative narrative ghostwriting with full copyright transfer.',
    resume: 'ATS-compatible resumes, targeted cover letters, and LinkedIn profile overhauls built to pass automated HR filters.',
    dev: 'SaaS platforms, customized microservices, schema architecture, database migration, and source code delivery.',
  }[s.slug],
  bullets: {
    academic: ['Instant dynamic word-count quotes', 'APA, MLA, Harvard, Chicago styles', 'Plagiarism & AI reports included'],
    statistics: ['Dataset cleaning & coding', 'SPSS & R-Studio modelling', 'Defense-ready summary decks'],
    content: ['SEO-optimized word counts', 'Tailored tone & voice matching', '100% commercial rights transfer'],
    resume: ['ATS keyword matching', 'Industry-specific tailoring', 'Recruiter visibility boost'],
    dev: ['MVP prototype builds', 'Complete source code ownership', 'Milestone-based staging'],
  }[s.slug],
}));

export default function LandingPage() {
  const [content, setContent] = useState<HomePageContent>(HOME_PAGE_DEFAULTS);

  useEffect(() => {
    fetchPageSettings('home', HOME_PAGE_DEFAULTS).then(setContent);
  }, []);

  const { hero, trust_bar, why_us, faqs } = content;

  return (
    <div className="min-h-screen bg-primary text-primary selection:bg-accent/30 overflow-x-hidden">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-header-32 pb-2">
        <PromoBanner position="header" />
      </div>

      {/* Hero with aurora + grain */}
      <section className="relative pt-12 pb-24 md:pb-32 px-4 sm:px-6 md:px-8 overflow-hidden text-center">
        <div className="aurora-bg absolute inset-0 pointer-events-none" />
        <div className="grain-overlay absolute inset-0 pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <Badge variant="default" className="mx-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-accent mr-1.5" /> {hero.badge}
          </Badge>

          <h1 className="font-bold tracking-tight text-primary text-[2.75rem] leading-[1.04] sm:text-6xl md:text-[4.5rem] md:leading-[1.04] max-w-4xl mx-auto">
            <span className="font-display italic font-medium">{hero.title_prefix}</span>{' '}
            <span className="bg-gradient-to-r from-accent via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              {hero.title_highlight_1}
            </span>
            <br className="hidden sm:block" />
            <span className="text-secondary">{hero.title_highlight_2}</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-secondary max-w-2xl mx-auto leading-relaxed">
            {hero.subtitle}
          </p>

          <div className="flex gap-4 justify-center flex-wrap items-center pt-2">
            <Button href="#services" size="lg">
              Explore Services <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="#process" variant="outline" size="lg">
              See how it works
            </Button>
          </div>

          {/* Quick trust metrics */}
          <div className="pt-10 border-t border-theme/60 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary flex items-center justify-center gap-1">
                <span>0%</span>
                <span className="text-xs font-bold text-accent">Plagiarism</span>
              </div>
              <div className="text-xs text-secondary mt-1">Guaranteed & verified</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary flex items-center justify-center gap-1">
                <span>100k+</span>
                <span className="text-xs font-bold text-accent">Topics</span>
              </div>
              <div className="text-xs text-secondary mt-1"><HomeStats compact={true} /> in stock</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary flex items-center justify-center gap-1">
                <span>100%</span>
                <span className="text-xs font-bold text-accent">Escrow</span>
              </div>
              <div className="text-xs text-secondary mt-1">Milestone delivery</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-primary flex items-center justify-center gap-1">
                <span>24/7</span>
                <span className="text-xs font-bold text-accent">Support</span>
              </div>
              <div className="text-xs text-secondary mt-1">WhatsApp documented</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y border-theme bg-card/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10">
          <p className="text-center text-[10px] font-bold uppercase text-secondary tracking-widest mb-6">
            Guaranteed protection on every order
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trust_bar.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 surface text-xs font-semibold text-primary">
                <div className="w-8 h-8 rounded-lg bg-secondary border border-theme flex items-center justify-center text-accent shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Bento */}
      <section id="services" className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 relative">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Services</span>
              <h2 className="font-bold tracking-tight text-primary text-3xl sm:text-4xl md:text-5xl">
                Every order, customised to your brief
              </h2>
            </div>
            <p className="text-secondary text-sm max-w-md">
              Each pipeline has a dedicated specialist team and a customisable quote module. Pick a pipeline to start configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {SERVICE_CARDS.map((card) => {
              const Icon = card.Icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group relative rounded-2xl border border-theme bg-card hover:border-strong transition-all duration-300 overflow-hidden select-none p-5 flex flex-col gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${card.color} ${card.bg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-primary text-sm transition-colors duration-300 group-hover:text-accent">
                    {card.label}
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed line-clamp-2 flex-1">{card.description}</p>
                  <div className="flex items-center justify-between text-[11px] text-secondary font-bold group-hover:text-primary transition-colors pt-2 border-t border-theme/30">
                    <span>Configure</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-secondary transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 border-t border-theme bg-card/30 relative">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Accountability Protocol</span>
            <h2 className="font-bold tracking-tight text-primary text-3xl sm:text-4xl md:text-5xl">
              How the escrow works
            </h2>
            <p className="text-secondary text-sm max-w-md mx-auto">
              Our structured milestones remove project risk. The writer is paid only after original proof reports are uploaded.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              { icon: FileEdit, title: '1. Configure & submit', description: 'Select a custom service pipeline, specify requirements (page/word counts, deadlines), and get an instant quote.' },
              { icon: Wallet, title: '2. Fund escrow', description: 'Pay the deposit (60% standard or customised installments) securely via Paystack or wallet balance.' },
              { icon: Users, title: '3. Track drafts', description: 'Monitor logs and timelines in your client dashboard. Submit revisions directly to the document.' },
              { icon: PackageCheck, title: '4. Unlock vault', description: 'Confirm plagiarism and AI scans, clear the remaining balance, and download the unlocked docx files.' },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <Card key={i} padding="lg" className="relative">
                  <div className="w-11 h-11 rounded-xl bg-secondary border border-theme flex items-center justify-center text-accent mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-primary text-sm mb-2">{step.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Buy */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 border-t border-theme">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Immediate dispatch</span>
              <h2 className="font-bold tracking-tight text-primary text-3xl sm:text-4xl md:text-5xl">
                No brief, no waiting time
              </h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">
              Need a verified reference document or a ready-made code solution immediately? Skip custom bidding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Link href="/projects" className="group relative rounded-2xl bg-card border border-theme hover:border-strong transition-all duration-300 p-7 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-secondary border border-theme flex items-center justify-center text-secondary transition-all duration-300 group-hover:border-accent/30 group-hover:text-accent">
                  <Library className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-secondary transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 transition-colors duration-300 group-hover:text-accent">Ready-made projects</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">
                Browse our indexed repository of 100,000+ pre-defended thesis briefs and reference papers across various academic departments.
              </p>
              <div className="border-t border-theme/60 pt-4 flex items-center justify-between text-xs text-secondary">
                <HomeStats />
                <span className="text-accent font-bold group-hover:underline">Browse repository</span>
              </div>
            </Link>

            <Link href="/developer/shop" className="group relative rounded-2xl bg-card border border-theme hover:border-strong transition-all duration-300 p-7 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-secondary border border-theme flex items-center justify-center text-secondary transition-all duration-300 group-hover:border-accent/30 group-hover:text-accent">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-secondary transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3 transition-colors duration-300 group-hover:text-accent">Script marketplace</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">
                Purchase pre-packaged, functional script utilities, landing page templates, and database schemas. Shipped with full documentation and clean source code.
              </p>
              <div className="border-t border-theme/60 pt-4 flex items-center justify-between text-xs text-secondary">
                <span>Complete source code ownership</span>
                <span className="text-accent font-bold group-hover:underline">Browse scripts</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 border-t border-theme bg-card/30">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Integrity Protocol</span>
            <h2 className="font-bold tracking-tight text-primary text-3xl sm:text-4xl md:text-5xl">
              High-standard project accountability
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {why_us.map((item, i) => {
              const Icon = (lucide as any)[item.icon] || CheckCircle2;
              return (
                <Card key={i} padding="lg" className="flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center text-accent mb-5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-primary mb-2 text-sm">{item.title}</h4>
                    <p className="text-xs text-secondary leading-relaxed">{item.text}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonial pull-quote */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 border-t border-theme relative">
        <div className="aurora-bg absolute inset-0 opacity-50 pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <Quote className="w-10 h-10 text-accent mx-auto mb-6" />
          <p className="font-display italic text-2xl md:text-3xl text-primary leading-snug">
            The escrow kept both sides honest. I got my dissertation defended before the deadline, with original reports attached. Nothing else in Nigeria comes close.
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary mt-6">Adaeze O. — UNILAG MSc Public Health</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 border-t border-theme">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-bold uppercase text-accent tracking-widest">Help Centre</span>
            <h2 className="font-bold tracking-tight text-primary text-3xl sm:text-4xl">Frequently asked questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group border border-theme bg-card hover:bg-secondary/40 rounded-2xl p-5 [&_summary::-webkit-details-marker]:hidden transition-all">
                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-sm text-primary gap-4">
                  <span>{faq.q}</span>
                  <span className="w-7 h-7 rounded-lg bg-secondary border border-theme flex items-center justify-center text-secondary transition-transform duration-300 group-open:rotate-180 shrink-0">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </summary>
                <div className="border-t border-theme/60 mt-4 pt-4 text-xs text-secondary leading-relaxed whitespace-pre-line">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 md:px-8 border-t border-theme">
        <div className="max-w-4xl mx-auto rounded-2xl bg-card border border-theme p-8 md:p-12 text-center relative overflow-hidden shadow-elevation-3">
          <Sparkles className="w-8 h-8 text-accent mx-auto mb-4" />
          <h2 className="font-bold tracking-tight text-2xl md:text-4xl text-primary">Ready to get your project done properly?</h2>
          <p className="text-secondary text-sm md:text-base leading-relaxed max-w-xl mx-auto mt-4">
            Submit your detailed requirements now for an instant pipeline quote, or chat with our operations lead on WhatsApp for a custom invoice schedule.
          </p>
          <div className="flex gap-4 justify-center flex-wrap pt-6">
            <Button href="#services" size="lg">
              Configure pipeline <ArrowRight className="w-4 h-4" />
            </Button>
            <Button href="https://wa.me/2348121443666" variant="outline" size="lg">
              Chat on WhatsApp
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10">
        <PromoBanner position="footer" />
      </div>

      <Footer />
    </div>
  );
}