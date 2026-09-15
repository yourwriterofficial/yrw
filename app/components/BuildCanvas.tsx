'use client';

import { useEffect, useRef, useState } from 'react';

type Stage = { tag: string; ticker: string };

const STAGES: Stage[] = [
  { tag: 'wireframe.sketch', ticker: 'git init project-brief' },
  { tag: 'structure.html', ticker: 'npm install @developa/scaffold' },
  { tag: 'ui.css', ticker: 'tailwind build --minify' },
  { tag: 'deployed', ticker: 'vercel deploy --prod' },
];

const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]';

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
  const wireframe = stage === 0;
  const structure = stage === 1;
  const styled = stage >= 2;
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

        <div className="relative h-64 p-5 overflow-hidden">
          <div
            className={`absolute top-3 right-3 text-[10px] font-bold bg-emerald-500 text-black rounded-full px-2.5 py-1 transition-all duration-500 ${EASE} ${
              shipped ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            Deployed ✓
          </div>

          <div
            className={`h-4 rounded mb-5 transition-all duration-500 ${EASE} ${
              wireframe ? 'w-2/3 border border-dashed border-strong bg-transparent'
                : structure ? 'w-2/3 bg-border'
                : 'w-2/5 bg-cyan-500'
            }`}
          />

          <div
            className={`h-16 rounded-lg mb-4 transition-all duration-500 ${EASE} ${
              wireframe ? 'border border-dashed border-strong bg-transparent'
                : structure ? 'bg-border'
                : 'bg-gradient-to-br from-cyan-500/15 to-transparent border border-theme'
            }`}
          />

          <div className="flex gap-2.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`flex-1 h-[70px] rounded-lg transition-all duration-500 ${EASE} ${
                  wireframe ? 'border border-dashed border-strong bg-transparent'
                    : structure ? 'bg-border'
                    : 'bg-primary border border-theme'
                }`}
              >
                {styled && <div className="w-4 h-4 rounded bg-cyan-500/20 m-3" />}
              </div>
            ))}
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
            className={`h-1.5 rounded-full transition-all duration-300 ${i === stage ? 'w-5 bg-cyan-500' : 'w-1.5 bg-border'}`}
          />
        ))}
      </div>
    </div>
  );
}
