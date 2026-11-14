'use client';

import { useEffect, useState } from 'react';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from './types';

interface AnalyticsData {
  views7d: number;
  views30d: number;
  uniques30d: number;
  orders30d: number;
  conversionRate: number;
  dailySeries: { date: string; views: number; orders: number }[];
  topReferrers: { source: string; count: number }[];
  topProducts: { product_id: string; title: string; views: number }[];
}

export default function AnalyticsCard({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    jsonFetch<AnalyticsData>(`/api/forums/${site.slug}/analytics`)
      .then((r) => {
        if (active && r.ok) setData(r.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [site.slug]);

  const series = data?.dailySeries || [];
  const maxViews = Math.max(1, ...series.map((d) => d.views));

  return (
    <section className="g-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Traffic & conversion (30 days)</h3>
          <p className="text-xs text-secondary mt-0.5">Privacy-friendly counts without cookies or raw IP logs.</p>
        </div>
        {!plan.deeperAnalytics && (
          <button type="button" onClick={goToPlan} className="text-xs font-medium px-3.5 h-9 rounded-full border border-theme hover:bg-hover">
            Upgrade to Pro for sources
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-secondary">Loading visits…</p>
      ) : !data ? (
        <p className="text-sm text-secondary">Visit data will show up after customers browse your link.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-secondary/25">
              <p className="text-xs text-secondary">7-day visits</p>
              <p className="text-lg font-medium mt-0.5">{data.views7d}</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/25">
              <p className="text-xs text-secondary">Unique visitors</p>
              <p className="text-lg font-medium mt-0.5">{data.uniques30d}</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/25">
              <p className="text-xs text-secondary">Order rate</p>
              <p className="text-lg font-medium mt-0.5">{data.conversionRate}%</p>
            </div>
          </div>

          {series.length > 0 && (
            <div>
              <p className="text-xs text-secondary mb-1.5">Last 14 days</p>
              <svg viewBox="0 0 280 56" className="w-full h-14 overflow-visible" role="img" aria-label="14-day visits chart">
                {series.map((d, i) => {
                  const h = Math.max(3, Math.round((d.views / maxViews) * 48));
                  const x = i * 20;
                  return (
                    <g key={d.date}>
                      <title>{`${d.date}: ${d.views} visits, ${d.orders} orders`}</title>
                      <rect
                        x={x + 2}
                        y={52 - h}
                        width={14}
                        height={h}
                        rx={3}
                        fill="var(--accent, #2563eb)"
                        opacity={d.views > 0 ? 0.85 : 0.2}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {plan.deeperAnalytics && (
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-theme text-xs">
              <div>
                <p className="font-medium text-secondary mb-1.5">Top sources</p>
                {data.topReferrers.length === 0 ? (
                  <p className="text-secondary">No external referrers yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.topReferrers.map((r) => (
                      <li key={r.source} className="flex justify-between gap-2">
                        <span className="truncate">{r.source}</span>
                        <span className="text-secondary shrink-0">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium text-secondary mb-1.5">Most viewed items</p>
                {data.topProducts.length === 0 ? (
                  <p className="text-secondary">No product opens recorded yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.topProducts.map((p) => (
                      <li key={p.product_id} className="flex justify-between gap-2">
                        <span className="truncate">{p.title}</span>
                        <span className="text-secondary shrink-0">{p.views}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
