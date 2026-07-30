import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-secondary text-secondary border-theme',
  primary: 'bg-brand-500/10 text-brand-500 border-brand-500/20',
  success: 'bg-[var(--success-bg)] text-success border-success/20',
  warning: 'bg-[var(--warning-bg)] text-warning border-warning/20',
  danger: 'bg-[var(--danger-bg)] text-danger border-danger/20',
  info: 'bg-[var(--info-bg)] text-info border-info/20',
};

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center rounded-md font-semibold border ${sizeClass} ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}
