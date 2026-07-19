'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAds, useUserAdPurchases, useAdPricing, type Ad, type UserAdPurchase, type AdPricing } from '@/app/hooks/admin/useAds';
import { AD_POSITIONS } from '@/lib/adPages';
import ImageUploadField from '@/app/components/ImageUploadField';
import {
  Megaphone, Plus, Pencil, Trash2, X, Eye, EyeOff, Loader2, CheckCircle2, RefreshCw,
} from 'lucide-react';

export default function AdminAdsPage() {
  const { data: systemAds = [], isLoading: loadingSystem, refetch: refetchSystem } = useAdminAds();
  const { data: userPurchases = [], isLoading: loadingPurchases, refetch: refetchPurchases } = useUserAdPurchases();
  const { data: pricingList = [], isLoading: loadingPricing, refetch: refetchPricing } = useAdPricing();

  const [tab, setTab] = useState<'system' | 'user-ads' | 'pricing'>('system');
  const [autoApproveAds, setAutoApproveAds] = useState(false);

  // System Ad Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [form, setForm] = useState<Omit<Ad, 'id' | 'created_at' | 'impressions' | 'clicks'>>({
    title: '',
    image_url: '',
    image_mobile_url: '',
    link_url: '',
    cta_text: 'Learn More',
    start_date: '',
    end_date: '',
    position: 'header',
    pages: ['all'],
    priority: 0,
    is_active: true,
    is_dismissible: false,
    autoplay_speed: 5,
  });

  // Rejection Modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('marketplace_settings').select('auto_approve_ads').maybeSingle();
    if (data) setAutoApproveAds(!!data.auto_approve_ads);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const toggleAutoApprove = async () => {
    const nextVal = !autoApproveAds;
    setAutoApproveAds(nextVal);
    await supabase.from('marketplace_settings').upsert({ id: 1, auto_approve_ads: nextVal, updated_at: new Date().toISOString() });
  };

  const handleCreateOrUpdateSystemAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingAd) {
        await supabase.from('ads').update(form).eq('id', editingAd.id);
      } else {
        await supabase.from('ads').insert(form);
      }
      setIsModalOpen(false);
      refetchSystem();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSystemAd = async (id: string) => {
    if (!confirm('Are you sure you want to delete this system ad?')) return;
    await supabase.from('ads').delete().eq('id', id);
    refetchSystem();
  };

  const toggleSystemAdActive = async (ad: Ad) => {
    await supabase.from('ads').update({ is_active: !ad.is_active }).eq('id', ad.id);
    refetchSystem();
  };

  const handleApproveUserAd = async (id: string) => {
    await supabase.rpc('approve_user_ad', { p_id: id });
    refetchPurchases();
  };

  const handleRejectUserAd = async () => {
    if (!rejectingId) return;
    await supabase.rpc('reject_user_ad', { p_id: rejectingId, p_reason: rejectReason || 'Did not meet ad quality requirements' });
    setRejectingId(null);
    setRejectReason('');
    refetchPurchases();
  };

  const handlePauseToggle = async (id: string, currentlyPaused: boolean) => {
    try {
      if (currentlyPaused) {
        await supabase.rpc('resume_user_ad', { p_id: id });
      } else {
        await supabase.rpc('pause_user_ad', { p_id: id });
      }
      refetchPurchases();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePricing = async (p: AdPricing, patch: Partial<AdPricing>) => {
    await supabase.from('ad_pricing').update(patch).eq('id', p.id);
    refetchPricing();
  };

  const totalImpressions = systemAds.reduce((s, a) => s + (a.impressions || 0), 0) + userPurchases.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = systemAds.reduce((s, a) => s + (a.clicks || 0), 0) + userPurchases.reduce((s, a) => s + (a.clicks || 0), 0);

  return (
    <div className="min-h-screen bg-background text-primary">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Megaphone className="w-7 h-7 text-emerald-500" /> Admin Ads Control
            </h1>
            <p className="text-xs text-secondary mt-1">Manage system banners, review self-serve submissions, and adjust slot pricing rates.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { refetchSystem(); refetchPurchases(); refetchPricing(); }} className="px-4 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold hover:bg-white/10 transition flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {tab === 'system' && (
              <button
                onClick={() => {
                  setEditingAd(null);
                  setForm({ title: '', image_url: '', image_mobile_url: '', link_url: '', cta_text: 'Learn More', start_date: '', end_date: '', position: 'header', pages: ['all'], priority: 0, is_active: true, is_dismissible: false, autoplay_speed: 5 });
                  setIsModalOpen(true);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-black uppercase text-xs tracking-wider hover:bg-emerald-400 transition shadow-md flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Banner
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-theme rounded-2xl p-4">
            <p className="text-xs font-bold text-secondary uppercase">Active System Banners</p>
            <p className="text-2xl font-black text-primary mt-1">{systemAds.filter(a => a.is_active).length}</p>
          </div>
          <div className="bg-card border border-theme rounded-2xl p-4">
            <p className="text-xs font-bold text-secondary uppercase">Pending User Submissions</p>
            <p className="text-2xl font-black text-amber-500 mt-1">{userPurchases.filter(a => a.status === 'pending').length}</p>
          </div>
          <div className="bg-card border border-theme rounded-2xl p-4">
            <p className="text-xs font-bold text-secondary uppercase">Total Views</p>
            <p className="text-2xl font-black text-blue-500 mt-1">{totalImpressions.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-theme rounded-2xl p-4">
            <p className="text-xs font-bold text-secondary uppercase">Total Clicks</p>
            <p className="text-2xl font-black text-emerald-500 mt-1">{totalClicks.toLocaleString()}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-secondary/50 p-1.5 rounded-2xl w-fit border border-theme">
          <button onClick={() => setTab('system')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${tab === 'system' ? 'bg-emerald-500 text-black shadow-md' : 'text-secondary hover:text-primary'}`}>
            System Banners ({systemAds.length})
          </button>
          <button onClick={() => setTab('user-ads')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${tab === 'user-ads' ? 'bg-emerald-500 text-black shadow-md' : 'text-secondary hover:text-primary'}`}>
            User Ads Review ({userPurchases.filter(a => a.status === 'pending').length} pending)
          </button>
          <button onClick={() => setTab('pricing')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${tab === 'pricing' ? 'bg-emerald-500 text-black shadow-md' : 'text-secondary hover:text-primary'}`}>
            Slot Pricing Rates
          </button>
        </div>

        {/* SYSTEM BANNERS TAB */}
        {tab === 'system' && (
          <div className="space-y-4">
            {loadingSystem ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></div>
            ) : systemAds.length === 0 ? (
              <div className="p-12 text-center bg-card border border-theme rounded-2xl">
                <Megaphone className="w-8 h-8 mx-auto text-secondary mb-2" />
                <p className="text-sm font-bold text-secondary">No system banners configured yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-theme border border-theme rounded-2xl overflow-hidden bg-card">
                {systemAds.map(ad => (
                  <div key={ad.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-primary">{ad.title}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">{ad.position}</span>
                        {ad.is_active ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary text-[10px] font-bold">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-secondary truncate">{ad.link_url || 'No URL specified'}</p>
                      <p className="text-[11px] text-secondary">
                        {ad.impressions.toLocaleString()} views · {ad.clicks.toLocaleString()} clicks
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleSystemAdActive(ad)} className="p-2 rounded-xl border border-theme bg-secondary text-secondary hover:text-primary transition">
                        {ad.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingAd(ad);
                          setForm({
                            title: ad.title,
                            image_url: ad.image_url || '',
                            image_mobile_url: ad.image_mobile_url || '',
                            link_url: ad.link_url || '',
                            cta_text: ad.cta_text || 'Learn More',
                            start_date: ad.start_date || '',
                            end_date: ad.end_date || '',
                            position: ad.position,
                            pages: ad.pages || ['all'],
                            priority: ad.priority || 0,
                            is_active: ad.is_active,
                            is_dismissible: ad.is_dismissible,
                            autoplay_speed: ad.autoplay_speed || 5,
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-xl border border-theme bg-secondary text-emerald-500 hover:bg-emerald-500/10 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteSystemAd(ad.id)} className="p-2 rounded-xl border border-theme bg-secondary text-red-500 hover:bg-red-500/10 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USER ADS REVIEW TAB */}
        {tab === 'user-ads' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-card border border-theme flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-bold text-sm text-primary">Auto-Approve User Ads</p>
                <p className="text-xs text-secondary">When enabled, user ad submissions bypass manual review unless slot capacity is full.</p>
              </div>
              <button
                onClick={toggleAutoApprove}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition ${autoApproveAds ? 'bg-emerald-500 text-black' : 'bg-secondary border border-theme text-secondary'}`}
              >
                {autoApproveAds ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {loadingPurchases ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></div>
            ) : userPurchases.length === 0 ? (
              <div className="p-12 text-center bg-card border border-theme rounded-2xl">
                <CheckCircle2 className="w-8 h-8 mx-auto text-secondary mb-2" />
                <p className="text-sm font-bold text-secondary">No user ad submissions found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userPurchases.map(p => (
                  <div key={p.id} className="p-5 rounded-2xl bg-card border border-theme shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-primary truncate">{p.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : p.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-secondary">
                        Position: <span className="font-bold capitalize">{p.position}</span> · Amount: ₦{p.amount_paid.toLocaleString()} · Duration: {p.duration_days} Days
                      </p>
                      <p className="text-xs text-secondary truncate">Target: {p.link_url || 'No URL'}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveUserAd(p.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-wider hover:bg-emerald-400 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(p.id)}
                            className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-extrabold text-xs uppercase tracking-wider hover:bg-red-500/20 transition"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => handlePauseToggle(p.id, !!p.paused_at)}
                          className="px-4 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold hover:bg-white/10 transition"
                        >
                          {p.paused_at ? 'Resume' : 'Pause'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRICING TAB */}
        {tab === 'pricing' && (
          <div className="space-y-4">
            {loadingPricing ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pricingList.map(p => (
                  <div key={p.id} className="p-5 rounded-2xl bg-card border border-theme space-y-4">
                    <div className="flex items-center justify-between border-b border-theme pb-3">
                      <span className="font-extrabold text-sm text-primary">{p.label}</span>
                      <span className="text-xs font-black uppercase text-emerald-500">{p.position}</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Price Per Day (₦)</label>
                        <input
                          type="number"
                          value={p.price_per_day}
                          onChange={e => handleUpdatePricing(p, { price_per_day: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Min Days</label>
                          <input
                            type="number"
                            value={p.min_days}
                            onChange={e => handleUpdatePricing(p, { min_days: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Max Days</label>
                          <input
                            type="number"
                            value={p.max_days}
                            onChange={e => handleUpdatePricing(p, { max_days: parseInt(e.target.value) || 90 })}
                            className="w-full px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SYSTEM AD MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-theme rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-theme pb-3">
                <h3 className="font-extrabold text-base text-primary">{editingAd ? 'Edit System Banner' : 'Create System Banner'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
              </div>

              <form onSubmit={handleCreateOrUpdateSystemAd} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-secondary mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <ImageUploadField
                  label="Desktop Image"
                  value={form.image_url}
                  onChange={url => setForm({ ...form, image_url: url })}
                />
                <ImageUploadField
                  label="Mobile Image"
                  value={form.image_mobile_url}
                  onChange={url => setForm({ ...form, image_mobile_url: url })}
                />
                <div>
                  <label className="block text-xs font-bold text-secondary mb-1">Destination URL</label>
                  <input
                    type="url"
                    value={form.link_url || ''}
                    onChange={e => setForm({ ...form, link_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-secondary mb-1">Position</label>
                  <select
                    value={form.position}
                    onChange={e => setForm({ ...form, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold outline-none focus:border-emerald-500"
                  >
                    {AD_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border border-theme text-xs font-bold">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition">
                    {saving ? 'Saving...' : 'Save Banner'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REJECTION REASON MODAL */}
        {rejectingId && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-theme rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="font-extrabold text-base text-primary">Reject Ad Submission</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Specify rejection reason..."
                className="w-full p-3 rounded-xl bg-secondary border border-theme text-xs outline-none focus:border-red-500 min-h-[100px]"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectingId(null)} className="px-4 py-2 rounded-xl border border-theme text-xs font-bold">Cancel</button>
                <button onClick={handleRejectUserAd} className="px-4 py-2 rounded-xl bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-red-600 transition">Confirm Rejection</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
