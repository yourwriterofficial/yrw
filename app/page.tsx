'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, PenLine } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import PromoBanner from './components/PromoBanner';
import QuoteRequestForm from './components/QuoteRequestForm';
import { fetchPageSettings } from '@/lib/pageSettings';
import { HOME_PAGE_DEFAULTS, type HomePageContent } from '@/lib/pageContentDefaults';

type ServiceSlug = 'academic' | 'statistics' | 'content' | 'resume' | 'dev';

const SERVICES: { slug: ServiceSlug; tab: string; title: string; summary: string; covers: string[] }[] = [
  {
    slug: 'academic', tab: 'Academic', title: 'Academic writing & research',
    summary: 'Essays, term papers, theses and dissertations, referenced to your institution\'s guidelines and written by someone who knows your field.',
    covers: ['Essays and term papers', 'Dissertations and theses, chapter by chapter', 'APA, MLA, Harvard and Chicago referencing', 'Plagiarism and AI reports with delivery'],
  },
  {
    slug: 'statistics', tab: 'Statistics', title: 'Statistics, maths & fieldwork',
    summary: 'Data analysis and fieldwork for projects that need more than a standard write-up. Priced to the scope of the work.',
    covers: ['SPSS and statistical analysis', 'Questionnaire design and data collection', 'Financial and mathematical modelling', 'Slides summarising your findings'],
  },
  {
    slug: 'content', tab: 'Content', title: 'Content & creative writing',
    summary: 'Articles, web copy, eBooks and stories in the tone you ask for, with full commercial rights passing to you.',
    covers: ['SEO articles and landing page copy', 'eBooks and long-form guides', 'Fiction and ghostwriting', 'Brand voice matching and revision rounds'],
  },
  {
    slug: 'resume', tab: 'CVs', title: 'CVs, resumes & LinkedIn',
    summary: 'Clear, scannable career documents written for the role you want, from first jobs to executive roles.',
    covers: ['ATS-friendly resumes', 'Tailored cover letters', 'LinkedIn profile rewrites', 'Executive bios'],
  },
  {
    slug: 'dev', tab: 'Software', title: 'Software development',
    summary: 'Web apps, mobile apps, APIs and databases built to a fixed-fee quote, with full source code and ownership handed over at the end.',
    covers: ['Web applications and client portals', 'Mobile apps for iOS and Android', 'API and payment integrations', 'Ready-made scripts you can buy from the shop'],
  },
];

const STEPS = [
  { title: 'Send your brief', text: 'Tell us what you need and when. No payment at this stage.' },
  { title: 'Get a quote', text: 'We reply within 24 hours with a price and a timeline.' },
  { title: 'Pay in milestones', text: 'A deposit by bank transfer or from your wallet, then the balance as work is delivered.' },
  { title: 'Follow progress', text: 'Track your order and request revisions from your dashboard.' },
  { title: 'Collect your files', text: 'Finished files unlock in your private dashboard once the balance is paid.' },
];

// Tonal surfaces: a faint wash of the brand colour over the page background.
const tonal = 'var(--g-tonal)';
const tonalStrong = 'var(--g-tonal-strong)';

const pillFilled = 'inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full transition-colors';
const pillTonal = 'inline-flex items-center justify-center gap-2 font-medium text-sm px-6 h-11 rounded-full transition-colors text-accent hover:brightness-95';

