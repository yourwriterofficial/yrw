'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, ShoppingBag, MessageCircle, Zap } from 'lucide-react';

/** Animation styles for the Developa home page. Everything stops when the visitor prefers reduced motion. */
export function HomeStyles() {
  return (
    <style>{`
      .dv-theme { --dv-a: #8b5cf6; --dv-b: #ec4899; --dv-c: #f59e0b;
        --bg-primary: #0a0714; --bg-secondary: #100b1e; --bg-card: #150f28; --bg-elevated: #1c1433; --bg-input: #0e0a1c;
        --border: #2a2045; --border-strong: #3b2f60; --text-primary: #f5f1ff; --text-secondary: #a79fc2;
        --accent: #a78bfa; --accent-hover: #c4b5fd; --accent-foreground: #140a2e; }
      [data-theme="light"] .dv-theme { --dv-a: #6d28d9; --dv-b: #db2777; --dv-c: #ea580c;
        --bg-primary: #fbf8ff; --bg-secondary: #ffffff; --bg-card: #ffffff; --bg-elevated: #ffffff; --bg-input: #f6f1ff;
        --border: #e7def7; --border-strong: #d6c8f0; --text-primary: #1a1030; --text-secondary: #5f5580;
        --accent: #6d28d9; --accent-hover: #5b21b6; --accent-foreground: #ffffff; }
      @keyframes dv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
      @keyframes dv-drift { 0% { transform: translate(0,0) scale(1) } 50% { transform: translate(24px,-18px) scale(1.08) } 100% { transform: translate(0,0) scale(1) } }
      @keyframes dv-pop { 0% { opacity: 0; transform: translateY(10px) scale(.96) } 100% { opacity: 1; transform: none } }
      @keyframes dv-word { 0% { opacity: 0; transform: translateY(.45em) } 8%,90% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-.45em) } }
      @keyframes dv-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      @keyframes dv-shine { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
      @keyframes dv-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent) } 100% { box-shadow: 0 0 0 16px transparent } }
      .dv-blob { position: absolute; border-radius: 999px; -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 68%); mask-image: radial-gradient(circle, #000 0%, transparent 68%); opacity: .5; pointer-events: none; will-change: transform; animation: dv-drift 14s ease-in-out infinite; }
      .dv-grad-text { background: linear-gradient(90deg, var(--dv-a), var(--dv-b), var(--dv-c), var(--dv-a)); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: dv-shine 6s linear infinite; }
      .dv-reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1); transition-delay: var(--d, 0ms); }
      .dv-reveal.in { opacity: 1; transform: none; }
      .dv-lift { transition: transform .25s ease, box-shadow .25s ease; }
      .dv-lift:hover { transform: translateY(-4px); box-shadow: 0 16px 40px -18px color-mix(in srgb, var(--accent) 55%, transparent); }
      .dv-cta { animation: dv-pulse 2.4s ease-out infinite; }
      .dv-marquee { display: flex; width: max-content; animation: dv-marquee 34s linear infinite; }
      .dv-marquee:hover { animation-play-state: paused; }
      @media (prefers-reduced-motion: reduce) {
        .dv-blob, .dv-grad-text, .dv-cta, .dv-marquee, .dv-float, .dv-word, .dv-pop { animation: none !important; }
        .dv-reveal { opacity: 1; transform: none; transition: none; }
      }
    `}</style>
  );
}

/** Fades and lifts its content into view the first time it is scrolled to. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setTimeout(() => setShown(true), 0); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`dv-reveal ${shown ? 'in' : ''} ${className}`} style={{ ['--d' as string]: `${delay}ms` }}>{children}</div>;
}

/** Cycles through the kinds of site people build. */
export function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [words.length]);
  // First word is visible straight away; only later words animate in.
  return <span className="block min-h-[1.2em]"><span key={i} className="dv-grad-text inline-block" style={i === 0 ? undefined : { animation: 'dv-word 2.6s ease both' }}>{words[i]}</span></span>;
}

