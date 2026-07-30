'use client';

import { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  content?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function Tabs({ tabs, active, onChange, variant = 'default', className = '' }: TabsProps) {
  const isPills = variant === 'pills';
  const isUnderline = variant === 'underline';

  return (
    <div className={`${className}`}>
      <div
        className={`flex items-center gap-1 ${
          isUnderline
            ? 'border-b border-theme'
            : isPills
            ? 'bg-secondary p-1 rounded-xl border border-theme w-fit'
            : 'bg-secondary p-1 rounded-xl border border-theme w-fit'
        }`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                isUnderline
                  ? selected
                    ? 'text-primary border-b-2 border-accent -mb-[1px] pb-[7px]'
                    : 'text-secondary hover:text-primary pb-2'
                  : selected
                  ? 'bg-card text-primary shadow-sm border border-theme'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanels({ tabs, active }: { tabs: TabItem[]; active: string }) {
  return (
    <div className="mt-6">
      {tabs.map((tab) =>
        tab.content && active === tab.id ? (
          <div key={tab.id} role="tabpanel">
            {tab.content}
          </div>
        ) : null
      )}
    </div>
  );
}
