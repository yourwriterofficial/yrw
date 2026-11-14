'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Search, ExternalLink, ShieldCheck } from 'lucide-react';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import CreateForumForm from '@/app/components/forums/CreateForumForm';
import { type ForumSummary, getForumHref } from '@/lib/forums';

export default function ForumsDirectoryPage() {
  const [forums, setForums] = useState<ForumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [host, setHost] = useState('');

  const loadForums = useCallback(async (q: string) => {
    setHost((prev) => prev || (typeof window !== 'undefined' ? window.location.host : ''));
    setLoading(true);
    try {
      const url = q.trim() ? `/api/forums?q=${encodeURIComponent(q.trim())}` : '/api/forums';
      const res = await fetch(url);
      const data = await res.json();
      setForums(data.forums || []);
    } catch {
      setForums([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadForums(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, loadForums]);

  return (
    <div className="min-h-screen bg-primary text-primary">
      <DevelopaHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            [name].developa.me
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Stores & Community Forums</h1>
          <p className="text-sm text-secondary max-w-2xl">
            Launch a zero-code online store, a discussion forum, or both at{' '}
            <span className="font-mono text-cyan-400">yourname.developa.me</span>.
          </p>
        </div>

        <CreateForumForm onCreated={() => loadForums(query)} />

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Public Forums</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search forums..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-card border border-theme text-sm text-primary focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-32 rounded-2xl bg-card border border-theme animate-pulse" />
              ))}
            </div>
          ) : forums.length === 0 ? (
            <div className="bg-card border border-theme rounded-2xl p-8 text-center text-sm text-secondary">
              No public forums found yet. Be the first to create one above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forums.map((f) => {
                const href = getForumHref(f.slug, host);
                const isExternal = href.startsWith('http');
                return (
                  <Link
                    key={f.id}
                    href={href}
                    className="group bg-card border border-theme hover:border-cyan-500/40 rounded-2xl p-5 transition flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: f.accent_color || '#06b6d4' }}
                          />
                          <h3 className="font-bold text-primary truncate group-hover:text-cyan-400 transition-colors">
                            {f.name}
                          </h3>
                          {f.verified && (
                            <span title="Verified seller" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold shrink-0">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                        {isExternal && <ExternalLink className="w-3.5 h-3.5 text-secondary shrink-0" />}
                      </div>
                      <p className="text-xs font-mono text-cyan-400/90">{f.slug}.developa.me</p>
                      {f.description && (
                        <p className="text-xs text-secondary line-clamp-2 pt-1">{f.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs text-secondary pt-2 border-t border-theme">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> {f.member_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> {f.thread_count} threads
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary/50 text-primary/80">
                        {f.site_mode === 'store' ? 'Store' : f.site_mode === 'both' ? 'Store + Forum' : 'Forum'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
