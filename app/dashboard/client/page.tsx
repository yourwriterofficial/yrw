'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import * as lucide from 'lucide-react';
import type { AdminOrderView } from '@/lib/types';

// ==========================================
// 1. BULLETPROOF HELPER FUNCTIONS
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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
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
  
  // State
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vault' | 'profile'>('dashboard');
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderView | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);

      const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(userProfile);

      await fetchOrders(user.email!);
      setLoading(false);
    };
    init();

    // Auto-refresh when returning to tab (e.g., after Flutterwave redirect)
    const handleFocus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) fetchOrders(session.user.email);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [router]);

  const fetchOrders = async (email: string) => {
    const { data, error } = await supabase
      .from('admin_orders_view')
      .select('*')
      .eq('Email', email)
      .order('Timestamp', { ascending: false });
    if (!error && data) setOrders(data as AdminOrderView[]);
  };

  const handlePayment = async (orderId: string, amount: number, email: string, name: string, type: 'DEPOSIT' | 'BALANCE') => {
  setProcessingPayment(orderId);
  try {
    const res = await fetch('/api/paystack/create-invoice', { // <-- Changed URL
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, amount, email, name, type }),
    });
    const data = await res.json();
    if (data.link) window.location.href = data.link;
    else alert(`Payment initiation failed: ${data.error}`);
  } catch (err) {
    alert('Network error communicating with payment gateway.');
  }
  setProcessingPayment(null);
};

  const downloadFile = async (orderId: string) => {
    try {
      const { data: files } = await supabase.storage.from('final-deliverables').list(orderId);
      if (!files || files.length === 0) return alert('No files found in the vault yet.');
      
      const { data: linkData } = await supabase.storage.from('final-deliverables').createSignedUrl(`${orderId}/${files[0].name}`, 60);
      if (linkData) window.open(linkData.signedUrl, '_blank');
    } catch (error) {
      alert('Error accessing the secure vault.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) return <LoadingScreen />;

  // Derived metrics
  const activeOrders = orders.filter(o => o['Workflow Status'] !== 'Completed' && o['Workflow Status'] !== 'Cancelled');
  const completedOrders = orders.filter(o => o['Workflow Status'] === 'Completed');
  const vaultItems = orders.filter(o => renderBool(o['Work Submitted']) || o['Workflow Status'] === 'Completed');

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-['Inter'] selection:bg-emerald-500/30">
      
      {/* ================= SIDEBAR (DESKTOP) ================= */}
      <aside className="hidden md:flex flex-col w-64 bg-black border-r border-white/5 h-screen sticky top-0 p-6">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-black font-black text-xl">Y</div>
          <div>
            <h1 className="font-black tracking-tight leading-none text-lg">YRW</h1>
            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Client Portal</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<lucide.LayoutDashboard />} label="Dashboard" />
          <SidebarBtn active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} icon={<lucide.Lock />} label="Secure Vault" badge={vaultItems.length} />
          <SidebarBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<lucide.User />} label="My Profile" />
        </nav>

        <div className="border-t border-white/10 pt-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <lucide.User className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{profile?.full_name || 'Client'}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition text-sm font-bold p-2 rounded-lg hover:bg-red-500/10">
            <lucide.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ================= MOBILE TOPBAR ================= */}
      <div className="md:hidden bg-black border-b border-white/5 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black font-black">Y</div>
          <span className="font-bold">Portal</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white">
          {mobileMenuOpen ? <lucide.X /> : <lucide.Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black border-b border-white/5 p-4 flex flex-col gap-2 absolute w-full z-40 top-[73px]">
          <SidebarBtn active={activeTab === 'dashboard'} onClick={() => {setActiveTab('dashboard'); setMobileMenuOpen(false);}} icon={<lucide.LayoutDashboard />} label="Dashboard" />
          <SidebarBtn active={activeTab === 'vault'} onClick={() => {setActiveTab('vault'); setMobileMenuOpen(false);}} icon={<lucide.Lock />} label="Secure Vault" />
          <SidebarBtn active={activeTab === 'profile'} onClick={() => {setActiveTab('profile'); setMobileMenuOpen(false);}} icon={<lucide.User />} label="My Profile" />
          <button onClick={handleLogout} className="mt-4 p-3 text-red-400 font-bold text-left flex items-center gap-2"><lucide.LogOut className="w-4 h-4"/> Sign Out</button>
        </div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto relative">
        
        {/* === TAB: DASHBOARD === */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header className="mb-10">
              <h2 className="text-3xl font-black text-white">Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}</h2>
              <p className="text-zinc-400 mt-1">Here is the current status of your research pipeline.</p>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <StatCard label="Total Orders" value={orders.length} icon={<lucide.Layers />} />
              <StatCard label="Active" value={activeOrders.length} icon={<lucide.Activity />} color="text-amber-400" />
              <StatCard label="Completed" value={completedOrders.length} icon={<lucide.CheckCircle2 />} color="text-emerald-400" />
              <StatCard label="In Vault" value={vaultItems.length} icon={<lucide.Lock />} color="text-purple-400" />
            </div>

            {/* Orders List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">Active Projects</h3>
                <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition flex items-center gap-2">
                  <lucide.Plus className="w-3 h-3" /> New Order
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center bg-[#0a0a0a]">
                  <lucide.Inbox className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-white mb-2">No projects yet</h4>
                  <p className="text-zinc-400 text-sm mb-6">Your workspace is empty. Submit a brief to get started.</p>
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
              <h2 className="text-3xl font-black text-white flex items-center gap-3"><lucide.Lock className="text-emerald-500" /> Secure Vault</h2>
              <p className="text-zinc-400 mt-1">Encrypted storage for all your completed deliverables.</p>
            </header>
            
            {vaultItems.length === 0 ? (
              <div className="border border-white/5 bg-[#0a0a0a] rounded-3xl p-12 text-center">
                <lucide.Shield className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-400">Your vault is currently empty. Files will appear here once drafting is complete.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vaultItems.map(order => {
                  const paid40 = renderBool(order['40% Paid']);
                  return (
                    <div key={order['Order ID']} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><lucide.FileText className="w-24 h-24" /></div>
                      <h4 className="font-bold text-lg mb-1 relative z-10">{order['Order ID']}</h4>
                      <p className="text-xs text-zinc-400 mb-6 relative z-10 line-clamp-1">{order['Research Topic']}</p>
                      
                      {paid40 ? (
                        <button onClick={() => downloadFile(order['Order ID'])} className="w-full py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition relative z-10">
                          <lucide.Download className="w-4 h-4" /> Download Package
                        </button>
                      ) : (
                        <button onClick={() => handlePayment(order['Order ID'], parsePriceStr(order['Financial Quote']) * 0.4, order['Email'], order['Legal Name'], 'BALANCE')} className="w-full py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-500/20 transition relative z-10">
                          <lucide.Unlock className="w-4 h-4" /> Pay Balance to Unlock
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* === TAB: PROFILE === */}
        {activeTab === 'profile' && (
          <div className="animate-in fade-in duration-500 max-w-2xl mx-auto">
            <header className="mb-10">
              <h2 className="text-3xl font-black text-white">Profile Settings</h2>
              <p className="text-zinc-400 mt-1">Manage your personal information and account security.</p>
            </header>
            
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8">
              <div className="flex items-center gap-6 mb-8 border-b border-white/5 pb-8">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-500 font-black text-2xl">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{profile?.full_name}</h3>
                  <p className="text-zinc-400 text-sm">Account Type: Client</p>
                  {renderBool(profile?.is_admin) && <span className="inline-block mt-2 px-2 py-1 bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase rounded-md">Admin</span>}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Email Address</label>
                  <div className="p-3 bg-black border border-white/10 rounded-xl text-zinc-300 mt-1">{user?.email}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Account ID</label>
                  <div className="p-3 bg-black border border-white/10 rounded-xl text-zinc-500 font-mono text-xs mt-1">{user?.id}</div>
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

        {/* ================= ORDER DETAILS MODAL (LOGS & HISTORY) ================= */}
        {selectedOrderDetails && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-end">
            <div className="bg-[#050505] w-full max-w-md h-full border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black">
                <div>
                  <h3 className="font-black text-lg">{selectedOrderDetails['Order ID']}</h3>
                  <p className="text-xs text-emerald-500 uppercase tracking-widest font-bold">Activity Log</p>
                </div>
                <button onClick={() => setSelectedOrderDetails(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition"><lucide.X className="w-5 h-5" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-8">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Topic</h4>
                  <p className="text-sm bg-[#0a0a0a] p-4 rounded-xl border border-white/5">{selectedOrderDetails['Research Topic']}</p>
                </div>

                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Workflow History</h4>
                
                {/* Visual Timeline based on status */}
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
      </main>
    </div>
  );
}

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================

function SidebarBtn({ active, onClick, icon, label, badge }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-3 rounded-xl transition font-bold text-sm ${active ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
      <div className="flex items-center gap-3">
        {icon} <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && <span className="px-2 py-0.5 bg-emerald-500 text-black rounded-md text-[10px]">{badge}</span>}
    </button>
  );
}

function StatCard({ label, value, icon, color = "text-emerald-500" }: any) {
  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg bg-black border border-white/5 ${color}`}>{icon}</div>
      </div>
      <div>
        <div className="text-3xl font-black">{value}</div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-1">{label}</div>
      </div>
    </div>
  );
}

function TimelineItem({ title, desc, date, done }: any) {
  if (!done) return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-zinc-800 bg-black text-zinc-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"><lucide.Circle className="w-4 h-4"/></div>
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/5 bg-black opacity-50">
        <div className="flex justify-between mb-1"><span className="font-bold text-sm text-zinc-500">{title}</span></div>
        <div className="text-xs text-zinc-600">{desc}</div>
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-emerald-500 bg-emerald-500/20 text-emerald-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"><lucide.Check className="w-5 h-5"/></div>
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <div className="flex justify-between mb-1"><span className="font-bold text-sm text-emerald-400">{title}</span><span className="text-[10px] text-zinc-500">{date}</span></div>
        <div className="text-xs text-zinc-400">{desc}</div>
      </div>
    </div>
  );
}

function OrderCard({ order, handlePayment, processingPayment, openDetails }: any) {
  const total = parsePriceStr(order['Financial Quote']);
  const paid60 = renderBool(order['60% Paid']);
  const paid40 = renderBool(order['40% Paid']);
  const workSubmitted = renderBool(order['Work Submitted']);
  
  // LOGIC LOCK: Admin Approval Check
  // If the status is still "Briefing Received" OR the admin hasn't set a price yet, lock payments.
  const awaitingAdminApproval = order['Workflow Status'] === 'Briefing Received' || total <= 0;

  const depositAmount = total * 0.6;
  const balanceAmount = total * 0.4;

  return (
    <div className="bg-[#0a0a0a] border border-white/10 hover:border-emerald-500/50 transition-colors rounded-3xl p-6 md:p-8 relative overflow-hidden group">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-black tracking-tight">{order['Order ID']}</h3>
            <span className={`text-[10px] px-3 py-1 rounded-md font-black uppercase tracking-widest ${
              order['Workflow Status'] === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              awaitingAdminApproval ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {awaitingAdminApproval ? 'Awaiting Quote' : order['Workflow Status']}
            </span>
          </div>
          <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">{order['Research Topic']}</p>
        </div>

        <div className="text-left md:text-right shrink-0">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Financial Quote</div>
          <div className="text-3xl font-black text-white">
            {awaitingAdminApproval ? 'Pending...' : formatNaira(total)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <span className={paid60 ? 'text-emerald-500' : ''}>1. Deposit</span>
          <span className={workSubmitted ? 'text-emerald-500' : ''}>2. Research</span>
          <span className={paid40 ? 'text-emerald-500' : ''}>3. Delivery</span>
        </div>
        <div className="w-full bg-black border border-white/5 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out relative" 
            style={{ width: paid40 && workSubmitted ? '100%' : paid60 && workSubmitted ? '75%' : paid60 ? '33%' : '0%' }}>
            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
        <div className="flex items-center gap-6 text-xs w-full md:w-auto">
          <div><span className="text-zinc-500 block mb-1">Deadline</span> <span className="font-bold text-white">{formatDate(order['Deadline'])}</span></div>
          <div><span className="text-zinc-500 block mb-1">Deposit</span> <span className={paid60 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{paid60 ? 'Cleared' : 'Pending'}</span></div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button onClick={openDetails} className="px-4 py-2.5 bg-black border border-white/10 hover:bg-white/5 text-white text-xs font-bold rounded-xl transition flex items-center gap-2">
            <lucide.Activity className="w-4 h-4" /> View Logs
          </button>

          {/* ADMIN LOCK LOGIC APPLIED HERE */}
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