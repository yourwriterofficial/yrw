import { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { SkeletonRow } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  cell: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: { title: string; description?: string };
  className?: string;
}

export function Table<T>({ columns, rows, rowKey, loading, empty, className = '' }: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-theme">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest text-secondary whitespace-nowrap ${
                  col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table-row-hover">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8">
                <EmptyState title={empty?.title || 'No data'} description={empty?.description} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-theme last:border-0">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 text-sm text-primary whitespace-nowrap ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
