'use client';

import { useEffect } from 'react';
import { isValidPermalink } from '@/lib/permalink';

export const REFERRAL_STORAGE_KEY = 'rw_ref_code';

/**
 * Captures a `?ref=<username>` query param into localStorage so it survives
 * navigation to /register (or the Google OAuth round-trip) regardless of
 * which page the visitor first lands on. Reads window.location directly
 * (rather than useSearchParams) so it never forces this root-mounted
 * component's static pages into dynamic/Suspense-boundary rendering.
 */
export default function ReferralCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && isValidPermalink(ref.toLowerCase())) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toLowerCase());
    }
  }, []);

  return null;
}
