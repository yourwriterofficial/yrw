'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { clearImpersonation } from '@/lib/impersonate';
import ThemeToggle from './ThemeToggle';
import ImpersonationBanner from './ImpersonationBanner';
import { Menu, X, ArrowRight, ChevronDown, ShieldCheck, LayoutDashboard, LogOut, User, Code2, GraduationCap, PenLine, FileText, LineChart } from 'lucide-react';

const SERVICE_LINKS: { href: string; label: string; icon: any; color: string; badge?: string }[] = [
  { href: '/developer', label: 'Full Stack Development', icon: Code2, color: 'text-accent bg-accent/10', badge: 'developa.me' },
  { href: '/#academic', label: 'Academic Writing & Research', icon: GraduationCap, color: 'text-accent bg-accent/10' },
  { href: '/#content', label: 'Content & Creative Writing', icon: PenLine, color: 'text-accent bg-accent/10' },
  { href: '/#resume', label: 'Executive CVs & Resumes', icon: FileText, color: 'text-accent bg-accent/10' },
  { href: '/#statistics', label: 'Statistics, Maths & Fieldwork', icon: LineChart, color: 'text-accent bg-accent/10' },
];

export default function Header({ projectsContext = false }: { projectsContext?: boolean }) {
  const router = useRouter();
  const servicesHref = projectsContext ? '/projects#services' : '/#services';
  const processHref = projectsContext ? '/projects#how-it-works' : '/#process';
  const startHref = '/#quote';
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
          scrolled ? 'bg-primary border-b border-theme shadow-sm' : 'bg-primary border-b border-theme'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Link href="/" className="text-[15px] font-semibold tracking-tight flex items-center gap-2 select-none group">
            <div className="w-8 h-8 bg-accent text-[var(--accent-foreground)] rounded-lg flex items-center justify-center font-bold text-xs">
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
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span>{s.label}</span>
                          {s.badge && (
                            <span className="text-[10px] font-mono font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                              {s.badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <Link href={user ? (isAdmin ? '/projects' : '/dashboard/client?tab=projects') : '/projects'} className="hover:text-primary transition-colors whitespace-nowrap">
              Ready-made projects
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
            className="hidden lg:inline-flex bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] px-5 py-2 rounded-full text-[13px] font-medium transition-colors items-center gap-1.5"
          >
            Get a quote
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
          <div className="lg:hidden fixed inset-0 z-[300] bg-primary text-primary flex flex-col animate-in fade-in duration-150">
            <div className="h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 border-b border-theme">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="font-bold tracking-tight">ResearchWriter</Link>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="p-2 -mr-2 text-secondary hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-28">
              <Link
                href={startHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center rounded-lg bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-semibold py-3 transition-colors"
              >
                Get a quote
              </Link>

              <p className="text-xs text-secondary mt-8 mb-1">Services</p>
              <ul className="divide-y divide-theme border-y border-theme">
                {SERVICE_LINKS.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between py-3.5 text-[17px]">
                      <span>{s.label}</span>
                      <ChevronDown className="w-4 h-4 text-secondary -rotate-90" />
                    </Link>
                  </li>
                ))}
              </ul>

              <ul className="mt-6 divide-y divide-theme border-y border-theme">
                <li><Link href="/projects" onClick={() => setMobileMenuOpen(false)} className="block py-3.5 text-[17px]">Ready-made projects</Link></li>
                <li><Link href="/#process" onClick={() => setMobileMenuOpen(false)} className="block py-3.5 text-[17px]">How it works</Link></li>
                <li><Link href="/#faq" onClick={() => setMobileMenuOpen(false)} className="block py-3.5 text-[17px]">Questions</Link></li>
              </ul>

              <div className="mt-8 flex items-center justify-between">
                {user ? (
                  <>
                    <Link href={isAdmin ? '/admin' : '/dashboard/client'} onClick={() => setMobileMenuOpen(false)} className="font-semibold text-accent">
                      My dashboard
                    </Link>
                    <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-sm text-secondary hover:text-primary">
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="font-semibold text-accent">Log in</Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="text-sm text-secondary hover:text-primary">Create account</Link>
                  </>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between text-sm text-secondary">
                <span>Appearance</span>
                <ThemeToggle />
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
