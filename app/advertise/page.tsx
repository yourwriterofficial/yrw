'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import { supabase } from '@/lib/supabaseClient';
import { AD_POSITIONS, normalizeAdPages } from '@/lib/adPages';
import {
  Megaphone, Clock, CheckCircle, BarChart2, MousePointerClick, Eye, Loader2,
  AlertTriangle, Wallet,
} from 'lucide-react';

interface AdPricing {
  id: string;
  position: string;
  label: string;
  price_per_day: number;
  boost_price_per_day: number;
  min_days: number;
  max_days: number;
  description: string;
  is_active: boolean;
  billing_model: 'per_day' | 'metered';
  cpm_rate: number | null;
  cpc_rate: number | null;
  slot_cap: number;
}

interface MyAdPurchase {
  id: string;
  title: string;
  position: string;
  duration_days: number;
  amount_paid: number;
  status: string;
  rejection_reason: string | null;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  created_at: string;
  is_boost: boolean;
  image_url: string | null;
  image_mobile_url: string | null;
  paused_at: string | null;
  capacity_wait: boolean;
  billing_model: 'per_day' | 'metered';
  budget: number | null;
  spent: number;
}

interface SlotOccupancy {
  occupied: number;
  slot_cap: number;
  next_free_at: string | null;
}

const POSITION_ICONS: Record<string, React.ReactNode> = {
  header: <Megaphone className="w-4 h-4 text-emerald-500" />,
  footer: <Megaphone className="w-4 h-4 text-emerald-500" />,
  sidebar: <BarChart2 className="w-4 h-4 text-blue-500" />,
  inline: <Eye className="w-4 h-4 text-teal-500" />,
  popup: <AlertTriangle className="w-4 h-4 text-amber-500" />,
};

function SlotOccupancyBadge({ position }: { position: string }) {
  const [occ, setOcc] = useState<SlotOccupancy | null>(null);

  useEffect(() => {
    supabase
      .rpc('get_slot_occupancy', { p_position: position })
      .single()
      .then(({ data }) => {
        if (data) setOcc(data as SlotOccupancy);
      });
  }, [position]);

  if (!occ) return null;
  const full = occ.occupied >= occ.slot_cap;
  return (
    <p className={`text-[11px] font-semibold mt-1 ${full ? 'text-amber-500' : 'text-zinc-500'}`}>
      {occ.occupied}/{occ.slot_cap} slots filled{full ? ' — new ads will queue until a slot opens' : ''}
    </p>
  );
}

