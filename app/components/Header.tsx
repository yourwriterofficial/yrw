'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { clearImpersonation } from '@/lib/impersonate';
import ThemeToggle from './ThemeToggle';
import ImpersonationBanner from './ImpersonationBanner';
import { Menu, X, ArrowRight, ChevronDown, ShieldCheck, LayoutDashboard, LogOut, User, Code2, GraduationCap, PenLine, FileText, LineChart } from 'lucide-react';

const SERVICE_LINKS = [
  { href: '/developer', label: 'Full Stack Development', icon: Code2, color: 'text-cyan-500 bg-cyan-500/10' },
  { href: '/academic-writing', label: 'Academic Writing & Research', icon: GraduationCap, color: 'text-emerald-500 bg-emerald-500/10' },
  { href: '/content-writing', label: 'Content & Creative Writing', icon: PenLine, color: 'text-rose-500 bg-rose-500/10' },
  { href: '/resume-cv', label: 'Executive CVs & Resumes', icon: FileText, color: 'text-blue-500 bg-blue-500/10' },
  { href: '/statistics-fieldwork', label: 'Statistics, Maths & Fieldwork', icon: LineChart, color: 'text-purple-500 bg-purple-500/10' },
];

export default function Header({ projectsContext = false }: { projectsContext?: boolean }) {
  const router = useRouter();
  const servicesHref = projectsContext ? '/projects#services' : '/#services';
  const processHref = projectsContext ? '/projects#how-it-works' : '/#process';
  const startHref = projectsContext ? '/projects#topics-grid' : '/#services';
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

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
    if (typeof window !== 'undefined') {
      clearImpersonation();
      sessionStorage.removeItem('yrw_user');
      sessionStorage.removeItem('yrw_profile');
      sessionStorage.removeItem('yrw_wallet');
    }
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <ImpersonationBanner />
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-200 pt-safe ${
          scrolled ? 'bg-primary/95 backdrop-blur-md border-b border-theme' : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Link href="/" className="text-[15px] font-semibold tracking-tight flex items-center gap-2 select-none group">
            <div className="w-8 h-8 bg-card border border-theme rounded-lg flex items-center justify-center text-primary font-bold text-xs group-hover:border-accent transition-colors">
              RW
            </div>
            <span className="text-primary font-bold">ResearchWriter</span>
          </Link>

          <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-secondary">
            <div className="relative py-2" onMouseEnter={() => setServicesOpen(true)} onMouseLeave={() => setServicesOpen(false)}>
              <button
                className="flex items-center gap-1 hover:text-primary transition-colors outline-none"
                aria-expanded={servicesOpen}
              >
                Services <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`} />
              </button>
              {servicesOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-card border border-theme rounded-xl shadow-elevation-2 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {SERVICE_LINKS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="group/item flex items-center gap-3 px-4 py-2.5 text-[13px] text-primary font-medium transition-all duration-200 rounded-lg mx-1.5 hover:bg-hover"
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span>{s.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <Link href={user ? (isAdmin ? '/projects' : '/dashboard/client?tab=projects') : '/projects'} className="hover:text-primary transition-colors whitespace-nowrap">
              Ready-made projects
            </Link>
            <Link href="/advertise" className="hover:text-primary transition-colors whitespace-nowrap">
              Advertise
            </Link>
            <Link href={processHref} className="hover:text-primary transition-colors whitespace-nowrap">
              How it works
            </Link>
            {user ? (
              <>
                <Link href={isAdmin ? '/admin' : '/dashboard/client'} className="hover:text-primary transition-colors whitespace-nowrap">
                  Dashboard
                </Link>
                <button onClick={handleLogout} className="hover:text-primary transition-colors cursor-pointer whitespace-nowrap">
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" className="hover:text-primary transition-colors whitespace-nowrap">
                Log in
              </Link>
            )}
            <ThemeToggle className="flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:bg-hover hover:text-primary transition-colors shrink-0 [&_span]:hidden" />
          </div>

          <Link
            href={startHref}
            className="hidden lg:inline-flex bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] px-5 py-2 rounded-full text-[13px] font-extrabold active:scale-[0.98] transition-all items-center gap-1.5"
          >
            Start a project <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            className="lg:hidden text-primary p-2 hover:bg-hover rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[150] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60 transition-opacity duration-200" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative bg-card border-t border-theme rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200 pb-8 pb-safe z-10 text-primary">
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-10 h-1 rounded-full bg-border-strong" />
              </div>

              <div className="overflow-y-auto flex-1 px-5 sm:px-6 pt-2 space-y-5 select-none">
                <div className="flex items-center justify-between border-b border-theme pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary border border-theme flex items-center justify-center text-primary font-semibold text-sm">
                      {user ? (user.email?.charAt(0).toUpperCase() || 'U') : 'G'}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-primary truncate max-w-[180px]">{user ? user.email?.split('@')[0] : 'Guest'}</h4>
                      <p className="text-xs text-secondary">{user ? 'Signed in' : 'Browsing'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-8 h-8 bg-secondary hover:bg-hover text-secondary rounded-full flex items-center justify-center transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-1 p-2.5 rounded-xl bg-secondary border border-theme text-xs font-medium text-primary transition-colors active:scale-[0.98] text-center">
                    Home
                  </Link>
                  <Link href={user ? (isAdmin ? '/projects' : '/dashboard/client?tab=projects') : '/projects'} onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-1 p-2.5 rounded-xl bg-secondary border border-theme text-xs font-medium text-primary transition-colors active:scale-[0.98] text-center">
                    Projects
                  </Link>
                  <Link href="/advertise" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-1 p-2.5 rounded-xl bg-secondary border border-theme text-xs font-medium text-primary transition-colors active:scale-[0.98] text-center">
                    Advertise
                  </Link>
                </div>

                <div className="bg-secondary border border-theme rounded-xl p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-secondary px-1 pb-1">Services</p>
                  {SERVICE_LINKS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Link
                        key={s.href}
                        href={s.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="group/item flex items-center justify-between p-2 rounded-lg transition-all duration-200 text-sm font-medium text-primary hover:bg-hover"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.color}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          {s.label}
                        </span>
                        <ChevronDown className="w-4 h-4 text-secondary -rotate-90" />
                      </Link>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center bg-secondary border border-theme p-3 rounded-xl">
                  <span className="text-sm text-secondary font-medium">Appearance</span>
                  <ThemeToggle />
                </div>

                <div className="pt-1 space-y-2">
                  {user ? (
                    <>
                      <Link href={isAdmin ? '/admin' : '/dashboard/client'} onClick={() => setMobileMenuOpen(false)} className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-hover border border-theme rounded-xl text-sm font-medium text-primary transition-colors active:scale-[0.98]">
                        <LayoutDashboard className="w-4 h-4" /> Go to dashboard
                      </Link>
                      <button
                        onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-hover border border-theme rounded-xl text-sm font-medium text-danger transition-colors active:scale-[0.98] cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-hover border border-theme rounded-xl text-sm font-medium text-primary transition-colors active:scale-[0.98]">
                        <User className="w-4 h-4" /> Log in
                      </Link>
                      <Link href={startHref} onClick={() => setMobileMenuOpen(false)} className="w-full py-3 bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-center font-extrabold rounded-xl text-sm block transition-colors active:scale-[0.98]">
                        Start a project
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
