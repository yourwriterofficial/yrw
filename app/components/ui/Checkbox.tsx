'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <label className={`flex items-start gap-3 cursor-pointer ${className}`}>
        <div className="relative flex items-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            className="peer sr-only"
            aria-invalid={!!error}
            {...props}
          />
          <span className="w-5 h-5 rounded-md border border-border-strong bg-bg-input transition-colors peer-checked:bg-accent peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50" />
          <svg
            className="absolute inset-0 m-auto w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-0.5">
          {label && <span className="block text-sm font-medium text-primary">{label}</span>}
          {error && <span className="block text-xs font-medium text-danger">{error}</span>}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
