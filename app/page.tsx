import Header from './components/Header';
import HomeStats from './components/HomeStats';
import Link from 'next/link';
import {
  BookOpen, LineChart, PenTool, Briefcase, Terminal, ArrowRight,
  CheckCircle2, Shield, Clock, FileEdit, Users, PackageCheck, Wallet,
  Library, ShoppingBag, ChevronDown, Award,
} from 'lucide-react';

const FAQS = [
  {
    q: 'How fast is delivery?',
    a: 'Ready-made project materials are delivered within 4 hours. Custom writing, resumes, and software are scoped to a deadline you set when you submit your brief.',
  },
  {
    q: 'Is the ready-made project catalogue plagiarism-checked?',
    a: 'No — those are pre-written materials delivered as-is, without a plagiarism or AI-detection guarantee. If you need a plagiarism-free, AI-free custom write-up, use our Academic Writing service instead.',
  },
  {
    q: 'Can I pay in installments?',
    a: 'Yes. Custom academic, content, resume, and software orders support milestone-based payment plans — a deposit followed by a balance, or a custom schedule for larger software builds.',
  },
  {
    q: 'Is my payment and data secure?',
    a: 'Payments are processed through Paystack. Every final deliverable is encrypted and stays locked in your Secure Vault until your balance is fully cleared.',
  },
  {
    q: 'Do I get full source code for software projects?',
    a: 'Yes — complete source code and IP transfer are included for custom development orders and every script purchased from the Dev Shop marketplace.',
  },
  {
    q: 'What if my exact topic isn\'t in the catalogue?',
    a: 'Search the ready-made catalogue for availability first — if nothing matches, submit a custom brief and a writer will produce it from scratch.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-emerald-500/30 transition-colors duration-200 overflow-x-hidden">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-header-32 sm:pt-header-40 pb-16 sm:pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-[65%] w-72 h-72 sm:w-[600px] sm:h-[600px] bg-emerald-500/20 blur-[110px] rounded-full pointer-events-none animate-blob" />
        <div className="absolute top-32 left-1/2 translate-x-[5%] w-64 h-64 sm:w-[480px] sm:h-[480px] bg-teal-500/15 blur-[110px] rounded-full pointer-events-none animate-blob animation-delay-2000" />
        <div className="absolute top-10 left-1/2 -translate-x-[10%] w-56 h-56 sm:w-[360px] sm:h-[360px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none animate-blob animation-delay-4000" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block glass-panel border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">
            Premium Academic Writing & Research Agency
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6 sm:mb-8 leading-[1.15] sm:leading-[1.1] px-1">
            Elevate your <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Academic</span> & <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Professional</span> trajectory.
          </h1>
          <p className="text-sm sm:text-base md:text-xl text-secondary mb-8 max-w-2xl mx-auto leading-relaxed px-2">
            From complex dissertations and statistical data analysis to executive resumes, custom software, and creative content. Expertly crafted, rigorously vetted, and delivered on time.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-10 text-xs font-bold px-2">
            <span className="glass-panel px-4 py-1.5 rounded-full text-secondary">
              <HomeStats />
            </span>
            <span className="glass-panel px-4 py-1.5 rounded-full text-secondary">⚡ 4-hour ready-made delivery</span>
            <span className="glass-panel px-4 py-1.5 rounded-full text-secondary hidden sm:inline">💻 Full source code on every dev order</span>
          </div>

          <div className="flex gap-3 justify-center flex-wrap px-2">
            <a
              href="#services"
              className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              Explore Services <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <Link
              href="/projects"
              className="glass-panel px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider hover:border-amber-500/50 transition-all duration-200 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" /> Browse Ready-Made Projects
            </Link>
          </div>
        </div>
      </section>

      {/* Services Hub */}
      <section id="services" className="py-16 sm:py-24 px-4 sm:px-6 bg-secondary border-y border-theme relative">
        <div className="max-w-7xl mx-auto">

          {/* Track 1: Custom order services */}
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Track 1</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2 mb-4">Custom Order Services</h2>
            <p className="text-secondary text-sm max-w-xl mx-auto px-2">Each service has its own dedicated page — see what's included, then get a quote when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-16 sm:mb-24">

            {/* 1. Standard Academic */}
            <Link href="/academic-writing" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-emerald-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-emerald-500" /></div>
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <BookOpen className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3">Standard Academic Research</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">Essays, term papers, and standard university assignments. Includes automated volume discounts and strict plagiarism checks.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Instant dynamic quotes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> APA, MLA, Harvard formatting</li>
              </ul>
            </Link>

            {/* 2. Complex & Custom Data */}
            <Link href="/custom-research" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-purple-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-purple-500" /></div>
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                <LineChart className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3">Complex Data & Fieldwork</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">For massive projects requiring custom add-ons. Request SPSS analysis, fieldwork, survey gathering, and PowerPoint summaries.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" /> Add-on toggles (Slides, Data)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" /> Bespoke emergency pricing</li>
              </ul>
            </Link>

            {/* 3. Content Writing */}
            <Link href="/content-writing" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-amber-500" /></div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <PenTool className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3">Content & Creative Writing</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">eBooks, web copy, fictional narratives, and SEO articles. Tailored tone of voice and distinct stylistic requirements.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> SEO-optimized structuring</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> Commercial copyright transfer</li>
              </ul>
            </Link>

            {/* 4. Resumes & CVs */}
            <Link href="/resume-cv" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-blue-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-blue-500" /></div>
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                <Briefcase className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3">Executive CVs & Resumes</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">ATS-friendly resumes, Cover Letters, and LinkedIn profile optimization designed to bypass automated filters and secure interviews.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" /> ATS compatibility</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" /> Industry-specific keywords</li>
              </ul>
            </Link>

            {/* 5. Full Stack Development */}
            <Link href="/developer" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden lg:col-span-1">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-cyan-500" /></div>
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20">
                <Terminal className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3">Full Stack & Custom Software</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">Web applications, mobile development, custom scripts, database schema setup, and a marketplace of ready-made scripts.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" /> Web apps, APIs & Database setup</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" /> Complete source code & IP transfer</li>
              </ul>
            </Link>

          </div>

          {/* Track 2: Buy instantly */}
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Track 2</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2 mb-4">Buy Instantly</h2>
            <p className="text-secondary text-sm max-w-xl mx-auto px-2">No brief, no wait — pick something ready-made and check out now.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
            {/* Ready-made projects */}
            <Link href="/projects" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-amber-500" /></div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <Library className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3 flex items-center gap-2">
                Ready-Made Projects <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              </h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">Thousands of completed project topics across every Nigerian department — Chapters 1–5, MS Word, delivered to your vault.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> <HomeStats /></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" /> Delivered within 4 hours</li>
              </ul>
            </Link>

            {/* Script shop */}
            <Link href="/developer/shop" className="group block p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] glass-panel hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-cyan-500" /></div>
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20">
                <ShoppingBag className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-3">Script Marketplace</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" /> Complete source code included</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" /> One-time purchase, yours to keep</li>
              </ul>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="process" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">How It Works</h2>
            <p className="text-secondary text-sm">The same straightforward pipeline, whichever service you choose.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {[
              { icon: FileEdit, title: 'Submit Brief', description: 'Pick a service, share your requirements, and get an instant or custom quote.' },
              { icon: Wallet, title: 'Pay Securely', description: 'Pay in full or in milestones — via card, transfer, or your wallet balance.' },
              { icon: Users, title: 'We Get to Work', description: 'A specialist is assigned and progress is tracked live in your dashboard.' },
              { icon: PackageCheck, title: 'Vault Delivery', description: 'Final work lands encrypted in your Secure Vault, ready to download.' },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
                    <Icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="font-bold mb-2 text-sm sm:text-base">{step.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-secondary border-y border-theme">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">Why ResearchWriter</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
            <div className="glass-panel rounded-[24px] p-6 text-center">
              <Shield className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <h4 className="font-bold mb-2">Vault Security</h4>
              <p className="text-xs text-secondary leading-relaxed">Every document is heavily encrypted. Final deliverables remain securely locked until payment balance is cleared.</p>
            </div>
            <div className="glass-panel rounded-[24px] p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <h4 className="font-bold mb-2">Plagiarism Free</h4>
              <p className="text-xs text-secondary leading-relaxed">Custom writing is passed through advanced originality scanners and delivered with verifiable AI/Similarity reports.</p>
            </div>
            <div className="glass-panel rounded-[24px] p-6 text-center">
              <Clock className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <h4 className="font-bold mb-2">On-Time Delivery</h4>
              <p className="text-xs text-secondary leading-relaxed">Strict adherence to deadlines with real-time countdown tracking available inside your client dashboard.</p>
            </div>
            <div className="glass-panel rounded-[24px] p-6 text-center">
              <Award className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <h4 className="font-bold mb-2">Flexible Payments</h4>
              <p className="text-xs text-secondary leading-relaxed">Pay upfront, in milestones, or from your wallet balance — whichever fits your budget.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group glass-panel rounded-2xl p-5 open:border-emerald-500/40 transition-colors">
                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-sm text-primary gap-4">
                  {faq.q}
                  <ChevronDown className="w-4 h-4 text-secondary transition-transform duration-200 group-open:rotate-180 shrink-0" />
                </summary>
                <p className="text-xs text-secondary leading-relaxed mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center glass-panel rounded-[32px] sm:rounded-[40px] p-8 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 blur-[90px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black mb-4">Ready to get started?</h2>
            <p className="text-secondary text-sm mb-8">Order custom work, or grab something ready-made — either way, it lands in your Secure Vault.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href="#services"
                className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-black px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                Explore Services <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <Link
                href="/projects"
                className="glass-panel px-7 sm:px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-wider hover:border-amber-500/50 transition-all duration-200 flex items-center gap-2"
              >
                Browse Ready-Made Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-theme py-12 sm:py-16 px-4 sm:px-6 pb-safe">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-lg font-black tracking-tighter flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center text-black font-black text-sm">RW</div>
              ResearchWriter<span className="text-emerald-500">.</span>
            </Link>
            <p className="text-xs text-secondary leading-relaxed">Premium academic writing, software, and creative services.</p>
          </div>
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">Custom Services</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/academic-writing" className="hover:text-emerald-400 transition">Academic Writing</Link></li>
              <li><Link href="/content-writing" className="hover:text-emerald-400 transition">Content Writing</Link></li>
              <li><Link href="/resume-cv" className="hover:text-emerald-400 transition">CVs & Resumes</Link></li>
              <li><Link href="/custom-research" className="hover:text-emerald-400 transition">Data & Fieldwork</Link></li>
              <li><Link href="/developer" className="hover:text-emerald-400 transition">Full Stack Dev</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">Buy Instantly</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/projects" className="hover:text-emerald-400 transition">Ready-Made Projects</Link></li>
              <li><Link href="/developer/shop" className="hover:text-emerald-400 transition">Script Shop</Link></li>
              <li><Link href="#faq" className="hover:text-emerald-400 transition">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-3">Account</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/login" className="hover:text-emerald-400 transition">Client Login</Link></li>
              <li><Link href="/register" className="hover:text-emerald-400 transition">Register</Link></li>
              <li><Link href="/dashboard/client" className="hover:text-emerald-400 transition">Dashboard</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-theme mt-10 pt-6 text-center text-xs text-secondary">
          <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
