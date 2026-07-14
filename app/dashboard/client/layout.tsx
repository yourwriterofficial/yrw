'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import * as lucide from 'lucide-react';
import ThemeToggle from '@/app/components/ThemeToggle';
import NotificationBell from '@/app/components/ui/NotificationBell';
import { getEffectiveUser } from '@/lib/impersonate';

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

  const fetchUnviewedVault = useCallback(async (email: string, id: string) => {
    try {
      const { data: userOrders } = await supabase
        .from('orders')
        .select('order_id')
        .or(`client_id.eq.${id},email.eq.${email}`);

      const orderIds = userOrders?.map(o => o.order_id) || [];
      if (orderIds.length > 0) {
        const { data: files } = await supabase
          .from('final_deliverables')
          .select('id')
          .in('order_id', orderIds)
          .is('downloaded_at', null);
        setUnviewedVaultCount(files?.length || 0);
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
      
      await fetchUnviewedVault(user.email || '', user.id);
      setLoading(false);
    };
    checkUser();
  }, [router, fetchUnviewedVault]);

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

  const navBtnClass = (tab: string) =>
    `w-full flex items-center justify-between p-3 rounded-xl transition font-bold text-sm ${
      isActive(tab)
        ? 'bg-emerald-500/10 text-emerald-500'
        : 'text-secondary hover:bg-white/5 hover:text-primary'
    }`;

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
      <aside className="hidden md:flex flex-col w-64 bg-secondary border-r border-theme h-screen sticky top-0 p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-black font-black text-xl">Y</div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Client Portal</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
          {(profile?.is_admin || profile?._original_is_admin) && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center justify-center gap-2 w-full p-2.5 mb-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-black text-xs uppercase tracking-wider border border-purple-500/25 transition cursor-pointer shrink-0"
            >
              <lucide.Shield className="w-4 h-4" /> Admin Control Panel
            </button>
          )}
          <button id="rw-tour-dashboard" onClick={() => router.push('/dashboard/client')} className={navBtnClass('dashboard')}>
            <div className="flex items-center gap-3"><lucide.LayoutDashboard className="w-5 h-5" /> <span>Dashboard</span></div>
          </button>
          <button id="rw-tour-neworder" onClick={() => router.push('/dashboard/client/order/new')} className={navBtnClass('new')}>
            <div className="flex items-center gap-3"><lucide.PlusCircle className="w-5 h-5" /> <span>New Order</span></div>
          </button>
          
          {/* Services Group */}
          <div className="mt-2 mb-1">
            <p className="text-[9px] uppercase tracking-widest text-secondary font-black pl-3 mb-1.5">Writing Services</p>
            <div className="space-y-1 pl-2 border-l border-zinc-800">
              <button onClick={() => router.push('/dashboard/client/order/new/dev')} className={navBtnClass('new/dev')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.Code className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Web Development</span></div>
              </button>
              <button onClick={() => router.push('/dashboard/client/order/new/resume')} className={navBtnClass('new/resume')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.FileText className="w-4 h-4 text-emerald-400 shrink-0" /> <span>CV / Resume</span></div>
              </button>
              <button onClick={() => router.push('/dashboard/client/order/new/content')} className={navBtnClass('new/content')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.PenTool className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Content Writing</span></div>
              </button>
              <button onClick={() => router.push('/dashboard/client/order/new/academic')} className={navBtnClass('new/academic')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Premium Academic Writing</span></div>
              </button>
              <button onClick={() => router.push('/dashboard/client/order/new/statistics')} className={navBtnClass('new/statistics')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.LineChart className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Statistics & Fieldwork</span></div>
              </button>
            </div>
          </div>

          {/* Project Topics */}
          <div className="mt-2 mb-1">
            <p className="text-[9px] uppercase tracking-widest text-secondary font-black pl-3 mb-1.5">Project Materials</p>
            <div className="space-y-1 pl-2 border-l border-zinc-800">
              <button onClick={() => router.push('/dashboard/client?tab=projects')} className={navBtnClass('projects')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.BookOpen className="w-4 h-4 text-amber-400 shrink-0" /> <span>Buy Already-Made Projects</span></div>
              </button>
              <button onClick={() => router.push('/dashboard/client?tab=scripts')} className={navBtnClass('scripts')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.ShoppingBag className="w-4 h-4 text-cyan-400 shrink-0" /> <span>My Scripts</span></div>
              </button>
            </div>
          </div>

          {/* Account Group */}
          <div className="mt-2 mb-1">
            <p className="text-[9px] uppercase tracking-widest text-secondary font-black pl-3 mb-1.5">Account</p>
            <div className="space-y-1 pl-2 border-l border-zinc-800">
              <button id="rw-tour-vault" onClick={() => router.push('/dashboard/client?tab=vault')} className={navBtnClass('vault')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.Lock className="w-4 h-4 shrink-0" /> <span>Secure Vault</span></div>
                {unviewedVaultCount > 0 && <span className="px-2 py-0.5 bg-emerald-500 text-black rounded-md text-[10px] font-black">{unviewedVaultCount}</span>}
              </button>
              <button id="rw-tour-wallet" onClick={() => router.push('/dashboard/client?tab=wallet')} className={navBtnClass('wallet')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.Wallet className="w-4 h-4 shrink-0" /> <span>Wallet</span></div>
              </button>
              <button onClick={() => router.push('/dashboard/client?tab=affiliate')} className={navBtnClass('affiliate')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.Coins className="w-4 h-4 text-purple-400 shrink-0" /> <span>Affiliate</span></div>
              </button>
              <button id="rw-tour-profile" onClick={() => router.push('/dashboard/client?tab=profile')} className={navBtnClass('profile')}>
                <div className="flex items-center gap-2.5 text-xs"><lucide.User className="w-4 h-4 shrink-0" /> <span>My Profile</span></div>
              </button>
            </div>
          </div>

          <button id="rw-tour-chat" onClick={() => router.push('/dashboard/client?tab=chat')} className={navBtnClass('chat')}>
            <div className="flex items-center gap-3"><lucide.MessageSquare className="w-5 h-5" /> <span>Support Chat</span></div>
          </button>
        </nav>

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
          <button onClick={() => { router.push('/dashboard/client'); setMobileMenuOpen(false); }} className={navBtnClass('dashboard')}>
            <div className="flex items-center gap-3"><lucide.LayoutDashboard className="w-5 h-5" /> <span>Dashboard</span></div>
          </button>
          <button onClick={() => { router.push('/dashboard/client/order/new'); setMobileMenuOpen(false); }} className={navBtnClass('new')}>
            <div className="flex items-center gap-3"><lucide.PlusCircle className="w-5 h-5" /> <span>New Order</span></div>
          </button>

          {/* Mobile subpath items */}
          <div className="pl-4 border-l border-zinc-800 space-y-1 my-1">
            <button onClick={() => { router.push('/dashboard/client/order/new/dev'); setMobileMenuOpen(false); }} className={navBtnClass('new/dev')}>
              <div className="flex items-center gap-2.5 text-xs"><lucide.Code className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Web Development</span></div>
            </button>
            <button onClick={() => { router.push('/dashboard/client/order/new/resume'); setMobileMenuOpen(false); }} className={navBtnClass('new/resume')}>
              <div className="flex items-center gap-2.5 text-xs"><lucide.FileText className="w-4 h-4 text-emerald-400 shrink-0" /> <span>CV / Resume</span></div>
            </button>
            <button onClick={() => { router.push('/dashboard/client/order/new/content'); setMobileMenuOpen(false); }} className={navBtnClass('new/content')}>
              <div className="flex items-center gap-2.5 text-xs"><lucide.PenTool className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Content Writing</span></div>
            </button>
            <button onClick={() => { router.push('/dashboard/client/order/new/academic'); setMobileMenuOpen(false); }} className={navBtnClass('new/academic')}>
              <div className="flex items-center gap-2.5 text-xs"><lucide.GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Premium Academic Writing</span></div>
            </button>
            <button onClick={() => { router.push('/dashboard/client/order/new/statistics'); setMobileMenuOpen(false); }} className={navBtnClass('new/statistics')}>
              <div className="flex items-center gap-2.5 text-xs"><lucide.LineChart className="w-4 h-4 text-emerald-400 shrink-0" /> <span>Statistics & Fieldwork</span></div>
            </button>
          </div>

          {/* Mobile: Project Topics */}
          <button onClick={() => { router.push('/dashboard/client?tab=projects'); setMobileMenuOpen(false); }} className={navBtnClass('projects')}>
            <div className="flex items-center gap-2.5 text-xs"><lucide.BookOpen className="w-4 h-4 text-amber-400 shrink-0" /> <span>Buy Already-Made Projects</span></div>
          </button>
          <button onClick={() => { router.push('/dashboard/client?tab=scripts'); setMobileMenuOpen(false); }} className={navBtnClass('scripts')}>
            <div className="flex items-center gap-2.5 text-xs"><lucide.ShoppingBag className="w-4 h-4 text-cyan-400 shrink-0" /> <span>My Scripts</span></div>
          </button>

          <p className="text-[9px] uppercase tracking-widest text-secondary font-black pl-3 mt-2 mb-1">Account</p>
          <button onClick={() => { router.push('/dashboard/client?tab=vault'); setMobileMenuOpen(false); }} className={navBtnClass('vault')}>
            <div className="flex items-center gap-3"><lucide.Lock className="w-5 h-5" /> <span>Secure Vault</span></div>
          </button>
          <button onClick={() => { router.push('/dashboard/client?tab=wallet'); setMobileMenuOpen(false); }} className={navBtnClass('wallet')}>
            <div className="flex items-center gap-3"><lucide.Wallet className="w-5 h-5" /> <span>Wallet</span></div>
          </button>
          <button onClick={() => { router.push('/dashboard/client?tab=affiliate'); setMobileMenuOpen(false); }} className={navBtnClass('affiliate')}>
            <div className="flex items-center gap-3"><lucide.Coins className="w-5 h-5 text-purple-400" /> <span>Affiliate</span></div>
          </button>
          <button onClick={() => { router.push('/dashboard/client?tab=profile'); setMobileMenuOpen(false); }} className={navBtnClass('profile')}>
            <div className="flex items-center gap-3"><lucide.User className="w-5 h-5" /> <span>My Profile</span></div>
          </button>
          <button onClick={() => { router.push('/dashboard/client?tab=chat'); setMobileMenuOpen(false); }} className={navBtnClass('chat')}>
            <div className="flex items-center gap-3"><lucide.MessageSquare className="w-5 h-5" /> <span>Support Chat</span></div>
          </button>
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
          <div className="flex items-center gap-4">
            <NotificationBell isAdmin={false} userEmail={user?.email || ''} userId={user?.id} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
