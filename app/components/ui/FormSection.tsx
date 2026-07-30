import { ReactNode } from 'react';

interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function FormSection({ title, description, children, className = '', actions }: FormSectionProps) {
  return (
    <section className={`bg-card border border-theme rounded-2xl p-5 md:p-6 space-y-5 ${className}`}>
      {(title || description) && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title && <h3 className="text-sm font-bold text-primary">{title}</h3>}
            {description && <p className="text-xs text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
