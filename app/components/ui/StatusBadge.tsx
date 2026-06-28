type StatusBadgeProps = {
  status: string;
  size?: 'sm' | 'md';
};

function getStatusStyle(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (normalized === 'cancelled') {
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
  if (normalized === 'briefing received' || normalized === 'awaiting quote') {
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  }
  if (normalized === 'quote sent') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
  if (normalized === 'synthesis active') {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-white/5 text-secondary border-theme';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const sizeClass =
    size === 'md'
      ? 'px-3 py-1 text-[10px]'
      : 'px-2 py-0.5 text-[9px]';

  return (
    <span
      className={`inline-flex items-center rounded-md font-black uppercase tracking-widest border ${sizeClass} ${getStatusStyle(status)}`}
    >
      {status}
    </span>
  );
}
