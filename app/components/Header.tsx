'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ThemeToggle from './ThemeToggle';
import { Menu, X, ArrowRight } from 'lucide-react';
import * as lucide from 'lucide-react';

const SERVICE_LINKS = [
  { href: '/developer', label: 'Full Stack Development', icon: lucide.Code2 },
  { href: '/academic-writing', label: 'Academic Writing & Research', icon: lucide.GraduationCap },
  { href: '/content-writing', label: 'Content & Creative Writing', icon: lucide.PenLine },
  { href: '/resume-cv', label: 'Executive CVs & Resumes', icon: lucide.FileText },
  { href: '/statistics-fieldwork', label: 'Statistics, Maths & Fieldwork', icon: lucide.LineChart },
];

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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('impersonate_user_id');
      localStorage.removeItem('impersonate_user_email');
      sessionStorage.removeItem('yrw_user');
      sessionStorage.removeItem('yrw_profile');
      sessionStorage.removeItem('yrw_wallet');
    }
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-200 pt-safe ${scrolled ? 'bg-primary/90 backdrop-blur-md border-b border-theme' : 'bg-transparent border-b border-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="text-[15px] font-semibold tracking-tight flex items-center gap-2 select-none group">
          <div className="w-7 h-7 bg-primary border border-theme rounded-md flex items-center justify-center text-primary font-bold text-xs group-hover:border-accent transition-colors">
            RW
          </div>
          <span className="text-primary">
            ResearchWriter
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-secondary">
          {/* Services Dropdown */}
          <div className="relative group/menu py-2">
            <button className="flex items-center gap-1 hover:text-primary text-secondary transition-colors outline-none">
              Services <lucide.ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-hover/menu:rotate-180" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-secondary border border-theme rounded-xl shadow-lg py-2 hidden group-hover/menu:block animate-in fade-in slide-in-from-top-1 duration-150">
              {SERVICE_LINKS.map(s => {
                const Icon = s.icon;
                return (
                  <Link key={s.href} href={s.href} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-primary hover:bg-primary font-medium transition-colors">
                    <Icon className="w-4 h-4 text-secondary shrink-0" /> {s.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <Link href={user ? (isAdmin ? "/projects" : "/dashboard/client?tab=projects") : "/projects"} className="hover:text-primary transition-colors whitespace-nowrap">
            Ready-made projects
          </Link>
          <Link href={processHref} className="hover:text-primary transition-colors whitespace-nowrap">
            How it works
          </Link>
          {user ? (
            <>
              <Link
                href={isAdmin ? "/admin" : "/dashboard/client"}
                className="hover:text-primary transition-colors whitespace-nowrap"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="hover:text-primary transition-colors whitespace-nowrap">
              Log in
            </Link>
          )}
          <ThemeToggle className="flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:bg-secondary hover:text-primary transition-colors shrink-0 [&_span]:hidden" />
        </div>

        {/* Desktop CTA */}
        <Link
          href={startHref}
          className="hidden lg:flex bg-accent hover:bg-accent-hover text-black px-5 py-2 rounded-full text-[13px] font-semibold active:scale-[0.98] transition-all items-center gap-1.5"
        >
          Start a project <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden text-primary p-2 hover:bg-secondary rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Drawer Bottom Sheet */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[150] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity duration-200 animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Bottom Sheet */}
          <div className="relative bg-secondary border-t border-theme rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200 pb-8 pb-safe z-10 text-primary">
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
            </div>

            {/* Content Area */}
            <div className="overflow-y-auto flex-1 px-5 sm:px-6 pt-2 space-y-5 select-none">

              {/* Account/Header Info */}
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-card border border-theme flex items-center justify-center text-primary font-semibold text-sm">
                    {user ? (user.email?.charAt(0).toUpperCase() || 'U') : 'G'}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-primary truncate max-w-[180px]">
                      {user ? user.email?.split('@')[0] : 'Guest'}
                    </h4>
                    <p className="text-xs text-secondary">
                      {user ? 'Signed in' : 'Browsing'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 bg-card hover:bg-primary text-secondary rounded-full flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Navigation Links */}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-card border border-theme text-sm font-medium text-primary transition-colors active:scale-[0.98]"
                >
                  Home
                </Link>
                <Link
                  href={user ? (isAdmin ? "/projects" : "/dashboard/client?tab=projects") : "/projects"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-card border border-theme text-sm font-medium text-primary transition-colors active:scale-[0.98]"
                >
                  Ready-made projects
                </Link>
              </div>

              {/* services provided */}
              <div className="bg-card border border-theme rounded-xl p-3 space-y-1">
                <p className="text-[11px] font-semibold text-secondary px-1 pb-1">Services</p>
                {SERVICE_LINKS.map(s => {
                  const Icon = s.icon;
                  return (
                    <Link
                      key={s.href}
                      href={s.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-primary transition-colors text-sm font-medium text-primary"
                    >
                      <span className="flex items-center gap-2.5"><Icon className="w-4 h-4 text-secondary" /> {s.label}</span>
                      <lucide.ChevronRight className="w-4 h-4 text-secondary" />
                    </Link>
                  );
                })}
              </div>

              {/* Theme Selector */}
              <div className="flex justify-between items-center bg-card border border-theme p-3 rounded-xl">
                <span className="text-sm text-secondary font-medium">Appearance</span>
                <ThemeToggle />
              </div>

              {/* Auth Settings / CTA */}
              <div className="pt-1 space-y-2">
                {user ? (
                  <>
                    <Link
                      href={isAdmin ? "/admin" : "/dashboard/client"}
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-card hover:bg-primary border border-theme rounded-xl text-sm font-medium text-primary transition-colors active:scale-[0.98]"
                    >
                      <lucide.LayoutDashboard className="w-4 h-4" /> Go to dashboard
                    </Link>
                    <button
                      onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-card hover:bg-primary border border-theme rounded-xl text-sm font-medium text-red-500 transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      <lucide.LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-card hover:bg-primary border border-theme rounded-xl text-sm font-medium text-primary transition-colors active:scale-[0.98]"
                    >
                      <lucide.User className="w-4 h-4" /> Log in
                    </Link>
                    <Link
                      href={startHref}
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-3 bg-accent hover:bg-accent-hover text-black text-center font-semibold rounded-xl text-sm block transition-colors active:scale-[0.98]"
                    >
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
  );
}
