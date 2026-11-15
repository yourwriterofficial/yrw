'use client';

import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The classic blog sidebar (search, recent posts, categories, about) that WordPress-style themes put to
 * the right of the posts. On narrow screens it drops under the content.
 */
export function WithBlogSidebar({
  on,
  brand,
  about,
  accent,
  posts,
  children,
}: {
  on: boolean;
  brand: string;
  about?: string;
  accent: string;
  posts: { id: string; title: string }[];
  children: ReactNode;
}) {
  if (!on) return <>{children}</>;
  const cats = ['Business', 'Guides', 'News', 'Community', 'Opinion'];
  const widget = 'bg-card border border-theme rounded-lg p-4';
  const title = 'text-[13px] font-bold uppercase tracking-wider text-primary pb-2 mb-3 border-b-2 inline-block';
  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start">
      <div className="space-y-8 min-w-0">{children}</div>
      <aside className="space-y-4" aria-label="Sidebar">
        <div className={widget}>
          <div className="flex">
            <input readOnly placeholder="Search…" className="flex-1 min-w-0 h-9 px-3 text-sm bg-transparent border border-theme rounded-l-md outline-none" />
            <span className="h-9 w-10 rounded-r-md text-white flex items-center justify-center" style={{ background: accent }}><Search className="w-4 h-4" /></span>
          </div>
        </div>
        <div className={widget}>
          <h3 className={title} style={{ borderColor: accent }}>Recent posts</h3>
          <ul className="space-y-2.5 text-sm">
            {posts.slice(0, 5).map((p) => (
              <li key={p.id} className="leading-snug text-secondary hover:text-primary"><a className="hover:underline">{p.title}</a></li>
            ))}
          </ul>
        </div>
        <div className={widget}>
          <h3 className={title} style={{ borderColor: accent }}>Categories</h3>
          <ul className="text-sm divide-y divide-theme">
            {cats.map((c) => (
              <li key={c} className="py-1.5 flex justify-between text-secondary"><a className="hover:underline">{c}</a><span className="text-xs">({3 + c.length})</span></li>
            ))}
          </ul>
        </div>
        <div className={widget}>
          <h3 className={title} style={{ borderColor: accent }}>About</h3>
          <p className="text-sm text-secondary leading-relaxed">{about || `${brand}: stories, notes and guides, published regularly.`}</p>
        </div>
      </aside>
    </div>
  );
}
