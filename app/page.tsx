'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ThemeToggle from './components/ThemeToggle';
import { Menu, X, BookOpen, LineChart, PenTool, Briefcase, ArrowRight, CheckCircle2, Shield, Clock } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        setIsAdmin(!!profile?.is_admin);
      }
    };
    getUser();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Inter'] selection:bg-emerald-500/30">
      {/* Dynamic Navbar - Mobile Responsive */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-black/90 backdrop-blur-md border-b border-white/5 py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="text-xl font-black tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center text-black">RW</div>
            ResearchWriter<span className="text-emerald-500">.</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-zinc-400 uppercase tracking-widest">
  <a href="#services" className="hover:text-emerald-400 transition">Services</a>
  <a href="#process" className="hover:text-emerald-400 transition">How it Works</a>
  <ThemeToggle />
  {user ? (
    <>
      <Link href={isAdmin ? "/admin" : "/dashboard/client"} className="text-white hover:text-emerald-400 transition">
        Dashboard
      </Link>
      <button onClick={handleLogout} className="text-white hover:text-red-400 transition">Logout</button>
    </>
  ) : (
    <Link href="/login" className="text-white hover:text-emerald-400 transition">Client Login</Link>
  )}
</div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Desktop CTA */}
          <Link href="#services" className="hidden md:block bg-white text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition">
            Start Project
          </Link>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black/95 backdrop-blur-md border-b border-white/10 py-4 px-6 flex flex-col gap-4 text-sm font-bold">
  <a href="#services" onClick={() => setMobileMenuOpen(false)} className="text-zinc-300 hover:text-emerald-400 py-2">Services</a>
  <a href="#process" onClick={() => setMobileMenuOpen(false)} className="text-zinc-300 hover:text-emerald-400 py-2">How it Works</a>
  <ThemeToggle />
  {user ? (
    <>
      <Link href={isAdmin ? "/admin" : "/dashboard/client"} onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-emerald-400 py-2">Dashboard</Link>
      <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-red-400 hover:text-red-300 text-left py-2">Logout</button>
    </>
  ) : (
    <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-white hover:text-emerald-400 py-2">Client Login</Link>
  )}
  <Link href="#services" onClick={() => setMobileMenuOpen(false)} className="bg-emerald-500 text-black text-center py-3 rounded-full font-black uppercase tracking-wider mt-2">
    Start Project
  </Link>
</div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6">
            Premium Writing & Research Agency
          </div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tight mb-8 leading-[1.1]">
            Elevate your <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Academic</span> & <span className="bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Professional</span> trajectory.
          </h1>
          <p className="text-base md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            From complex dissertations and statistical data analysis to executive resumes and creative content. Expertly crafted, rigorously vetted, and delivered on time.
          </p>
        </div>
      </section>

      {/* Services Hub (Routing to the 4 distinct forms) */}
      <section id="services" className="py-24 px-6 bg-[#0a0a0a] border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4">Select Your Service</h2>
            <p className="text-zinc-400 text-sm">Choose the dedicated pipeline that fits your project requirements.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Standard Academic */}
            <Link href="/order/academic" className="group block p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-emerald-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-emerald-500" /></div>
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <BookOpen className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Standard Academic Research</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Essays, term papers, and standard university assignments. Includes automated volume discounts and strict plagiarism checks.</p>
              <ul className="space-y-2 text-xs font-medium text-zinc-500">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant dynamic quotes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> APA, MLA, Harvard formatting</li>
              </ul>
            </Link>

            {/* 2. Complex & Custom Data */}
            <Link href="/order/custom" className="group block p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-purple-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-purple-500" /></div>
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                <LineChart className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Complex Data & Fieldwork</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">For massive projects requiring custom add-ons. Request SPSS analysis, fieldwork, survey gathering, and PowerPoint summaries.</p>
              <ul className="space-y-2 text-xs font-medium text-zinc-500">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Add-on toggles (Slides, Data)</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-500" /> Bespoke emergency pricing</li>
              </ul>
            </Link>

            {/* 3. Content Writing */}
            <Link href="/order/content" className="group block p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-amber-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-amber-500" /></div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <PenTool className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Content & Creative Writing</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">eBooks, web copy, fictional narratives, and SEO articles. Tailored tone of voice and distinct stylistic requirements.</p>
              <ul className="space-y-2 text-xs font-medium text-zinc-500">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500" /> SEO-optimized structuring</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500" /> Commercial copyright transfer</li>
              </ul>
            </Link>

            {/* 4. Resumes & CVs */}
            <Link href="/order/resume" className="group block p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-blue-500/50 transition duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-blue-500" /></div>
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                <Briefcase className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-black mb-3">Executive CVs & Resumes</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">ATS-friendly resumes, Cover Letters, and LinkedIn profile optimization designed to bypass automated filters and secure interviews.</p>
              <ul className="space-y-2 text-xs font-medium text-zinc-500">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> ATS compatibility</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Industry-specific keywords</li>
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
            <p className="text-xs text-zinc-400 leading-relaxed">Every document is heavily encrypted. Final deliverables remain securely locked until payment balance is cleared.</p>
          </div>
          <div>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">Plagiarism Free</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">All works are passed through advanced originality scanners and delivered with verifiable AI/Similarity reports.</p>
          </div>
          <div>
            <Clock className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h4 className="font-bold mb-2">On-Time Delivery</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">Strict adherence to deadlines with real-time countdown tracking available inside your client dashboard.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 text-center text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
      </footer>
    </div>
  );
}