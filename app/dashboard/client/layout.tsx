'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import ThemeToggle from '@/app/components/ThemeToggle';
import NotificationBell from '@/app/components/ui/NotificationBell';
import PromoBanner from '@/app/components/PromoBanner';
import { getEffectiveUser, clearImpersonation } from '@/lib/impersonate';
import { Avatar } from '@/app/components/ui/Avatar';
import Button from '@/app/components/ui/Button';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: keyof typeof lucide;
  iconColor?: string;
  tourId?: string;
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { key: 'dashboard', label: 'Dashboard Overview', href: '/dashboard/client', icon: 'LayoutDashboard', tourId: 'rw-tour-dashboard' },
      { key: 'new', label: 'Create New Order', href: '/dashboard/client/order/new', icon: 'PlusCircle', tourId: 'rw-tour-neworder' },
    ],
  },
  {
    title: 'Project Store',
    items: [
      { key: 'projects', label: 'Buy Pre-Made Projects', href: '/dashboard/client?tab=projects', icon: 'BookOpen' },
      { key: 'scripts', label: 'My Scripts / Software', href: '/dashboard/client?tab=scripts', icon: 'ShoppingBag' },
    ],
  },
  {
    title: 'Billing & Escrow',
    items: [
      { key: 'vault', label: 'Secure Deliverables Vault', href: '/dashboard/client?tab=vault', icon: 'Lock', tourId: 'rw-tour-vault' },
      { key: 'wallet', label: 'My Wallet Ledger', href: '/dashboard/client?tab=wallet', icon: 'Wallet', tourId: 'rw-tour-wallet' },
      { key: 'affiliate', label: 'Affiliate Earnings Hub', href: '/dashboard/client?tab=affiliate', icon: 'Coins' },
    ],
  },
  {
    title: 'Account Settings',
    items: [
      { key: 'profile', label: 'Profile & Credentials', href: '/dashboard/client?tab=profile', icon: 'User', tourId: 'rw-tour-profile' },
      { key: 'chat', label: 'Helpdesk & Support Chat', href: '/dashboard/client?tab=chat', icon: 'MessageSquare' },
    ],
  },
];

