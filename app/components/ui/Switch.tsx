'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, className = '', ...props }, ref) => {
    return (
      <label className={`flex items-start gap-3 cursor-pointer ${className}`}>
        <div className="relative inline-flex items-center">
          <input
            ref={ref}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <span className="w-10 h-5 rounded-full bg-border border border-transparent transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50" />
          <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </div>
        <div className="space-y-0.5">
          {label && <span className="block text-sm font-medium text-primary">{label}</span>}
          {description && <span className="block text-xs text-secondary">{description}</span>}
        </div>
      </label>
    );
  }
);
Switch.displayName = 'Switch';
