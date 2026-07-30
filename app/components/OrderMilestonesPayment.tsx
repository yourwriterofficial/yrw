'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';

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

export function BillingDetailsFields({ companyName, setCompanyName, address, setAddress }: BillingProps) {
  return (
    <Card elevation={0} className="bg-secondary/30">
      <div className="space-y-4">
        <div className="text-[10px] uppercase font-black tracking-widest text-secondary ml-1">Billing & Company Details (Optional)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            placeholder="e.g. My Company Ltd"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />
          <Input
            label="Billing Address"
            placeholder="Street, City, State, Country"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>
      </div>
    </Card>
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
}: PaymentStructureProps) {
  const totalMilestoneSum = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);

  const addMilestone = () => {
    setMilestones([...milestones, { name: 'Milestone X', percentage: 10, trigger: 'Upon phase completion' }]);
  };

  const removeMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, field: keyof Milestone, val: string | number) => {
    const upd = [...milestones];
    upd[idx] = { ...upd[idx], [field]: val };
    setMilestones(upd);
  };

  return (
    <Card elevation={0}>
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase text-secondary tracking-widest block ml-1">Payment Structure</label>
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
              <Button type="button" size="sm" variant="secondary" onClick={addMilestone}>
                + Add Milestone
              </Button>
            </div>
            <div className="space-y-2">
              {milestones.map((m, idx) => (
                <div key={idx} className="bg-primary/50 border border-theme rounded-xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4">
                    <Input
                      value={m.name}
                      onChange={e => updateMilestone(idx, 'name', e.target.value)}
                      placeholder="Name"
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Input
                      value={m.trigger}
                      onChange={e => updateMilestone(idx, 'trigger', e.target.value)}
                      placeholder="Trigger"
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-1">
                    <Input
                      type="number"
                      value={m.percentage}
                      onChange={e => updateMilestone(idx, 'percentage', parseInt(e.target.value) || 0)}
                      className="text-xs"
                    />
                    <span className="text-xs font-bold text-secondary">%</span>
                    <button type="button" onClick={() => removeMilestone(idx)} className="sm:hidden text-secondary hover:text-red-400 shrink-0 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => removeMilestone(idx)} className="hidden sm:flex sm:col-span-1 text-secondary hover:text-red-400 justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="text-right text-xs font-bold text-secondary">
              Total Milestone sum: <span className={totalMilestoneSum === 100 ? 'text-emerald-400' : 'text-red-400'}>{totalMilestoneSum}%</span>
            </div>

            <Card elevation={0} className="bg-emerald-500/5 border border-theme overflow-x-auto">
              <div className="flex justify-between font-black text-lg pb-2 border-b border-theme flex-wrap gap-2 text-primary">
                <span>Total Project Cost</span>
                <span className="text-emerald-500">₦{totalPrice.toLocaleString()}</span>
              </div>
              <div className="space-y-2 mt-4">
                {milestones.map((m, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-secondary font-bold">
                    <span>{idx + 1}. {m.name || `Milestone ${idx + 1}`} ({m.percentage}%)</span>
                    <span className="text-primary">₦{Math.round(totalPrice * (m.percentage / 100)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card elevation={0} className="bg-emerald-500/5 border border-theme overflow-x-auto">
            <div className="flex justify-between font-black text-lg pb-2 border-b border-theme flex-wrap gap-2 text-primary">
              <span>Total Project Cost</span>
              <span className="text-emerald-500">₦{totalPrice.toLocaleString()}</span>
            </div>
            <div className="space-y-2 mt-4 text-sm">
              <div className="flex justify-between text-xs text-secondary font-bold mt-2">
                <span>60% Deposit (due now)</span>
                <span className="text-primary">₦{Math.round(totalPrice * 0.6).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-secondary font-bold">
                <span>40% Balance (on completion)</span>
                <span className="text-primary">₦{Math.round(totalPrice * 0.4).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Card>
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
