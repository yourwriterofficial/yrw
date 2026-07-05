'use client';

import React from 'react';
import * as lucide from 'lucide-react';

interface Milestone {
  name: string;
  percentage: number;
  trigger: string;
}

interface BillingProps {
  companyName: string;
  setCompanyName: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  accentColor?: string;
}

export function BillingDetailsFields({ companyName, setCompanyName, address, setAddress, accentColor = 'emerald-500' }: BillingProps) {
  return (
    <div className="space-y-4 bg-secondary/30 p-6 rounded-2xl border border-theme">
      <div className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1 font-bold">Billing & Company Details (Optional)</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] text-secondary block ml-1 font-bold">Company Name</label>
          <input
            type="text"
            placeholder="e.g. My Company Ltd"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="w-full bg-card border border-theme p-3 rounded-[16px] text-sm text-primary focus:border-purple-500 outline-none transition font-semibold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-secondary block ml-1 font-bold">Billing Address</label>
          <input
            type="text"
            placeholder="Street, City, State, Country"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full bg-card border border-theme p-3 rounded-[16px] text-sm text-primary focus:border-purple-500 outline-none transition font-semibold"
          />
        </div>
      </div>
    </div>
  );
}

interface PaymentStructureProps {
  paymentStructure: '60/40' | 'CUSTOM';
  setPaymentStructure: (v: '60/40' | 'CUSTOM') => void;
  milestones: Milestone[];
  setMilestones: (v: Milestone[]) => void;
  totalPrice: number;
  accentColor?: string;
}

export function PaymentStructureFields({
  paymentStructure,
  setPaymentStructure,
  milestones,
  setMilestones,
  totalPrice,
  accentColor = 'emerald-500'
}: PaymentStructureProps) {
  
  const totalMilestoneSum = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);

  const addMilestone = () => {
    setMilestones([...milestones, { name: 'Milestone X', percentage: 10, trigger: 'Upon phase completion' }]);
  };

  const removeMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: keyof Milestone, val: any) => {
    const upd = [...milestones];
    upd[idx] = { ...upd[idx], [field]: val };
    setMilestones(upd);
  };

  return (
    <div className="bg-secondary p-5 rounded-2xl border border-theme space-y-4">
      <label className="text-[10px] font-black uppercase text-secondary tracking-widest block ml-1 font-bold">Payment Structure</label>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-primary font-bold text-sm">
          <input
            type="radio"
            name="paymentStructureRadio"
            value="60/40"
            checked={paymentStructure === '60/40'}
            onChange={() => setPaymentStructure('60/40')}
            className="accent-emerald-500"
          />
          <span>Standard (60% Deposit / 40% Balance)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-primary font-bold text-sm">
          <input
            type="radio"
            name="paymentStructureRadio"
            value="CUSTOM"
            checked={paymentStructure === 'CUSTOM'}
            onChange={() => setPaymentStructure('CUSTOM')}
            className="accent-emerald-500"
          />
          <span>Custom Milestones</span>
        </label>
      </div>

      {paymentStructure === 'CUSTOM' ? (
        <div className="border-t border-theme pt-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-secondary font-bold">Define Milestones (Percentages must sum to 100%)</span>
            <button
              type="button"
              onClick={addMilestone}
              className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider"
            >
              + Add Milestone
            </button>
          </div>
          <div className="space-y-2">
            {milestones.map((m, idx) => (
              <div key={idx} className="bg-primary/50 border border-theme rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  className="col-span-4 bg-secondary border border-theme rounded-lg p-2 text-xs text-primary font-bold"
                  value={m.name}
                  onChange={e => updateMilestone(idx, 'name', e.target.value)}
                  placeholder="Name"
                />
                <input
                  type="text"
                  className="col-span-4 bg-secondary border border-theme rounded-lg p-2 text-xs text-primary"
                  value={m.trigger}
                  onChange={e => updateMilestone(idx, 'trigger', e.target.value)}
                  placeholder="Trigger"
                />
                <div className="col-span-3 flex items-center gap-1">
                  <input
                    type="number"
                    className="w-full bg-secondary border border-theme rounded-lg p-2 text-xs text-primary font-bold"
                    value={m.percentage}
                    onChange={e => updateMilestone(idx, 'percentage', parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-secondary">%</span>
                </div>
                <button type="button" onClick={() => removeMilestone(idx)} className="col-span-1 text-secondary hover:text-red-400 text-center">
                  <lucide.Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            ))}
          </div>
          <div className="text-right text-xs font-bold text-secondary">
            Total Milestone sum: <span className={totalMilestoneSum === 100 ? 'text-emerald-400' : 'text-red-400'}>{totalMilestoneSum}%</span>
          </div>

          <div className="bg-emerald-500/5 p-6 rounded-[30px] border border-theme overflow-x-auto space-y-4">
            <div className="flex justify-between font-black text-lg pb-2 border-b border-theme flex-wrap gap-2 text-primary">
              <span>Total Project Cost</span>
              <span className="text-emerald-500">₦{totalPrice.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              {milestones.map((m, idx) => (
                <div key={idx} className="flex justify-between text-xs text-secondary font-bold">
                  <span>{idx + 1}. {m.name || `Milestone ${idx+1}`} ({m.percentage}%)</span>
                  <span className="text-primary">₦{Math.round(totalPrice * (m.percentage / 100)).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/5 p-6 rounded-[30px] border border-theme overflow-x-auto space-y-2 text-sm">
          <div className="flex justify-between font-black text-lg pb-2 border-b border-theme flex-wrap gap-2 text-primary">
            <span>Total Project Cost</span>
            <span className="text-emerald-500">₦{totalPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-secondary font-bold mt-2">
            <span>60% Deposit (due now)</span>
            <span className="text-primary">₦{Math.round(totalPrice * 0.6).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-secondary font-bold">
            <span>40% Balance (on completion)</span>
            <span className="text-primary">₦{Math.round(totalPrice * 0.4).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function compileMilestones(paymentStructure: '60/40' | 'CUSTOM', milestones: Milestone[], totalPrice: number) {
  if (paymentStructure === 'CUSTOM') {
    return milestones.map(m => ({
      name: m.name,
      percentage: m.percentage,
      amount: Math.round((m.percentage / 100) * totalPrice),
      paid: false,
      delivered: false,
      paid_at: null,
      tx_ref: null,
      trigger: m.trigger
    }));
  } else {
    return [
      { name: 'Initial Deposit', percentage: 60, amount: Math.round(totalPrice * 0.6), paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: 'Upon signing this agreement' },
      { name: 'Final Payment', percentage: 40, amount: Math.round(totalPrice * 0.4), paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: 'Upon project completion' }
    ];
  }
}
