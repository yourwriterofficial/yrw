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
}

export default function StatCard({ label, value, color = 'text-primary', icon, trend, loading, mini }: StatCardProps) {
  if (loading) return <Skeleton className="h-28 rounded-2xl" />;

  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trend?.direction === 'up' ? 'text-success' : trend?.direction === 'down' ? 'text-danger' : 'text-secondary';

  return (
    <div className="bg-card border border-theme rounded-2xl p-5">
      <div className="flex items-start justify-between">
        {icon && (
          <div className={`p-2 rounded-lg bg-secondary border border-theme inline-flex mb-3 ${color}`}>
            {icon}
          </div>
        )}
        {trend && (
          <div className={`flex items-center gap-0.5 text-[11px] font-bold ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {trend.value}
          </div>
        )}
      </div>
      <div className={`font-black truncate ${color} ${mini ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{value}</div>
      <div className="text-[10px] text-secondary uppercase tracking-widest font-bold mt-1">{label}</div>
    </div>
  );
}
