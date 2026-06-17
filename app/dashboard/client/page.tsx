'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import * as lucide from 'lucide-react';
import type { AdminOrderView } from '@/lib/types';
import ThemeToggle from '@/app/components/ThemeToggle';
import WalletPage from './wallet/page';

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================
const renderBool = (val: any): boolean => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    return ['yes', 'true', '1', 't', 'y'].includes(s);
  }
  return false;
};

const parsePriceStr = (s: any): number => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
const formatNaira = (amount: number): string => '₦' + Math.round(amount).toLocaleString('en-NG');
const formatDate = (iso: string | null): string => {
  if (!iso || iso === 'Not set') return 'Not set';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let toastId = 0;
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const event = new CustomEvent('app:toast', { detail: { id: toastId++, message, type } });
  window.dispatchEvent(event);
};

// ==========================================
// 2. MAIN COMPONENT EXPORT
// ==========================================
export default function ClientDashboard() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-primary text-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-emerald-500 text-xs font-black uppercase tracking-widest animate-pulse">Initializing Workspace...</span>
      </div>
    </div>
  );
}

// ==========================================
// 3. DASHBOARD LOGIC & UI
// ==========================================
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vault' | 'wallet' | 'profile'>('dashboard');
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderView | null>(null);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const [unviewedVaultCount, setUnviewedVaultCount] = useState(0);
  const [vaultFiles, setVaultFiles] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  const refreshOrders = useCallback(async (userId?: string, adminMode?: boolean, previewId?: string | null) => {
    try {
      if (adminMode && previewId) {
        const { data, error } = await supabase.from('admin_orders_view').select('*').eq('Order ID', previewId);
        if (error) throw error;
        if (data) setOrders(data as AdminOrderView[]);
      } else if (adminMode) {
        const { data, error } = await supabase.from('admin_orders_view').select('*').limit(10).order('Timestamp', { ascending: false });
        if (error) throw error;
        if (data) setOrders(data as AdminOrderView[]);
      } else if (userId) {
        const { data, error } = await supabase.from('admin_orders_view').select('*').eq('Email', userId).order('Timestamp', { ascending: false });
        if (error) throw error;
        if (data) setOrders(data as AdminOrderView[]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to refresh orders', 'error');
    }
  }, []);

  // Fetch vault files for the user (improved error handling)
  const fetchVaultFiles = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's order IDs
      const { data: userOrders, error: ordersError } = await supabase
        .from('orders')
        .select('order_id')
        .or(`client_id.eq.${user.id},email.eq.${user.email}`);

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
        throw ordersError;
      }

      const orderIds = userOrders?.map(o => o.order_id) || [];

      if (orderIds.length === 0) {
        setVaultFiles([]);
        setUnviewedVaultCount(0);
        return;
      }

      // Fetch deliverables for these orders
      const { data: files, error: filesError } = await supabase
        .from('final_deliverables')
        .select('*')
        .in('order_id', orderIds)
        .order('uploaded_at', { ascending: false });

      if (filesError) {
        console.error('Deliverables fetch error:', filesError);
        throw filesError;
      }

      setVaultFiles(files || []);
      const unviewed = files?.filter(f => f.downloaded_at === null).length || 0;
      setUnviewedVaultCount(unviewed);
    } catch (err) {
      console.error('Error fetching vault files:', err);
      // Set empty state to avoid breaking the UI
      setVaultFiles([]);
      setUnviewedVaultCount(0);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(userProfile);

      const previewOrderId = searchParams.get('preview');
      const isAdmin = userProfile?.is_admin === true;
      setIsAdminPreview(isAdmin);

      if (isAdmin) {
        if (previewOrderId) {
          await refreshOrders(undefined, true, previewOrderId);
        } else {
          await refreshOrders(undefined, true, null);
        }
      } else {
        await refreshOrders(user.email, false, null);
      }

      // Fetch vault files
      await fetchVaultFiles();
      
      setLoading(false);
    };
    
    init();

    const channel = supabase
      .channel('client-order-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refreshOrders(isAdminPreview ? undefined : user?.email, isAdminPreview, searchParams.get('preview'));
        showToast('Order status updated', 'info');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_deliverables' }, () => {
        fetchVaultFiles();
        showToast('Vault updated', 'info');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router, searchParams, refreshOrders, fetchVaultFiles]);

  const handlePayment = async (orderId: string, amount: number, email: string, name: string, type: 'DEPOSIT' | 'BALANCE') => {
    setProcessingPayment(orderId);
    try {
      const res = await fetch('/api/paystack/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, email, name, type }),
      });
      const data = await res.json();
      if (data.link) window.location.href = data.link;
      else showToast(`Payment initiation failed: ${data.error}`, 'error');
    } catch (err) {
      showToast('Network error communicating with payment gateway.', 'error');
    }
    setProcessingPayment(null);
  };

  // *** FIXED: downloadFile uses server API ***
  const downloadFile = async (fileId: number) => {
    try {
      const res = await fetch('/api/client/download-vault-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (res.ok && data.signedUrl) {
        window.open(data.signedUrl, '_blank');
        await fetchVaultFiles(); // refresh badge
        showToast('Download started', 'success');
      } else {
        showToast(data.error || 'Download failed', 'error');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('Network error', 'error');
    }
  };

  const markViewed = async (fileId: number) => {
    try {
      const res = await fetch('/api/client/mark-vault-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      if (res.ok) {
        showToast('Marked as viewed', 'success');
        await fetchVaultFiles(); // refresh to update badge
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to mark as viewed', 'error');
      }
    } catch (err) {
      console.error('Mark viewed error:', err);
      showToast('Error marking as viewed', 'error');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleResetPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) showToast(error.message, 'error');
    else showToast('Password reset email sent. Check your inbox.', 'success');
  };

  const handleUpdateEmail = async (newEmail: string) => {
    if (!newEmail) return showToast('Enter new email', 'error');
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) showToast(error.message, 'error');
    else showToast('Verification email sent. Please confirm your new address.', 'success');
  };

  if (loading) return <LoadingScreen />;

  const activeOrders = orders.filter(o => o['Workflow Status'] !== 'Completed' && o['Workflow Status'] !== 'Cancelled');
  const completedOrders = orders.filter(o => o['Workflow Status'] === 'Completed');

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col md:flex-row font-['Inter'] selection:bg-emerald-500/30">
      
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold animate-in slide-in-from-right duration-300 ${
            t.type === 'success' ? 'bg-emerald-500 text-black' : t.type === 'error' ? 'bg-red-500 text-white' : 'bg-card text-primary'
          }`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ================= SIDEBAR ================= */}
      <aside className="hidden md:flex flex-col w-64 bg-secondary border-r border-theme h-screen sticky top-0 p-6">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-black font-black text-xl">Y</div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Client Portal</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<lucide.LayoutDashboard />} label="Dashboard" />
          <SidebarBtn active={false} onClick={() => router.push('/dashboard/client/order/new')} icon={<lucide.PlusCircle />} label="New Order" />
          <SidebarBtn active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} icon={<lucide.Lock />} label="Secure Vault" badge={unviewedVaultCount} />
          <SidebarBtn active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={<lucide.Wallet />} label="Wallet" />
          <SidebarBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<lucide.User />} label="My Profile" />
        </nav>

        <div className="border-t border-theme pt-6 mt-6">
          <div className="mb-4">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-theme">
              <lucide.User className="w-5 h-5 text-secondary" />
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
      <div className="md:hidden bg-secondary border-b border-theme p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black font-black">Y</div>
          <span className="font-bold text-primary">Portal</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-primary">
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-secondary border-b border-theme p-4 flex flex-col gap-2 absolute w-full z-40 top-[73px]">
          <SidebarBtn active={activeTab === 'dashboard'} onClick={() => {setActiveTab('dashboard'); setMobileMenuOpen(false);}} icon={<lucide.LayoutDashboard />} label="Dashboard" />
          <SidebarBtn active={activeTab === 'vault'} onClick={() => {setActiveTab('vault'); setMobileMenuOpen(false);}} icon={<lucide.Lock />} label="Secure Vault" badge={unviewedVaultCount} />
          <SidebarBtn active={activeTab === 'wallet'} onClick={() => {setActiveTab('wallet'); setMobileMenuOpen(false);}} icon={<lucide.Wallet />} label="Wallet" />
          <SidebarBtn active={activeTab === 'profile'} onClick={() => {setActiveTab('profile'); setMobileMenuOpen(false);}} icon={<lucide.User />} label="My Profile" />
          <ThemeToggle />
          <button onClick={handleLogout} className="mt-4 p-3 text-red-400 font-bold text-left flex items-center gap-2"><lucide.LogOut className="w-4 h-4"/> Sign Out</button>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 overflow-y-auto relative">
        
        {/* Admin Preview Banner */}
        {isAdminPreview && (
          <div className="bg-amber-500 text-black py-2 px-6 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest sticky top-0 z-40 shadow-md">
            <lucide.Eye className="w-4 h-4" /> Admin Preview Mode
          </div>
        )}

        <div className="p-6 md:p-10">
          {/* === TAB: DASHBOARD === */}
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
              <header className="mb-10">
                <h2 className="text-3xl font-black text-primary">Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}</h2>
                <p className="text-secondary mt-1">Here is the current status of your research pipeline.</p>
              </header>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <StatCard label="Total Orders" value={orders.length} icon={<lucide.Layers />} />
                <StatCard label="Active" value={activeOrders.length} icon={<lucide.Activity />} color="text-amber-400" />
                <StatCard label="Completed" value={completedOrders.length} icon={<lucide.CheckCircle2 />} color="text-emerald-400" />
                <StatCard label="In Vault" value={vaultFiles.length} icon={<lucide.Lock />} color="text-purple-400" />
              </div>

              {/* Orders List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black">Active Projects</h3>
                  <button onClick={() => router.push('/dashboard/client/order/new')} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition flex items-center gap-2">
                    <lucide.Plus className="w-3 h-3" /> New Order
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="border border-dashed border-theme rounded-3xl p-12 text-center bg-card">
                    <lucide.Inbox className="w-12 h-12 text-secondary mx-auto mb-4" />
                    <h4 className="text-lg font-bold text-primary mb-2">No projects yet</h4>
                    <p className="text-secondary text-sm mb-6">Your workspace is empty. Submit a brief to get started.</p>
                    <button onClick={() => window.location.href = '/'} className="px-6 py-3 bg-emerald-500 text-black font-black rounded-full text-sm uppercase tracking-wider hover:bg-emerald-400 transition">Place First Order</button>
                  </div>
                ) : (
                  orders.map(order => <OrderCard 
                    key={order['Order ID']} 
                    order={order} 
                    handlePayment={handlePayment} 
                    processingPayment={processingPayment === order['Order ID']} 
                    openDetails={() => setSelectedOrderDetails(order)}
                  />)
                )}
              </div>
            </div>
          )}

          {/* === TAB: VAULT === */}
          {activeTab === 'vault' && (
            <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
              <header className="mb-10">
                <h2 className="text-3xl font-black text-primary flex items-center gap-3"><lucide.Lock className="text-emerald-500" /> Secure Vault</h2>
                <p className="text-secondary mt-1">Encrypted storage for all your completed deliverables.</p>
              </header>
              
              {vaultFiles.length === 0 ? (
                <div className="border border-theme bg-card rounded-3xl p-12 text-center">
                  <lucide.Shield className="w-12 h-12 text-secondary mx-auto mb-4" />
                  <p className="text-secondary">Your vault is currently empty. Files will appear here once drafting is complete.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vaultFiles.map(file => {
                    // Find the associated order to check payment status
                    const order = orders.find(o => o['Order ID'] === file.order_id);
                    const paid40 = order ? renderBool(order['40% Paid']) : false;
                    const isViewed = file.downloaded_at !== null;
                    return (
                      <div key={file.id} className="bg-card border border-theme rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><lucide.FileText className="w-24 h-24 text-secondary" /></div>
                        <h4 className="font-bold text-lg mb-1 relative z-10 text-primary">{file.order_id}</h4>
                        <p className="text-xs text-secondary mb-2 relative z-10">{file.file_name}</p>
                        <p className="text-[10px] text-secondary mb-4 relative z-10">
                          Uploaded: {new Date(file.uploaded_at).toLocaleDateString()}
                          {isViewed && ` • Viewed: ${new Date(file.downloaded_at).toLocaleDateString()}`}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-2 relative z-10">
                          {paid40 ? (
                            // *** FIXED: pass only file.id to downloadFile ***
                            <button onClick={() => downloadFile(file.id)} className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition">
                              <lucide.Download className="w-4 h-4" /> Download Package
                            </button>
                          ) : (
                            <button 
                              onClick={() => order && handlePayment(order['Order ID'], parsePriceStr(order['Financial Quote']) * 0.4, order['Email'], order['Legal Name'], 'BALANCE')} 
                              className="flex-1 py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-500/20 transition"
                            >
                              <lucide.Unlock className="w-4 h-4" /> Pay Balance to Unlock
                            </button>
                          )}
                          
                          {!isViewed && paid40 && (
                            <button
                              onClick={() => markViewed(file.id)}
                              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-secondary rounded-xl text-sm flex items-center justify-center gap-2 transition whitespace-nowrap"
                              title="Mark as viewed (clears notification badge)"
                            >
                              <lucide.Eye className="w-4 h-4" /> Mark Viewed
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === TAB: WALLET === */}
          {activeTab === 'wallet' && (
            <div className="animate-in fade-in duration-500">
              <WalletPage />
            </div>
          )}

          {/* === TAB: PROFILE (with password/email reset) === */}
          {activeTab === 'profile' && (
            <div className="animate-in fade-in duration-500 max-w-2xl mx-auto">
              <header className="mb-10">
                <h2 className="text-3xl font-black text-primary">Profile Settings</h2>
                <p className="text-secondary mt-1">Manage your personal information and account security.</p>
              </header>
              
              <div className="bg-card border border-theme rounded-3xl p-8">
                <div className="flex items-center gap-6 mb-8 border-b border-theme pb-8">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-500 font-black text-2xl">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-primary">{profile?.full_name}</h3>
                    <p className="text-secondary text-sm">Account Type: Client</p>
                    {renderBool(profile?.is_admin) && <span className="inline-block mt-2 px-2 py-1 bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase rounded-md">Admin</span>}
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Email Address</label>
                    <div className="p-3 bg-secondary border border-theme rounded-xl text-primary mt-1">{user?.email}</div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Change Email Address</label>
                    <div className="flex gap-3 mt-2">
                      <input
                        type="email"
                        id="newEmail"
                        placeholder="newemail@example.com"
                        className="flex-1 bg-secondary border border-theme rounded-xl px-4 py-2 text-sm focus:border-emerald-500 outline-none text-primary"
                      />
                      <button
                        onClick={async () => {
                          const newEmail = (document.getElementById('newEmail') as HTMLInputElement).value;
                          await handleUpdateEmail(newEmail);
                        }}
                        className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs"
                      >
                        Update Email
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleResetPassword}
                      className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold"
                    >
                      Reset Password
                    </button>
                  </div>

                  <div className="pt-4 border-t border-theme">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Account ID</label>
                    <div className="p-3 bg-secondary border border-theme rounded-xl text-secondary font-mono text-xs mt-1">{user?.id}</div>
                  </div>

                  <div className="pt-4">
                    <button onClick={() => window.open('https://wa.me/2348121443666', '_blank')} className="px-6 py-3 bg-[#25D366]/10 text-[#25D366] font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-[#25D366]/20 transition">
                      <lucide.MessageCircle className="w-4 h-4" /> Contact Support to Update Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= ORDER DETAILS MODAL ================= */}
          {selectedOrderDetails && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-end">
              <div className="bg-primary w-full max-w-md h-full border-l border-theme flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b border-theme flex justify-between items-center bg-secondary">
                  <div>
                    <h3 className="font-black text-lg text-primary">{selectedOrderDetails['Order ID']}</h3>
                    <p className="text-xs text-emerald-500 uppercase tracking-widest font-bold">Activity Log</p>
                  </div>
                  <button onClick={() => setSelectedOrderDetails(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition"><lucide.X className="w-5 h-5 text-secondary" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="mb-8">
                    <h4 className="text-xs font-bold text-secondary uppercase tracking-widest mb-2">Topic</h4>
                    <p className="text-sm bg-card p-4 rounded-xl border border-theme text-primary">{selectedOrderDetails['Research Topic']}</p>
                  </div>

                  <h4 className="text-xs font-bold text-secondary uppercase tracking-widest mb-6">Workflow History</h4>
                  
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:to-zinc-800">
                    <TimelineItem title="Order Placed" desc="Briefing received by system." date={formatDate(selectedOrderDetails['Timestamp'])} done={true} />
                    <TimelineItem 
                      title="Quote Generated" 
                      desc={`Financial assessment: ₦${parsePriceStr(selectedOrderDetails['Financial Quote']).toLocaleString()}`} 
                      date="Logged" 
                      done={parsePriceStr(selectedOrderDetails['Financial Quote']) > 0 && selectedOrderDetails['Workflow Status'] !== 'Briefing Received'} 
                    />
                    <TimelineItem 
                      title="Deposit Cleared" 
                      desc="60% payment verified. Synthesis started." 
                      date="Logged" 
                      done={renderBool(selectedOrderDetails['60% Paid'])} 
                    />
                    <TimelineItem 
                      title="Drafting & Quality Audit" 
                      desc="Research compilation in progress." 
                      date="Logged" 
                      done={selectedOrderDetails['Workflow Status'].includes('Synthesis') || renderBool(selectedOrderDetails['Work Submitted'])} 
                    />
                    <TimelineItem 
                      title="Vault Secured" 
                      desc="Final files uploaded to encrypted vault." 
                      date="Logged" 
                      done={renderBool(selectedOrderDetails['Work Submitted']) || selectedOrderDetails['Workflow Status'] === 'Completed'} 
                    />
                    <TimelineItem 
                      title="Completed" 
                      desc="Balance cleared and contract fulfilled." 
                      date="Logged" 
                      done={selectedOrderDetails['Workflow Status'] === 'Completed'} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================
function SidebarBtn({ active, onClick, icon, label, badge }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-3 rounded-xl transition font-bold text-sm ${active ? 'bg-emerald-500/10 text-emerald-500' : 'text-secondary hover:bg-white/5 hover:text-primary'}`}>
      <div className="flex items-center gap-3">
        {icon} <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && <span className="px-2 py-0.5 bg-emerald-500 text-black rounded-md text-[10px]">{badge}</span>}
    </button>
  );
}

