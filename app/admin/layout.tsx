'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { clearImpersonation } from '@/lib/impersonate';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/app/components/ThemeToggle';
import NotificationBell from '@/app/components/ui/NotificationBell';

type NavItem = { href: string; label: string; icon: typeof lucide.LayoutDashboard; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: lucide.LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'Sales & Orders',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: lucide.Database },
      { href: '/admin/invoices', label: 'Invoices', icon: lucide.FileSpreadsheet },
      { href: '/admin/transactions', label: 'Transactions', icon: lucide.History },
      { href: '/admin/finance', label: 'Finance', icon: lucide.Wallet },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/admin/projects', label: 'Project Topics', icon: lucide.BookOpen },
      { href: '/admin/dev-shop', label: 'Dev Shop', icon: lucide.ShoppingBag },
      { href: '/admin/promos', label: 'Promo Codes', icon: lucide.Tag },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: lucide.Users },
      { href: '/admin/affiliate', label: 'Affiliates', icon: lucide.Coins },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/admin/chat', label: 'Support Chat', icon: lucide.MessageSquare },
      { href: '/admin/email', label: 'Messaging', icon: lucide.Send },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/vault', label: 'Vault Files', icon: lucide.FolderArchive },
      { href: '/admin/logs', label: 'System Logs', icon: lucide.FileText },
      { href: '/admin/settings', label: 'Settings', icon: lucide.Settings },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single();
      if (!profile?.is_admin) {
        router.replace('/dashboard/client');
        return;
      }
      setUser(data.user);
      setCheckingAdmin(false);
    });
  }, [router]);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      clearImpersonation();
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

  const currentPageLabel = NAV_ITEMS.find(item => isActive(item.href, item.exact))?.label || 'Admin';

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-secondary text-xs uppercase tracking-widest font-bold">Verifying access…</div>
      </div>
    );
  }

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

        <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] uppercase tracking-widest text-secondary/70 font-black pl-3 mb-1.5">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, exact }) => (
                  <Link key={href} href={href} className={navLinkClass(href, exact)}>
                    <Icon className="w-5 h-5 mr-3 shrink-0" /> {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="my-2 border-t border-theme" />

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
      <div className="md:hidden bg-secondary border-b border-theme px-4 pb-4 topbar-safe flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white">
            <lucide.Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm uppercase tracking-widest text-purple-500">Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2.5 text-primary rounded-lg hover:bg-white/5"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary border-b border-theme p-4 flex flex-col gap-3 absolute w-full z-40 dropdown-top-safe shadow-lg max-h-[70vh] overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] uppercase tracking-widest text-secondary/70 font-black pl-3 mb-1">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, exact }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass(href, exact)}
                  >
                    <Icon className="w-4 h-4 mr-3 shrink-0" /> {label}
                  </Link>
                ))}
              </div>
            </div>
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
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <span className="text-secondary/60">Admin</span>
            <lucide.ChevronRight className="w-3 h-3 text-secondary/40" />
            <span className="text-primary">{currentPageLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell isAdmin={true} userEmail={user?.email || ''} userId={user?.id} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
