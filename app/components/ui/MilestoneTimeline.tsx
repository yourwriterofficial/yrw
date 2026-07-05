'use client';

import * as lucide from 'lucide-react';

export interface TimelineMilestone {
  name: string;
  percentage: number;
  amount: number;
  paid?: boolean;
  delivered?: boolean;
  paid_at?: string | null;
  trigger?: string;
}

const formatNaira = (amount: number, currency = '₦') => currency + Math.round(amount || 0).toLocaleString('en-NG');

/**
 * Vertical milestone progress timeline shared by the client vault, client order
 * modal, and admin order modal. Renders each milestone's paid / delivered /
 * locked state in order. Only the next unpaid milestone is payable (onPay).
 */
export default function MilestoneTimeline({
  milestones,
  currency = '₦',
  onPay,
  payingIndex,
  compact = false,
}: {
  milestones: TimelineMilestone[];
  currency?: string;
  onPay?: (index: number) => void;
  payingIndex?: number | null;
  compact?: boolean;
}) {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;
  const nextUnpaidIdx = milestones.findIndex(m => !m.paid);
  const allPaid = nextUnpaidIdx === -1;

  return (
    <div className="space-y-2">
      {milestones.map((m, idx) => {
        const isNext = idx === nextUnpaidIdx;
        const locked = !m.paid && !isNext;
        return (
          <div
            key={idx}
            className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
              m.paid
                ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                : isNext
                  ? 'bg-amber-500/[0.04] border-amber-500/30'
                  : 'bg-secondary/40 border-theme opacity-70'
            }`}
          >
            {/* status dot */}
            <div className="mt-0.5 shrink-0">
              {m.paid ? (
                <lucide.CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : isNext ? (
                <lucide.CircleDot className="w-5 h-5 text-amber-500" />
              ) : (
                <lucide.Lock className="w-5 h-5 text-secondary" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-secondary text-secondary">
                  {idx + 1} · {m.percentage}%
                </span>
                <span className="text-sm font-bold text-primary truncate">{m.name}</span>
                {m.delivered && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Work Delivered
                  </span>
                )}
              </div>
              {!compact && m.trigger && (
                <p className="text-[11px] text-secondary mt-0.5">Trigger: {m.trigger}</p>
              )}
              {m.paid && m.paid_at && (
                <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
                  ✓ Paid {new Date(m.paid_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-sm font-black text-primary">{formatNaira(m.amount, currency)}</span>
              {m.paid ? (
                <span className="text-[10px] font-black uppercase text-emerald-500">Paid ✓</span>
              ) : isNext && onPay ? (
                <button
                  onClick={() => onPay(idx)}
                  disabled={payingIndex === idx}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 transition disabled:opacity-50 cursor-pointer"
                >
                  {payingIndex === idx ? 'Connecting…' : 'Pay Now'}
                </button>
              ) : locked ? (
                <span className="text-[10px] font-black uppercase text-secondary">Locked</span>
              ) : null}
            </div>
          </div>
        );
      })}
      {allPaid && (
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs px-1 pt-1">
          <lucide.ShieldCheck className="w-4 h-4" /> All milestones paid — files unlocked.
        </div>
      )}
    </div>
  );
}
