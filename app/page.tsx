import Header from './components/Header';
import Link from 'next/link';
import { BookOpen, LineChart, PenTool, Briefcase, ArrowRight, CheckCircle2, Shield, Clock, Terminal } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-primary text-primary font-['Inter'] selection:bg-emerald-500/30 transition-colors duration-200">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">
            Premium Academic Writing & Research Agency
          </div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tight mb-8 leading-[1.1]">
            Elevate your <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Academic</span> & <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Professional</span> trajectory.
          </h1>
          <p className="text-base md:text-xl text-secondary mb-12 max-w-2xl mx-auto leading-relaxed">
            From complex dissertations and statistical data analysis to executive resumes and creative content. Expertly crafted, rigorously vetted, and delivered on time.
          </p>
        </div>
      </section>

      {/* Services Hub */}
      <section id="services" className="py-24 px-6 bg-secondary border-y border-theme relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4">Select Your Service</h2>
            <p className="text-secondary text-sm">Choose the dedicated pipeline that fits your project requirements.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Standard Academic */}
            <Link href="/order/academic" className="group block p-8 rounded-[32px] bg-card border border-theme hover:border-emerald-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-emerald-500" /></div>
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <BookOpen className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Standard Academic Research</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">Essays, term papers, and standard university assignments. Includes automated volume discounts and strict plagiarism checks.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant dynamic quotes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> APA, MLA, Harvard formatting</li>
              </ul>
            </Link>

            {/* 2. Complex & Custom Data */}
            <Link href="/order/custom" className="group block p-8 rounded-[32px] bg-card border border-theme hover:border-purple-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-purple-500" /></div>
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                <LineChart className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Complex Data & Fieldwork</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">For massive projects requiring custom add-ons. Request SPSS analysis, fieldwork, survey gathering, and PowerPoint summaries.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Add-on toggles (Slides, Data)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Bespoke emergency pricing</li>
              </ul>
            </Link>

            {/* 3. Content Writing */}
            <Link href="/order/content" className="group block p-8 rounded-[32px] bg-card border border-theme hover:border-amber-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-amber-500" /></div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <PenTool className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Content & Creative Writing</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">eBooks, web copy, fictional narratives, and SEO articles. Tailored tone of voice and distinct stylistic requirements.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500" /> SEO-optimized structuring</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500" /> Commercial copyright transfer</li>
              </ul>
            </Link>

            {/* 4. Resumes & CVs */}
            <Link href="/order/resume" className="group block p-8 rounded-[32px] bg-card border border-theme hover:border-blue-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-blue-500" /></div>
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                <Briefcase className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Executive CVs & Resumes</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">ATS-friendly resumes, Cover Letters, and LinkedIn profile optimization designed to bypass automated filters and secure interviews.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> ATS compatibility</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Industry-specific keywords</li>
              </ul>
            </Link>

            {/* 5. Full Stack Development */}
            <Link href="/order/dev" className="group block p-8 rounded-[32px] bg-card border border-theme hover:border-cyan-500/50 transition duration-300 relative overflow-hidden md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-cyan-500" /></div>
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20">
                <Terminal className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Full Stack & Custom Software</h3>
              <p className="text-sm text-secondary mb-6 leading-relaxed">Web applications, mobile development, custom scripts, database schema setup, and payment integration. Designed for maximum scale.</p>
              <ul className="space-y-2 text-xs font-medium text-secondary">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500" /> Web apps, APIs & Database setup</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-500" /> Complete source code & IP transfer</li>
              </ul>
            </Link>

          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <Shield className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">Vault Security</h4>
            <p className="text-xs text-secondary leading-relaxed">Every document is heavily encrypted. Final deliverables remain securely locked until payment balance is cleared.</p>
          </div>
          <div>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">Plagiarism Free</h4>
            <p className="text-xs text-secondary leading-relaxed">All works are passed through advanced originality scanners and delivered with verifiable AI/Similarity reports.</p>
          </div>
          <div>
            <Clock className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">On-Time Delivery</h4>
            <p className="text-xs text-secondary leading-relaxed">Strict adherence to deadlines with real-time countdown tracking available inside your client dashboard.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-theme py-12 px-6 text-center text-xs text-secondary">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>
    </div>
  );
}