'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  name: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  className?: string;
}

export function RadioGroup({ name, options, value, onChange, label, error, className = '' }: RadioGroupProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <span className="block text-xs font-semibold text-primary">{label}</span>}
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange?.(opt.value)}
                className="peer sr-only"
              />
              <span className="w-5 h-5 rounded-full border border-border-strong bg-bg-input transition-colors peer-checked:border-accent peer-checked:border-[5px] peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50" />
            </div>
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-primary group-hover:text-secondary transition-colors">{opt.label}</span>
              {opt.description && <span className="block text-xs text-secondary">{opt.description}</span>}
            </div>
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