export default function LandingPage() {
  const [content, setContent] = useState<HomePageContent>(HOME_PAGE_DEFAULTS);
  const [active, setActive] = useState<ServiceSlug>('academic');
  // What the visitor typed in the hero. It is carried into the quote form below.
  const [brief, setBrief] = useState('');
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    fetchPageSettings('home', HOME_PAGE_DEFAULTS).then(setContent);
  }, []);

  const { hero, faqs } = content;
  const service = SERVICES.find((s) => s.slug === active)!;

  const startQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setFormKey((k) => k + 1); // remount so the typed brief fills the form
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="g-font min-h-screen bg-primary text-primary overflow-x-hidden">
      <Header />

      <div className="pt-16">
        <PromoBanner position="header" />
      </div>

      {/* Hero: one big pill field that leads straight into a custom quote */}
      <section className="px-[var(--page-gutter)] pt-14 sm:pt-20 pb-20 text-center">
        <h1 className="mx-auto max-w-3xl g-h1">
          {hero.title_prefix} {hero.title_highlight_1} {hero.title_highlight_2}
        </h1>
        <p className="mx-auto max-w-2xl g-lead mt-6">{hero.subtitle}</p>

        <form onSubmit={startQuote} className="mx-auto mt-10 max-w-2xl">
          <div className="flex items-center gap-3 rounded-full border border-theme pl-5 pr-2 h-14 shadow-sm hover:shadow-md focus-within:shadow-md transition-shadow bg-primary">
            <PenLine className="w-5 h-5 text-accent shrink-0" />
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what you need and get a quote"
              aria-label="What do you need?"
              className="flex-1 min-w-0 bg-transparent outline-none text-base placeholder:text-secondary"
            />
            <button type="submit" className="shrink-0 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium px-5 h-10 rounded-full transition-colors">
              Get a quote
            </button>
          </div>
          <p className="text-xs text-secondary mt-3">Free quote within 24 hours. No payment needed.</p>
        </form>

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <a href="#services" className={pillTonal} style={{ background: tonalStrong }}>See what we do</a>
          <a href="https://wa.me/2348121443666" className="inline-flex items-center h-11 px-4 text-sm font-medium text-accent hover:underline">Chat on WhatsApp</a>
        </div>
      </section>

      {/* Services: tabs + one big surface */}
      <section id="services" className="scroll-mt-20 px-[var(--page-gutter)] pb-16">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="g-h2 text-center">What can we help with?</h2>

          <div role="tablist" className="flex flex-wrap justify-center gap-2 mt-8">
            {SERVICES.map((s) => (
              <button
                key={s.slug}
                role="tab"
                aria-selected={active === s.slug}
                onClick={() => setActive(s.slug)}
                className={`px-5 h-10 rounded-full text-sm font-medium border transition-colors ${
                  active === s.slug ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme text-secondary hover:bg-hover hover:text-primary'
                }`}
              >
                {s.tab}
              </button>
            ))}
          </div>

          <div id="quote" className="scroll-mt-24 mt-8 rounded-[var(--radius-panel)] p-6 sm:p-10 grid lg:grid-cols-2 gap-8 lg:gap-12" style={{ background: tonal }}>
            <div>
              <h3 className="g-h3">{service.title}</h3>
              <p className="text-secondary mt-3 leading-relaxed">{service.summary}</p>
              <ul className="mt-6 space-y-3">
                {service.covers.map((c) => (
                  <li key={c} className="flex gap-3 text-[15px]">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-accent text-[var(--accent-foreground)] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
              {service.slug === 'dev' && (
                <div className="flex flex-wrap gap-3 mt-6">
                  <Link href="/developer/shop" className={pillTonal} style={{ background: tonalStrong }}>Browse scripts</Link>
                  <Link href="/developer" className="inline-flex items-center gap-1 h-11 px-3 text-sm font-medium text-accent">More on software <ArrowRight className="w-4 h-4" /></Link>
                </div>
              )}
            </div>
            <div className="bg-primary rounded-[var(--radius-card)] p-6 sm:p-7 shadow-sm">
              <h4 className="text-lg font-medium">Get a quote</h4>
              <p className="text-sm text-secondary mt-1 mb-5">We reply within 24 hours.</p>
              <QuoteRequestForm key={`${active}-${formKey}`} defaultService={active} initialDetails={brief} bare />
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="process" className="scroll-mt-20 px-[var(--page-gutter)] py-[var(--section-y)]" style={{ background: tonal }}>
        <div className="max-w-[1100px] mx-auto">
          <h2 className="g-h2 text-center">How it works</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-primary rounded-[var(--radius-card)] p-6 shadow-sm">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-accent" style={{ background: tonalStrong }}>{i + 1}</div>
                <div className="font-medium mt-4">{s.title}</div>
                <p className="text-sm text-secondary mt-2 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Account + privacy */}
      <section className="px-[var(--page-gutter)] py-[var(--section-y)]">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-2 gap-5">
          <div className="rounded-[var(--radius-card)] p-8 border border-theme">
            <h3 className="g-h3">One account for everything</h3>
            <p className="text-secondary mt-3 leading-relaxed">Orders, files, wallet and referrals in one place. Free to create.</p>
            <div className="flex gap-3 mt-6">
              <Link href="/register" className={pillFilled}>Create an account</Link>
              <Link href="/login" className={pillTonal} style={{ background: tonalStrong }}>Log in</Link>
            </div>
          </div>
          <div id="confidentiality" className="rounded-[var(--radius-card)] p-8" style={{ background: tonal }}>
            <h3 className="g-h3">Your work stays private</h3>
            <p className="text-secondary mt-3 leading-relaxed">We never publish or show client work. Your brief, drafts and files are visible only to you and the people working on your order.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 px-[var(--page-gutter)] pb-20">
        <div className="max-w-[800px] mx-auto">
          <h2 className="g-h2 text-center">Frequently asked questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-[20px] border border-theme px-6 py-4 open:bg-[var(--g-tonal)]">
                <summary className="cursor-pointer list-none font-medium flex justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <span className="text-accent text-2xl leading-none group-open:rotate-45 transition-transform shrink-0">+</span>
                </summary>
                <div className="text-sm text-secondary leading-relaxed whitespace-pre-line mt-3">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-[var(--page-gutter)] pb-8">
        <PromoBanner position="footer" />
      </div>

      <Footer />
    </div>
  );
}
