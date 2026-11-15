'use client';

import { useState } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { SECTION_DEFS, DEFAULT_ORDER, parseLayout, serializeLayout, type SectionKey } from '@/lib/sectionOrder';
import { jsonFetch, type Site } from '../types';

/**
 * Drag the parts of the home page into the order you like, and hide the ones you do not want.
 * Drag with a mouse or finger on the handle, or use the arrow buttons (works with a keyboard too).
 */
export default function LayoutCard({ site, reload }: { site: Site; reload: () => Promise<void> }) {
  const saved = parseLayout((site.plugins as Record<string, unknown> | undefined)?._cfg_layout);
  const [order, setOrder] = useState<SectionKey[]>(saved.order);
  const [hidden, setHidden] = useState<Set<SectionKey>>(saved.hidden);
  const [dragKey, setDragKey] = useState<SectionKey | null>(null);
  const [overKey, setOverKey] = useState<SectionKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = serializeLayout(order, hidden) !== serializeLayout(saved.order, saved.hidden);

  const move = (key: SectionKey, to: number) => {
    setOrder((o) => {
      const from = o.indexOf(key);
      if (from < 0 || to < 0 || to >= o.length || from === to) return o;
      const next = [...o];
      next.splice(from, 1);
      next.splice(to, 0, key);
      return next;
    });
    setMsg(null);
  };

  const toggle = (key: SectionKey) => {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await jsonFetch(`/api/forums/${encodeURIComponent(site.slug)}/plugins`, { method: 'PATCH', body: { _cfg_layout: serializeLayout(order, hidden) } });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'Saved. Your store now shows this order.' }); await reload(); }
    else setMsg({ ok: false, text: (r.data.error as string) || 'Could not save the layout.' });
  };

  return (
    <section className="g-card p-5 sm:p-6 space-y-4" aria-label="Page layout">
      <div>
        <h3 className="font-semibold">Arrange your home page</h3>
        <p className="text-sm text-secondary mt-1">Drag the parts into the order you want. Use the eye to hide a part you do not need.</p>
      </div>

      <ul className="space-y-2">
        {order.map((key, i) => {
          const def = SECTION_DEFS.find((d) => d.key === key)!;
          const isHidden = hidden.has(key);
          return (
            <li
              key={key}
              draggable
              onDragStart={(e) => { setDragKey(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }}
              onDragOver={(e) => { e.preventDefault(); if (overKey !== key) setOverKey(key); }}
              onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => { e.preventDefault(); if (dragKey && dragKey !== key) move(dragKey, i); setDragKey(null); setOverKey(null); }}
              onDragEnd={() => { setDragKey(null); setOverKey(null); }}
              className={`flex items-center gap-3 rounded-xl border p-3 bg-card transition ${overKey === key && dragKey !== key ? 'border-accent ring-2 ring-accent/30' : 'border-theme'} ${dragKey === key ? 'opacity-50' : ''} ${isHidden ? 'opacity-60' : ''}`}
            >
              <span className="cursor-grab active:cursor-grabbing text-secondary touch-none" aria-hidden="true" title="Drag to move"><GripVertical className="w-5 h-5" /></span>
              <span className="w-6 h-6 rounded-full bg-secondary/60 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{def.label}{isHidden && <span className="ml-2 text-[11px] text-secondary font-normal">Hidden</span>}</p>
                <p className="text-xs text-secondary truncate">{def.hint}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => move(key, i - 1)} disabled={i === 0} aria-label={`Move ${def.label} up`} className="w-9 h-9 rounded-full hover:bg-hover disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(key, i + 1)} disabled={i === order.length - 1} aria-label={`Move ${def.label} down`} className="w-9 h-9 rounded-full hover:bg-hover disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-4 h-4" /></button>
                {!def.locked && (
                  <button type="button" onClick={() => toggle(key)} aria-label={isHidden ? `Show ${def.label}` : `Hide ${def.label}`} aria-pressed={isHidden} className="w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center">
                    {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-10 rounded-full disabled:opacity-50">{busy ? 'Saving…' : 'Save layout'}</button>
        <button type="button" onClick={() => { setOrder([...DEFAULT_ORDER]); setHidden(new Set()); setMsg(null); }} className="text-sm text-secondary hover:text-primary inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Back to the original order</button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`} role="status">{msg.text}</p>}
      </div>
    </section>
  );
}
