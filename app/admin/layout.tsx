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

type NavItem = { href: string; label: string; icon: typeof lucide.LayoutDashboard; exact?: boolean; tab?: string; defaultTab?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: lucide.LayoutDashboard, exact: true }],
  },
  {
    label: 'Work',
    items: [
      { href: '/admin/quote-requests', label: 'Quote requests', icon: lucide.Inbox },
      { href: '/admin/orders', label: 'Orders', icon: lucide.Database },
      { href: '/admin/invoices', label: 'Invoices', icon: lucide.FileSpreadsheet },
      { href: '/admin/inbox', label: 'Support inbox', icon: lucide.Mail },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/admin/finance', label: 'Finance', icon: lucide.Wallet },
      { href: '/admin/transactions', label: 'Transactions', icon: lucide.History },
      { href: '/admin/affiliate', label: 'Affiliates', icon: lucide.Coins },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/projects', label: 'Project Topics', icon: lucide.BookOpen },
      { href: '/admin/promos', label: 'Promo Codes', icon: lucide.Tag },
      { href: '/admin/ads', label: 'Ads', icon: lucide.Megaphone },
      { href: '/admin/vault', label: 'Vault Files', icon: lucide.FolderArchive },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: lucide.Users },
      { href: '/admin/email', label: 'Messaging', icon: lucide.Send },
    ],
  },
  {
    label: 'Developa',
    items: [
      { href: '/admin/developa', label: 'Developa overview', icon: lucide.Globe, exact: true },
      { href: '/admin/developa-sites', tab: 'sites', defaultTab: true, label: 'Sites and revenue', icon: lucide.Store },
      { href: '/admin/dev-shop', label: 'Script Shop', icon: lucide.ShoppingBag },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/logs', label: 'System Logs', icon: lucide.FileText },
      { href: '/admin/settings', label: 'Settings', icon: lucide.Settings },
    ],
  },
];

// On Developa hosts the admin only shows Developa's own tools; YourResearchWriter's orders, quotes,
// invoices and catalogue stay on the main domain.
const DEVELOPA_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin/developa', label: 'Overview', icon: lucide.LayoutDashboard, exact: true }],
  },
  {
    label: 'Stores',
    items: [
      { href: '/admin/developa-sites', tab: 'sites', defaultTab: true, label: 'Sites', icon: lucide.Globe },
      { href: '/admin/developa-sites', tab: 'reports', label: 'Reports', icon: lucide.Flag },
      { href: '/admin/developa-sites', tab: 'payments', label: 'Plan payments', icon: lucide.Wallet },
      { href: '/admin/developa-sites', tab: 'themes', label: 'Themes and prices', icon: lucide.Palette },
    ],
  },
  {
    label: 'Reach',
    items: [
      { href: '/admin/developa-sites', tab: 'announce', label: 'Announcements', icon: lucide.Megaphone },
      { href: '/admin/developa-sites', tab: 'ads', label: 'Ads on all sites', icon: lucide.Tag },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/inbox', label: 'Support inbox', icon: lucide.Inbox },
      { href: '/admin/developa-sites', tab: 'support', label: 'Priority support', icon: lucide.LifeBuoy },
      { href: '/admin/email', label: 'Messaging', icon: lucide.Send },
    ],
  },
  {
    label: 'People and products',
    items: [
      { href: '/admin/users', label: 'Users', icon: lucide.Users },
      { href: '/admin/dev-shop', label: 'Script Shop', icon: lucide.ShoppingBag },
    ],
  },
  {
    label: 'Safety',
    items: [{ href: '/admin/developa-sites', tab: 'audit', label: 'History', icon: lucide.History }],
  },
];

function onDevelopaHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('developa') || new URLSearchParams(window.location.search).get('brand') === 'developa';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isDevelopa, setIsDevelopa] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  // Which tab of the Developa hub is open (kept in the address as ?tab=). The hub tells us when it changes.
  const [tabParam, setTabParam] = useState('');
  useEffect(() => {
    const read = () => setTabParam(new URLSearchParams(window.location.search).get('tab') || '');
    read();
    window.addEventListener('admintab', read);
    window.addEventListener('popstate', read);
    return () => { window.removeEventListener('admintab', read); window.removeEventListener('popstate', read); };
  }, [pathname]);
  useEffect(() => { setIsDevelopa(onDevelopaHost()); }, []);
  const navGroups = isDevelopa ? DEVELOPA_NAV_GROUPS : NAV_GROUPS;
  const navItems = navGroups.flatMap((g) => g.items);
  const portalHref = isDevelopa ? '/create' : '/dashboard/client';
  const portalLabel = isDevelopa ? 'My sites' : 'Client Portal';

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single();
      if (!profile?.is_admin) {
        router.replace(onDevelopaHost() ? '/create' : '/dashboard/client');
        return;
      }
      setUser(data.user);
      setCheckingAdmin(false);
      // Unread support mail, shown as a badge on the inbox link and refreshed every minute.
      const poll = () => fetch('/api/admin/inbox/threads?limit=1&status=open').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.counts) setInboxUnread(Number(j.counts.unread) || 0); }).catch(() => undefined);
      void poll();
      timer = setInterval(poll, 60_000);
    });
    return () => { if (timer) clearInterval(timer); };
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

  const hrefFor = (item: NavItem) => (item.tab ? `${item.href}?tab=${item.tab}` : item.href);
  const isActive = (item: NavItem) => {
    const onPath = item.exact ? pathname === item.href : pathname === item.href || !!pathname?.startsWith(item.href + '/');
    if (!onPath) return false;
    if (item.tab) return (tabParam || 'sites') === item.tab;
    return true;
  };

  // Clicking a tab link while already on that page switches the tab in place instead of reloading the page.
  const onNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.tab && pathname === item.href) {
      e.preventDefault();
      window.history.pushState(null, '', hrefFor(item));
      window.dispatchEvent(new Event('admintab'));
    }
  };

  const navLinkClass = (item: NavItem) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg transition font-semibold text-[13px] ${
      isActive(item)
        ? 'bg-accent/10 text-accent'
        : 'text-secondary hover:bg-hover hover:text-primary'
    }`;

  const currentPage = navItems.find((item) => isActive(item));

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
            <h1 className="font-black tracking-tight leading-none text-lg">{isDevelopa ? 'Developa' : 'YRW'}</h1>
            <p className="text-[10px] text-accent uppercase tracking-widest font-bold">{isDevelopa ? 'Platform admin' : 'SysAdmin'}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[9px] uppercase tracking-widest text-secondary/70 font-black pl-3 mb-1.5">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => { const Icon = item.icon; const href = item.href; const label = item.label; return (
                  <Link key={hrefFor(item)} href={hrefFor(item)} onClick={(e) => onNavClick(e, item)} className={navLinkClass(item)}>
                    <Icon className="w-4 h-4 shrink-0" /> {label}{href === '/admin/inbox' && inboxUnread > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-accent text-[var(--accent-foreground)] text-[11px] font-bold flex items-center justify-center">{inboxUnread}</span>}
                  </Link>
                ); })}
              </div>
            </div>
          ))}

          <div className="my-2 border-t border-theme" />

          <Button variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent/10" onClick={() => router.push(portalHref)}>
            <lucide.User className="w-4 h-4 mr-2" /> {portalLabel}
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
          <span className="font-bold text-sm uppercase tracking-widest text-accent">{isDevelopa ? 'Developa admin' : 'Admin'}</span>
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
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[9px] uppercase tracking-widest text-secondary/70 font-black pl-3 mb-1">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => { const Icon = item.icon; const href = item.href; const label = item.label; return (
                  <Link key={hrefFor(item)} href={hrefFor(item)} onClick={(e) => { onNavClick(e, item); setMobileMenuOpen(false); }} className={navLinkClass(item)}>
                    <Icon className="w-4 h-4 shrink-0" /> {label}{href === '/admin/inbox' && inboxUnread > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-accent text-[var(--accent-foreground)] text-[11px] font-bold flex items-center justify-center">{inboxUnread}</span>}
                  </Link>
                ); })}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="border-accent/30 text-accent" onClick={() => { router.push(portalHref); setMobileMenuOpen(false); }}>
            <lucide.User className="w-4 h-4 mr-2" /> {portalLabel}
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
