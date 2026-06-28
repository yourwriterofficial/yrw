import type { CSSProperties } from 'react';

/**
 * Base skeleton block. Use the `.skeleton` shimmer (defined in globals.css).
 * Sizing is left to the caller via className / style so it can mirror the real
 * content it stands in for.
 */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** A few stacked text lines. The last line is shortened to feel natural. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

/** A card placeholder matching the StatCard layout used across dashboards. */
export function StatCardSkeleton() {
  return (
    <div className="bg-card border border-theme rounded-2xl p-5">
      <Skeleton className="w-9 h-9 rounded-lg mb-3" />
      <Skeleton className="h-7 w-20 mb-2" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

/** A horizontal row placeholder for list/table rows. */
export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-theme py-4 last:border-0">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-5 w-20 rounded-md" />
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}

/**
 * Full dashboard skeleton: a header line, a row of stat cards, and a list card.
 * Mirrors the admin/client dashboard structure so the page doesn't visibly
 * "jump" when real data arrives.
 */
export function DashboardSkeleton({ stats = 4, rows = 5 }: { stats?: number; rows?: number }) {
  return (
    <div className="p-6 md:p-10 max-w-6xl" aria-busy="true" aria-label="Loading">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: stats }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-card border border-theme rounded-2xl p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-1">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
