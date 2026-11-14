'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Star } from 'lucide-react';
import type { SiteProduct } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface OwnerReview {
  id: string;
  product_id: string;
  buyer_name: string;
  rating: number;
  body: string;
  is_visible: boolean;
  created_at: string;
}

export default function ReviewsPanel({
  site,
  products,
}: {
  site: Site;
  products: SiteProduct[];
}) {
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const titleByProduct = new Map(products.map((p) => [p.id, p.title]));

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/reviews?includeHidden=1`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!active) return;
      if (!res.ok) {
        setError(data.error || 'Could not load reviews.');
      } else {
        setReviews(data.reviews || []);
        setTableMissing(!!data.tableMissing);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [site.slug]);

  const toggle = async (rev: OwnerReview) => {
    setBusyId(rev.id);
    setError('');
    const r = await jsonFetch<{ review?: OwnerReview }>(`/api/forums/${site.slug}/reviews`, {
      method: 'PATCH',
      body: { review_id: rev.id, is_visible: !rev.is_visible },
    });
    if (!r.ok) {
      setError(r.data.error || 'Could not update review.');
    } else if (r.data.review) {
      setReviews((prev) => prev.map((x) => (x.id === rev.id ? { ...x, is_visible: !rev.is_visible } : x)));
    }
    setBusyId(null);
  };

  return (
    <section className="mt-10 pt-8 border-t border-theme space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="g-h3">Customer reviews</h3>
          <p className="text-sm text-secondary mt-0.5">
            {plan.reviews
              ? 'Verified buyers can rate items from their paid order tracker. Hide any spam below.'
              : 'Available on Pro and Business plans. Verified buyers can rate items once paid.'}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {tableMissing && (
        <p className="text-xs text-secondary border border-dashed border-theme rounded-xl p-4">
          Reviews will appear here after the latest database migration runs.
        </p>
      )}
      {loading ? (
        <p className="text-sm text-secondary">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-6 text-center">
          No customer reviews yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((rev) => (
            <li key={rev.id} className="g-card p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-primary">{rev.buyer_name}</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${rev.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className={`w-3.5 h-3.5 ${idx < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-secondary/40'}`} />
                    ))}
                  </span>
                  <span className="text-secondary">· {titleByProduct.get(rev.product_id) || 'Product'}</span>
                  {!rev.is_visible && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary">Hidden</span>}
                </div>
                {rev.body && <p className="text-sm text-primary whitespace-pre-line">{rev.body}</p>}
              </div>
              <button
                type="button"
                disabled={busyId === rev.id}
                onClick={() => toggle(rev)}
                className="min-h-9 px-3 rounded-full border border-theme hover:bg-hover text-xs font-medium inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {rev.is_visible ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Show</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
