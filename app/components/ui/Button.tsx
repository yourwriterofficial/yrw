'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
type ButtonColor = 'success' | 'warning' | 'danger' | 'info';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  href?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-[var(--accent-foreground)] font-extrabold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
  secondary: 'bg-secondary text-primary font-bold border border-theme hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed',
  outline: 'bg-transparent text-primary font-bold border border-theme hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'bg-transparent text-primary font-bold hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed',
  soft: 'font-bold disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'bg-[var(--danger-bg)] text-danger font-bold border border-danger/20 hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed',
};

const SOFT_COLOR_CLASSES: Record<ButtonColor, string> = {
  success: 'bg-[var(--success-bg)] text-success hover:bg-[color-mix(in_srgb,var(--success)_20%,transparent)]',
  warning: 'bg-[var(--warning-bg)] text-warning hover:bg-[color-mix(in_srgb,var(--warning)_20%,transparent)]',
  danger: 'bg-[var(--danger-bg)] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)]',
  info: 'bg-[var(--info-bg)] text-info hover:bg-[color-mix(in_srgb,var(--info)_20%,transparent)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[11px] rounded-lg gap-1.5 h-8',
  md: 'px-4 py-2 text-xs rounded-xl gap-2 h-10',
  lg: 'px-6 py-2.5 text-sm rounded-xl gap-2 h-12',
  icon: 'p-2 rounded-lg h-10 w-10',
};

export default function Button({
  variant = 'primary',
  color = 'success',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className = '',
  children,
  href,
  ...rest
}: ButtonProps) {
  const variantClasses = variant === 'soft' ? `${VARIANT_CLASSES.soft} ${SOFT_COLOR_CLASSES[color]}` : VARIANT_CLASSES[variant];
  const baseClasses = `inline-flex items-center justify-center uppercase tracking-wide transition focus-ring ${variantClasses} ${size === 'icon' ? SIZE_CLASSES.icon : SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
  const content = loading ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" />
      {loadingText && <span>{loadingText}</span>}
    </>
  ) : (
    <>
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </>
  );

  if (href) {
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a href={href} className={baseClasses} {...(rest as any)}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={baseClasses} {...(rest as any)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled || loading} className={baseClasses} {...rest}>
      {content}
    </button>
  );
}
