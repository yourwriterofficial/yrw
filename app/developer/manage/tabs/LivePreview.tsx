'use client';

import { useEffect, useState } from 'react';
import { Monitor, Smartphone, RefreshCw, Eye } from 'lucide-react';
import type { Site } from '../types';

/**
 * Shows the real store next to the settings, so an owner sees a change as soon as it is saved. Desktop and
 * phone widths. The store page allows framing by this site only (see next.config.mjs).
 */
export default function LivePreview({ site }: { site: Site }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [stamp, setStamp] = useState(0);

  // Reload the preview whenever a saved value that changes the look changes.
  const sig = JSON.stringify([site.name, site.accent_color, site.logo_url, site.hero_headline, site.hero_subheadline, site.announcement, site.announcement_active, site.plugins, site.is_public]);
  useEffect(() => { setStamp((s) => s + 1); }, [sig]);

  return (
    <section className="g-card p-5 space-y-4" aria-label="Live preview">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> See your store as buyers do</h3>
          <p className="text-sm text-secondary mt-1">Save a change and it shows here straight away.</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="h-9 px-4 rounded-full text-sm font-medium border border-theme hover:bg-hover">{open ? 'Hide preview' : 'Show preview'}</button>
      </div>
      {open && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPhone(false)} aria-pressed={!phone} className={`h-9 px-3 rounded-full text-sm inline-flex items-center gap-1.5 ${!phone ? 'g-tonal-strong font-medium' : 'text-secondary'}`}><Monitor className="w-4 h-4" /> Desktop</button>
            <button type="button" onClick={() => setPhone(true)} aria-pressed={phone} className={`h-9 px-3 rounded-full text-sm inline-flex items-center gap-1.5 ${phone ? 'g-tonal-strong font-medium' : 'text-secondary'}`}><Smartphone className="w-4 h-4" /> Phone</button>
            <button type="button" onClick={() => setStamp((s) => s + 1)} className="h-9 px-3 rounded-full text-sm inline-flex items-center gap-1.5 text-secondary hover:text-primary ml-auto"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
          <div className="rounded-2xl border border-theme bg-secondary/30 p-3 overflow-auto">
            <iframe
              key={stamp}
              title={`${site.name} preview`}
              src={`/forums/${encodeURIComponent(site.slug)}?preview=${stamp}`}
              className="mx-auto block bg-white rounded-xl border border-theme"
              style={{ width: phone ? 390 : '100%', height: 620 }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
