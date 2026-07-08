'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/app/components/ThemeToggle';
import NotificationBell from '@/app/components/ui/NotificationBell';

const NAV_ITEMS: { href: string; label: string; icon: typeof lucide.LayoutDashboard; exact?: boolean }[] = [
  { href: '/admin', label: 'Dashboard', icon: lucide.LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: lucide.Database },
  { href: '/admin/invoices', label: 'Invoices', icon: lucide.FileSpreadsheet },
  { href: '/admin/projects', label: 'Project Topics', icon: lucide.BookOpen },
  { href: '/admin/finance', label: 'Finance', icon: lucide.Wallet },
  { href: '/admin/users', label: 'Users', icon: lucide.Users },
  { href: '/admin/chat', label: 'Support Chat', icon: lucide.MessageSquare },
  { href: '/admin/transactions', label: 'Transactions', icon: lucide.History },
  { href: '/admin/logs', label: 'System Logs', icon: lucide.FileText },
  { href: '/admin/affiliate', label: 'Affiliates', icon: lucide.Coins },
  { href: '/admin/promos', label: 'Promo Codes', icon: lucide.Tag },
  { href: '/admin/email', label: 'Messaging', icon: lucide.Send },
  { href: '/admin/settings', label: 'Settings', icon: lucide.Settings },
  { href: '/admin/vault', label: 'Vault Files', icon: lucide.FolderArchive },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
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
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const navLinkClass = (href: string, exact?: boolean) =>
    `flex items-center p-3 rounded-xl transition font-bold text-sm ${
      isActive(href, exact)
        ? 'bg-purple-500/10 text-purple-400'
        : 'text-secondary hover:bg-white/5 hover:text-primary'
    }`;

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col md:flex-row font-['Inter'] selection:bg-purple-500/30">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-secondary border-r border-theme h-screen sticky top-0 p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl">
            <lucide.Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-purple-500 uppercase tracking-widest font-bold">SysAdmin</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
            <Link key={href} href={href} className={navLinkClass(href, exact)}>
              <Icon className="w-5 h-5 mr-3 shrink-0" /> {label}
            </Link>
          ))}

          <div className="my-4 border-t border-theme" />

          <button
            type="button"
            onClick={() => router.push('/dashboard/client')}
            className="w-full flex items-center p-3 rounded-xl transition font-bold text-sm text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 border border-purple-500/25 mb-2 cursor-pointer"
          >
            <lucide.User className="w-5 h-5 mr-3" /> Client Portal
          </button>
        </nav>

        <div className="border-t border-theme pt-6 mt-6">
          <div className="mb-4">
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition text-sm font-bold p-2 rounded-lg hover:bg-red-500/10"
          >
            <lucide.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden bg-secondary border-b border-theme p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white">
            <lucide.Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm uppercase tracking-widest text-purple-500">Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-primary rounded-lg hover:bg-white/5"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary border-b border-theme p-4 flex flex-col gap-1 absolute w-full z-40 top-[73px] shadow-lg max-h-[70vh] overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className={navLinkClass(href, exact)}
            >
              <Icon className="w-4 h-4 mr-3 shrink-0" /> {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => { router.push('/dashboard/client'); setMobileMenuOpen(false); }}
            className="p-3 text-purple-400 font-bold text-left flex items-center gap-2 rounded-xl hover:bg-purple-500/10 border border-purple-500/25 mb-2 cursor-pointer"
          >
            <lucide.User className="w-4 h-4" /> Client Portal
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 p-3 text-red-400 font-bold text-left flex items-center gap-2 rounded-xl hover:bg-red-500/10"
          >
            <lucide.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto flex flex-col h-screen bg-primary">
        {/* Top Header */}
        <header className="bg-secondary/40 backdrop-blur-md border-b border-theme px-6 py-4 flex justify-between items-center sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-black text-xs uppercase tracking-widest text-secondary">
              {pathname === '/admin' ? 'Dashboard' : pathname.replace('/admin/', '').replace('-', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell isAdmin={true} userEmail={user?.email || ''} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
