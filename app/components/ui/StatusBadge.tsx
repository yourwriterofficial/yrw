type StatusBadgeProps = {
  status: string;
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
};

function getStatusStyle(status: string): string {
  const normalized = status.toLowerCase();
  if (['completed', 'delivered', 'paid', 'active', 'success', 'approved'].includes(normalized)) {
    return 'bg-[var(--success-bg)] text-success border-success/20';
  }
  if (['cancelled', 'failed', 'rejected', 'refunded', 'inactive', 'banned'].includes(normalized)) {
    return 'bg-[var(--danger-bg)] text-danger border-danger/20';
  }
  if (['briefing received', 'awaiting quote', 'pending', 'in review', 'on hold'].includes(normalized)) {
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  }
  if (['quote sent', 'in progress', 'processing', 'shipped', 'in transit'].includes(normalized)) {
    return 'bg-[var(--info-bg)] text-info border-info/20';
  }
  if (['synthesis active', 'awaiting payment', 'needs action', 'escalated'].includes(normalized)) {
    return 'bg-[var(--warning-bg)] text-warning border-warning/20';
  }
  return 'bg-secondary text-secondary border-theme';
}

export default function StatusBadge({ status, size = 'sm', dot, pulse }: StatusBadgeProps) {
  const sizeClass =
    size === 'md'
      ? 'px-3 py-1 text-[10px]'
      : 'px-2 py-0.5 text-[9px]';

  return (
    <span
      className={`inline-flex items-center rounded-md font-black uppercase tracking-widest border ${sizeClass} ${getStatusStyle(status)}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            status.toLowerCase().includes('active') || status.toLowerCase().includes('progress')
              ? pulse ? 'bg-info animate-pulse' : 'bg-info'
              : 'bg-current'
          }`}
        />
      )}
      {status}
    </span>
  );
}