/** Soft moving colour behind the hero. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="dv-blob" style={{ width: 340, height: 340, left: '-90px', top: '-60px', background: 'var(--dv-a)' }} />
      <div className="dv-blob" style={{ width: 300, height: 300, right: '-80px', top: '120px', background: 'var(--dv-b)', animationDelay: '-4s' }} />
      <div className="dv-blob" style={{ width: 260, height: 260, left: '35%', bottom: '-120px', background: 'var(--dv-c)', animationDelay: '-8s' }} />
    </div>
  );
}

/** A small phone showing a store being built. Pure CSS, no images. */
export function PhoneMockup() {
  const items = [
    { n: 'Ankara tote', p: '₦12,500', c: '#f59e0b' },
    { n: 'Beaded set', p: '₦8,000', c: '#ec4899' },
    { n: 'Linen shirt', p: '₦15,000', c: '#10b981' },
    { n: 'Leather belt', p: '₦6,500', c: '#6366f1' },
  ];
  return (
    <div className="dv-float relative mx-auto w-[220px] sm:w-[250px]" style={{ animation: 'dv-float 6s ease-in-out infinite' }} aria-hidden>
      <div className="rounded-[2.2rem] border-[6px] border-[var(--border)] bg-card shadow-2xl overflow-hidden">
        <div className="h-5 flex justify-center items-end"><span className="w-14 h-1.5 rounded-full bg-[var(--border)]" /></div>
        <div className="px-3 pb-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold">Ada&apos;s Store</span>
            <span className="relative"><ShoppingBag className="w-4 h-4" /><span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-[8px] text-white flex items-center justify-center">2</span></span>
          </div>
          <div className="mt-2 rounded-xl h-16 flex items-center px-3 text-white text-[11px] font-semibold" style={{ background: 'linear-gradient(120deg, var(--dv-a), var(--dv-b))' }}>New in this week</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {items.map((it, k) => (
              <div key={it.n} className="rounded-lg border border-theme p-1.5" style={{ animation: `dv-pop .6s ease ${0.3 + k * 0.18}s both` }}>
                <div className="h-14 rounded-md" style={{ background: `${it.c}33` }} />
                <p className="text-[9px] font-medium mt-1 truncate">{it.n}</p>
                <p className="text-[9px] text-secondary">{it.p}</p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold text-center py-1.5">Pay online</div>
        </div>
      </div>
      <div className="absolute -left-6 top-44 rounded-xl bg-card border border-theme shadow-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-medium" style={{ animation: 'dv-pop .6s ease 1.4s both' }}>
        <Zap className="w-3 h-3 text-[var(--accent)]" /> Order paid
      </div>
      <div className="absolute -right-5 bottom-16 rounded-xl bg-card border border-theme shadow-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-medium" style={{ animation: 'dv-pop .6s ease 1.9s both' }}>
        <MessageCircle className="w-3 h-3 text-emerald-500" /> WhatsApp order
      </div>
    </div>
  );
}

/** Looping strip of what every site includes. */
export function FeatureMarquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden py-4 border-y border-theme" aria-hidden>
      <div className="dv-marquee gap-3">
        {row.map((t, i) => (
          <span key={i} className="shrink-0 mx-1.5 px-4 py-1.5 rounded-full g-tonal-strong text-xs sm:text-sm font-medium whitespace-nowrap">{t}</span>
        ))}
      </div>
    </div>
  );
}

/** The clear call to action that sits between the themes and the sign-up form. Built for phones first. */
export function SignupBanner({ trialDays, onStart }: { trialDays: number; onStart: () => void }) {
  const points = ['Free to start, no card needed', `${trialDays} days of Pro to try everything`, 'Live on your own yourname.developa.me address'];
  return (
    <section className="g-wrap pb-10 sm:pb-14">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl px-5 py-8 sm:px-12 sm:py-12 text-white text-center sm:text-left" style={{ background: 'linear-gradient(135deg, var(--dv-a), var(--dv-b) 70%, var(--dv-c))' }}>
          <div aria-hidden className="dv-blob" style={{ width: 220, height: 220, right: -60, top: -60, background: '#fff', opacity: 0.18 }} />
          <div className="relative sm:flex sm:items-center sm:justify-between sm:gap-10">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Join in under 2 minutes</p>
              <h2 className="text-2xl sm:text-4xl font-semibold leading-tight mt-2">Your online store, live today.</h2>
              <ul className="mt-5 space-y-2.5 text-sm sm:text-base text-left inline-block sm:block">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5"><span className="mt-0.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Check className="w-3 h-3" /></span><span>{p}</span></li>
                ))}
              </ul>
            </div>
            <div className="mt-7 sm:mt-0 sm:shrink-0">
              <button type="button" onClick={onStart} className="dv-cta w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white text-[var(--dv-a)] font-semibold text-base px-8 py-4 hover:bg-white/90 transition">
                Create my free site <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-white/75 mt-3">Upgrade or cancel any time. Pay monthly.</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** A slim bar fixed to the bottom of phone screens until the sign-up form comes into view. */
export function StickySignupBar({ onStart, trialDays }: { onStart: () => void; trialDays: number }) {
  const [hide, setHide] = useState(false);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const target = document.getElementById('start');
    const onScroll = () => setPast(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    if (!target || typeof IntersectionObserver === 'undefined') return () => window.removeEventListener('scroll', onScroll);
    const io = new IntersectionObserver((e) => setHide(e.some((x) => x.isIntersecting)), { threshold: 0.15 });
    io.observe(target);
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect(); };
  }, []);
  const visible = past && !hide;
  return (
    <div className={`sm:hidden fixed left-0 right-[4.75rem] bottom-0 z-40 pl-3 pb-3 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`} style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <button type="button" onClick={onStart} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-[var(--accent)] text-white px-4 py-3 shadow-xl">
        <span className="text-left"><span className="block text-sm font-semibold">Create your free site</span><span className="block text-[11px] text-white/80">{trialDays} days of Pro free</span></span>
        <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></span>
      </button>
    </div>
  );
}
