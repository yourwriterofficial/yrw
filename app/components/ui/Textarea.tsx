'use client';

import { forwardRef, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helper, error, fullWidth, className = '', rows = 4, ...props }, ref) => {
    return (
      <div className={`${fullWidth ? 'w-full' : ''} space-y-1.5`}>
        {label && (
          <label className="block text-xs font-semibold text-primary">
            {label}
            {props.required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={`input-box w-full resize-y min-h-[96px] placeholder:text-[var(--text-muted)] ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${props.id}-error` : helper ? `${props.id}-helper` : undefined}
          {...props}
        />
        {helper && !error && <p id={`${props.id}-helper`} className="text-xs text-secondary">{helper}</p>}
        {error && <p id={`${props.id}-error`} className="text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
