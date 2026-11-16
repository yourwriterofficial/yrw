import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Skeleton } from './Skeleton';

type TrendDirection = 'up' | 'down' | 'neutral';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  icon?: ReactNode;
  trend?: { direction: TrendDirection; value: string };
  loading?: boolean;
  mini?: boolean;
  /** One short line under the number, for example "from 3 clients". */
  hint?: string;
}

/**
 * One headline number. The label sits on top, the number below it on a single line (it never wraps),
 * and the icon, when given, sits at the right so cards line up in a row.
 */
export default function StatCard({ label, value, color = 'text-primary', icon, trend, loading, mini, hint }: StatCardProps) {
  if (loading) return <Skeleton className="h-24 rounded-2xl" />;

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trend?.direction === 'up' ? 'text-success' : trend?.direction === 'down' ? 'text-danger' : 'text-secondary';

  return (
    <div className="bg-card border border-theme rounded-2xl p-4 md:p-5 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-secondary truncate">{label}</p>
        {icon && <span className={`shrink-0 ${color} opacity-80 [&>svg]:w-4 [&>svg]:h-4`}>{icon}</span>}
      </div>
      <div className={`mt-2 font-black tracking-tight tabular-nums whitespace-nowrap overflow-hidden text-ellipsis leading-none ${color} ${mini || String(value).length > 9 ? 'text-xl' : 'text-2xl'}`} title={String(value)}>{value}</div>
      {(trend || hint) && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          {trend && (
            <span className={`flex items-center gap-0.5 font-bold ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {hint && <span className="text-secondary truncate">{hint}</span>}
        </div>
      )}
    </div>
  );
}
