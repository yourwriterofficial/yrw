import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: string;
};

export default function PageHeader({ title, description, icon, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        {breadcrumb && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">{breadcrumb}</p>
        )}
        <h1 className="text-2xl md:text-3xl font-black text-primary flex items-center gap-3">
          {icon}
          {title}
        </h1>
        {description && <p className="text-secondary text-sm mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