const Spinner = () => (
  <div className="min-h-screen bg-primary flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
  </div>
);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spinner />}>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </Suspense>
  );
}

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unviewedVaultCount, setUnviewedVaultCount] = useState(0);

  const fetchUnviewedVault = useCallback(async () => {
    try {
      let impId = null;
      let impEmail = null;
      if (typeof window !== 'undefined') {
        impId = localStorage.getItem('impersonate_user_id');
        impEmail = localStorage.getItem('impersonate_user_email');
      }

      let url = '/api/client/vault-files';
      if (impId) {
        url += `?impersonate_user_id=${impId}&impersonate_user_email=${impEmail}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const files = json.files || [];
        const unviewed = files.filter((f: any) => f.downloaded_at === null).length;
        setUnviewedVaultCount(unviewed);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      let cachedUser = null;
      let cachedProfile = null;
      if (typeof window !== 'undefined') {
        try {
          const uStr = sessionStorage.getItem('yrw_user');
          const pStr = sessionStorage.getItem('yrw_profile');
          if (uStr && pStr) {
            cachedUser = JSON.parse(uStr);
            cachedProfile = JSON.parse(pStr);
            setUser(cachedUser);
            setProfile(cachedProfile);
            setLoading(false);
          }
        } catch (e) {}
      }

      const { user, profile, isImpersonating } = await getEffectiveUser();
      if (!user) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('yrw_user');
          sessionStorage.removeItem('yrw_profile');
          sessionStorage.removeItem('yrw_wallet');
        }
        router.push('/login');
        return;
      }
      setUser(user);
      const activeProfile = isImpersonating ? { ...profile, _original_is_admin: true } : profile;
      setProfile(activeProfile);

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('yrw_user', JSON.stringify(user));
          sessionStorage.setItem('yrw_profile', JSON.stringify(activeProfile));
        } catch (e) {}
      }

      await fetchUnviewedVault();
      setLoading(false);
    };
    checkUser();
  }, [router, fetchUnviewedVault]);

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

  const isActive = (tab: string) => {
    if (tab === 'dashboard') {
      return pathname === '/dashboard/client' && !activeTab;
    }
    if (tab === 'new') {
      return pathname === '/dashboard/client/order/new';
    }
    if (tab.startsWith('new/')) {
      return pathname === `/dashboard/client/order/${tab.substring(4)}`;
    }
    return activeTab === tab || pathname.includes(`/dashboard/client/${tab}`);
  };

  const renderNavItem = (item: NavItem, top: boolean, onNavigate?: () => void) => {
    const active = isActive(item.key);
    const Icon = lucide[item.icon] as lucide.LucideIcon;
    return (
      <Link
        key={item.key}
        id={item.tourId}
        href={item.href}
        title={item.label}
        onClick={onNavigate}
        className={`group relative w-full flex items-center justify-between gap-2.5 pl-2 pr-3 py-1.5 rounded-xl transition font-bold ${top ? 'text-sm' : 'text-xs'} ${
          active
            ? 'bg-accent/10 border border-accent/20 text-accent'
            : 'border border-transparent text-secondary hover:bg-hover hover:text-primary'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              active ? 'bg-accent/15 text-accent' : 'bg-secondary border border-theme text-secondary group-hover:text-primary'
            }`}
          >
            <Icon className={`w-4 h-4 ${item.iconColor || ''}`} />
          </div>
          <span className="truncate">{item.label}</span>
        </div>
        {item.key === 'vault' && unviewedVaultCount > 0 && (
          <span className="px-2 py-0.5 bg-accent text-[var(--accent-foreground)] rounded-md text-[10px] font-black shrink-0">{unviewedVaultCount}</span>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col md:flex-row selection:bg-accent/30">
      <aside className="hidden md:flex flex-col w-72 bg-secondary border-r border-theme h-screen sticky top-0 p-5 z-40 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-6 shrink-0 relative z-10">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-[var(--accent-foreground)] font-black text-lg shadow-sm">Y</div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-base">YRW</h1>
            <p className="text-[10px] text-accent uppercase tracking-widest font-bold">Client Portal</p>
          </div>
        </div>

        {(profile?.is_admin || profile?._original_is_admin) && (
          <Button
            variant="outline"
            size="sm"
            className="mb-3 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 shrink-0 relative z-10"
            onClick={() => router.push('/admin')}
          >
            <lucide.Shield className="w-4 h-4" /> Admin Control Panel
          </Button>
        )}

        <nav className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto pr-1 relative z-10">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title || `group-${gi}`} className={gi === 0 ? 'flex flex-col gap-0.5' : 'mt-3 flex flex-col gap-0.5'}>
              {group.title && <p className="text-[10px] uppercase tracking-widest text-secondary font-black pl-2 mb-1">{group.title}</p>}
              {group.items.map((item) => renderNavItem(item, gi === 0))}
            </div>
          ))}
        </nav>

        <div className="shrink-0 relative z-10">
          <PromoBanner position="sidebar" limit={1} />
        </div>

        <div className="mt-3 shrink-0 relative z-10 space-y-3">
          <Link
            href="/advertise"
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-full border border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning font-semibold text-[11px] transition cursor-pointer"
          >
            <lucide.Megaphone className="w-3.5 h-3.5" /> Advertise With Us
          </Link>

          <div className="bg-card border border-theme rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={profile?.full_name || 'Client'} size="sm" />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate">{profile?.full_name || 'Client'}</p>
                  <p className="text-[10px] text-secondary truncate">{user?.email}</p>
                </div>
              </div>
              <ThemeToggle compact />
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 text-danger hover:text-red-300 transition text-xs font-bold p-2 mt-2 rounded-lg hover:bg-danger/10 border-t border-theme pt-2.5"
            >
              <lucide.LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="md:hidden bg-secondary border-b border-theme px-4 pb-4 topbar-safe flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-[var(--accent-foreground)] font-black">Y</div>
          <span className="font-bold text-primary">Portal</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2.5 text-primary hover:bg-hover rounded-lg" aria-label="Toggle menu">
          {mobileMenuOpen ? <lucide.X className="w-5 h-5" /> : <lucide.Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary border-b border-theme p-4 flex flex-col gap-2 absolute w-full z-40 dropdown-top-safe shadow-elevation-3 max-h-[80vh] overflow-y-auto">
          {(profile?.is_admin || profile?._original_is_admin) && (
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-400"
              onClick={() => { router.push('/admin'); setMobileMenuOpen(false); }}
            >
              <lucide.Shield className="w-4 h-4 mr-2" /> Admin Control Panel
            </Button>
          )}
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title || `mgroup-${gi}`} className={gi === 0 ? 'flex flex-col gap-1' : 'mt-3 flex flex-col gap-1'}>
              {group.title && <p className="text-[10px] uppercase tracking-widest text-secondary font-black pl-4 mb-1">{group.title}</p>}
              {group.items.map((item) => renderNavItem(item, gi === 0, () => setMobileMenuOpen(false)))}
            </div>
          ))}
          <div className="border-t border-theme mt-1 pt-2">
            <Link
              href="/advertise"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-warning/10 text-warning font-black text-xs uppercase tracking-wider border border-warning/25 transition cursor-pointer"
            >
              <lucide.Megaphone className="w-4 h-4" /> Advertise With Us
            </Link>
          </div>
          <div className="p-2">
            <ThemeToggle />
          </div>
          <button onClick={handleLogout} className="mt-2 p-3 text-danger font-bold text-left flex items-center gap-2 rounded-xl hover:bg-danger/10 transition">
            <lucide.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto flex flex-col h-screen bg-primary">
        <header className="bg-secondary/40 backdrop-blur-md border-b border-theme px-6 py-4 flex justify-between items-center sticky top-0 z-30 shrink-0">
          <span className="font-black text-xs uppercase tracking-widest text-secondary">Client Portal</span>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/client?tab=chat"
              title="Support Desk"
              className="p-2 text-secondary hover:text-primary hover:bg-hover rounded-full transition relative flex items-center justify-center"
            >
              <lucide.MessageSquare className="w-5 h-5" />
            </Link>
            <NotificationBell isAdmin={false} userEmail={user?.email || ''} userId={user?.id} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
