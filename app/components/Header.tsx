'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ThemeToggle from './ThemeToggle';
import { Menu, X, ArrowRight } from 'lucide-react';

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
          <Link href={servicesHref} className="hover:text-emerald-400 transition-colors duration-200">
            Services
          </Link>
          <Link href="/projects" className="hover:text-emerald-400 transition-colors duration-200">
            Project Materials
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
                className="text-primary hover:text-red-400 transition-colors duration-200 cursor-pointer"
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

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary/95 backdrop-blur-md border-b border-theme py-6 px-6 flex flex-col gap-4 text-sm font-bold shadow-xl animate-in slide-in-from-top duration-200">
          <Link
            href={servicesHref}
            onClick={() => setMobileMenuOpen(false)}
            className="text-secondary hover:text-emerald-400 py-2 border-b border-theme/20 transition-colors"
          >
            Services
          </Link>
          <Link
            href="/projects"
            onClick={() => setMobileMenuOpen(false)}
            className="text-secondary hover:text-emerald-400 py-2 border-b border-theme/20 transition-colors"
          >
            Project Materials
          </Link>
          <Link
            href={processHref}
            onClick={() => setMobileMenuOpen(false)}
            className="text-secondary hover:text-emerald-400 py-2 border-b border-theme/20 transition-colors"
          >
            How it Works
          </Link>
          <div className="py-2 border-b border-theme/20">
            <ThemeToggle />
          </div>
          {user ? (
            <>
              <Link
                href={isAdmin ? "/admin" : "/dashboard/client"}
                onClick={() => setMobileMenuOpen(false)}
                className="text-primary hover:text-emerald-400 py-2 border-b border-theme/20 transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="text-red-400 hover:text-red-300 text-left py-2 transition-colors cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-primary hover:text-emerald-400 py-2 border-b border-theme/20 transition-colors"
            >
              Client Login
            </Link>
          )}
          <Link
            href={startHref}
            onClick={() => setMobileMenuOpen(false)}
            className="bg-emerald-500 text-black text-center py-3 rounded-full font-black uppercase tracking-wider mt-4 hover:bg-emerald-400 active:scale-95 transition-all duration-200"
          >
            Start Project
          </Link>
        </div>
      )}
    </header>
  );
}
