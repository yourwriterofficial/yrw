'use client';

import { useEffect, useRef, useState } from 'react';

type Stage = { tag: string; ticker: string };

const STAGES: Stage[] = [
  { tag: 'StatCard.tsx', ticker: 'git init project-brief' },
  { tag: 'StatCard.tsx', ticker: 'npm install @developa/scaffold' },
  { tag: 'styles.css', ticker: 'tailwind build --minify' },
  { tag: 'deployed', ticker: 'vercel deploy --prod' },
];

const BARS = [0.5, 0.9, 0.65, 1, 0.75];

export default function BuildCanvas() {
  const [stage, setStage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setStage(STAGES.length - 1);
      return;
    }

    timerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setStage(s => (s + 1) % STAGES.length);
    }, 3500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const current = STAGES[stage];
  const shipped = stage === 3;

  return (
    <div aria-hidden="true" className="select-none">
      <div className="bg-card border border-theme rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-theme">
          <span className="w-2 h-2 rounded-full bg-secondary/40" />
          <span className="w-2 h-2 rounded-full bg-secondary/40" />
          <span className="w-2 h-2 rounded-full bg-secondary/40" />
          <span className="ml-2 text-[10px] font-mono text-secondary bg-primary border border-theme rounded px-2 py-0.5 flex-1 truncate">
            developa.me/preview
          </span>
          <span className="text-[10px] font-mono text-cyan-500 bg-cyan-500/10 rounded px-2 py-0.5 whitespace-nowrap">
            {current.tag}
          </span>
        </div>

        <div className="relative p-5 space-y-4 overflow-hidden">
          <div
            className={`absolute top-3 right-3 z-10 text-[10px] font-bold bg-emerald-500 text-black rounded-full px-2.5 py-1 transition-all duration-500 ${
              shipped ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            Deployed ✓
          </div>

          {/* A real, generic code snippet — always fully rendered, never a placeholder */}
          <div className="rounded-lg bg-primary border border-theme p-3.5 font-mono text-[11px] leading-relaxed overflow-hidden">
            <div><span className="text-purple-400">export function</span> <span className="text-cyan-500">StatCard</span>({'{'} <span className="text-amber-500">label, value</span> {'}'}) {'{'}</div>
            <div className="pl-3"><span className="text-purple-400">return</span> (</div>
            <div className="pl-6">&lt;<span className="text-cyan-500">div</span> <span className="text-emerald-400">className</span>=<span className="text-amber-500">"card"</span>&gt;</div>
            <div className="pl-9">&lt;<span className="text-cyan-500">span</span>&gt;{'{label}'}&lt;/<span className="text-cyan-500">span</span>&gt;</div>
            <div className="pl-9">&lt;<span className="text-cyan-500">h3</span>&gt;{'{value}'}&lt;/<span className="text-cyan-500">h3</span>&gt;</div>
            <div className="pl-6">&lt;/<span className="text-cyan-500">div</span>&gt;</div>
            <div className="pl-3">)</div>
            <div>{'}'} <span className="inline-block w-1.5 h-3 -mb-0.5 bg-cyan-500 animate-pulse" /></div>
          </div>

          {/* The live rendered output of that component — a small stat card with an animated chart */}
          <div className="rounded-lg border border-theme p-3.5 flex items-center gap-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-secondary">Revenue</div>
              <div className="text-lg font-bold text-cyan-500">$48.2k</div>
            </div>
            <div className="flex items-end gap-1.5 h-10 flex-1 justify-end">
              {BARS.map((h, i) => (
                <div key={i} className="w-2.5 rounded-t bg-cyan-500/20 overflow-hidden flex items-end" style={{ height: '100%' }}>
                  <div
                    className="w-full rounded-t bg-cyan-500 animate-bar-pulse"
                    style={{ height: `${h * 100}%`, animationDelay: `${i * 180}ms` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3.5 font-mono text-xs text-secondary h-4 pl-1">
        <span className="text-cyan-500">$</span> {current.ticker}
      </div>

      <div className="flex gap-1.5 justify-center mt-4">
        {STAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            onClick={() => setStage(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === stage ? 'w-5 bg-cyan-500' : 'w-1.5 bg-theme'}`}
          />
        ))}
      </div>
    </div>
  );
}
