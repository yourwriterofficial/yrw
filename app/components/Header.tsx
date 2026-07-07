'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ThemeToggle from './ThemeToggle';
import { Menu, X, ArrowRight } from 'lucide-react';
import * as lucide from 'lucide-react';

export default function Header({ projectsContext = false }: { projectsContext?: boolean }) {
  const router = useRouter();
  const servicesHref = projectsContext ? '/projects#services' : '/#services';
  const processHref = projectsContext ? '/projects#how-it-works' : '/#process';
  const startHref = projectsContext ? '/projects#topics-grid' : '/#services';
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    // Initial check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(!!profile?.is_admin);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    };
    checkUser();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(!!profile?.is_admin);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-secondary/85 backdrop-blur-md border-b border-theme py-3 shadow-lg' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="text-xl font-black tracking-tighter flex items-center gap-2 select-none group">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center text-black font-black transform group-hover:scale-105 transition-transform duration-200">
            RW
          </div>
          <span className="text-primary group-hover:text-emerald-400 transition-colors">
            ResearchWriter<span className="text-emerald-500">.</span>
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8 text-xs font-bold text-secondary uppercase tracking-widest">
          {/* Services Dropdown */}
          <div className="relative group/menu py-2">
            <button className="flex items-center gap-1 hover:text-emerald-400 text-secondary transition-colors duration-200 outline-none font-bold">
              Order Services <lucide.ChevronDown className="w-3 h-3 transition-transform duration-200 group-hover/menu:rotate-180" />
            </button>
            <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-theme rounded-xl shadow-xl py-2 hidden group-hover/menu:block animate-in fade-in slide-in-from-top-1 duration-200">
              <Link href="/order/dev" className="block px-4 py-2 text-[11px] text-primary hover:bg-white/5 hover:text-emerald-400 font-bold transition-all">
                💻 Web Development
              </Link>
              <Link href="/order/resume" className="block px-4 py-2 text-[11px] text-primary hover:bg-white/5 hover:text-emerald-400 font-bold transition-all">
                📄 CV / Resume Building
              </Link>
              <Link href="/order/content" className="block px-4 py-2 text-[11px] text-primary hover:bg-white/5 hover:text-emerald-400 font-bold transition-all">
                ✍ Content Writing
              </Link>
              <Link href="/order/academic" className="block px-4 py-2 text-[11px] text-primary hover:bg-white/5 hover:text-emerald-400 font-bold transition-all">
                🎓 Premium Writing
              </Link>
            </div>
          </div>

          <Link href="/projects" className="hover:text-emerald-400 transition-colors duration-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Project Topics
          </Link>
          <Link href={processHref} className="hover:text-emerald-400 transition-colors duration-200">
            How it Works
          </Link>
          <div className="w-40 border-l border-theme pl-4">
            <ThemeToggle />
          </div>
          {user ? (
            <>
              <Link
                href={isAdmin ? "/admin" : "/dashboard/client"}
                className="text-primary hover:text-emerald-400 transition-colors duration-200"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-primary hover:text-red-400 transition-colors duration-200 cursor-pointer font-bold uppercase tracking-widest"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="text-primary hover:text-emerald-400 transition-colors duration-200">
              Client Login
            </Link>
          )}
        </div>

        {/* Desktop CTA */}
        <Link
          href={startHref}
          className="hidden md:flex bg-emerald-500 text-black px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider hover:bg-emerald-400 active:scale-95 transition-all duration-200 items-center gap-1.5 shadow-md shadow-emerald-500/10"
        >
          Start Project <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-primary p-2 hover:bg-secondary/50 rounded-xl transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Drawer Bottom Sheet (subsKription style) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[150] flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-300 animate-in fade-in" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          
          {/* Bottom Sheet */}
          <div className="relative bg-[#0d0d0d] border-t border-zinc-800 rounded-t-[2.5rem] shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 pb-8 z-10 text-primary">
            {/* Drag Handle */}
            <div className="flex justify-center pt-4 pb-2 shrink-0">
              <div className="w-12 h-1 bg-zinc-750 rounded-full" />
            </div>

            {/* Content Area */}
            <div className="overflow-y-auto flex-1 px-6 pt-3 space-y-5 select-none">
              
              {/* Account/Header Info */}
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-black text-lg shadow-md shadow-emerald-500/10">
                    {user ? (user.email?.charAt(0).toUpperCase() || 'U') : 'G'}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-primary truncate max-w-[180px]">
                      {user ? user.email?.split('@')[0] : 'Guest Visitor'}
                    </h4>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">
                      {user ? 'Authenticated Client' : 'Browse Platform'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 bg-zinc-800 hover:bg-zinc-750 text-secondary rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0"
                >
                  <X className="w-4 h-4 text-primary" />
                </button>
              </div>

              {/* Core Navigation Links */}
              <div className="grid grid-cols-2 gap-2">
                <Link 
                  href="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-850 hover:border-emerald-500/30 text-xs font-black text-primary transition-all active:scale-[0.98]"
                >
                  🏠 Home Page
                </Link>
                <Link 
                  href="/projects" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-xs font-black text-amber-400 transition-all active:scale-[0.98]"
                >
                  📚 Project Topics
                </Link>
              </div>

              {/* services provided */}
              <div className="bg-gradient-to-br from-zinc-900 via-[#121212] to-zinc-900 border border-zinc-850 rounded-2xl p-4 space-y-3 shadow-sm">
                <p className="text-[9px] font-extrabold text-emerald-500 uppercase tracking-widest leading-none">Order Custom Services</p>
                <div className="grid grid-cols-1 gap-2">
                  <Link 
                    href="/order/dev" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800 transition text-xs font-bold text-primary"
                  >
                    <span className="flex items-center gap-2">💻 Web Development</span>
                    <lucide.ChevronRight className="w-3.5 h-3.5 text-secondary" />
                  </Link>
                  <Link 
                    href="/order/resume" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800 transition text-xs font-bold text-primary"
                  >
                    <span className="flex items-center gap-2">📄 CV / Resume Building</span>
                    <lucide.ChevronRight className="w-3.5 h-3.5 text-secondary" />
                  </Link>
                  <Link 
                    href="/order/content" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800 transition text-xs font-bold text-primary"
                  >
                    <span className="flex items-center gap-2">✍ Content Writing</span>
                    <lucide.ChevronRight className="w-3.5 h-3.5 text-secondary" />
                  </Link>
                  <Link 
                    href="/order/academic" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800 transition text-xs font-bold text-primary"
                  >
                    <span className="flex items-center gap-2">🎓 Premium Writing</span>
                    <lucide.ChevronRight className="w-3.5 h-3.5 text-secondary" />
                  </Link>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="flex justify-between items-center bg-zinc-900 border border-zinc-850 p-3 rounded-2xl">
                <span className="text-xs text-secondary font-bold">Interface Style</span>
                <ThemeToggle />
              </div>

              {/* Auth Settings / CTA */}
              <div className="pt-2 space-y-2">
                {user ? (
                  <>
                    <Link 
                      href={isAdmin ? "/admin" : "/dashboard/client"}
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-2xl text-xs font-black text-primary transition active:scale-[0.98]"
                    >
                      <lucide.LayoutDashboard className="w-4 h-4 text-emerald-500" /> Go to Dashboard
                    </Link>
                    <button 
                      onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-2xl text-xs font-black text-red-400 transition active:scale-[0.98] cursor-pointer"
                    >
                      <lucide.LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 rounded-2xl text-xs font-black text-primary transition active:scale-[0.98]"
                    >
                      <lucide.User className="w-4 h-4 text-emerald-500" /> Client Login Area
                    </Link>
                    <Link 
                      href={startHref}
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-center font-black rounded-2xl text-xs uppercase tracking-wider block transition active:scale-[0.98]"
                    >
                      Start Project
                    </Link>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </header>
  );
}
