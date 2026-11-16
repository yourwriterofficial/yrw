'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

type PromoCode = {
  code: string;
  discount_percent: number;
  active: boolean;
};

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState({ code: '', discount_percent: 10, active: true });
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('code', { ascending: true });
    if (data) setCodes(data);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleSave = async () => {
    if (!newCode.code.trim() || newCode.discount_percent <= 0 || newCode.discount_percent > 100) {
      showToast('Enter a valid promo code and discount percentage (1-100%).', 'error');
      return;
    }
    setSaving(true);
    const payload = { code: newCode.code.toUpperCase().trim(), discount_percent: newCode.discount_percent, active: newCode.active };
    const { error } = await supabase.from('promo_codes').upsert(payload, { onConflict: 'code' });
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Promo code saved successfully', 'success');
      setNewCode({ code: '', discount_percent: 10, active: true });
    }
    setSaving(false);
    fetchCodes();
  };

  const toggleStatus = async (code: string, current: boolean) => {
    const { error } = await supabase.from('promo_codes').update({ active: !current }).eq('code', code);
    if (error) showToast(error.message, 'error');
    else showToast(current ? 'Code switched off' : 'Code switched on', 'success');
    fetchCodes();
  };

  const deleteCode = async (code: string) => {
    if (!confirm('Are you sure you want to delete this promo code permanently?')) return;
    const { error } = await supabase.from('promo_codes').delete().eq('code', code);
    if (error) showToast(error.message, 'error');
    else showToast('Promo code deleted successfully', 'success');
    fetchCodes();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`${code} copied`, 'success');
    } catch {
      showToast('Could not copy. Select the code and copy it.', 'error');
    }
  };

  if (loading) return <LoadingScreen label="Loading promo codes..." accent="brand" />;

  const live = codes.filter((c) => c.active).length;

  return (
    <div className="p-6 md:p-10 max-w-5xl space-y-6">
      <PageHeader
        title="Promo codes"
        description="Discount codes clients can enter at checkout. Switch one off to pause it without losing it."
        icon={<lucide.Tag className="w-7 h-7 text-accent" />}
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Codes', value: codes.length },
          { label: 'Live now', value: live },
          { label: 'Switched off', value: codes.length - live },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-secondary">{x.label}</p>
            <p className="text-xl font-black mt-1 tabular-nums">{x.value}</p>
          </div>
        ))}
      </div>

      {/* Create */}
      <form
        onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
        className="bg-card border border-theme rounded-2xl p-5"
      >
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><lucide.Plus className="w-4 h-4 text-accent" /> New code</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-end">
          <div>
            <label htmlFor="pc-code" className="text-xs font-semibold text-secondary block mb-1">Code</label>
            <input id="pc-code" type="text" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} placeholder="SUMMER50" className="w-full h-11 bg-primary border border-theme rounded-xl px-4 text-sm focus:border-accent outline-none text-primary uppercase font-mono font-bold" />
          </div>
          <div>
            <label htmlFor="pc-pct" className="text-xs font-semibold text-secondary block mb-1">Discount (%)</label>
            <input id="pc-pct" type="number" min={1} max={100} value={newCode.discount_percent} onChange={(e) => setNewCode({ ...newCode, discount_percent: Number(e.target.value) })} className="w-full h-11 bg-primary border border-theme rounded-xl px-4 text-sm focus:border-accent outline-none text-primary font-bold" />
          </div>
          <label className="h-11 inline-flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input type="checkbox" checked={newCode.active} onChange={(e) => setNewCode({ ...newCode, active: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
            Live
          </label>
          <button type="submit" disabled={saving} className="h-11 px-6 bg-accent text-[var(--accent-foreground)] font-bold text-sm rounded-xl hover:bg-accent-hover disabled:opacity-50 transition">
            {saving ? 'Saving…' : 'Save code'}
          </button>
        </div>
      </form>

      {/* Codes as tickets */}
      {codes.length === 0 ? (
        <div className="bg-card border border-dashed border-theme rounded-2xl p-12 text-center text-secondary">
          <lucide.Tag className="w-10 h-10 mx-auto opacity-40 mb-3" />
          <p className="text-sm font-medium">No promo codes yet</p>
          <p className="text-xs mt-1">Create your first one above.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {codes.map((c) => (
            <article key={c.code} className={`bg-card border rounded-2xl overflow-hidden flex ${c.active ? 'border-theme' : 'border-theme opacity-70'}`}>
              <div className={`w-24 shrink-0 flex flex-col items-center justify-center py-5 ${c.active ? 'bg-accent text-[var(--accent-foreground)]' : 'bg-secondary text-secondary'}`}>
                <span className="text-3xl font-black leading-none tabular-nums">{c.discount_percent}%</span>
                <span className="text-[10px] font-bold uppercase tracking-widest mt-1">off</span>
              </div>
              <div className="flex-1 min-w-0 p-4 flex flex-col justify-between gap-3 border-l-2 border-dashed border-theme">
                <div className="min-w-0">
                  <p className="font-mono font-black text-lg truncate">{c.code}</p>
                  <p className={`text-xs font-semibold ${c.active ? 'text-success' : 'text-secondary'}`}>{c.active ? 'Live at checkout' : 'Switched off'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleStatus(c.code, c.active)} role="switch" aria-checked={c.active} aria-label={`${c.code} ${c.active ? 'on' : 'off'}`} className={`relative w-11 h-6 rounded-full transition shrink-0 ${c.active ? 'bg-accent' : 'bg-secondary border border-theme'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${c.active ? 'translate-x-5' : ''}`} />
                  </button>
                  <button onClick={() => copy(c.code)} aria-label={`Copy ${c.code}`} className="h-8 w-8 rounded-lg border border-theme hover:bg-hover inline-flex items-center justify-center ml-auto"><lucide.Copy className="w-4 h-4" /></button>
                  <button onClick={() => deleteCode(c.code)} aria-label={`Delete ${c.code}`} className="h-8 w-8 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 inline-flex items-center justify-center"><lucide.Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