function StatCard({ label, value, icon, color = "text-emerald-500" }: any) {
  return (
    <div className="bg-card border border-theme rounded-2xl p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg bg-secondary border border-theme ${color}`}>{icon}</div>
      </div>
      <div>
        <div className="text-3xl font-black text-primary">{value}</div>
        <div className="text-xs text-secondary uppercase tracking-widest font-bold mt-1">{label}</div>
      </div>
    </div>
  );
}

function TimelineItem({ title, desc, date, done }: any) {
  if (!done) return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-theme bg-secondary text-secondary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"><lucide.Circle className="w-4 h-4"/></div>
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-theme bg-secondary opacity-50">
        <div className="flex justify-between mb-1"><span className="font-bold text-sm text-secondary">{title}</span></div>
        <div className="text-xs text-secondary">{desc}</div>
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-emerald-500 bg-emerald-500/20 text-emerald-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"><lucide.Check className="w-5 h-5"/></div>
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <div className="flex justify-between mb-1"><span className="font-bold text-sm text-emerald-400">{title}</span><span className="text-[10px] text-secondary">{date}</span></div>
        <div className="text-xs text-secondary">{desc}</div>
      </div>
    </div>
  );
}

function OrderCard({ order, handlePayment, processingPayment, openDetails }: any) {
  const total = parsePriceStr(order['Financial Quote']);
  const paid60 = renderBool(order['60% Paid']);
  const paid40 = renderBool(order['40% Paid']);
  const workSubmitted = renderBool(order['Work Submitted']);
  
  const awaitingAdminApproval = order['Workflow Status'] === 'Briefing Received' || total <= 0;

  const depositAmount = total * 0.6;
  const balanceAmount = total * 0.4;

  return (
    <div className="bg-card border border-theme hover:border-emerald-500/50 transition-colors rounded-3xl p-6 md:p-8 relative overflow-hidden group">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-black tracking-tight text-primary">{order['Order ID']}</h3>
            <span className={`text-[10px] px-3 py-1 rounded-md font-black uppercase tracking-widest ${
              order['Workflow Status'] === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              awaitingAdminApproval ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {awaitingAdminApproval ? 'Awaiting Quote' : order['Workflow Status']}
            </span>
          </div>
          <p className="text-secondary text-sm max-w-2xl leading-relaxed">{order['Research Topic']}</p>
        </div>

        <div className="text-left md:text-right shrink-0">
          <div className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">Financial Quote</div>
          <div className="text-3xl font-black text-primary">
            {awaitingAdminApproval ? 'Pending...' : formatNaira(total)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">
          <span className={paid60 ? 'text-emerald-500' : ''}>1. Deposit</span>
          <span className={workSubmitted ? 'text-emerald-500' : ''}>2. Research</span>
          <span className={paid40 ? 'text-emerald-500' : ''}>3. Delivery</span>
        </div>
        <div className="w-full bg-secondary border border-theme rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out relative" 
            style={{ width: paid40 && workSubmitted ? '100%' : paid60 && workSubmitted ? '75%' : paid60 ? '33%' : '0%' }}>
            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-theme">
        <div className="flex items-center gap-6 text-xs w-full md:w-auto">
          <div><span className="text-secondary block mb-1">Deadline</span> <span className="font-bold text-primary">{formatDate(order['Deadline'])}</span></div>
          <div><span className="text-secondary block mb-1">Deposit</span> <span className={paid60 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{paid60 ? 'Cleared' : 'Pending'}</span></div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button onClick={openDetails} className="px-4 py-2.5 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition flex items-center gap-2">
            <lucide.Activity className="w-4 h-4" /> View Logs
          </button>

          {awaitingAdminApproval ? (
            <div className="px-5 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-bold flex items-center gap-2">
              <lucide.Clock className="w-4 h-4" /> Admin Reviewing Brief
            </div>
          ) : (
            <>
              {!paid60 && (
                <button
                  onClick={() => handlePayment(order['Order ID'], depositAmount, order['Email'], order['Legal Name'], 'DEPOSIT')}
                  disabled={processingPayment}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition disabled:opacity-50"
                >
                  {processingPayment ? 'Connecting...' : `Pay Deposit (${formatNaira(depositAmount)})`}
                </button>
              )}
              {paid60 && !paid40 && workSubmitted && (
                <button
                  onClick={() => handlePayment(order['Order ID'], balanceAmount, order['Email'], order['Legal Name'], 'BALANCE')}
                  disabled={processingPayment}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                >
                  <lucide.Unlock className="w-4 h-4" /> {processingPayment ? 'Connecting...' : `Clear Balance & Unlock Vault`}
                </button>
              )}
              {paid60 && paid40 && workSubmitted && (
                <div className="px-5 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-2">
                  <lucide.CheckCircle2 className="w-4 h-4" /> Contract Fulfilled
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}