function AdPreview({ title, imageUrl, ctaText, showBanner, showInline }: {
  title: string; imageUrl: string; ctaText: string; showBanner: boolean; showInline: boolean;
}) {
  const hasContent = !!(title.trim() || imageUrl);
  return (
    <div className="rounded-2xl border border-dashed border-theme bg-secondary/30 p-4 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-secondary">Live Creative Preview</p>
      {!hasContent ? (
        <p className="text-xs text-secondary">Fill in title or upload an image above to preview your ad live.</p>
      ) : (
        <div className="space-y-3">
          {showBanner && (
            <div className="relative overflow-hidden rounded-2xl bg-card border border-theme aspect-[3/1] max-w-sm shadow-md">
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-40" />
                  <img src={imageUrl} alt={title || 'Ad preview'} className="relative w-full h-full object-contain" />
                </>
              ) : (
                <div className="w-full h-full grid place-items-center p-3 bg-emerald-500/10 text-center">
                  <div>
                    <p className="font-bold text-sm text-primary">{title}</p>
                    {ctaText && <span className="text-xs text-emerald-500 font-semibold">{ctaText}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
          {showInline && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 flex items-center gap-2.5 max-w-sm">
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-500 text-[10px] font-bold tracking-wide uppercase">Ad</span>
              <span className="flex-1 min-w-0 truncate text-sm font-semibold text-primary">{title || 'Your ad title'}</span>
              {ctaText && <span className="shrink-0 text-xs font-semibold text-emerald-500">{ctaText} &rarr;</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdvertisePage() {
  const [pricing, setPricing] = useState<AdPricing[]>([]);
  const [myAds, setMyAds] = useState<MyAdPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [adCredits, setAdCredits] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const [tab, setTab] = useState<'buy' | 'my-ads'>('buy');
  const [selected, setSelected] = useState<Record<string, { duration_days: number; budget: number; pages: string[] }>>({});
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    image_mobile_url: '',
    link_url: '',
    cta_text: 'Learn More',
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser({ id: currentUser.id });
      const { data: prof } = await supabase.from('profiles').select('wallet_balance, ad_credits_balance').eq('id', currentUser.id).maybeSingle();
      if (prof) {
        setWalletBalance(prof.wallet_balance || 0);
        setAdCredits(prof.ad_credits_balance || prof.wallet_balance || 0);
      }

      const { data: adsRes } = await supabase.from('user_ad_purchases').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
      if (adsRes) setMyAds(adsRes as MyAdPurchase[]);
    }

    const { data: priceRes } = await supabase.from('ad_pricing').select('*').eq('is_active', true).order('price_per_day', { ascending: false });
    if (priceRes) setPricing(priceRes as AdPricing[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isRot = (p: AdPricing) => (AD_POSITIONS as readonly string[]).includes(p.position as typeof AD_POSITIONS[number]);
  const isInlineP = (p: AdPricing) => p.position === 'inline';

  const togglePlacement = (p: AdPricing) => {
    setSelected(prev => {
      if (prev[p.id]) {
        const next = { ...prev };
        delete next[p.id];
        return next;
      }
      return {
        ...prev,
        [p.id]: { duration_days: Math.max(p.min_days, 7), budget: 1000, pages: ['all'] }
      };
    });
  };

  const updateCfg = (id: string, patch: Partial<{ duration_days: number; budget: number; pages: string[] }>) => {
    setSelected(prev => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  };

  const selectedList = pricing.filter(p => selected[p.id]);
  const totalCost = selectedList.reduce((sum, p) => sum + (p.price_per_day * selected[p.id].duration_days), 0);
  const anyImageSlot = selectedList.some(p => isRot(p) && !isInlineP(p));
  const anyInline = selectedList.some(p => isInlineP(p));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: 'error', text: 'Please log in to purchase advertisement slots.' });
      return;
    }
    if (selectedList.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one placement slot.' });
      return;
    }
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'Ad title is required.' });
      return;
    }
    if (anyImageSlot && !form.image_url && !form.image_mobile_url) {
      setMessage({ type: 'error', text: 'Please provide at least one banner image URL.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const rows = selectedList.map(p => {
        const cfg = selected[p.id];
        return {
          title: form.title.trim(),
          image_url: isInlineP(p) ? null : (form.image_url || null),
          image_mobile_url: isInlineP(p) ? null : (form.image_mobile_url || null),
          link_url: form.link_url || null,
          cta_text: form.cta_text,
          position: p.position,
          pages: normalizeAdPages(p.position, cfg.pages),
          duration_days: cfg.duration_days,
          amount_paid: p.price_per_day * cfg.duration_days,
          status: 'pending',
          capacity_wait: false,
          starts_at: null,
          ends_at: null,
          billing_model: p.billing_model,
          budget: cfg.budget,
          cpm_rate: p.cpm_rate,
          cpc_rate: p.cpc_rate,
          is_boost: false,
          product_id: null,
        };
      });

      const { error } = await supabase.rpc('purchase_ad_placements', {
        p_user_id: user.id,
        p_rows: rows,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Ad placement submitted successfully! Our team will review and activate it shortly.' });
      setSelected({});
      setForm({ title: '', image_url: '', image_mobile_url: '', link_url: '', cta_text: 'Learn More' });
      fetchData();
      setTab('my-ads');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit campaign';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePauseToggle = async (id: string, currentlyPaused: boolean) => {
    try {
      if (currentlyPaused) {
        await supabase.rpc('resume_user_ad', { p_id: id });
      } else {
        await supabase.rpc('pause_user_ad', { p_id: id });
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Megaphone className="w-7 h-7 text-emerald-500" /> Self-Serve Advertising
            </h1>
            <p className="text-xs text-secondary mt-1">Promote your brand, products, or services sitewide to thousands of active visitors.</p>
          </div>
          <div className="flex items-center gap-3 bg-secondary/40 border border-theme rounded-2xl px-4 py-3">
            <Wallet className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-secondary">Ad Credits</p>
              <p className="text-lg font-black text-emerald-500">₦{adCredits.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {myAds.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-theme rounded-2xl p-4 shadow-sm">
              <CheckCircle className="w-4 h-4 text-emerald-500 mb-2" />
              <p className="text-xs text-secondary font-semibold">Live Ads</p>
              <p className="text-2xl font-black text-primary">{myAds.filter(a => a.status === 'approved').length}</p>
            </div>
            <div className="bg-card border border-theme rounded-2xl p-4 shadow-sm">
              <Clock className="w-4 h-4 text-amber-500 mb-2" />
              <p className="text-xs text-secondary font-semibold">Pending</p>
              <p className="text-2xl font-black text-primary">{myAds.filter(a => a.status === 'pending').length}</p>
            </div>
            <div className="bg-card border border-theme rounded-2xl p-4 shadow-sm">
              <Eye className="w-4 h-4 text-blue-500 mb-2" />
              <p className="text-xs text-secondary font-semibold">Impressions</p>
              <p className="text-2xl font-black text-primary">{myAds.reduce((sum, a) => sum + (a.impressions || 0), 0).toLocaleString()}</p>
            </div>
            <div className="bg-card border border-theme rounded-2xl p-4 shadow-sm">
              <MousePointerClick className="w-4 h-4 text-teal-500 mb-2" />
              <p className="text-xs text-secondary font-semibold">Clicks</p>
              <p className="text-2xl font-black text-primary">{myAds.reduce((sum, a) => sum + (a.clicks || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 p-1.5 rounded-2xl w-fit border border-theme">
          <button
            onClick={() => setTab('buy')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${tab === 'buy' ? 'bg-emerald-500 text-black shadow-md' : 'text-secondary hover:text-primary'}`}
          >
            Buy Ad Slot
          </button>
          <button
            onClick={() => setTab('my-ads')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${tab === 'my-ads' ? 'bg-emerald-500 text-black shadow-md' : 'text-secondary hover:text-primary'}`}
          >
            My Campaigns {myAds.length > 0 && `(${myAds.length})`}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl border text-xs font-bold ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
            {message.text}
          </div>
        )}

        {/* BUY TAB */}
        {tab === 'buy' && (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Policy Notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-400 uppercase tracking-wide">Ad Acceptance Guidelines</p>
                <p className="text-secondary">All submitted ads must be appropriate, accurate, and free of deceptive claims. Explicit adult material, scams, and illegal financial schemes will be rejected without refund.</p>
              </div>
            </div>

            {/* Step 1: Select Placements */}
            <div className="space-y-4">
              <h3 className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center">1</span>
                Select Placement Slots
              </h3>

              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pricing.map(p => {
                    const active = !!selected[p.id];
                    const cfg = selected[p.id];
                    return (
                      <div
                        key={p.id}
                        onClick={() => togglePlacement(p)}
                        className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${active ? 'bg-emerald-500/10 border-emerald-500' : 'bg-card border-theme hover:border-emerald-500/30'}`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {POSITION_ICONS[p.position]}
                              <span className="font-extrabold text-sm text-primary">{p.label}</span>
                            </div>
                            <span className="text-xs font-black text-emerald-500">₦{p.price_per_day.toLocaleString()}/day</span>
                          </div>
                          <p className="text-xs text-secondary mb-2">{p.description}</p>
                          <SlotOccupancyBadge position={p.position} />
                        </div>

                        {active && cfg && (
                          <div className="mt-4 pt-4 border-t border-theme space-y-3" onClick={e => e.stopPropagation()}>
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-1">
                                <span>Duration: {cfg.duration_days} Days</span>
                                <span>Subtotal: ₦{(p.price_per_day * cfg.duration_days).toLocaleString()}</span>
                              </div>
                              <input
                                type="range"
                                min={p.min_days}
                                max={p.max_days}
                                value={cfg.duration_days}
                                onChange={e => updateCfg(p.id, { duration_days: parseInt(e.target.value) })}
                                className="w-full accent-emerald-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Ad Creative & Live Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center justify-center">2</span>
                Ad Creative & Preview
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 uppercase tracking-wider">Ad Title *</label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Professional Academic Research & Writing"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-theme text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 uppercase tracking-wider">Destination URL</label>
                    <input
                      type="url"
                      value={form.link_url}
                      onChange={e => setForm({ ...form, link_url: e.target.value })}
                      placeholder="https://yourwebsite.com/landing"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-theme text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 uppercase tracking-wider">CTA Text</label>
                    <input
                      type="text"
                      value={form.cta_text}
                      onChange={e => setForm({ ...form, cta_text: e.target.value })}
                      placeholder="Learn More"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-theme text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary mb-1 uppercase tracking-wider">Desktop Banner Image URL</label>
                    <input
                      type="url"
                      value={form.image_url}
                      onChange={e => setForm({ ...form, image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-theme text-sm outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <AdPreview
                    title={form.title}
                    imageUrl={form.image_url}
                    ctaText={form.cta_text}
                    showBanner={anyImageSlot || selectedList.length === 0}
                    showInline={anyInline || selectedList.length === 0}
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Checkout Summary */}
            <div className="p-6 rounded-2xl bg-card border border-theme flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs text-secondary uppercase font-bold tracking-wider">Total Investment</p>
                <p className="text-2xl font-black text-emerald-500">₦{totalCost.toLocaleString()}</p>
                <p className="text-[11px] text-secondary mt-0.5">{selectedList.length} placement(s) selected</p>
              </div>
              <button
                type="submit"
                disabled={submitting || selectedList.length === 0}
                className="px-8 py-3.5 rounded-full bg-emerald-500 text-black font-black uppercase tracking-wider text-xs hover:bg-emerald-400 disabled:opacity-50 transition shadow-lg"
              >
                {submitting ? 'Submitting...' : 'Submit & Activate Ad'}
              </button>
            </div>
          </form>
        )}

        {/* MY ADS TAB */}
        {tab === 'my-ads' && (
          <div className="space-y-4">
            {myAds.length === 0 ? (
              <div className="p-12 text-center bg-card border border-theme rounded-2xl">
                <Megaphone className="w-8 h-8 mx-auto text-secondary mb-2" />
                <p className="text-sm font-bold text-secondary">You haven't launched any ad campaigns yet.</p>
              </div>
            ) : (
              myAds.map(ad => (
                <div key={ad.id} className="p-5 rounded-2xl bg-card border border-theme shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-primary truncate">{ad.title}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${ad.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : ad.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                        {ad.paused_at ? 'Paused' : ad.status}
                      </span>
                    </div>
                    <p className="text-xs text-secondary">
                      Position: <span className="font-bold capitalize">{ad.position}</span> · Duration: {ad.duration_days} Days · Amount: ₦{ad.amount_paid.toLocaleString()}
                    </p>
                    {ad.rejection_reason && (
                      <p className="text-xs text-red-500 font-medium">Reason: {ad.rejection_reason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-secondary">Performance</p>
                      <p className="text-xs font-bold text-primary tabular-nums">{ad.impressions.toLocaleString()} views · {ad.clicks.toLocaleString()} clicks</p>
                    </div>

                    {ad.status === 'approved' && (
                      <button
                        onClick={() => handlePauseToggle(ad.id, !!ad.paused_at)}
                        className="px-4 py-2 rounded-xl border border-theme bg-secondary text-xs font-bold hover:bg-white/10 transition"
                      >
                        {ad.paused_at ? 'Resume' : 'Pause'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
