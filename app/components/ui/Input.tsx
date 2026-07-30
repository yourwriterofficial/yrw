'use client';

import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helper, error, iconLeft, iconRight, fullWidth, className = '', ...props }, ref) => {
    const wrapperClass = fullWidth ? 'w-full' : '';
    const inputClass = `
      input-box w-full placeholder:text-[var(--text-muted)]
      ${iconLeft ? 'pl-11' : ''}
      ${iconRight ? 'pr-11' : ''}
      ${className}
    `;

    return (
      <div className={`${wrapperClass} space-y-1.5`}>
        {label && (
          <label className="block text-xs font-semibold text-primary">
            {label}
            {props.required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {iconLeft && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            className={inputClass}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : helper ? `${props.id}-helper` : undefined}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none">
              {iconRight}
            </span>
          )}
        </div>
        {helper && !error && <p id={`${props.id}-helper`} className="text-xs text-secondary">{helper}</p>}
        {error && <p id={`${props.id}-error`} className="text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
