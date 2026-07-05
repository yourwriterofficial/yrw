'use client';

import { useEffect, useState } from 'react';
import * as lucide from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { usePushNotifications } from '@/app/hooks/usePushNotifications';
import { showToast } from './Toast';

interface Prefs {
  email_order_updates: boolean;
  email_payments: boolean;
  email_vault_delivery: boolean;
  email_admin_messages: boolean;
  email_promotions: boolean;
  push_order_updates: boolean;
  push_payments: boolean;
  push_vault_delivery: boolean;
  push_admin_messages: boolean;
  push_promotions: boolean;
}

const DEFAULT_PREFS: Prefs = {
  email_order_updates: true,
  email_payments: true,
  email_vault_delivery: true,
  email_admin_messages: true,
  email_promotions: false,
  push_order_updates: true,
  push_payments: true,
  push_vault_delivery: true,
  push_admin_messages: true,
  push_promotions: false,
};

const CATEGORIES: { key: 'order_updates' | 'payments' | 'vault_delivery' | 'admin_messages' | 'promotions'; label: string; desc: string }[] = [
  { key: 'order_updates', label: 'Order Updates', desc: 'Briefing received, quote sent, work in progress, completed.' },
  { key: 'payments', label: 'Payments & Milestones', desc: 'Deposit paid, balance paid, milestone confirmed.' },
  { key: 'vault_delivery', label: 'Vault & File Delivery', desc: 'New files added, milestone work delivered.' },
  { key: 'admin_messages', label: 'Messages From Us', desc: 'Direct messages and announcements from the team.' },
  { key: 'promotions', label: 'Promotions & Offers', desc: 'Discount codes and occasional offers.' },
];

export default function NotificationPreferencesPanel({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const push = usePushNotifications(userId);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
      if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
      setLoading(false);
    };
    load();
  }, [userId]);

  const toggle = async (column: string, value: boolean) => {
    const updated = { ...prefs, [column]: value } as Prefs;
    setPrefs(updated);
    setSaving(true);
    try {
      await supabase.from('notification_preferences').upsert({ user_id: userId, ...updated, updated_at: new Date().toISOString() });
    } catch {
      showToast('Failed to save preference', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    if (push.subscribed) {
      await push.unsubscribe();
      showToast('Push notifications disabled on this device', 'info');
    } else {
      const res = await push.subscribe();
      if (res.ok) showToast('Push notifications enabled on this device', 'success');
      else showToast(res.error || 'Could not enable push notifications', 'error');
    }
  };

  if (loading) return <div className="text-secondary text-xs">Loading preferences...</div>;

  return (
    <div className="pt-8 mt-8 border-t border-theme space-y-6">
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <lucide.Bell className="w-4 h-4 text-emerald-500" /> Notification Preferences
        </h3>
        <p className="text-secondary text-xs mt-1">Choose which updates you receive by email and push. In-app alerts (the bell) are always on.</p>
      </div>

      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${push.subscribed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary border-theme'}`}>
        <div>
          <p className="text-sm font-bold text-primary flex items-center gap-2">
            {push.subscribed ? <lucide.BellRing className="w-4 h-4 text-emerald-500" /> : <lucide.BellOff className="w-4 h-4 text-secondary" />}
            Push Notifications on This Device
          </p>
          <p className="text-[11px] text-secondary mt-0.5">
            {push.subscribed ? 'Enabled — you\'ll get live alerts even when the site is closed.' : 'Get live alerts on desktop and mobile, even when the site is closed.'}
          </p>
          {push.lastError && <p className="text-[11px] text-red-500 mt-1">{push.lastError}</p>}
        </div>
        <button
          onClick={handlePushToggle}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase shrink-0 cursor-pointer ${push.subscribed ? 'bg-secondary border border-theme text-primary' : 'bg-emerald-500 text-black'}`}
        >
          {push.subscribed ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_60px_60px] gap-2 text-[9px] uppercase font-black text-secondary tracking-widest px-1">
          <span>Category</span><span className="text-center">Email</span><span className="text-center">Push</span>
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat.key} className="grid grid-cols-[1fr_60px_60px] gap-2 items-center bg-secondary/50 border border-theme rounded-xl p-3">
            <div>
              <p className="text-xs font-bold text-primary">{cat.label}</p>
              <p className="text-[10px] text-secondary">{cat.desc}</p>
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                checked={(prefs as any)[`email_${cat.key}`]}
                onChange={e => toggle(`email_${cat.key}`, e.target.checked)}
                disabled={saving}
              />
            </div>
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                checked={(prefs as any)[`push_${cat.key}`]}
                onChange={e => toggle(`push_${cat.key}`, e.target.checked)}
                disabled={saving}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
