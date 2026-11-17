'use client';

import { useState, useEffect } from 'react';
import { DevelopaMark, DevelopaIcons } from '@/app/components/DevelopaMark';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { clearImpersonation } from '@/lib/impersonate';
import { resolveIsAdmin, clearIsAdminCache } from '@/lib/authProfileCache';
import ThemeToggle from './ThemeToggle';
import ImpersonationBanner from './ImpersonationBanner';
import {
  Menu,
  X,
  ArrowRight,
  ShoppingBag,
  Code2,
  Cpu,
  LayoutDashboard,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';

export default function DevelopaHeader() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (session?.user) {
        setUser(session.user);
        const adminFlag = await resolveIsAdmin(session.user.id);
        if (active) setIsAdmin(adminFlag);
      } else {
        setUser(null);
        setIsAdmin(false);
        if (event === 'SIGNED_OUT') clearIsAdminCache();
      }
    });

    return () => {
      active = false;
      window.removeEventListener('scroll', handleScroll);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      clearImpersonation();
      clearIsAdminCache();
      sessionStorage.removeItem('yrw_user');
      sessionStorage.removeItem('yrw_profile');
      sessionStorage.removeItem('yrw_wallet');
    }
    await supabase.auth.signOut();
    router.push('/developer');
    router.refresh();
  };

  return (
    <>
      <ImpersonationBanner />
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-200 pt-safe ${
          scrolled
            ? 'bg-primary/95 backdrop-blur-md border-b border-theme shadow-sm'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <DevelopaIcons />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          {/* Brand Logo */}
          <Link
            href="/developer"
            className="text-[15px] font-semibold tracking-tight flex items-center gap-2.5 select-none group"
            aria-label="developa.me home"
          >
            <DevelopaMark className="w-9 h-9 rounded-[10px] shadow-sm group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-0.5 leading-none">
                <span className="text-primary font-black text-lg tracking-tight">developa</span>
                <span className="text-accent font-bold text-sm tracking-tight">.me</span>
              </div>
              <span className="text-[9px] font-mono text-secondary/70 tracking-wider">
                build your website, no code
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7 text-[13px] font-medium text-secondary">
            <Link
              href="/developer"
              className="hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5 text-accent" />
              Create a site
            </Link>

            <Link
              href="/developer/templates"
              className="hover:text-primary transition-colors flex items-center gap-1.5"
            >
              Templates
            </Link>

            <Link
              href="/developer#plans"
              className="hover:text-primary transition-colors flex items-center gap-1.5"
            >
              Pricing
            </Link>

            <Link
              href="/forums"
              className="hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              Forums
            </Link>

            {user ? (
              <div className="flex items-center gap-4 pl-2 border-l border-theme">
                <Link href="/developer/manage" className="text-primary hover:text-accent transition-colors font-medium text-xs">
                  Site admin
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin/developa-sites"
                    className="flex items-center gap-1.5 text-accent hover:text-accent transition-colors font-bold text-xs bg-accent/10 border border-accent/30 px-3 py-1.5 rounded-lg"
                  >
                    <Cpu className="w-3.5 h-3.5" /> Platform admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="hover:text-danger transition-colors p-1.5 rounded-lg hover:bg-hover"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                Sign in
              </Link>
            )}
          </nav>

          {/* Right Action & Theme Toggle */}
          <div className="hidden lg:flex items-center gap-3">
            <ThemeToggle compact />
            <Link
              href="/developer#start"
              className="bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-black font-bold text-xs tracking-wide px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-accent/20 flex items-center gap-1.5"
            >
              <span>Start free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle compact />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-hover focus:outline-none transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-card border-b border-theme px-4 pt-3 pb-6 space-y-3 shadow-elevation-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <Link
              href="/developer/templates"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-primary hover:bg-hover font-medium"
            >
              Templates
            </Link>
            <Link
              href="/developer#plans"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-primary hover:bg-hover font-medium"
            >
              Pricing
            </Link>
            <Link
              href="/forums"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-primary hover:bg-hover font-medium"
            >
              Forums
            </Link>

            <div className="pt-3 border-t border-theme space-y-2">
              {user ? (
                <>
                  <Link
                    href="/developer/manage"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    Site admin
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin/developa-sites"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent font-bold bg-accent/10"
                    >
                      <Cpu className="w-4 h-4" /> Platform admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-hover font-medium"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-secondary hover:text-primary font-medium"
                >
                  <User className="w-4 h-4" /> Sign in
                </Link>
              )}

              <Link
                href="/developer#start"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full mt-2 bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-black font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Start free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
