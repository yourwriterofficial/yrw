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

// Single source of truth for both the desktop sidebar and mobile menu — previously
// hand-duplicated in two places, which risked the two falling out of sync.
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
    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
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
      // 1. Try to load from cache for instant initial rendering
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

      // 2. Fetch fresh user details
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
      
      // Save to cache
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
        className={`relative w-full flex items-center justify-between gap-2.5 pl-4 pr-3 py-2.5 rounded-xl transition font-bold ${top ? 'text-sm' : 'text-xs'} ${
          active
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'text-secondary hover:bg-white/5 hover:text-primary'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-emerald-500" />}
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-5 h-5 shrink-0 ${item.iconColor || ''}`} />
          <span className="truncate">{item.label}</span>
        </div>
        {item.key === 'vault' && unviewedVaultCount > 0 && (
          <span className="px-2 py-0.5 bg-emerald-500 text-black rounded-md text-[10px] font-black shrink-0">{unviewedVaultCount}</span>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col md:flex-row font-['Inter'] selection:bg-emerald-500/30">

      {/* ================= SIDEBAR ================= */}
      <aside className="hidden md:flex flex-col w-72 bg-secondary border-r border-theme h-screen sticky top-0 p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-black font-black text-xl">Y</div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Client Portal</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
          {(profile?.is_admin || profile?._original_is_admin) && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center justify-center gap-2 w-full p-2.5 mb-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-black text-xs uppercase tracking-wider border border-purple-500/25 transition cursor-pointer shrink-0"
            >
              <lucide.Shield className="w-4 h-4" /> Admin Control Panel
            </button>
          )}
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title || `group-${gi}`} className={gi === 0 ? 'flex flex-col gap-1' : 'mt-5 flex flex-col gap-1'}>
              {group.title && (
                <p className="text-[10px] uppercase tracking-widest text-secondary font-black pl-4 mb-1.5">{group.title}</p>
              )}
              {group.items.map(item => renderNavItem(item, gi === 0))}
            </div>
          ))}
        </nav>

        <div className="mt-5">
          <PromoBanner position="sidebar" limit={1} />
        </div>

        <div className="border-t border-theme pt-6 mt-6">
          <div className="mb-4">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
              <lucide.User className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{profile?.full_name || 'Client'}</p>
              <p className="text-xs text-secondary truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition text-sm font-bold p-2 rounded-lg hover:bg-red-500/10">
            <lucide.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ================= MOBILE TOPBAR ================= */}
      <div className="md:hidden bg-secondary border-b border-theme px-4 pb-4 topbar-safe flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black font-black">Y</div>
          <span className="font-bold text-primary">Portal</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2.5 text-primary" aria-label="Toggle menu">
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary border-b border-theme p-4 flex flex-col gap-2 absolute w-full z-40 dropdown-top-safe shadow-lg max-h-[80vh] overflow-y-auto">
          {(profile?.is_admin || profile?._original_is_admin) && (
            <button
              onClick={() => { router.push('/admin'); setMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-purple-500/10 text-purple-400 font-black text-xs uppercase tracking-wider border border-purple-500/25 transition cursor-pointer"
            >
              <lucide.Shield className="w-4 h-4" /> Admin Control Panel
            </button>
          )}
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title || `mgroup-${gi}`} className={gi === 0 ? 'flex flex-col gap-1' : 'mt-3 flex flex-col gap-1'}>
              {group.title && (
                <p className="text-[10px] uppercase tracking-widest text-secondary font-black pl-4 mb-1">{group.title}</p>
              )}
              {group.items.map(item => renderNavItem(item, gi === 0, () => setMobileMenuOpen(false)))}
            </div>
          ))}
          <div className="p-2 border-t border-theme mt-1">
            <ThemeToggle />
          </div>
          <button onClick={handleLogout} className="mt-2 p-3 text-red-400 font-bold text-left flex items-center gap-2 rounded-xl hover:bg-red-500/10 transition"><lucide.LogOut className="w-4 h-4"/> Sign Out</button>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 overflow-y-auto flex flex-col h-screen bg-primary">
        {/* Top Header */}
        <header className="bg-secondary/40 backdrop-blur-md border-b border-theme px-6 py-4 flex justify-between items-center sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-black text-xs uppercase tracking-widest text-secondary">
              Client Portal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/client?tab=chat"
              title="Support Desk"
              className="p-2 text-secondary hover:text-primary hover:bg-white/5 rounded-full transition relative flex items-center justify-center cursor-pointer"
            >
              <lucide.MessageSquare className="w-5 h-5" />
            </Link>
            <NotificationBell isAdmin={false} userEmail={user?.email || ''} userId={user?.id} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-4">
            <PromoBanner position="inline" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
