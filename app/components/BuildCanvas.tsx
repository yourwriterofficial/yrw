'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal, ArrowRight, ShoppingBag } from 'lucide-react';

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
  // Three-tier progressive-enhancement narrative, matching the corner tag at
  // each stage: raw content (wireframe.sketch) -> unstyled semantic HTML
  // (structure.html) -> real CSS applied (ui.css / deployed). Real copy is
  // always on screen at every stage -- only its styling changes -- so there
  // is never a blank/placeholder frame.
  const structured = stage === 1;
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

        <div className="relative h-64 p-6 overflow-hidden flex flex-col justify-center gap-3">
          <div
            className={`absolute top-3 right-3 text-[10px] font-bold bg-emerald-500 text-black rounded-full px-2.5 py-1 transition-all duration-500 ${EASE} ${
              shipped ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            Deployed ✓
          </div>

          {/* badge — real copy at every stage, styling progresses raw -> unstyled HTML -> real CSS */}
          {styled ? (
            <div className="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold text-cyan-500 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2.5 py-1 transition-all duration-500">
              <Terminal className="w-2.5 h-2.5" /> Development Pipeline
            </div>
          ) : structured ? (
            <span className="inline-flex w-fit items-center text-xs font-bold border border-strong px-2 py-1 transition-all duration-500">
              Development Pipeline
            </span>
          ) : (
            <span className="inline-flex w-fit items-center text-[11px] font-mono text-secondary/70 border-b border-dashed border-strong pb-0.5 transition-all duration-500">
              Development Pipeline
            </span>
          )}

          {/* headline — same text throughout, matching the actual h1 next to it once styled */}
          {styled ? (
            <h3 className="font-display italic font-semibold text-lg leading-snug transition-all duration-500">
              Full Stack &amp; <span className="text-cyan-500">Custom Software</span>
            </h3>
          ) : structured ? (
            <h3 className="font-bold text-xl leading-snug transition-all duration-500">
              Full Stack &amp; Custom Software
            </h3>
          ) : (
            <h3 className="font-mono text-sm text-secondary/70 leading-snug transition-all duration-500">
              Full Stack &amp; Custom Software
            </h3>
          )}

          {/* subhead — real paragraph excerpt at every stage */}
          {styled ? (
            <p className="text-[11px] text-secondary leading-relaxed line-clamp-2 transition-all duration-500">
              Web apps, mobile builds, API integrations, and MVP prototypes — engineered end-to-end.
            </p>
          ) : structured ? (
            <p className="text-xs leading-relaxed line-clamp-2 transition-all duration-500">
              Web apps, mobile builds, API integrations, and MVP prototypes — engineered end-to-end.
            </p>
          ) : (
            <p className="text-[11px] font-mono text-secondary/70 leading-relaxed line-clamp-2 transition-all duration-500">
              Web apps, mobile builds, API integrations, and MVP prototypes — engineered end-to-end.
            </p>
          )}

          {/* the two real CTAs: Start a project + Browse scripts, styling progresses each stage */}
          {styled ? (
            <div className="flex gap-2 pt-1">
              <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-cyan-500 text-black rounded-full px-3 py-1.5 transition-all duration-500">
                Start a project <ArrowRight className="w-2.5 h-2.5" />
              </div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold border border-strong rounded-full px-3 py-1.5 transition-all duration-500">
                <ShoppingBag className="w-2.5 h-2.5" /> Browse scripts
              </div>
            </div>
          ) : structured ? (
            <div className="flex gap-2 pt-1">
              <span className="text-xs font-bold border border-strong px-3 py-1.5 transition-all duration-500">Start a project</span>
              <span className="text-xs font-bold border border-strong px-3 py-1.5 transition-all duration-500">Browse scripts</span>
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              <span className="text-[11px] font-mono text-secondary/70 underline decoration-dashed underline-offset-2 transition-all duration-500">Start a project</span>
              <span className="text-[11px] font-mono text-secondary/70 underline decoration-dashed underline-offset-2 transition-all duration-500">Browse scripts</span>
            </div>
          )}
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
