'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import * as lucide from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from '@/app/components/InvoicePDF';
import type { AdminOrderView, WorkflowStatus, CorrectionsStatus } from '@/lib/types';

ChartJS.register(ArcElement, Tooltip, Legend);

// Helper functions
const renderBool = (val: any): boolean => {
  if (val === true) return true;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'none') return false;
    return lower === 'yes' || lower === 'true' || lower === '1';
  }
  return false;
};

const parsePriceStr = (s: any): number => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
const formatNaira = (amount: number): string => '₦' + Math.round(amount).toLocaleString('en-NG');
const formatDate = (iso: string | null): string => {
  if (!iso || iso === 'Not set') return 'Not set';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
};
const formatDateTime = (iso: string | null): string => {
  if (!iso) return 'Never';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB');
  } catch { return iso; }
};

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null); // Supabase user object, can be kept as any or import User type
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [currentOrder, setCurrentOrder] = useState<AdminOrderView | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [countdownClass, setCountdownClass] = useState<string>('');
  const [lastKnownStatus, setLastKnownStatus] = useState<WorkflowStatus | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [clientNotes, setClientNotes] = useState<string>('');
  const [correctionText, setCorrectionText] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('auto');
  const [isLight, setIsLight] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (profile) setIsAdmin(!!profile.is_admin);
      const savedTheme = localStorage.getItem('yrw_theme') as 'light' | 'dark' | 'auto' | null;
      if (savedTheme) setThemeMode(savedTheme);
      else setThemeMode('auto');
      const savedNotif = localStorage.getItem('yrw_notifications');
      if (savedNotif !== null) setNotificationsEnabled(savedNotif === 'true');
      await fetchOrders(user.email);
    };
    init();
  }, []);

  const fetchOrders = async (email: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_orders_view')
      .select('*')
      .eq('Email', email)
      .order('Timestamp', { ascending: false });
    if (!error && data) {
      setOrders(data as AdminOrderView[]);
      if (data.length > 0) setCurrentOrder(data[0] as AdminOrderView);
    }
    setLoading(false);
  };

  useEffect(() => {
    const updateTheme = () => {
      let light = false;
      if (themeMode === 'light') light = true;
      else if (themeMode === 'dark') light = false;
      else light = window.matchMedia('(prefers-color-scheme: light)').matches;
      setIsLight(light);
    };
    updateTheme();
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', updateTheme);
    return () => window.matchMedia('(prefers-color-scheme: light)').removeEventListener('change', updateTheme);
  }, [themeMode]);

  useEffect(() => {
    if (!currentOrder || !currentOrder.Deadline) return;
    const interval = setInterval(() => {
      const deadline = new Date(currentOrder.Deadline);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown('Overdue');
        setCountdownClass('text-red-500 font-bold');
      } else {
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        let str = '';
        if (days > 0) str += `${days}d `;
        str += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setCountdown(str);
        setCountdownClass(days < 1 ? 'text-amber-500 font-bold' : 'text-emerald-500');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentOrder]);

  useEffect(() => {
    if (!currentOrder) return;
    const newStatus = currentOrder['Workflow Status'] as WorkflowStatus;
    if (lastKnownStatus && lastKnownStatus !== newStatus && notificationsEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Order ${currentOrder['Order ID']} updated`, {
          body: `Status changed from ${lastKnownStatus} to ${newStatus}`,
        });
      }
    }
    setLastKnownStatus(newStatus);
  }, [currentOrder, lastKnownStatus, notificationsEnabled]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (user?.email) fetchOrders(user.email);
    }, 300000);
    return () => clearInterval(interval);
  }, [autoRefresh, user]);

  useEffect(() => {
    if (currentOrder) {
      const saved = localStorage.getItem(`client_notes_${currentOrder['Order ID']}`);
      setClientNotes(saved || '');
    }
  }, [currentOrder]);

  const saveClientNotes = () => {
    if (currentOrder) {
      localStorage.setItem(`client_notes_${currentOrder['Order ID']}`, clientNotes);
      alert('Notes saved locally');
    }
  };

  const toggleTheme = () => {
    let newMode: 'light' | 'dark' | 'auto';
    if (themeMode === 'auto') newMode = 'dark';
    else if (themeMode === 'dark') newMode = 'light';
    else newMode = 'auto';
    setThemeMode(newMode);
    localStorage.setItem('yrw_theme', newMode);
  };

  const sendWhatsApp = (msg: string) => {
    if (!currentOrder) return;
    const phone = '+2348121443666';
    const text = `${msg} (Order: ${currentOrder['Order ID']}, ${currentOrder['Legal Name']})`;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleBalancePayment = async () => {
    if (!currentOrder) return;
    setProcessingPayment(true);
    try {
      const amount = parsePriceStr(currentOrder['Financial Quote']) * 0.4;
      const res = await fetch('/api/flutterwave/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrder['Order ID'],
          amount,
          email: currentOrder['Email'],
          name: currentOrder['Legal Name'],
          type: 'BALANCE'
        }),
      });
      const data = await res.json();
      if (data.link) window.location.href = data.link;
      else alert(`Error: ${data.error}`);
    } catch (e) {
      alert("Network error processing payment.");
    }
    setProcessingPayment(false);
  };

  const downloadFinalFiles = async () => {
    if (!currentOrder) return;
    setDownloading(true);
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('final-deliverables')
        .list(currentOrder['Order ID']);
      if (listError || !files || files.length === 0) {
        alert("No files found in the vault. Please contact admin.");
        setDownloading(false);
        return;
      }
      const { data: linkData, error: linkError } = await supabase.storage
        .from('final-deliverables')
        .createSignedUrl(`${currentOrder['Order ID']}/${files[0].name}`, 60);
      if (linkError) alert("Error unlocking file.");
      else window.open(linkData.signedUrl, '_blank');
    } catch (e) {
      alert("System error accessing vault.");
    }
    setDownloading(false);
  };

  const downloadReceipt = async () => {
    if (!currentOrder) return;
    const amount = parsePriceStr(currentOrder['Financial Quote']);
    const type = renderBool(currentOrder['60% Paid']) ? 'BALANCE' : 'DEPOSIT';
    const blob = await pdf(<InvoicePDF order={currentOrder} amount={amount} type={type} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${currentOrder['Order ID']}_${type}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPaymentChartData = () => {
    if (!currentOrder) return { labels: [], datasets: [] };
    const total = parsePriceStr(currentOrder['Financial Quote']);
    const paid60 = renderBool(currentOrder['60% Paid']);
    const paid40 = renderBool(currentOrder['40% Paid']);
    const depositPaid = paid60 ? total * 0.6 : 0;
    const balancePaid = paid40 ? total * 0.4 : 0;
    const remaining = Math.max(0, total - depositPaid - balancePaid);
    return {
      labels: ['Deposit Paid', 'Balance Paid', 'Remaining'],
      datasets: [{
        data: [depositPaid, balancePaid, remaining],
        backgroundColor: ['#1DB954', '#10b981', '#ef4444'],
        borderWidth: 0,
      }],
    };
  };

  const getScores = () => {
    if (!currentOrder) return { plagiarism: null, ai: null };
    const vault = currentOrder['Vault Status'] || '';
    const pMatch = vault.match(/P:(\d+(\.\d+)?)%/);
    const aiMatch = vault.match(/AI:(\d+(\.\d+)?)%/);
    const plagiarism = pMatch ? parseFloat(pMatch[1]) : null;
    const ai = aiMatch ? parseFloat(aiMatch[1]) : null;
    return { plagiarism, ai };
  };

  const getProgressStepClass = (step: string): string => {
    if (!currentOrder) return '';
    const status = currentOrder['Workflow Status'];
    if (step === 'briefing' && status !== 'Briefing Received') return 'completed';
    if (step === 'payment' && (renderBool(currentOrder['60% Paid']) || status.includes('Synthesis') || status.includes('Audit') || status === 'Completed')) return 'completed';
    if (step === 'synthesis' && (status.includes('Synthesis') || status.includes('Audit') || status === 'Completed')) return 'completed';
    if (step === 'complete' && status === 'Completed') return 'completed';
    return '';
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading dashboard...</div>;
  if (!currentOrder) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center">
        <lucide.Inbox className="w-16 h-16 text-slate-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">No orders found</h2>
        <p className="text-slate-400 mb-6">We couldn’t find any orders linked to <strong>{user?.email}</strong>.</p>
        <div className="space-y-3 text-center">
          <a href="/" className="inline-block px-6 py-3 bg-emerald-500 text-black font-bold rounded-full">Place a new order</a>
          <p className="text-xs text-slate-500">If you have an existing order, make sure you used the same email address when placing it.</p>
        </div>
      </div>
    );
  }

  const scores = getScores();
  const total = parsePriceStr(currentOrder['Financial Quote']);
  const paid60 = renderBool(currentOrder['60% Paid']);
  const paid40 = renderBool(currentOrder['40% Paid']);
  const workSubmitted = renderBool(currentOrder['Work Submitted']);
  const remaining = total - (paid60 ? total * 0.6 : 0) - (paid40 ? total * 0.4 : 0);

  return (
    <div className={`min-h-screen p-4 transition-colors ${isLight ? 'bg-gradient-to-br from-slate-50 to-slate-200 text-slate-900' : 'bg-gradient-to-br from-[#050505] to-[#0a0a0a] text-white'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">Project Dashboard</h1>
            <p className="text-xs uppercase tracking-widest text-slate-500">{currentOrder['Order ID']} | {currentOrder['Legal Name']}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-full transition-colors hover:bg-white/10">{themeMode === 'light' ? '☀️' : themeMode === 'dark' ? '🌙' : '⚙️'}</button>
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`p-2 rounded-full transition-colors ${autoRefresh ? 'text-emerald-500' : ''}`}><lucide.RefreshCw className="w-5 h-5" /></button>
            <button onClick={() => setNotificationsEnabled(!notificationsEnabled)} className="p-2 rounded-full transition-colors">{notificationsEnabled ? '🔔' : '🔕'}</button>
            {isAdmin && <a href="/admin" className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><lucide.LayoutDashboard className="w-3 h-3" /> Admin Panel</a>}
            <button onClick={() => sendWhatsApp('Hello, I have a question about my order.')} className="px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><lucide.MessageCircle className="w-3 h-3" /> WhatsApp</button>
            <a href="/" className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold uppercase flex items-center gap-1"><lucide.Plus className="w-3 h-3" /> New Order</a>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-bold uppercase">Logout</button>
          </div>
        </div>
        {/* Order tabs */}
        {orders.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {orders.map(order => (
              <button key={order['Order ID']} onClick={() => setCurrentOrder(order)} className={`px-4 py-2 rounded-full text-xs font-bold transition ${currentOrder['Order ID'] === order['Order ID'] ? 'bg-emerald-500 text-black' : 'bg-white/5 hover:bg-white/10'}`}>{order['Order ID']}</button>
            ))}
          </div>
        )}
        {/* Main grid – exactly the same JSX as the user's original, no changes needed besides types. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'} backdrop-blur-sm`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Status</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${currentOrder['Workflow Status'] === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{currentOrder['Workflow Status']}</span>
              </div>
              <p className="text-sm leading-relaxed border-l-2 border-emerald-500 pl-4 py-1">
                {currentOrder['Workflow Status'] === 'Briefing Received' && 'Your project details have been securely logged. Expect a quote within 24 hours.'}
                {currentOrder['Workflow Status'] === 'Quote Sent' && 'Your custom quote is ready. Please make the 60% deposit to begin work.'}
                {currentOrder['Workflow Status'] === 'Synthesis Active' && 'Work has officially begun! Our researchers are drafting your document.'}
                {currentOrder['Workflow Status'] === 'Internal Audit' && 'Your completed work is undergoing quality assurance.'}
                {currentOrder['Workflow Status'] === 'Completed' && 'Congratulations! Your project is complete.'}
              </p>
              <div className="grid grid-cols-4 gap-2 mt-6">
                {['briefing', 'payment', 'synthesis', 'complete'].map((step, idx) => (
                  <div key={step} className={`text-center progress-step ${getProgressStepClass(step)}`}>
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-black transition-colors ${getProgressStepClass(step) ? 'bg-emerald-500/30 text-emerald-500' : 'bg-white/5'}`}>{getProgressStepClass(step) ? '✓' : idx + 1}</div>
                    <p className="text-[9px] uppercase mt-1">{step.charAt(0).toUpperCase() + step.slice(1)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Project Brief</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block text-[10px] uppercase">Topic</span><span className="font-medium">{currentOrder['Research Topic'] || '—'}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Service Tier</span><span className="font-medium">{currentOrder['Service Tier'] || '—'}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Word Count</span><span className="font-medium">{currentOrder['Word Count']?.toLocaleString() || '—'} words</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Citation</span><span className="font-medium">{currentOrder['Reference Style'] || '—'}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Font</span><span className="font-medium">{currentOrder['Font Specification'] || '—'}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Deadline</span><span className="font-medium">{formatDate(currentOrder['Deadline'])}</span></div>
                <div className="col-span-2"><span className="text-slate-500 block text-[10px] uppercase">Time Remaining</span><span className={`font-mono font-bold text-xl ${countdownClass}`}>{countdown}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Est. Completion</span><span className="font-medium">{currentOrder['Workflow Status'] === 'Completed' ? 'Completed' : formatDate(currentOrder['Deadline'])}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Last Activity</span><span className="font-medium">{formatDateTime(currentOrder['Last Activity'] || currentOrder['Timestamp'])}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Media Link</span><span className="font-medium">{currentOrder['Media Sync'] && currentOrder['Media Sync'] !== 'None' ? <a href={currentOrder['Media Sync']} target="_blank" className="text-emerald-500 underline">View</a> : 'None'}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Additional Info</span><span className="font-medium">{currentOrder['Additional Info'] || '—'}</span></div>
                <div><span className="text-slate-500 block text-[10px] uppercase">Work Submitted</span><span className={`font-bold ${workSubmitted ? 'text-emerald-500' : 'text-amber-500'}`}>{workSubmitted ? '✅ File Sent' : '⏳ Pending'}</span></div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[10px]"><span>Overall Progress</span><span id="word-progress-text">0%</span></div>
                <div className="w-full bg-white/10 rounded-full h-2 mt-1"><div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${currentOrder['Workflow Status'] === 'Completed' ? 100 : currentOrder['Workflow Status'] === 'Internal Audit' ? 90 : currentOrder['Workflow Status'] === 'Synthesis Active' ? 50 : 20}%` }}></div></div>
              </div>
            </div>
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">📝 Your Private Notes <span className="text-[9px] font-normal normal-case">(only visible to you)</span></h3>
              <textarea rows={3} className="w-full rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-transparent border border-white/10" value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Write your personal notes about this project..."></textarea>
              <button onClick={saveClientNotes} className="mt-2 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg transition">Save Notes</button>
            </div>
          </div>
          <div className="space-y-6">
            {/* Vault Card */}
            <div className={`rounded-2xl p-6 border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'} ${workSubmitted && !paid40 ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : ''}`}>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2"><lucide.Lock className="w-4 h-4" /> Secure Delivery Vault</h3>
              {!workSubmitted ? (
                <div className="text-center py-4 opacity-50"><lucide.FileX className="w-8 h-8 mx-auto mb-2 text-slate-500" /><p className="text-xs text-slate-400">Vault is empty.<br/>Researchers are actively drafting.</p></div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-3"><lucide.FileCheck className="w-6 h-6 text-emerald-500" /><div><p className="text-xs font-bold text-emerald-400">Final Documents Uploaded</p><p className="text-[10px] text-slate-400">Ready for secure download.</p></div></div>
                  {!paid40 ? (
                    <div className="space-y-3"><p className="text-[10px] text-amber-500 font-bold bg-amber-500/10 p-2 rounded-lg text-center">Vault locked. Clear 40% balance to access files.</p><button onClick={handleBalancePayment} disabled={processingPayment} className="w-full py-3 bg-amber-500 text-black font-black uppercase text-[11px] tracking-widest rounded-xl hover:bg-amber-400 transition">{processingPayment ? 'Processing...' : 'Pay Balance to Unlock'}</button></div>
                  ) : (
                    <button onClick={downloadFinalFiles} disabled={downloading} className="w-full py-3 bg-emerald-500 text-black font-black uppercase text-[11px] tracking-widest rounded-xl hover:bg-emerald-400 transition flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20"><lucide.Download className="w-4 h-4" /> {downloading ? 'Decrypting...' : 'Download Final Files'}</button>
                  )}
                </div>
              )}
            </div>
            {/* Payment Summary */}
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Payment Summary</h3>
              <div className="flex flex-col items-center">
                <div className="w-48 h-48"><Doughnut data={getPaymentChartData()} options={{ cutout: '65%', plugins: { legend: { display: false } } }} /></div>
                {remaining <= 0 && total > 0 && <div className="mt-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center w-full"><span className="text-emerald-400 font-bold text-sm">🎉 Fully Paid! Thank you.</span></div>}
                <div className="w-full space-y-3 mt-4">
                  <div className="flex justify-between items-end"><span className="text-sm">Total Quote</span><span className="text-xl font-black text-emerald-500">{formatNaira(total)}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2"><span>60% Deposit</span><span className={paid60 ? 'text-emerald-500 font-bold' : 'text-amber-500'}>{paid60 ? '✅ Paid' : '❌ Pending'}</span></div>
                  <div className="flex justify-between"><span>40% Balance</span><span className={paid40 ? 'text-emerald-500 font-bold' : 'text-amber-500'}>{paid40 ? '✅ Paid' : '❌ Pending'}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2"><span className="font-bold">Remaining</span><span className="text-lg font-black text-red-400">{formatNaira(remaining)}</span></div>
                </div>
              </div>
            </div>
            {/* Originality Report */}
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">🔬 Originality Report</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center"><div className="w-24 h-24 mx-auto"><Doughnut data={{ labels: ['Similarity', 'Original'], datasets: [{ data: [scores.plagiarism || 0, 100 - (scores.plagiarism || 0)], backgroundColor: ['#ef4444', '#334155'], borderWidth: 0 }] }} options={{ cutout: '75%', plugins: { legend: { display: false } } }} /></div><div className="text-2xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent mt-2">{scores.plagiarism !== null ? scores.plagiarism.toFixed(1) : '—'}%</div><p className="text-[8px] uppercase tracking-widest text-slate-500">Plagiarism</p></div>
                <div className="text-center"><div className="w-24 h-24 mx-auto"><Doughnut data={{ labels: ['AI', 'Human'], datasets: [{ data: [scores.ai || 0, 100 - (scores.ai || 0)], backgroundColor: ['#f59e0b', '#334155'], borderWidth: 0 }] }} options={{ cutout: '75%', plugins: { legend: { display: false } } }} /></div><div className="text-2xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent mt-2">{scores.ai !== null ? scores.ai.toFixed(1) : '—'}%</div><p className="text-[8px] uppercase tracking-widest text-slate-500">AI Detection</p></div>
              </div>
            </div>
            {/* Corrections, Quick Support, Request Corrections, Download Receipt – identical to original */}
            {currentOrder['Corrections Status'] && currentOrder['Corrections Status'] !== 'None' && (
              <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">✏️ Corrections</h3>
                <p className="text-sm">Status: {currentOrder['Corrections Status']}. Check your email/WhatsApp for details.</p>
              </div>
            )}
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">⚡ Quick Support</h3>
              <div className="space-y-2">
                <button onClick={() => sendWhatsApp('What is the current status of my order?')} className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-bold flex items-center justify-center gap-1">📊 Order Status</button>
                <button onClick={() => sendWhatsApp('Can you confirm the deadline for my order?')} className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 text-[10px] font-bold">⏰ Deadline Inquiry</button>
                <button onClick={() => sendWhatsApp('I have a question about the payment breakdown.')} className="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-purple-400 text-[10px] font-bold">💰 Payment Question</button>
                <button onClick={() => sendWhatsApp('Could you please provide a sample of the work so far?')} className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-400 text-[10px] font-bold">📄 Request Sample</button>
              </div>
            </div>
            {workSubmitted && paid40 && (
              <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">✏️ Request Corrections</h3>
                <textarea rows={3} className="w-full bg-transparent border border-white/10 rounded-xl p-3 text-sm resize-none mb-3 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Describe what needs to be changed..." value={correctionText} onChange={e => setCorrectionText(e.target.value)}></textarea>
                <button onClick={async () => { await supabase.from('orders').update({ corrections_status: 'Requested' }).eq('order_id', currentOrder['Order ID']); sendWhatsApp(`Correction Request:\n${correctionText}`); setCorrectionText(''); alert("Correction request submitted!"); }} className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-bold">Send Correction Request</button>
              </div>
            )}
            <div className={`rounded-2xl p-6 ${isLight ? 'bg-white/80 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
              <button onClick={downloadReceipt} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 text-xs font-bold flex items-center justify-center gap-2"><lucide.FileText className="w-4 h-4" /> Download Receipt</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}