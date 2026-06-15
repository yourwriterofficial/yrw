'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as lucide from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-['Inter'] selection:bg-purple-500/30">
      <aside className="hidden md:flex flex-col w-64 bg-black border-r border-white/5 h-screen sticky top-0 p-6 z-40">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl"><lucide.Shield className="w-5 h-5" /></div>
          <div><h1 className="font-black tracking-tight leading-none text-lg">YRW</h1><p className="text-[10px] text-purple-500 uppercase tracking-widest font-bold">SysAdmin</p></div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <Link href="/admin" className={`flex items-center p-3 rounded-xl transition font-bold text-sm ${isActive('/admin') && !pathname?.includes('/orders') && !pathname?.includes('/finance') && !pathname?.includes('/promos') && !pathname?.includes('/email') ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <lucide.LayoutDashboard className="w-5 h-5 mr-3" /> Dashboard
          </Link>
          <Link href="/admin/orders" className={`flex items-center p-3 rounded-xl transition font-bold text-sm ${isActive('/admin/orders') ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <lucide.Database className="w-5 h-5 mr-3" /> Orders
          </Link>
          <Link href="/admin/finance" className={`flex items-center p-3 rounded-xl transition font-bold text-sm ${isActive('/admin/finance') ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <lucide.Wallet className="w-5 h-5 mr-3" /> Finance
          </Link>
          <Link href="/admin/promos" className={`flex items-center p-3 rounded-xl transition font-bold text-sm ${isActive('/admin/promos') ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <lucide.Tag className="w-5 h-5 mr-3" /> Promo Codes
          </Link>
          <Link href="/admin/email" className={`flex items-center p-3 rounded-xl transition font-bold text-sm ${isActive('/admin/email') ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <lucide.Mail className="w-5 h-5 mr-3" /> Mass Email
          </Link>
          <Link href="/admin/settings" className={`flex items-center p-3 rounded-xl transition font-bold text-sm ${isActive('/admin/settings') ? 'bg-purple-500/10 text-purple-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <lucide.Settings className="w-5 h-5 mr-3" /> Settings
          </Link>
          <div className="my-4 border-t border-white/5" />
          <button onClick={() => window.open('/dashboard/client', '_blank')} className="w-full flex items-center p-3 rounded-xl transition font-bold text-sm text-zinc-400 hover:bg-white/5 hover:text-white">
            <lucide.ExternalLink className="w-5 h-5 mr-3" /> View Client UI
          </button>
        </nav>

        <div className="border-t border-white/10 pt-6 mt-6">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition text-sm font-bold p-2 rounded-lg hover:bg-red-500/10">
            <lucide.LogOut className="w-4 h-4" /> Terminate Session
          </button>
        </div>
      </aside>

      {/* Mobile topbar – same as before, update links similarly */}
      <div className="md:hidden bg-black border-b border-white/5 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-black"><lucide.Shield className="w-4 h-4" /></div>
          <span className="font-bold text-sm uppercase tracking-widest text-purple-500">Admin</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white">
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black border-b border-white/5 p-4 flex flex-col gap-2 absolute w-full z-40 top-[73px]">
          <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="p-3 text-zinc-400 font-bold flex items-center gap-2"><lucide.LayoutDashboard className="w-4 h-4" /> Dashboard</Link>
          <Link href="/admin/orders" onClick={() => setMobileMenuOpen(false)} className="p-3 text-zinc-400 font-bold flex items-center gap-2"><lucide.Database className="w-4 h-4" /> Orders</Link>
          <Link href="/admin/finance" onClick={() => setMobileMenuOpen(false)} className="p-3 text-zinc-400 font-bold flex items-center gap-2"><lucide.Wallet className="w-4 h-4" /> Finance</Link>
          <Link href="/admin/promos" onClick={() => setMobileMenuOpen(false)} className="p-3 text-zinc-400 font-bold flex items-center gap-2"><lucide.Tag className="w-4 h-4" /> Promo Codes</Link>
          <Link href="/admin/email" onClick={() => setMobileMenuOpen(false)} className="p-3 text-zinc-400 font-bold flex items-center gap-2"><lucide.Mail className="w-4 h-4" /> Mass Email</Link>
          <Link href="/admin/settings" onClick={() => setMobileMenuOpen(false)} className="p-3 text-zinc-400 font-bold flex items-center gap-2"><lucide.Settings className="w-4 h-4" /> Settings</Link>
          <button onClick={() => { window.open('/dashboard/client', '_blank'); setMobileMenuOpen(false); }} className="p-3 text-zinc-400 font-bold text-left flex items-center gap-2"><lucide.ExternalLink className="w-4 h-4" /> View Client UI</button>
          <button onClick={handleLogout} className="mt-4 p-3 text-red-400 font-bold text-left flex items-center gap-2"><lucide.LogOut className="w-4 h-4" /> Terminate Session</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}