'use client';

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import * as lucide from 'lucide-react';
import type { AdminOrderView } from '@/lib/types';
import ThemeToggle from '@/app/components/ThemeToggle';
import WalletPage from './wallet/page';
import { DashboardSkeleton } from '@/app/components/ui/Skeleton';
import { showToast } from '@/app/components/ui/Toast';
import { isCurrentlyImpersonating } from '@/lib/impersonate';
import StatusBadge from '@/app/components/ui/StatusBadge';
import StatCard from '@/app/components/ui/StatCard';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import NotificationPreferencesPanel from '@/app/components/ui/NotificationPreferencesPanel';
import MilestoneTimeline from '@/app/components/ui/MilestoneTimeline';
import { isOrderFullyPaid, isCustomPayment } from '@/lib/orderPayment';
import { deriveOrderStatus, amountPaid, displayMilestones } from '@/lib/orderStatus';
import SupportChat from './SupportChat';
import ProjectsTab from './ProjectsTab';
import ScriptsTab from './ScriptsTab';
import AffiliateTab from './AffiliateTab';

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

const parseAdditionalInfo = (raw: string | null): { notes?: string; extra_addons?: any[] } => {
  const str = raw || '';
  if (str.trim().startsWith('{') && str.trim().endsWith('}')) {
    try {
      return JSON.parse(str);
    } catch (e) {}
  }
  return { notes: str, extra_addons: [] };
};

