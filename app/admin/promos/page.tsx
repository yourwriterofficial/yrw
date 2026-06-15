'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';

type PromoCode = {
  code: string;
  discount_percent: number;
  active: boolean;
  created_at: string;
};

let toastId = 0;
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  const event = new CustomEvent('app:toast', { detail: { id: toastId++, message, type } });
  window.dispatchEvent(event);
};

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [newCode, setNewCode] = useState({ code: '', discount_percent: 10, active: true });
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  const fetchCodes = async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    if (data) setCodes(data);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleSave = async () => {
    if (!newCode.code.trim() || newCode.discount_percent <= 0) {
      showToast('Code and discount percent required', 'error');
      return;
    }
    setSaving(true);
    const payload = { code: newCode.code.toUpperCase(), discount_percent: newCode.discount_percent, active: newCode.active };
    const { error } = await supabase.from('promo_codes').upsert(payload, { onConflict: 'code' });
    if (error) showToast(error.message, 'error');
    else showToast('Promo code saved', 'success');
    setNewCode({ code: '', discount_percent: 10, active: true });
    setSaving(false);
    fetchCodes();
  };

  const toggleStatus = async (code: string, current: boolean) => {
    const { error } = await supabase.from('promo_codes').update({ active: !current }).eq('code', code);
    if (error) showToast(error.message, 'error');
    else showToast('Status updated', 'success');
    fetchCodes();
  };

  const deleteCode = async (code: string) => {
    if (!confirm('Delete this promo code permanently?')) return;
    const { error } = await supabase.from('promo_codes').delete().eq('code', code);
    if (error) showToast(error.message, 'error');
    else showToast('Deleted', 'success');
    fetchCodes();
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="p-6 md:p-10">
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold ${t.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black">Promo Codes</h1>
          <button onClick={() => setEditingCode(null)} className="px-4 py-2 bg-purple-500 text-black rounded-xl font-bold text-sm">+ New Code</button>
        </div>

        {/* Add/Edit Form */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-black text-zinc-500">Code</label>
              <input type="text" value={newCode.code} onChange={e => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" className="w-full bg-black border border-white/10 rounded-xl p-3 mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black text-zinc-500">Discount %</label>
              <input type="number" value={newCode.discount_percent} onChange={e => setNewCode({ ...newCode, discount_percent: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-xl p-3 mt-1" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newCode.active} onChange={e => setNewCode({ ...newCode, active: e.target.checked })} className="w-4 h-4 accent-purple-500" />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="mt-4 px-6 py-2 bg-purple-500 text-black rounded-xl font-bold">{saving ? 'Saving...' : 'Save Code'}</button>
        </div>

        {/* List of Codes */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-black border-b border-white/5 text-[10px] uppercase text-zinc-500">
              <tr><th className="px-6 py-4">Code</th><th className="px-6 py-4">Discount</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Created</th><th className="px-6 py-4">Actions</th></tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.code} className="border-b border-white/5">
                  <td className="px-6 py-4 font-mono font-bold">{code.code}</td>
                  <td className="px-6 py-4">{code.discount_percent}%</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${code.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {code.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">{new Date(code.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button onClick={() => toggleStatus(code.code, code.active)} className="text-xs bg-white/5 px-3 py-1 rounded">{code.active ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => deleteCode(code.code)} className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {codes.length === 0 && <div className="p-8 text-center text-zinc-500">No promo codes yet.</div>}
        </div>
      </div>
    </div>
  );
}