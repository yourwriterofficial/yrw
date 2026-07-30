'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { clearImpersonation } from '@/lib/impersonate';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/app/components/ThemeToggle';
import NotificationBell from '@/app/components/ui/NotificationBell';
import { Avatar } from '@/app/components/ui/Avatar';
import Button from '@/app/components/ui/Button';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import Card from '@/app/components/ui/Card';

type NavItem = { href: string; label: string; icon: typeof lucide.LayoutDashboard; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: lucide.LayoutDashboard, exact: true }],
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
      { href: '/admin/ads', label: 'Ads', icon: lucide.Megaphone },
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

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const navLinkClass = (href: string, exact?: boolean) =>
    `flex items-center p-3 rounded-xl transition font-bold text-sm ${
      isActive(href, exact)
        ? 'bg-accent/10 text-accent border border-accent/20'
        : 'text-secondary hover:bg-hover hover:text-primary'
    }`;

  const currentPage = NAV_ITEMS.find((item) => isActive(item.href, item.exact));

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-secondary text-xs uppercase tracking-widest font-bold">Verifying access…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col md:flex-row selection:bg-accent/30">
      <aside className="hidden md:flex flex-col w-64 bg-secondary border-r border-theme h-screen sticky top-0 p-6 z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-accent-foreground font-black text-xl">
            <lucide.Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-accent uppercase tracking-widest font-bold">SysAdmin</p>
          </div>
        </div>

        <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
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

          <Button variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent/10" onClick={() => router.push('/dashboard/client')}>
            <lucide.User className="w-4 h-4 mr-2" /> Client Portal
          </Button>
        </nav>

        <div className="border-t border-theme pt-5 mt-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={user?.email || 'Admin'} size="sm" />
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.email?.split('@')[0] || 'Admin'}</p>
              <p className="text-[10px] text-secondary truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
              <lucide.LogOut className="w-4 h-4 text-danger" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="md:hidden bg-secondary border-b border-theme px-4 pb-4 topbar-safe flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-accent-foreground">
            <lucide.Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm uppercase tracking-widest text-accent">Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2.5 text-primary rounded-lg hover:bg-hover"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <lucide.X className="w-5 h-5" /> : <lucide.Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary border-b border-theme p-4 flex flex-col gap-3 absolute w-full z-40 dropdown-top-safe shadow-elevation-3 max-h-[70vh] overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[9px] uppercase tracking-widest text-secondary/70 font-black pl-3 mb-1">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, exact }) => (
                  <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className={navLinkClass(href, exact)}>
                    <Icon className="w-4 h-4 mr-3 shrink-0" /> {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="border-accent/30 text-accent" onClick={() => { router.push('/dashboard/client'); setMobileMenuOpen(false); }}>
            <lucide.User className="w-4 h-4 mr-2" /> Client Portal
          </Button>
          <ThemeToggle />
          <button type="button" onClick={handleLogout} className="mt-2 p-3 text-danger font-bold text-left flex items-center gap-2 rounded-xl hover:bg-danger/10">
            <lucide.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto flex flex-col h-screen bg-primary">
        <header className="bg-secondary/40 backdrop-blur-md border-b border-theme px-6 py-4 flex justify-between items-center sticky top-0 z-30 shrink-0">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/admin' },
              { label: currentPage?.label || 'Dashboard' },
            ]}
          />
          <div className="flex items-center gap-4">
            <NotificationBell isAdmin={true} userEmail={user?.email || ''} userId={user?.id} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