const getPipelineDetails = (order: any) => {
  const oid = order?.['Order ID'] || order?.order_id || '';
  const top = order?.['Research Topic'] || order?.topic || '';
  
  if (oid.startsWith('PRJ-') || top.startsWith('[PROJECT]')) {
    return {
      category: 'Project Material',
      icon: 'BookOpen',
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
      borderClass: 'border-success/20',
      label: 'Ready-made Project Material',
      steps: [
        { title: 'Payment Confirmed', desc: 'Purchase received and logged.' },
        { title: 'Material Matched', desc: 'Chapters 1–5 material matched to your topic.' },
        { title: 'Quality Check', desc: 'Formatting and completeness verified.' },
        { title: 'Prepared for Delivery', desc: 'Package finalized for your vault.' },
        { title: 'Delivered to Vault', desc: 'Material available for download.' },
      ]
    };
  }
  if (oid.startsWith('DEV-') || top.startsWith('[DEV]')) {
    return {
      category: 'Software Dev',
      icon: 'Terminal',
      colorClass: 'text-info',
      bgClass: 'bg-info/10',
      borderClass: 'border-info/20',
      label: 'Full Stack & Custom Software',
      steps: [
        { title: 'Engineering Briefing', desc: 'Requirements received by engineering.' },
        { title: 'Scope & Architecture Design', desc: 'System specs and blueprints approved.' },
        { title: 'Active Development', desc: 'Coding modules and integrations in progress.' },
        { title: 'QA & Staging Deployment', desc: 'Testing build verified on staging servers.' },
        { title: 'Production Handover', desc: 'Secure repository credentials and docs ready.' },
      ]
    };
  }
  if (oid.startsWith('CT-') || top.startsWith('[CONTENT]')) {
    return {
      category: 'Content Writing',
      icon: 'PenTool',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/20',
      label: 'Content & Creative Writing',
      steps: [
        { title: 'Briefing Received', desc: 'Content directives and style parameters logged.' },
        { title: 'Outline Drafting', desc: 'Content structure and outline approved.' },
        { title: 'Copywriting & Content Synthesis', desc: 'First-pass copywriting in progress.' },
        { title: 'Editorial Audit & SEO Scan', desc: 'Grammar check, readability and SEO audit.' },
        { title: 'Final Copy Delivery', desc: 'Polished copy saved to final directory.' },
      ]
    };
  }
  if (oid.startsWith('CUST-') || oid.startsWith('STAT-') || top.startsWith('[COMPLEX]') || top.startsWith('[CUSTOM]')) {
    return {
      category: 'Bespoke Fieldwork',
      icon: 'LineChart',
      colorClass: 'text-accent',
      bgClass: 'bg-accent/10',
      borderClass: 'border-accent/20',
      label: 'Statistics, Maths, Financial & Fieldwork',
      steps: [
        { title: 'Research Briefing', desc: 'Fieldwork parameters and methodologies logged.' },
        { title: 'Data Collection & Processing', desc: 'Surveys and raw datasets compiled.' },
        { title: 'Statistical Modeling & Analysis', desc: 'SPSS/modeling processing completed.' },
        { title: 'Report Compiling', desc: 'Drafting findings and visualization briefs.' },
        { title: 'Handover & File Release', desc: 'Datasets and documentation released.' },
      ]
    };
  }
  if (oid.startsWith('CV-') || top.startsWith('[RESUME]')) {
    return {
      category: 'Resume & CV',
      icon: 'Briefcase',
      colorClass: 'text-info',
      bgClass: 'bg-info/10',
      borderClass: 'border-info/20',
      label: 'Executive CVs & Resumes',
      steps: [
        { title: 'ATS Guidelines Logged', desc: 'Target role, LinkedIn profile, history logged.' },
        { title: 'ATS Audit & Structuring', desc: 'Keyword alignment & outline structure draft.' },
        { title: 'Drafting CV/Resume', desc: 'Compiling achievements and cover letter copy.' },
        { title: 'Review & Audit Checks', desc: 'Formatting and double-audit checks finished.' },
        { title: 'Final Handover', desc: 'ATS-optimized PDF and doc files ready.' },
      ]
    };
  }
  
  // Default: Academic
  return {
    category: 'Academic Research',
    icon: 'BookOpen',
    colorClass: 'text-success',
    bgClass: 'bg-success/10',
    borderClass: 'border-success/20',
    label: 'Standard Academic Research',
    steps: [
      { title: 'Order Placed', desc: 'Briefing received by system.' },
      { title: 'Outline Drafted', desc: 'Chapter structure and thesis statement approved.' },
      { title: 'Research & Synthesis', desc: 'Academic drafting and citation compilation.' },
      { title: 'Plagiarism & AI Scan', desc: 'Turnitin and audit reports secured.' },
      { title: 'Completed & Released', desc: 'Final paper available in vault.' },
    ]
  };
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==========================================
// 2. MAIN COMPONENT EXPORT
// ==========================================
export default function ClientDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton stats={4} rows={4} />}>
      <DashboardContent />
    </Suspense>
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
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'vault' | 'wallet' | 'profile' | 'chat' | 'projects' | 'scripts' | 'affiliate'>('dashboard');

  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrderView | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'specs' | 'payments' | 'timeline'>('specs');
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [realUserIsAdmin, setRealUserIsAdmin] = useState(false);
  const [unviewedVaultCount, setUnviewedVaultCount] = useState(0);
  const [vaultFiles, setVaultFiles] = useState<any[]>([]);
  const [newAddonName, setNewAddonName] = useState('');
  const [submittingAddon, setSubmittingAddon] = useState(false);
  const [processingAddonPayment, setProcessingAddonPayment] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [vaultAddonRequest, setVaultAddonRequest] = useState<Record<string, string>>({});
  const [requestingAddon, setRequestingAddon] = useState<Record<string, boolean>>({});

  const userEmailRef = useRef<string | null>(null);
  const isAdminPreviewRef = useRef<boolean>(false);
  const isRealAdminRef = useRef<boolean>(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'vault' || tab === 'wallet' || tab === 'profile' || tab === 'dashboard' || tab === 'chat' || tab === 'projects' || tab === 'scripts' || tab === 'affiliate' || tab === 'orders') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // The admin_orders_view doesn't expose payment_milestones / payment_structure_type.
  // Fetch them from the RLS-scoped orders table and merge into each view row so the
  // client can see custom milestone progress.
  const mergeMilestoneData = useCallback(async (rows: AdminOrderView[]): Promise<AdminOrderView[]> => {
    if (!rows.length) return rows;
    const ids = rows.map(r => r['Order ID']);
    const { data: extra } = await supabase
      .from('orders')
      .select('order_id, payment_structure_type, payment_milestones')
      .in('order_id', ids);
    const byId: Record<string, any> = {};
    (extra || []).forEach(o => { byId[o.order_id] = o; });
    return rows.map(r => ({
      ...r,
      payment_structure_type: byId[r['Order ID']]?.payment_structure_type,
      payment_milestones: byId[r['Order ID']]?.payment_milestones,
    })) as AdminOrderView[];
  }, []);

  const refreshOrders = useCallback(async (userId?: string, adminMode?: boolean, previewId?: string | null) => {
    try {
      const isRealAdmin = isRealAdminRef.current;
      const effectiveAdminMode = adminMode && isRealAdmin;
      const effectiveEmail = isRealAdmin ? userId : (userEmailRef.current || userId);

      let freshOrders: AdminOrderView[] = [];
      if (effectiveAdminMode && previewId) {
        const { data, error } = await supabase.from('admin_orders_view').select('*').eq('Order ID', previewId);
        if (error) throw error;
        if (data) freshOrders = await mergeMilestoneData(data as AdminOrderView[]);
      } else if (effectiveAdminMode) {
        const { data, error } = await supabase.from('admin_orders_view').select('*').limit(10).order('Timestamp', { ascending: false });
        if (error) throw error;
        if (data) freshOrders = await mergeMilestoneData(data as AdminOrderView[]);
      } else if (effectiveEmail) {
        const { data, error } = await supabase.from('admin_orders_view').select('*').eq('Email', effectiveEmail).order('Timestamp', { ascending: false });
        if (error) throw error;
        if (data) freshOrders = await mergeMilestoneData(data as AdminOrderView[]);
      }
      setOrders(freshOrders);
      if (typeof window !== 'undefined' && freshOrders.length > 0) {
        try {
          sessionStorage.setItem('yrw_orders', JSON.stringify(freshOrders));
        } catch (e) {}
      }
    } catch (err) {
      // Transient load errors shouldn't alarm the user right after login — log only.
      console.error('refreshOrders failed:', err);
    }
  }, [mergeMilestoneData]);

  const fetchVaultFiles = useCallback(async () => {
    try {
      const impId = typeof window !== 'undefined' ? localStorage.getItem('impersonate_user_id') : null;
      const impEmail = typeof window !== 'undefined' ? localStorage.getItem('impersonate_user_email') : null;
      
      let url = '/api/client/vault-files';
      if (impId && impEmail) {
        url += `?impersonate_user_id=${encodeURIComponent(impId)}&impersonate_user_email=${encodeURIComponent(impEmail)}`;
      }
      
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch vault files');

      const visibleFiles = json.files || [];
      setVaultFiles(visibleFiles);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('yrw_vault_files', JSON.stringify(visibleFiles));
        } catch (e) {}
      }
      const unviewed = visibleFiles.filter((f: any) => f.downloaded_at === null).length || 0;
      setUnviewedVaultCount(unviewed);
      // Tell the persistent sidebar (a separate component tree in layout.tsx,
      // which tracks its own unviewed-vault badge count independently) to
      // refresh — otherwise the badge stays stale after a download/mark-viewed
      // here until a full page reload.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('yrw:vault-updated'));
      }
    } catch (err) {
      console.error('Error fetching vault files:', err);
      // Set empty state to avoid breaking the UI
      setVaultFiles([]);
      setUnviewedVaultCount(0);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // 1. Load from cache for instant loading bypass
      let cachedUser = null;
      let cachedProfile = null;
      let cachedWallet = 0;
      let cachedOrders = null;
      let cachedVault = null;
      if (typeof window !== 'undefined') {
        try {
          const uStr = sessionStorage.getItem('yrw_user');
          const pStr = sessionStorage.getItem('yrw_profile');
          const wStr = sessionStorage.getItem('yrw_wallet');
          const oStr = sessionStorage.getItem('yrw_orders');
          const vStr = sessionStorage.getItem('yrw_vault_files');
          if (uStr && pStr) {
            cachedUser = JSON.parse(uStr);
            cachedProfile = JSON.parse(pStr);
            cachedWallet = Number(wStr) || 0;
            
            setUser(cachedUser);
            setProfile(cachedProfile);
            setWalletBalance(cachedWallet);
            
            userEmailRef.current = cachedUser.email || null;
            isAdminPreviewRef.current = cachedProfile?.is_admin === true;
            setIsAdminPreview(cachedProfile?.is_admin === true);
            
            const cacheIsAdmin = cachedProfile?.is_admin === true;
            const cacheHasImpersonation = localStorage.getItem('impersonate_user_id') !== null;
            const cacheIsRealAdmin = cacheIsAdmin || cacheHasImpersonation;
            isRealAdminRef.current = cacheIsRealAdmin;
            setRealUserIsAdmin(cacheIsRealAdmin);
            
            if (oStr) {
              cachedOrders = JSON.parse(oStr);
              setOrders(cachedOrders);
            }
            if (vStr) {
              cachedVault = JSON.parse(vStr);
              setVaultFiles(cachedVault);
              setUnviewedVaultCount(cachedVault.filter((f: any) => f.downloaded_at === null).length || 0);
            }
            
            setLoading(false);
          }
        } catch (e) {}
      }

      // 2. Fetch fresh user details
      const { data: { user }, error: userError } = await supabase.auth.getUser();
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

      const [{ data: userProfile }, { data: walletRow }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
      ]);

      let activeProfile = userProfile;
      let activeWallet = walletRow;
      let activeUser = user;
      const impId = typeof window !== 'undefined' ? localStorage.getItem('impersonate_user_id') : null;
      const impEmail = typeof window !== 'undefined' ? localStorage.getItem('impersonate_user_email') : null;
      
      if (userProfile?.is_admin && impId && isCurrentlyImpersonating()) {
        setIsImpersonating(true);
        const [{ data: impProfile }, { data: impWallet }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', impId).single(),
          supabase.from('wallets').select('balance').eq('user_id', impId).maybeSingle(),
        ]);
        if (impProfile) {
          activeProfile = impProfile;
          activeWallet = impWallet;
          activeUser = { ...user, id: impId, email: impEmail || undefined };
        }
      }

      const isRealAdmin = userProfile?.is_admin === true;
      isRealAdminRef.current = isRealAdmin;
      setRealUserIsAdmin(isRealAdmin);

      setProfile(activeProfile);
      setWalletBalance(Number(activeWallet?.balance) || 0);
      
      // Update cache
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('yrw_user', JSON.stringify(activeUser));
          sessionStorage.setItem('yrw_profile', JSON.stringify(activeProfile));
          sessionStorage.setItem('yrw_wallet', String(Number(activeWallet?.balance) || 0));
        } catch (e) {}
      }

      userEmailRef.current = activeUser.email || null;
      const isAdmin = activeProfile?.is_admin === true;
      isAdminPreviewRef.current = isAdmin;
      
      await fetchVaultFiles();

      const previewOrderId = searchParams.get('preview');
      setIsAdminPreview(isAdmin);

      if (isAdmin) {
        await refreshOrders(undefined, true, previewOrderId || null);
      } else {
        await refreshOrders(activeUser.email, false, null);
      }

      setLoading(false);
    };
    
    init();

    const channel = supabase
      .channel('client-order-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refreshOrders(
          isAdminPreviewRef.current ? undefined : userEmailRef.current || undefined,
          isAdminPreviewRef.current,
          searchParams.get('preview')
        );
        showToast('Order status updated', 'info');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_deliverables' }, () => {
        fetchVaultFiles();
        showToast('Vault updated', 'info');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router, searchParams, refreshOrders, fetchVaultFiles]);

  useEffect(() => {
    const preview = searchParams.get('preview');
    if (preview && orders.length > 0) {
      const match = orders.find(o => o['Order ID'] === preview);
      if (match) setSelectedOrderDetails(match);
    }
  }, [searchParams, orders]);

  const handlePayment = async (orderId: string, amount: number, email: string, name: string, type: 'DEPOSIT' | 'BALANCE' | string) => {
    // Resolve a milestone index from the payment type (custom milestones use INDEX-n;
    // standard 60/40 orders map DEPOSIT->0, BALANCE->1 now that every order carries a
    // payment_milestones array).
    let milestoneIndex: number | null = null;
    if (typeof type === 'string' && type.startsWith('INDEX-')) milestoneIndex = parseInt(type.slice(6), 10);
    else if (type === 'DEPOSIT') milestoneIndex = 0;
    else if (type === 'BALANCE') milestoneIndex = 1;

    const order = orders.find(o => o['Order ID'] === orderId);
    const hasMilestones = Array.isArray((order as any)?.payment_milestones) && (order as any).payment_milestones.length > (milestoneIndex ?? 0);

    // Offer wallet if the balance covers it and we can map to a milestone.
    if (milestoneIndex !== null && hasMilestones && walletBalance >= amount) {
      const useWallet = window.confirm(
        `Pay ${formatNaira(amount)} from your wallet balance (${formatNaira(walletBalance)})?\n\nOK = Pay from Wallet   ·   Cancel = Pay with Card`
      );
      if (useWallet) {
        setProcessingPayment(orderId);
        try {
          const res = await fetch('/api/client/pay-milestone-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, milestoneIndex }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setWalletBalance(b => b - amount);
            showToast('Paid from wallet successfully!', 'success');
            await refreshOrders(isAdminPreview ? undefined : user?.email, isAdminPreview, searchParams.get('preview'));
            await fetchVaultFiles();
          } else {
            showToast(data.error || 'Wallet payment failed', 'error');
          }
        } catch {
          showToast('Network error during wallet payment.', 'error');
        }
        setProcessingPayment(null);
        return;
      }
    }

    // Card (Paystack) path
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

  const handleRequestAddon = async (orderId: string) => {
    if (!newAddonName.trim()) return;
    setSubmittingAddon(true);
    try {
      const res = await fetch('/api/client/request-addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, addonName: newAddonName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Extra requirement addon requested successfully!', 'success');
        setNewAddonName('');
        // Refresh details modal view
        if (selectedOrderDetails) {
          const rawInfo = selectedOrderDetails['Additional Info'] || '';
          let payload = { notes: '', extra_addons: [] as any[] };
          try {
            if (rawInfo.trim().startsWith('{')) payload = JSON.parse(rawInfo);
            else payload = { notes: rawInfo, extra_addons: [] };
          } catch {
            payload = { notes: rawInfo, extra_addons: [] };
          }
          payload.extra_addons.push(data.addon);
          setSelectedOrderDetails({
            ...selectedOrderDetails,
            ['Additional Info']: JSON.stringify(payload)
          });
        }
        await refreshOrders(isAdminPreview ? undefined : user?.email, isAdminPreview, searchParams.get('preview'));
      } else {
        showToast(`Request failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error while requesting addon.', 'error');
    }
    setSubmittingAddon(false);
  };

  const handlePayAddonWallet = async (orderId: string, addonId: string, price: number) => {
    setProcessingAddonPayment(addonId);
    try {
      const res = await fetch('/api/client/pay-addon-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, addonId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Addon paid successfully from wallet balance!', 'success');
        
        // Refresh details modal view
        if (selectedOrderDetails) {
          const rawInfo = selectedOrderDetails['Additional Info'] || '';
          let payload = { notes: '', extra_addons: [] as any[] };
          try {
            payload = JSON.parse(rawInfo);
          } catch {}
          const idx = payload.extra_addons.findIndex((a: any) => a.id === addonId);
          if (idx !== -1) {
            payload.extra_addons[idx].status = 'PAID';
            setSelectedOrderDetails({
              ...selectedOrderDetails,
              ['Additional Info']: JSON.stringify(payload)
            });
          }
        }
        
        await refreshOrders(isAdminPreview ? undefined : user?.email, isAdminPreview, searchParams.get('preview'));
      } else {
        showToast(`Wallet payment failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error while processing wallet payment.', 'error');
    }
    setProcessingAddonPayment(null);
  };

  const handlePayAddonCard = async (orderId: string, addonId: string, price: number) => {
    setProcessingAddonPayment(addonId);
    try {
      const res = await fetch('/api/paystack/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: price,
          email: user.email,
          name: profile?.full_name || 'Client',
          type: `ADDON-${addonId}`
        }),
      });
      const data = await res.json();
      if (data.link) {
        window.location.href = data.link;
      } else {
        showToast(`Card payment initiation failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Network error initiating card payment.', 'error');
    }
    setProcessingAddonPayment(null);
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

  if (loading) return <DashboardSkeleton stats={4} rows={4} />;

  const activeOrders = orders.filter(o => o['Workflow Status'] !== 'Completed' && o['Workflow Status'] !== 'Cancelled');
  const completedOrders = orders.filter(o => o['Workflow Status'] === 'Completed');
  const latestUnviewedVaultFile = vaultFiles.find(f => f.downloaded_at === null);

  return (
    <div className="p-6 md:p-10">
      {/* Impersonation is handled globally by ImpersonationBanner in Header */}

      {/* Admin Preview Banner */}
      {isAdminPreview && (
        <div className="bg-warning text-black py-2 px-6 flex items-center justify-center gap-4 font-black text-xs uppercase tracking-widest mb-6 rounded-xl shadow-md">
          <div className="flex items-center gap-2">
            <lucide.Eye className="w-4 h-4" /> Admin Preview Mode
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/admin')}
            className="!bg-black !text-white hover:!bg-black/80"
          >
            Go to Admin Panel →
          </Button>
        </div>
      )}

      {/* Temporary Password Advisory Banner */}
      {user?.user_metadata?.password_is_email === true && (
        <div className="bg-warning/10 border border-warning/30 text-warning py-3.5 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-bold text-xs uppercase tracking-wider mb-6 rounded-2xl shadow-sm animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3">
            <lucide.ShieldAlert className="w-5 h-5 shrink-0 text-warning" />
            <span className="leading-relaxed normal-case">
              Security Notice: Your temporary password is currently set to your email address. For your security, please update it.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab('profile')}
            className="!bg-warning !text-black hover:!bg-warning/90 shrink-0"
          >
            Change Password
          </Button>
        </div>
      )}

      {/* === TAB: DASHBOARD === */}
      {activeTab === 'dashboard' && (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
          {/* Row layout only from lg: at md the sidebar leaves ~480px, which can't
              fit the heading plus this shrink-0 date pill — the pill overflowed
              the viewport and got clipped. Stay stacked until there's real room. */}
          <header className="mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-theme pb-8">
            <div>
              <h2 className="text-3xl font-black text-primary tracking-tight">Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}</h2>
              <p className="text-secondary mt-1.5 text-xs font-semibold uppercase tracking-wider">Here is the current status of your research pipeline.</p>
            </div>
            <div className="text-xs font-bold text-secondary bg-secondary px-4 py-2.5 rounded-xl border border-theme max-w-xs shrink-0 select-none">
              Client Portal · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </header>

          {/* Latest Vault Upload notification */}
          {latestUnviewedVaultFile && (
            <div className="bg-gradient-to-r from-success/10 to-success/5 border border-success/25 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 shadow-sm animate-in slide-in-from-top duration-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center text-success border border-success/20 shrink-0">
                  <lucide.FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-secondary font-black uppercase tracking-widest text-[9px]">New Vault Upload Available</p>
                  <h4 className="text-sm font-bold text-primary mt-0.5">
                    "{latestUnviewedVaultFile.file_name}" has been uploaded to your Secure Vault.
                  </h4>
                </div>
              </div>
              <Button size="sm" onClick={() => setActiveTab('vault')} className="shrink-0">
                Access Secure Vault
              </Button>
            </div>
          )}

          {/* Redesigned Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Total Projects", value: orders.length, icon: lucide.Layers, color: "text-success", bg: "bg-success/[0.02]" },
              { label: "Active Pipelines", value: activeOrders.length, icon: lucide.Activity, color: "text-warning", bg: "bg-warning/[0.02]" },
              { label: "Completed Projects", value: completedOrders.length, icon: lucide.CheckCircle2, color: "text-accent", bg: "bg-accent/[0.02]" },
              { label: "In Secure Vault", value: vaultFiles.length, icon: lucide.Lock, color: "text-info", bg: "bg-info/[0.02]" }
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="p-6 rounded-2xl border border-theme bg-card transition-all duration-300 hover:scale-[1.01] hover:shadow-lg relative overflow-hidden group select-none">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-black text-secondary">{stat.label}</span>
                    <div className={`p-2 rounded-xl ${stat.bg} border border-theme`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-primary tracking-tight">{stat.value}</div>
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full opacity-[0.02] bg-white pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* Recent Projects preview — full list lives on the My Orders tab */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Recent Projects</h3>
              <div className="flex items-center gap-2">
                {orders.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('orders')}>
                    View All Orders
                  </Button>
                )}
                <Button variant="ghost" size="sm" icon={<lucide.Plus className="w-3 h-3" />} onClick={() => router.push('/dashboard/client/order/new/academic')}>
                  New Order
                </Button>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="empty-state">
                <lucide.Inbox className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h4 className="text-lg font-bold text-primary mb-2">No projects yet</h4>
                <p className="text-secondary text-sm mb-6 max-w-md mx-auto">Your workspace is empty. Submit a brief to get started with your first research project.</p>
                <Button onClick={() => router.push('/dashboard/client/order/new/academic')}>Place First Order</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {[...activeOrders, ...completedOrders].slice(0, 3).map(order => <OrderCard
                  key={order['Order ID']}
                  order={order}
                  handlePayment={handlePayment}
                  processingPayment={processingPayment === order['Order ID']}
                  openDetails={() => setSelectedOrderDetails(order)}
                />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: MY ORDERS === */}
      {activeTab === 'orders' && (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">My Orders</h3>
              <Button variant="ghost" size="sm" icon={<lucide.Plus className="w-3 h-3" />} onClick={() => router.push('/dashboard/client/order/new/academic')}>
                New Order
              </Button>
            </div>

            {orders.length === 0 ? (
              <div className="empty-state">
                <lucide.Inbox className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h4 className="text-lg font-bold text-primary mb-2">No projects yet</h4>
                <p className="text-secondary text-sm mb-6 max-w-md mx-auto">Your workspace is empty. Submit a brief to get started with your first research project.</p>
                <Button onClick={() => router.push('/dashboard/client/order/new/academic')}>Place First Order</Button>
              </div>
            ) : (
              <>
                {activeOrders.length > 0 && (
                  <div className="space-y-4 mb-8">
                    {activeOrders.map(order => <OrderCard
                      key={order['Order ID']}
                      order={order}
                      handlePayment={handlePayment}
                      processingPayment={processingPayment === order['Order ID']}
                      openDetails={() => setSelectedOrderDetails(order)}
                    />)}
                  </div>
                )}
                {completedOrders.length > 0 && (
                  <>
                    <h4 className="text-sm font-black uppercase tracking-widest text-secondary mb-4">Completed ({completedOrders.length})</h4>
                    <div className="space-y-4 opacity-90">
                      {completedOrders.map(order => <OrderCard
                        key={order['Order ID']}
                        order={order}
                        handlePayment={handlePayment}
                        processingPayment={processingPayment === order['Order ID']}
                        openDetails={() => setSelectedOrderDetails(order)}
                      />)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* === TAB: VAULT === */}
      {activeTab === 'vault' && (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
          <header className="mb-10">
            <h2 className="text-3xl font-black text-primary flex items-center gap-3"><lucide.Lock className="text-success" /> Secure Vault</h2>
            <p className="text-secondary mt-1">Encrypted storage for all your completed deliverables.</p>
          </header>
          
          {vaultFiles.length === 0 ? (
            <Card padding="lg" className="text-center">
              <lucide.Shield className="w-12 h-12 text-secondary mx-auto mb-4" />
              <p className="text-secondary">Your vault is currently empty. Files will appear here once drafting is complete.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vaultFiles.map(file => {
                const order = orders.find(o => o['Order ID'] === file.order_id);
                const fileAddonInfo = order ? parseAdditionalInfo(order['Additional Info'] || null) : { extra_addons: [] };
                const milestones = (order as any)?.payment_milestones || [];
                const custom = isCustomPayment({ payment_structure_type: (order as any)?.payment_structure_type });
                const opShape = {
                  payment_structure_type: (order as any)?.payment_structure_type,
                  payment_milestones: milestones,
                  sixty_percent_paid: renderBool(order?.['60% Paid']),
                  forty_percent_paid: renderBool(order?.['40% Paid']),
                };
                const fullyPaid = order ? isOrderFullyPaid(opShape) : false;
                const isViewed = file.downloaded_at !== null;
                const nextIdx = milestones.findIndex((m: any) => !m.paid);
                const nextUnpaid = milestones[nextIdx];
                return (
                  <Card key={file.id} elevation={1} padding="none" interactive className="p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><lucide.FileText className="w-24 h-24 text-secondary" /></div>
                    <h4 className="font-bold text-lg mb-1 relative z-10 text-primary">{file.order_id}</h4>
                    <p className="text-xs text-secondary mb-2 relative z-10">{file.file_name}</p>
                    <p className="text-[10px] text-secondary mb-4 relative z-10">
                      Uploaded: {new Date(file.uploaded_at).toLocaleDateString()}
                      {isViewed && ` • Viewed: ${new Date(file.downloaded_at).toLocaleDateString()}`}
                    </p>

                    {/* Milestone progress (custom orders) */}
                    {custom && milestones.length > 0 && !fullyPaid && (
                      <div className="mb-4 relative z-10">
                        <MilestoneTimeline
                          milestones={milestones}
                          compact
                          payingIndex={processingPayment === order?.['Order ID'] ? nextIdx : null}
                          onPay={(idx) => order && handlePayment(order['Order ID'], milestones[idx].amount, order['Email'], order['Legal Name'], ('INDEX-' + idx) as any)}
                        />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 relative z-10">
                      {fullyPaid ? (
                        <Button fullWidth onClick={() => downloadFile(file.id)} variant="soft" color="success" size="md">
                          <lucide.Download className="w-4 h-4" /> Download Package
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          onClick={() => order && nextUnpaid && handlePayment(order['Order ID'], nextUnpaid.amount, order['Email'], order['Legal Name'], ('INDEX-' + nextIdx) as any)}
                          variant="soft"
                          color="warning"
                          size="md"
                        >
                          <lucide.Unlock className="w-4 h-4" /> {nextUnpaid ? `Pay ${nextUnpaid.name} to Unlock` : 'Pay Balance to Unlock'}
                        </Button>
                      )}

                      {!isViewed && fullyPaid && (
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => markViewed(file.id)}
                          title="Mark as viewed (clears notification badge)"
                        >
                          <lucide.Eye className="w-4 h-4" /> Mark Viewed
                        </Button>
                      )}
                    </div>

                    {/* Add-on Request Panel */}
                    <div className="mt-5 pt-4 border-t border-theme/40 space-y-3 relative z-10">
                      <div className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                        <lucide.PlusCircle className="w-3.5 h-3.5 text-success shrink-0" />
                        <span>Need presentation slides, PPT, or extra features?</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="E.g. Presentation slides, custom modules..."
                          value={vaultAddonRequest[file.order_id] || ''}
                          onChange={e => setVaultAddonRequest({ ...vaultAddonRequest, [file.order_id]: e.target.value })}
                          className="flex-1 bg-secondary border border-theme rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-success font-medium"
                        />
                        <Button
                          size="sm"
                          disabled={requestingAddon[file.order_id] || !(vaultAddonRequest[file.order_id] || '').trim()}
                          onClick={async () => {
                            const name = vaultAddonRequest[file.order_id];
                            if (!name) return;
                            setRequestingAddon({ ...requestingAddon, [file.order_id]: true });
                            try {
                              const res = await fetch('/api/client/request-addon', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: file.order_id, addonName: name }),
                              });
                              if (res.ok) {
                                showToast("Addon requested! Admin will review and quote a price.", "success");
                                setVaultAddonRequest({ ...vaultAddonRequest, [file.order_id]: '' });
                                window.location.reload();
                              } else {
                                const err = await res.json();
                                showToast(err.error || "Request failed", "error");
                              }
                            } catch (e) {
                              showToast("Network error", "error");
                            } finally {
                              setRequestingAddon({ ...requestingAddon, [file.order_id]: false });
                            }
                          }}
                        >
                          {requestingAddon[file.order_id] ? 'Sending...' : 'Request'}
                        </Button>
                      </div>

                      {/* Display active extra addons status */}
                      {fileAddonInfo.extra_addons && fileAddonInfo.extra_addons.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[10px] uppercase font-black text-secondary tracking-wider">Active Add-on Requests:</p>
                          {fileAddonInfo.extra_addons.map((a: any) => (
                            <div key={a.id} className="flex justify-between items-center bg-secondary/30 p-2 rounded-lg border border-theme text-[10px]">
                              <span className="font-bold text-primary truncate max-w-[140px]">{a.name}</span>
                              <div className="flex items-center gap-2">
                                {a.price && <span className="font-mono font-bold text-primary">{formatNaira(a.price)}</span>}
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                  a.status === 'PAID' ? 'bg-success/10 text-success border-success/20' :
                                  a.status === 'AWAITING_PAYMENT' ? 'bg-warning/10 text-warning border-warning/20' :
                                  'bg-accent/10 text-accent border-accent/20'
                                }`}>
                                  {a.status === 'PENDING_QUOTE' ? 'Reviewing' : a.status === 'AWAITING_PAYMENT' ? 'Approved' : 'Paid'}
                                </span>
                                {a.status === 'AWAITING_PAYMENT' && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const match = orders.find(o => o['Order ID'] === file.order_id);
                                      if (match) {
                                        setSelectedOrderDetails(match);
                                      }
                                    }}
                                  >
                                    Pay
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === TAB: WALLET === */}
      {activeTab === 'wallet' && (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
          <header className="mb-8">
            <h2 className="text-3xl font-black text-primary flex items-center gap-3">
              <lucide.Wallet className="text-success w-8 h-8" /> Wallet
            </h2>
            <p className="text-secondary mt-1 text-sm">Manage your balance and view transaction history.</p>
          </header>
          <WalletPage embedded />
        </div>
      )}

      {/* === TAB: CHAT === */}
      {activeTab === 'chat' && (
        <div className="animate-in fade-in duration-500 max-w-4xl mx-auto h-[calc(100vh-180px)] flex flex-col bg-card border border-theme rounded-3xl overflow-hidden shadow-xl">
          <SupportChat user={user} />
        </div>
      )}

      {/* === TAB: PROJECTS === */}
      {activeTab === 'projects' && (
        <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
          <ProjectsTab user={user} />
        </div>
      )}

      {/* === TAB: SCRIPTS === */}
      {activeTab === 'scripts' && (
        <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
          <ScriptsTab user={user} />
        </div>
      )}

      {/* === TAB: AFFILIATE === */}
      {activeTab === 'affiliate' && (
        <div className="animate-in fade-in duration-500">
          <AffiliateTab user={user} />
        </div>
      )}

      {/* === TAB: PROFILE === */}
      {activeTab === 'profile' && (
        <div className="animate-in fade-in duration-500 max-w-2xl mx-auto">
          <header className="mb-10">
            <h2 className="text-3xl font-black text-primary">Profile Settings</h2>
            <p className="text-secondary mt-1">Manage your personal information and account security.</p>
          </header>
          
          <Card padding="lg">
            <div className="flex items-center gap-6 mb-8 border-b border-theme pb-8">
              <div className="w-20 h-20 rounded-full bg-success/20 border border-success/50 flex items-center justify-center text-success font-black text-2xl">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary">{profile?.full_name}</h3>
                <p className="text-secondary text-sm">Account Type: Client</p>
                {renderBool(profile?.is_admin) && <span className="inline-block mt-2 px-2 py-1 bg-accent/20 text-accent text-[10px] font-black uppercase rounded-md">Admin</span>}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Email Address</label>
                <div className="p-3 bg-secondary border border-theme rounded-xl text-primary mt-1">{user?.email}</div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Change Email Address</label>
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <input
                    type="email"
                    id="newEmail"
                    placeholder="newemail@example.com"
                    className="flex-1 bg-secondary border border-theme rounded-xl px-4 py-2 text-sm focus:border-success outline-none text-primary"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const newEmail = (document.getElementById('newEmail') as HTMLInputElement).value;
                      await handleUpdateEmail(newEmail);
                    }}
                  >
                    Update Email
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  variant="soft"
                  color="warning"
                  onClick={handleResetPassword}
                >
                  Reset Password
                </Button>
              </div>

              <div className="pt-4 border-t border-theme">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Account ID</label>
                <div className="p-3 bg-secondary border border-theme rounded-xl text-secondary font-mono text-xs mt-1">{user?.id}</div>
              </div>

              <div className="pt-4">
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => window.open('https://wa.me/2348121443666', '_blank')}
                >
                  <lucide.MessageCircle className="w-4 h-4" /> Contact Support to Update Details
                </Button>
              </div>

              {user?.id && <NotificationPreferencesPanel userId={user.id} />}
            </div>
          </Card>
        </div>
      )}

      {/* ================= ORDER DETAILS MODAL ================= */}
      {selectedOrderDetails && (() => {
        const details = getPipelineDetails(selectedOrderDetails);
        const total = parsePriceStr(selectedOrderDetails['Financial Quote']);
        const orderMilestones = (selectedOrderDetails as any).payment_milestones || [];
        const isCustomPayment = (selectedOrderDetails as any).payment_structure_type === 'CUSTOM';
        
        const paid60 = isCustomPayment
          ? (orderMilestones[0]?.paid || false)
          : renderBool(selectedOrderDetails['60% Paid']);
        const paid40 = isCustomPayment
          ? (orderMilestones.length > 0 && orderMilestones.every((m: any) => m.paid))
          : renderBool(selectedOrderDetails['40% Paid']);
        
        const workSubmitted = renderBool(selectedOrderDetails['Work Submitted']);
        const awaitingAdminApproval = selectedOrderDetails['Workflow Status'] === 'Briefing Received' || total <= 0;
        const addonInfo = parseAdditionalInfo(selectedOrderDetails['Additional Info']);
        
        const steps = [
          { title: details.steps[0].title, desc: details.steps[0].desc, done: true },
          { title: details.steps[1].title, desc: details.steps[1].desc, done: total > 0 && selectedOrderDetails['Workflow Status'] !== 'Briefing Received' },
          { title: details.steps[2].title, desc: isCustomPayment ? 'First milestone deposit cleared.' : details.steps[2].desc, done: paid60 },
          { title: details.steps[3].title, desc: details.steps[3].desc, done: String(selectedOrderDetails['Workflow Status']).includes('Synthesis') || selectedOrderDetails['Workflow Status'] === 'Internal Audit' || workSubmitted },
          { title: details.steps[4].title, desc: isCustomPayment ? 'All milestones paid & files released.' : details.steps[4].desc, done: paid40 },
          { title: 'Project Finalized', desc: 'Full payment verified & project closed.', done: selectedOrderDetails['Workflow Status'] === 'Completed' }
        ];

        return (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-end animate-in fade-in duration-200"
            onClick={() => setSelectedOrderDetails(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-primary w-full max-w-lg h-full border-l border-theme flex flex-col animate-in slide-in-from-right duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 md:p-6 border-b border-theme flex justify-between items-center bg-secondary">
                <div>
                  <h3 className="font-black text-lg text-primary flex items-center gap-2">
                    {selectedOrderDetails['Order ID']}
                  </h3>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${details.bgClass} ${details.colorClass} border ${details.borderClass}`}>
                    {details.category}
                  </span>
                </div>
                <button onClick={() => setSelectedOrderDetails(null)} className="p-2 bg-secondary hover:bg-white/10 rounded-full transition cursor-pointer" aria-label="Close details"><lucide.X className="w-5 h-5 text-secondary" /></button>
              </div>

              {/* Redesigned Inspector Tab Controls */}
              <div className="flex border-b border-theme bg-secondary px-4 md:px-6">
                {(['specs', 'payments', 'timeline'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInspectorTab(tab)}
                    className={`flex-1 text-center py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                      inspectorTab === tab
                        ? 'border-success text-success font-black'
                        : 'border-transparent text-secondary hover:text-primary'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
                {/* 1. PROJECT SPECIFICATIONS */}
                {inspectorTab === 'specs' && (
                  <div className="space-y-6 animate-in fade-in duration-250">
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Topic / Objective</span>
                        <p className="text-sm bg-secondary p-3.5 rounded-xl border border-theme text-primary font-bold leading-relaxed">{selectedOrderDetails['Research Topic']}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Deadline</span>
                          <p className="p-3 bg-secondary/40 border border-theme rounded-xl text-primary font-bold">{formatDate(selectedOrderDetails['Deadline'])}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Service Tier</span>
                          <p className="p-3 bg-secondary/40 border border-theme rounded-xl text-primary font-bold">{selectedOrderDetails['Service Tier'] || 'Custom Quote'}</p>
                        </div>
                      </div>

                      {selectedOrderDetails['Word Count'] && selectedOrderDetails['Word Count'] > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Word Count</span>
                            <p className="p-3 bg-secondary/40 border border-theme rounded-xl text-primary font-bold">{selectedOrderDetails['Word Count'].toLocaleString()} Words</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Estimated Pages</span>
                            <p className="p-3 bg-secondary/40 border border-theme rounded-xl text-primary font-bold">{Math.ceil(selectedOrderDetails['Word Count'] / 275)} Pages</p>
                          </div>
                        </div>
                      )}

                      {(selectedOrderDetails['Reference Style'] || selectedOrderDetails['Font Specification']) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Reference Style</span>
                            <p className="p-3 bg-secondary/40 border border-theme rounded-xl text-primary font-bold">{selectedOrderDetails['Reference Style'] || 'Standard'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Font Preference</span>
                            <p className="p-3 bg-secondary/40 border border-theme rounded-xl text-primary font-bold">{selectedOrderDetails['Font Specification'] || 'Standard'}</p>
                          </div>
                        </div>
                      )}

                      {selectedOrderDetails['Media Sync'] && (
                        <div>
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">External Storage Link</span>
                          <a href={selectedOrderDetails['Media Sync']} target="_blank" rel="noopener noreferrer" className="p-3 bg-secondary/40 border border-theme rounded-xl text-info font-bold block truncate hover:underline">
                            <span className="inline-block mr-1">🔗</span> {selectedOrderDetails['Media Sync']}
                          </a>
                        </div>
                      )}

                      {addonInfo.notes && (
                        <div>
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1.5 ml-1">Client Notes & Instructions</span>
                          <p className="bg-card p-4 rounded-xl border border-theme text-primary whitespace-pre-wrap leading-relaxed font-medium">{addonInfo.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* EXTRA REQUIREMENTS */}
                    <div className="pt-6 border-t border-theme/60 space-y-4">
                      <h4 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center gap-1.5">
                        <lucide.PlusCircle className="w-4 h-4 text-success" /> Extra Requirements & Custom Add-ons
                      </h4>
                      
                      {/* List existing addon requests */}
                      {addonInfo.extra_addons && addonInfo.extra_addons.length > 0 ? (
                        <div className="space-y-3">
                          {addonInfo.extra_addons.map((a: any) => (
                            <div key={a.id} className="p-3.5 bg-secondary border border-theme rounded-xl text-xs space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-primary">{a.name}</p>
                                  <p className="text-[9px] text-secondary mt-1">Requested {formatDate(a.created_at)}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                  a.status === 'PAID' ? 'bg-success/10 text-success border-success/20' :
                                  a.status === 'AWAITING_PAYMENT' ? 'bg-warning/10 text-warning border-warning/20' :
                                  'bg-accent/10 text-accent border-accent/20'
                                }`}>
                                  {a.status === 'PENDING_QUOTE' ? 'Reviewing' : a.status === 'AWAITING_PAYMENT' ? 'Approved' : 'Paid'}
                                </span>
                              </div>

                              {a.status !== 'PENDING_QUOTE' && (
                                <div className="flex justify-between items-center bg-primary p-2.5 rounded-lg border border-theme text-[10px]">
                                  <span className="text-secondary font-bold font-black">Charge:</span>
                                  <span className="font-black text-primary text-xs">{formatNaira(a.price)}</span>
                                </div>
                              )}

                              {a.status === 'AWAITING_PAYMENT' && (
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    fullWidth
                                    size="sm"
                                    onClick={() => handlePayAddonWallet(selectedOrderDetails['Order ID'], a.id, a.price)}
                                    disabled={processingAddonPayment !== null}
                                  >
                                    {processingAddonPayment === a.id ? 'Processing...' : 'Pay from Wallet'}
                                  </Button>
                                  <Button
                                    fullWidth
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handlePayAddonCard(selectedOrderDetails['Order ID'], a.id, a.price)}
                                    disabled={processingAddonPayment !== null}
                                  >
                                    Card
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-secondary text-xs">No custom add-ons requested yet.</p>
                      )}

                      {/* Addon Request Form */}
                      <div className="bg-card border border-theme p-4 rounded-2xl space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-secondary ml-1 font-bold">Request Extra Requirement</label>
                        <textarea 
                          placeholder="Enter details of your extra requirements (e.g. 'Add 5 slides presentation', 'Add SPSS output file' or custom software module)" 
                          value={newAddonName} 
                          onChange={e => setNewAddonName(e.target.value)} 
                          rows={2}
                          className="w-full bg-secondary border border-theme p-3 rounded-xl text-xs text-primary focus:border-success outline-none transition font-bold"
                        />
                        <Button
                          fullWidth
                          onClick={() => handleRequestAddon(selectedOrderDetails['Order ID'])}
                          disabled={submittingAddon || !newAddonName.trim()}
                        >
                          {submittingAddon ? 'Submitting...' : 'Submit Add-on Request'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ESCROW & PAYMENTS */}
                {inspectorTab === 'payments' && (
                  <div className="space-y-6 animate-in fade-in duration-250">
                    <div className="bg-secondary p-4 rounded-xl border border-theme flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-0.5">Total Project Valuation</span>
                        <span className="text-2xl font-black text-primary">{awaitingAdminApproval ? 'Pending...' : formatNaira(total)}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        paid40 ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'
                      }`}>
                        {paid40 ? 'Fully Settled' : paid60 ? 'Deposit Paid' : 'Awaiting Deposit'}
                      </span>
                    </div>

                    {orderMilestones.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center gap-1.5">
                          <lucide.CreditCard className="w-4 h-4 text-accent" /> Milestone Breakdown
                        </h4>
                        
                        {orderMilestones.map((m: any, idx: number) => (
                          <div key={idx} className="bg-secondary/40 border border-theme rounded-xl p-4 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-primary">{m.name} ({m.percentage}%)</p>
                              <p className="text-[10px] text-secondary mt-1">Trigger: {m.trigger || 'Upon request'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-primary font-mono">{formatNaira(m.amount)}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                m.paid ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'
                              }`}>
                                {m.paid ? 'Paid' : 'Unpaid'}
                              </span>
                            </div>
                          </div>
                        ))}

                        {!paid40 && (
                          <div className="pt-2">
                            {(() => {
                              const nextUnpaidIdx = orderMilestones.findIndex((m: any) => !m.paid);
                              const nextUnpaid = orderMilestones[nextUnpaidIdx];
                              if (nextUnpaid) {
                                return (
                                  <Button
                                    fullWidth
                                    onClick={() => handlePayment(selectedOrderDetails['Order ID'], nextUnpaid.amount, selectedOrderDetails['Email'], selectedOrderDetails['Legal Name'], ('INDEX-' + nextUnpaidIdx) as any)}
                                    disabled={processingPayment !== null}
                                  >
                                    {processingPayment === selectedOrderDetails['Order ID'] ? 'Connecting...' : `Pay ${nextUnpaid.name} (${formatNaira(nextUnpaid.amount)})`}
                                  </Button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. DYNAMIC PIPELINE TIMELINE */}
                {inspectorTab === 'timeline' && (
                  <div className="space-y-6 animate-in fade-in duration-250 pt-2">
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-success before:to-secondary">
                      {steps.map((step, i) => (
                        <TimelineItem 
                          key={i}
                          title={step.title}
                          desc={step.desc}
                          date={i === 0 ? formatDate(selectedOrderDetails['Timestamp']) : 'Logged'}
                          done={step.done}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================
function SidebarBtn({ active, onClick, icon, label, badge }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition font-bold text-sm ${
        active ? 'bg-success/10 text-success' : 'text-secondary hover:bg-hover hover:text-primary'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon} <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 bg-success text-black rounded-md text-[10px] font-black">{badge}</span>
      )}
    </button>
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
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-success bg-success/20 text-success shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"><lucide.Check className="w-5 h-5"/></div>
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-success/30 bg-success/5">
        <div className="flex justify-between mb-1"><span className="font-bold text-sm text-success">{title}</span><span className="text-[10px] text-secondary">{date}</span></div>
        <div className="text-xs text-secondary">{desc}</div>
      </div>
    </div>
  );
}

// Tone drives every colour on the card. It answers "whose turn is it?", which is
// the only question a client actually has — so service colour is demoted to a
// small text label and never competes with it.
const TONE = {
  act:  { bar: 'bg-warning',   ring: 'border-l-warning',   chip: 'bg-warning/10 text-warning border-warning/30',   icon: 'bg-warning text-black' },
  prog: { bar: 'bg-info',    ring: 'border-l-info',    chip: 'bg-info/10 text-info border-info/30',      icon: 'bg-info text-white' },
  done: { bar: 'bg-success', ring: 'border-l-success', chip: 'bg-success/10 text-success border-success/30', icon: 'bg-success text-black' },
  wait: { bar: 'bg-text-tertiary', ring: 'border-l-text-muted', chip: 'bg-secondary text-secondary border-theme', icon: 'bg-text-tertiary text-primary' },
} as const;

function ToneIcon({ tone }: { tone: 'act' | 'prog' | 'done' | 'wait' }) {
  const cls = 'w-5 h-5';
  if (tone === 'act') return <lucide.Wallet className={cls} />;
  if (tone === 'prog') return <lucide.PenTool className={cls} />;
  if (tone === 'done') return <lucide.CheckCircle2 className={cls} />;
  return <lucide.Clock className={cls} />;
}

function MilestoneChips({ milestones, activeIndex }: { milestones: any[]; activeIndex: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {milestones.map((m: any, i: number) => {
        const isNext = i === activeIndex;
        const cls = m.paid
          ? 'border-success/30 bg-success/5'
          : isNext
            ? 'border-warning/40 bg-warning/10'
            : 'border-theme bg-secondary/40 opacity-70';
        const dot = m.paid ? 'bg-success' : isNext ? 'bg-warning' : 'bg-text-tertiary';
        const pill = m.paid
          ? 'bg-success/15 text-success'
          : isNext
            ? 'bg-warning text-black'
            : 'bg-secondary text-secondary';
        return (
          <div key={i} className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-xs min-w-0 ${cls}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <span className="font-bold text-primary truncate">{m.name}</span>
            <span className="text-secondary tabular-nums shrink-0">{formatNaira(m.amount)}</span>
            <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${pill}`}>
              {m.paid ? 'Paid' : isNext ? 'Pay now' : m.trigger || 'Upcoming'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order, handlePayment, processingPayment, openDetails }: any) {
  const total = parsePriceStr(order['Financial Quote']);
  const rawMilestones = order.payment_milestones || [];
  const isCustom = order.payment_structure_type === 'CUSTOM';

  const paid60 = isCustom ? (rawMilestones[0]?.paid || false) : renderBool(order['60% Paid']);
  const paid40 = isCustom
    ? (rawMilestones.length > 0 && rawMilestones.every((m: any) => m.paid))
    : renderBool(order['40% Paid']);
  const workSubmitted = renderBool(order['Work Submitted']);

  const details = getPipelineDetails(order);
  const status = deriveOrderStatus({
    workflowStatus: order['Workflow Status'],
    total, isCustom, milestones: rawMilestones, paid60, paid40, workSubmitted,
  });
  const collected = amountPaid({ isCustom, milestones: rawMilestones, total, paid60, paid40 });
  const chips = displayMilestones({ isCustom, milestones: rawMilestones, total, paid60, paid40, workSubmitted });
  const nextIdx = chips.findIndex((m: any) => !m.paid);
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  const tone = TONE[status.tone];
  const awaitingQuote = total <= 0 || order['Workflow Status'] === 'Briefing Received';

  const assignedWriter = (() => {
    if (!String(order?.['Order ID'] || '').startsWith('PRJ-')) return null;
    return String(order?.['Additional Info'] || '').match(/Assigned Writer:\s*(.+)/)?.[1]?.trim() || null;
  })();

  return (
    <div className={`bg-card border-y border-r border-theme border-l-4 ${tone.ring} rounded-2xl overflow-hidden`}>

      {/* ── Status banner: what is happening + the one thing to do ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 border-b border-theme/50">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
          <ToneIcon tone={status.tone} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-primary text-base leading-tight">{status.title}</h3>
          <p className="text-secondary text-xs sm:text-sm mt-0.5 leading-snug">{status.subtitle}</p>
        </div>
        {status.action && (
          <Button
            onClick={() => handlePayment(order['Order ID'], status.action!.amount, order['Email'], order['Legal Name'], status.action!.paymentType)}
            disabled={processingPayment}
          >
            {processingPayment ? 'Connecting…' : status.action.label}
          </Button>
        )}
      </div>

      {/* ── Money: one line, one bar ── */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Paid so far</div>
            <div className="text-2xl font-black text-primary tabular-nums leading-tight">
              {awaitingQuote ? 'Pending quote' : (
                <>
                  {formatNaira(collected)}
                  <span className="text-secondary text-sm font-bold"> of {formatNaira(total)}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Order</div>
            <div className="font-mono font-black text-primary text-sm">{order['Order ID']}</div>
          </div>
        </div>

        {!awaitingQuote && (
          <>
            <div className="w-full bg-secondary border border-theme/40 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${tone.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <MilestoneChips milestones={chips} activeIndex={nextIdx} />
          </>
        )}

        {/* ── Meta + secondary actions ── */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-theme/40 text-xs">
          <span className="text-secondary">
            {details.category} · Due <span className="text-primary font-bold">{formatDate(order['Deadline'])}</span>
          </span>
          {assignedWriter && (
            <span className="text-secondary flex items-center gap-1.5">
              <lucide.Pencil className="w-3.5 h-3.5 shrink-0" /> Writer <span className="text-primary font-bold">{assignedWriter}</span>
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={openDetails}
              className="px-3 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer min-h-[38px]"
            >
              <lucide.Activity className="w-3.5 h-3.5" /> Details
            </button>
            <button
              onClick={() => {
                const text = `Hello, I need support for my ${details.label} order #${order['Order ID']}: "${order['Research Topic']}"`;
                window.open(`https://wa.me/2348121443666?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="px-3 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-bold rounded-lg transition flex items-center gap-1.5 border border-[#25D366]/20 cursor-pointer min-h-[38px]"
            >
              <lucide.MessageCircle className="w-3.5 h-3.5" /> Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}