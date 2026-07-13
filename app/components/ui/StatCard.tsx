import type { ReactNode } from 'react';

export default function StatCard({
  label,
  value,
  color = 'text-primary',
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-card border border-theme rounded-2xl p-5">
      {icon && (
        <div className={`p-2 rounded-lg bg-secondary border border-theme inline-flex mb-3 ${color}`}>
          {icon}
        </div>
      )}
      <div className={`text-2xl font-black truncate ${color}`}>{value}</div>
      <div className="text-[10px] text-secondary uppercase tracking-widest font-bold mt-1">{label}</div>
    </div>
  );
}
