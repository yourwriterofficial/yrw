import type { ReactNode } from 'react';
import { Breadcrumb } from './Breadcrumb';
import type { BreadcrumbItem } from './Breadcrumb';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: string;
  items?: BreadcrumbItem[];
  compact?: boolean;
}

export default function PageHeader({ title, description, icon, actions, breadcrumb, items, compact }: PageHeaderProps) {
  return (
    <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div className="min-w-0">
        {items && items.length > 0 && <Breadcrumb items={items} className="mb-2" />}
        {!items && breadcrumb && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">{breadcrumb}</p>
        )}
        <h1 className={`font-bold text-primary flex items-center gap-3 ${compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}>
          {icon && <span className="text-accent">{icon}</span>}
          <span className="truncate">{title}</span>
        </h1>
        {description && <p className="text-secondary text-sm mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 min-w-0">{actions}</div>}
    </header>
  );
}
