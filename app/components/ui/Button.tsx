'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import * as lucide from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

// Static per-variant class strings — required by Tailwind v4's JIT scanner, which
// only generates utilities that appear literally in source (no runtime `${}` interpolation).
// primary/secondary match .btn-primary/.btn-secondary in globals.css exactly, so old
// and new buttons look identical during the opportunistic migration.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-black font-extrabold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'bg-secondary text-primary font-bold border border-theme hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,var(--bg-secondary))] disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'bg-transparent text-primary font-bold hover:bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[11px] rounded-xl gap-1.5',
  md: 'px-5 py-2.5 text-xs rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-sm rounded-xl gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center uppercase tracking-wide transition cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <lucide.Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
}
