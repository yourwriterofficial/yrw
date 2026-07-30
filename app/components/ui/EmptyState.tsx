import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, action, className = '', children }: EmptyStateProps) {
  return (
    <div className={`empty-state flex flex-col items-center ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-secondary border border-theme flex items-center justify-center text-secondary mb-4">
        {icon || <Inbox className="w-5 h-5" />}
      </div>
      <h3 className="text-sm font-bold text-primary mb-1">{title}</h3>
      {description && <p className="text-xs text-secondary max-w-xs mb-4">{description}</p>}
      {action && (
        action.href ? (
          <Button variant="secondary" size="sm" href={action.href}>
            {action.label}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
      {children}
    </div>
  );
}
