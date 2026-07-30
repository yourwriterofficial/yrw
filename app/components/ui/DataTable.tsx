'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode, useMemo } from 'react';
import Button from './Button';
import { Column, Table } from './Table';
import { EmptyState } from './EmptyState';

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: { title: string; description?: string; action?: { label: string; onClick: () => void } };
  searchable?: boolean;
  searchValue?: string;
  onSearch?: (value: string) => void;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  searchable,
  searchValue,
  onSearch,
  pagination,
  title,
  description,
  actions,
  className = '',
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  const mobileCards = useMemo(
    () => rows,
    [rows]
  );

  if (!loading && rows.length === 0 && empty) {
    return (
      <div className={`bg-card border border-theme rounded-2xl p-8 ${className}`}>
        <EmptyState
          title={empty.title}
          description={empty.description}
          action={empty.action ? { label: empty.action.label, onClick: empty.action.onClick } : undefined}
        />
      </div>
    );
  }

  return (
    <div className={`bg-card border border-theme rounded-2xl overflow-hidden ${className}`}>
      {(title || description || actions || searchable) && (
        <div className="p-4 border-b border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-bold text-primary">{title}</h3>}
            {description && <p className="text-xs text-secondary">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {searchable && (
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearch?.(e.target.value)}
                placeholder="Search..."
                className="input-box w-full sm:w-56"
              />
            )}
            {actions}
          </div>
        </div>
      )}

      <div className="hidden md:block">
        <Table columns={columns} rows={rows} rowKey={rowKey} loading={loading} />
      </div>

      <div className="md:hidden divide-y divide-theme">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))
          : mobileCards.map((row) => (
              <div key={rowKey(row)} className="p-4 space-y-2">
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{col.header}</span>
                    <span className="text-sm text-primary">{col.cell(row)}</span>
                  </div>
                ))}
              </div>
            ))}
      </div>

      {pagination && totalPages > 1 && (
        <div className="p-3 border-t border-theme flex items-center justify-between">
          <span className="text-xs text-secondary">
            Page {pagination.page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
            />
          </div>
        </div>
      )}
    </div>
  );
}
