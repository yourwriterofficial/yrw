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
    else showToast('Promo code status updated', 'success');
    fetchCodes();
  };

  const deleteCode = async (code: string) => {
    if (!confirm('Are you sure you want to delete this promo code permanently?')) return;
    const { error } = await supabase.from('promo_codes').delete().eq('code', code);
    if (error) showToast(error.message, 'error');
    else showToast('Promo code deleted successfully', 'success');
    fetchCodes();
  };

  if (loading) return <LoadingScreen label="Loading promo codes..." accent="purple" />;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">

      <PageHeader
        title="Promo Codes"
        description="Configure active discount tags to run special sales or campaigns."
        breadcrumb="Admin / Promos"
        icon={<lucide.Tag className="w-8 h-8 text-purple-500" />}
      />

      {/* Add/Edit Form */}
      <div className="bg-secondary border border-theme rounded-3xl p-6 md:p-8">
        <h2 className="text-lg font-black text-primary mb-4">Create New Code</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-secondary block ml-1 mb-2">Code Name</label>
            <input 
              type="text" 
              value={newCode.code} 
              onChange={e => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} 
              placeholder="SUMMER50" 
              className="w-full bg-primary border border-theme rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none text-primary uppercase font-mono font-bold" 
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-secondary block ml-1 mb-2">Discount Percentage (%)</label>
            <input 
              type="number" 
              min={1} 
              max={100}
              value={newCode.discount_percent} 
              onChange={e => setNewCode({ ...newCode, discount_percent: Number(e.target.value) })} 
              className="w-full bg-primary border border-theme rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none text-primary font-bold" 
            />
          </div>
          <div className="flex items-center justify-between bg-primary border border-theme rounded-xl p-3 h-[46px] md:h-[46px]">
            <span className="text-xs font-bold text-secondary">Active Status</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={newCode.active} 
                onChange={e => setNewCode({ ...newCode, active: e.target.checked })} 
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500 peer-checked:after:bg-white" />
            </label>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            type="button"
            onClick={handleSave} 
            disabled={saving} 
            className="px-6 py-3 bg-purple-500 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-purple-400 disabled:opacity-50 transition cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Promo Code'}
          </button>
        </div>
      </div>

      {/* List of Codes */}
      <div>
        <h2 className="text-lg font-black text-primary mb-4">Active Promo Codes</h2>
        <div className="bg-secondary border border-theme rounded-3xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-primary border-b border-theme text-[10px] uppercase tracking-widest text-secondary">
                <tr>
                  <th className="px-6 py-4 font-black">Code</th>
                  <th className="px-6 py-4 font-black">Discount</th>
                  <th className="px-6 py-4 font-black">Status</th>
                  <th className="px-6 py-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {codes.map(code => (
                  <tr key={code.code} className="hover:bg-white/5 transition">
                    <td className="px-6 py-4 font-mono font-bold text-primary">{code.code}</td>
                    <td className="px-6 py-4 font-bold text-primary">{code.discount_percent}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${code.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                        {code.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => toggleStatus(code.code, code.active)} 
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${code.active ? 'bg-zinc-800 border-theme text-secondary hover:text-primary' : 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20'}`}
                      >
                        {code.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button 
                        onClick={() => deleteCode(code.code)} 
                        className="text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-secondary">
                      <lucide.Tag className="w-10 h-10 mx-auto text-secondary/35 mb-3" />
                      <p className="text-sm">No promo codes registered.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}