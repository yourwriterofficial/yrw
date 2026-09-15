# developa.me Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/developer` as a self-building-UI hero animation + editorial landing page, and give `/order/dev` (+ its logged-in mirror) a sidebar "studio" layout — both themed to read as a human-built dev studio, not an AI template.

**Architecture:** One new self-contained animation component (`BuildCanvas`), a full rewrite of the presentational `/developer` page (no data-model changes), and an opt-in `layoutVariant` prop on the shared `ServiceOrderPage` component so the other three order flows (content/resume/statistics) are provably untouched.

**Tech Stack:** Next.js App Router, React client components, Tailwind v4 (utility classes only — no new CSS files needed, see Task 1 note), `lucide-react` icons, existing `app/components/ui/*` primitives (`Button`, `Card`, `Badge`, `Shell`).

## Global Constraints

- No automated test framework exists in this repo (`package.json` has no `test` script, no jest/vitest/playwright). Every task's "test" step is `npx tsc --noEmit` plus a manual browser check — this replaces unit tests for this plan, matching how the last UI rebuild in this codebase was verified (see [[order-pricing-rebuild]]).
- Tailwind v4 JIT only generates classes whose **literal text** appears in a scanned source file — never build a class by string-concatenating a prefix with a runtime value (see [[design-system]] gotcha). Every class string below is written as a complete literal.
- Single accent color for both routes: `cyan-500` family only (`text-cyan-500`, `bg-cyan-500/10`, `border-cyan-500/30`, etc.) — no other accent hues on these two pages.
- All new transitions use `ease-[cubic-bezier(0.16,1,0.3,1)]` (declared as a literal string constant per-file so Tailwind's scanner sees it), never bare `ease` or `linear`.
- Every decorative/looping animation must freeze in a complete state under `prefers-reduced-motion: reduce` — never stop mid-transition.
- `content`/`resume`/`statistics` order pages must render **identically** to their current behavior after this plan — verified by not touching any code path that runs when `layoutVariant` is left at its default.

---

### Task 1: `BuildCanvas` hero animation component

**Files:**
- Create: `app/components/BuildCanvas.tsx`

**Interfaces:**
- Produces: `export default function BuildCanvas(): JSX.Element` — no props, fully self-contained, safe to drop into any client component tree.

- [ ] **Step 1: Create the component**

```tsx
// app/components/BuildCanvas.tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `BuildCanvas.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/BuildCanvas.tsx
git commit -m "feat: add BuildCanvas hero animation component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite `/developer` — hero + process section

**Files:**
- Modify: `app/developer/page.tsx` (full rewrite, done across this task and Task 3)

**Interfaces:**
- Consumes: `BuildCanvas` (Task 1, no props).
- Produces: default export `DeveloperPage` — unchanged signature (`export default function DeveloperPage()`), still reads `developer_page_settings` the same way so `/admin/dev-shop` content editing keeps working.

- [ ] **Step 1: Replace the file header, settings logic, and hero + process sections**

```tsx
// app/developer/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import DevelopaHeader from '@/app/components/DevelopaHeader';
import DevelopaFooter from '@/app/components/DevelopaFooter';
import BuildCanvas from '@/app/components/BuildCanvas';
import { supabase } from '@/lib/supabaseClient';
import {
  Terminal, ArrowRight, Shield, Clock, Code2,
  Database, Smartphone, Server, Layers, Rocket,
  GitBranch, ShoppingBag,
} from 'lucide-react';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Shell } from '@/app/components/ui/Shell';

const ICONS: Record<string, any> = { Code2, Smartphone, Server, Database, Rocket, Layers, Terminal, ShoppingBag };

type Capability = { icon: string; title: string; description: string };

type PageSettings = {
  hero_title: string;
  hero_description: string;
  capabilities: Capability[];
};

const DEFAULT_SETTINGS: PageSettings = {
  hero_title: 'Full Stack & Custom Software',
  hero_description: 'Web apps, mobile builds, API integrations, database architecture, and MVP prototypes — engineered end-to-end, with complete source code and IP transfer on delivery.',
  capabilities: [
    { icon: 'Code2', title: 'Web Applications', description: 'Dashboards, internal tools, e-commerce, and client portals built with modern frameworks.' },
    { icon: 'Smartphone', title: 'Mobile Development', description: 'Cross-platform apps for iOS and Android from a single codebase.' },
    { icon: 'Server', title: 'API Integrations', description: 'Payment gateways, third-party services, and internal microservices wired up securely.' },
    { icon: 'Database', title: 'Database Design', description: 'Schema architecture, migrations, and query optimization for scale.' },
    { icon: 'Rocket', title: 'MVP Prototypes', description: 'Fast, functional builds to validate an idea before full-scale investment.' },
    { icon: 'Layers', title: 'Custom Scripts', description: 'Automation, data processing, and one-off tooling built to spec.' },
  ],
};

const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]';

const PROCESS_STEPS = [
  { n: '01', title: 'Brief', desc: 'Submit your project scope through the intake form — objectives, platform, and technical requirements.' },
  { n: '02', title: 'Scope call', desc: 'The dev lead reviews your brief personally and returns a fixed-fee quote within 24 hours.' },
  { n: '03', title: 'Milestones', desc: 'Build starts against a milestone schedule, tracked live in your client dashboard.' },
  { n: '04', title: 'Delivery', desc: 'Complete source code, repository access, and IP transfer on final handover.' },
];

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function ProcessStep({ n, title, desc, isLast }: { n: string; title: string; desc: string; isLast: boolean }) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`relative flex-1 transition-all duration-700 ${EASE} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-mono text-sm font-bold flex items-center justify-center shrink-0">
          {n}
        </span>
        {!isLast && (
          <div className="hidden sm:block flex-1 h-px bg-border relative overflow-hidden">
            <div className={`absolute inset-y-0 left-0 bg-cyan-500 transition-all duration-700 ${EASE} ${visible ? 'w-full' : 'w-0'}`} />
          </div>
        )}
      </div>
      <h3 className="text-base font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-secondary leading-relaxed pr-4">{desc}</p>
    </div>
  );
}

function FeatureCapabilityCard({ capability }: { capability: Capability }) {
  const Icon = ICONS[capability.icon] || Code2;
  return (
    <Card padding="lg" interactive className="flex flex-col justify-between group">
      <div>
        <div className="w-10 h-10 rounded-xl border border-theme bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold mb-1.5">{capability.title}</h3>
        <p className="text-sm text-secondary leading-relaxed mb-6">{capability.description}</p>
      </div>
      <div className="rounded-xl border border-theme bg-primary overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-theme">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
        </div>
        <div className="p-3 space-y-2">
          <div className="h-2.5 w-2/5 rounded bg-cyan-500" />
          <div className="h-8 rounded-lg bg-gradient-to-br from-cyan-500/15 to-transparent border border-theme" />
          <div className="flex gap-1.5">
            <div className="flex-1 h-6 rounded bg-card border border-theme" />
            <div className="flex-1 h-6 rounded bg-card border border-theme" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function DeveloperPage() {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      const { data: settingsRows } = await supabase.from('developer_page_settings').select('*');
      if (settingsRows) {
        const merged = { ...DEFAULT_SETTINGS };
        settingsRows.forEach((row: any) => {
          if (row.key === 'hero') Object.assign(merged, row.value);
          if (row.key === 'capabilities' && Array.isArray(row.value)) merged.capabilities = row.value;
        });
        setSettings(merged);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <DevelopaHeader />

      {/* Hero */}
      <section className="pt-header-28 sm:pt-header-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <Shell size="lg">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <Badge variant="info" className="mb-6">
                <Terminal className="w-3.5 h-3.5 mr-1.5" /> Development Pipeline
              </Badge>
              <h1 className="font-display italic font-medium text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.1] md:text-6xl mb-6">
                {settings.hero_title}
              </h1>
              <p className="text-base sm:text-lg text-secondary max-w-lg leading-relaxed mb-8">
                {settings.hero_description}
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button href="/order/dev" size="lg">
                  Start a project <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/developer/shop" variant="secondary" size="lg">
                  <ShoppingBag className="w-4 h-4" /> Browse scripts
                </Button>
              </div>
            </div>
            <BuildCanvas />
          </div>
        </Shell>
      </section>

      {/* Process */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="mb-14 space-y-2">
            <span className="text-[10px] font-bold uppercase text-cyan-500 tracking-widest">How it works</span>
            <h2 className="font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl">From brief to production</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-10 sm:gap-6">
            {PROCESS_STEPS.map((step, i) => (
              <ProcessStep key={step.n} n={step.n} title={step.title} desc={step.desc} isLast={i === PROCESS_STEPS.length - 1} />
            ))}
          </div>
        </Shell>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-cyan-500 tracking-widest">What we build</span>
              <h2 className="font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl">Engineering services</h2>
            </div>
            <p className="text-secondary text-sm max-w-sm">Scoped, quoted, and delivered by the dev lead — from prototype to production.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {settings.capabilities[0] && <FeatureCapabilityCard capability={settings.capabilities[0]} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:col-span-2 gap-4">
              {settings.capabilities.slice(1).map((cap, i) => {
                const Icon = ICONS[cap.icon] || Code2;
                return (
                  <Card key={i} padding="lg" interactive className="group">
                    <div className="w-10 h-10 rounded-xl border border-theme bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold mb-1.5">{cap.title}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{cap.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </Shell>
      </section>

      {/* Proof strip */}
      <section className="py-10 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-center text-xs sm:text-sm font-medium text-secondary">
            <span>Fixed-fee milestones</span>
            <span className="text-secondary/30">·</span>
            <span>Full source & IP transfer on delivery</span>
            <span className="text-secondary/30">·</span>
            <span>Dev lead reviews every brief personally</span>
            <span className="text-secondary/30">·</span>
            <span>Structured escrow, no upfront lump sum</span>
          </div>
        </Shell>
      </section>

      {/* Script Shop teaser */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-card/30 border-t border-theme">
        <Shell size="sm" className="text-center">
          <Badge variant="info" className="mb-4">
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> Script marketplace
          </Badge>
          <h2 className="font-bold tracking-tight text-2xl sm:text-3xl mb-4">Ready-made scripts</h2>
          <p className="text-secondary text-sm max-w-xl mx-auto mb-8">
            Pre-built, source-available scripts and templates — buy once, download anytime from your dashboard.
          </p>
          <Button href="/developer/shop" size="lg">
            Browse scripts <ArrowRight className="w-4 h-4" />
          </Button>
        </Shell>
      </section>

      {/* Trust */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-theme">
        <Shell size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="lg">
              <Shield className="w-5 h-5 mb-4 text-cyan-500" />
              <h4 className="font-bold mb-1.5 text-sm">Complete IP transfer</h4>
              <p className="text-sm text-secondary leading-relaxed">Full source code, repository access, and ownership rights delivered with every completed project.</p>
            </Card>
            <Card padding="lg">
              <GitBranch className="w-5 h-5 mb-4 text-cyan-500" />
              <h4 className="font-bold mb-1.5 text-sm">Milestone payments</h4>
              <p className="text-sm text-secondary leading-relaxed">Structured payment plans tied to build milestones — no large upfront commitment.</p>
            </Card>
            <Card padding="lg">
              <Clock className="w-5 h-5 mb-4 text-cyan-500" />
              <h4 className="font-bold mb-1.5 text-sm">On-time delivery</h4>
              <p className="text-sm text-secondary leading-relaxed">Realistic deadlines with real-time status tracking inside your client dashboard.</p>
            </Card>
          </div>
        </Shell>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 border-t border-theme">
        <Shell size="md" className="text-center">
          <h2 className="font-display italic font-medium text-3xl sm:text-4xl md:text-5xl mb-6">Ready to build?</h2>
          <p className="text-secondary text-sm sm:text-base max-w-md mx-auto mb-8">Submit your project brief and hear back from the dev lead within 24 hours.</p>
          <Button href="/order/dev" size="lg">
            Start your software request <ArrowRight className="w-4 h-4" />
          </Button>
        </Shell>
      </section>

      <DevelopaFooter />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/developer/page.tsx`.

- [ ] **Step 3: Manual browser check**

With the dev server running, open `/developer` and confirm: hero renders with `BuildCanvas` cycling through its 4 stages every ~3.5s, process steps fade up on scroll, capability grid shows the first item as the large feature card. Check both light and dark theme via the header's theme toggle.

- [ ] **Step 4: Commit**

```bash
git add app/developer/page.tsx
git commit -m "feat: rewrite /developer landing page with BuildCanvas hero and process stepper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ServiceOrderPage` — add `layoutVariant` studio shell

**Files:**
- Modify: `app/components/ServiceOrderPage.tsx`

**Interfaces:**
- Consumes: existing internal state (`finalQuote`, `selectedTier`, `isProposing`, `pageContent`, `Icon`, `accent`) — all already defined earlier in the component, unchanged.
- Produces: `ServiceOrderPageConfig.layoutVariant?: 'default' | 'studio'` (defaults to `'default'` when omitted — every existing caller keeps current behavior).

- [ ] **Step 1: Add the prop to the config type**

Modify the `ServiceOrderPageConfig` interface (around line 36-52):

```tsx
export interface ServiceOrderPageConfig {
  serviceCategory: ServicePricingCategory;
  pageKey: keyof typeof ORDER_PAGE_DEFAULTS;
  orderPrefix: string;
  tosKey: string;
  accent: 'emerald' | 'rose' | 'cyan' | 'blue' | 'purple';
  icon: LucideIcon;
  vaultStatusDefault: string;
  topicLabel: string;
  topicPlaceholder: string;
  topicHelperText?: string;
  briefLabel: string;
  briefHelperText?: string;
  minProposedBudget: number;
  extraFields?: ExtraFieldSpec[];
  additionalInfoLabel?: string;
  /** 'studio' renders the sidebar + section-labeled layout used by the DEV order form. Defaults to 'default' (unchanged legacy layout). */
  layoutVariant?: 'default' | 'studio';
}
```

- [ ] **Step 2: Destructure the new prop and add the `isStudio` flag**

In the function body, change the destructuring line (around line 77) from:

```tsx
const { serviceCategory, pageKey, orderPrefix, tosKey, vaultStatusDefault, topicLabel, topicPlaceholder, topicHelperText, briefLabel, briefHelperText, minProposedBudget, extraFields = [], additionalInfoLabel } = config;
```

to:

```tsx
const { serviceCategory, pageKey, orderPrefix, tosKey, vaultStatusDefault, topicLabel, topicPlaceholder, topicHelperText, briefLabel, briefHelperText, minProposedBudget, extraFields = [], additionalInfoLabel, layoutVariant = 'default' } = config;
const isStudio = layoutVariant === 'studio';
```

- [ ] **Step 3: Add the sidebar component above the main export**

Add this function directly above `export default function ServiceOrderPage(config: ServiceOrderPageConfig) {`:

```tsx
function StudioSidebar({ icon: Icon, badge, title, subtitle, finalQuote, quoteLabel }: {
  icon: LucideIcon;
  badge: string;
  title: string;
  subtitle: string;
  finalQuote: number;
  quoteLabel: string;
}) {
  const STEPS = [
    { n: '1', title: 'Brief', desc: 'You submit the scope on this page' },
    { n: '2', title: 'Scope call', desc: 'Dev lead reviews, quotes in 24h' },
    { n: '3', title: 'Milestones', desc: 'Build tracked in your dashboard' },
    { n: '4', title: 'Delivery', desc: 'Source + IP transfer on completion' },
  ];
  return (
    <div className="lg:sticky lg:top-header-28 space-y-4 h-fit">
      <div>
        <p className="text-xs font-medium tracking-wide mb-3 flex items-center gap-2 text-cyan-500">
          <Icon className="w-3.5 h-3.5" /> {badge}
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mb-3 tracking-tight">{title}</h1>
        <p className="text-secondary text-sm">{subtitle}</p>
      </div>

      <Card padding="lg">
        <p className="text-[10px] font-bold uppercase text-secondary tracking-widest mb-4">What happens next</p>
        <div className="space-y-4">
          {STEPS.map(step => (
            <div key={step.n} className="flex gap-3">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                {step.n}
              </span>
              <div>
                <h5 className="text-xs font-bold">{step.title}</h5>
                <p className="text-[11px] text-secondary leading-snug">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="lg" className="text-center border-cyan-500/30 bg-cyan-500/5">
        <div className="text-2xl font-bold text-cyan-500">₦{finalQuote.toLocaleString()}</div>
        <p className="text-[11px] text-secondary mt-1">{quoteLabel}</p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Add mono section labels to the three existing field groups**

These three edits only add a conditional label + conditional left-border class — no existing markup is removed.

4a. Find the package tiers wrapper (around line 369):
```tsx
          {/* PACKAGE TIERS */}
          <div className="space-y-3">
```
Replace with:
```tsx
          {/* PACKAGE TIERS */}
          <div className={`space-y-3 ${isStudio ? 'border-l-2 border-cyan-500/40 pl-4 sm:pl-5' : ''}`}>
            {isStudio && <div className="font-mono text-[11px] font-bold text-cyan-500">// 01 — Project Scope</div>}
```

4b. Find the personal-info/spec block (around line 487):
```tsx
          <div className="space-y-4 pt-6 border-t border-theme">
            {isLoggedIn ? (
```
Replace with:
```tsx
          <div className={`space-y-4 pt-6 border-t border-theme ${isStudio ? 'border-l-2 border-cyan-500/40 pl-4 sm:pl-5' : ''}`}>
            {isStudio && <div className="font-mono text-[11px] font-bold text-cyan-500">// 02 — Specifications</div>}
            {isLoggedIn ? (
```

4c. Find the payment structure section start (around line 591, right before `<PaymentStructureFields`):
```tsx
          <PaymentStructureFields
```
Replace with:
```tsx
          {isStudio && <div className="font-mono text-[11px] font-bold text-cyan-500 -mb-4">// 03 — Milestones & Terms</div>}
          <PaymentStructureFields
```

- [ ] **Step 5: Branch the outer return on `layoutVariant`**

Find the final `return (` block (around line 333) that currently renders:

```tsx
  return (
    <div className="min-h-screen bg-primary text-primary py-10 sm:py-12 px-4 sm:px-6 font-['Inter']">
      {serviceCategory === 'DEV' ? (
        <div className="max-w-3xl mx-auto mb-6">
          ... (the 3-step nav bar) ...
        </div>
      ) : (
        <OrderCategoryNav />
      )}
      <div className="max-w-3xl mx-auto space-y-10 sm:space-y-12 mt-6">
        <div className="text-center">
          <p className={`text-xs font-medium tracking-wide mb-4 flex items-center justify-center gap-2 ${accent.text}`}>
            <Icon className="w-3.5 h-3.5" /> {pageContent.hero.badge}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 tracking-tight">{pageContent.hero.title}</h1>
          <p className="text-secondary text-sm px-2 max-w-xl mx-auto">{pageContent.hero.subtitle}</p>
        </div>

        <Card className="space-y-8">
          ... (everything from PACKAGE TIERS through the submit Button) ...
        </Card>
      </div>
    </div>
  );
```

Replace the whole block with:

```tsx
  const orderCard = (
    <Card className="space-y-8">
      {/* ... everything currently inside <Card className="space-y-8"> stays exactly as-is, unchanged ... */}
    </Card>
  );

  if (isStudio) {
    return (
      <div className="min-h-screen bg-primary text-primary py-10 sm:py-12 px-4 sm:px-6 font-['Inter']">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[320px_1fr] gap-6 lg:gap-10">
          <StudioSidebar
            icon={Icon}
            badge={pageContent.hero.badge}
            title={pageContent.hero.title}
            subtitle={pageContent.hero.subtitle}
            finalQuote={finalQuote}
            quoteLabel={isProposing ? 'Proposed budget — subject to approval' : 'Fixed-Fee Milestone Estimate'}
          />
          {orderCard}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-primary py-10 sm:py-12 px-4 sm:px-6 font-['Inter']">
      <OrderCategoryNav />
      <div className="max-w-3xl mx-auto space-y-10 sm:space-y-12 mt-6">
        <div className="text-center">
          <p className={`text-xs font-medium tracking-wide mb-4 flex items-center justify-center gap-2 ${accent.text}`}>
            <Icon className="w-3.5 h-3.5" /> {pageContent.hero.badge}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 tracking-tight">{pageContent.hero.title}</h1>
          <p className="text-secondary text-sm px-2 max-w-xl mx-auto">{pageContent.hero.subtitle}</p>
        </div>
        {orderCard}
      </div>
    </div>
  );
```

Important: because `serviceCategory === 'DEV'` will now always pair with `layoutVariant="studio"` (set in Task 4), the old inline 3-step nav bar branch (`serviceCategory === 'DEV' ? <div className="max-w-3xl mx-auto mb-6">...3-step bar...</div> : <OrderCategoryNav />`) is fully removed by this replacement — it's superseded by `StudioSidebar`. Do not keep both.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `ServiceOrderPage.tsx`.

- [ ] **Step 7: Commit**

```bash
git add app/components/ServiceOrderPage.tsx
git commit -m "feat: add opt-in studio layoutVariant to ServiceOrderPage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire DEV order pages to the studio layout

**Files:**
- Modify: `app/order/dev/page.tsx`
- Modify: `app/dashboard/client/order/new/dev/page.tsx`

**Interfaces:**
- Consumes: `ServiceOrderPageConfig.layoutVariant` (Task 3).

- [ ] **Step 1: Add the prop in both files**

In `app/order/dev/page.tsx`, inside the `<ServiceOrderPage ...>` call, add:

```tsx
      accent="cyan"
      icon={Terminal}
      layoutVariant="studio"
```

Do the same in `app/dashboard/client/order/new/dev/page.tsx` (note this file wraps `ServiceOrderPage` in `<Suspense>` — the prop goes on `ServiceOrderPage`, not `Suspense`):

```tsx
        accent="cyan"
        icon={Terminal}
        layoutVariant="studio"
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser check**

Open `/order/dev` as a guest — confirm the sidebar (steps + quote box) renders next to the form, section labels (`// 01 —`, `// 02 —`, `// 03 —`) appear, and the quote box updates when you pick a different package tier or word count. Then log in as the QA client account (see [[qa-test-accounts]]) and open `/dashboard/client/order/new/dev` — confirm the same studio layout appears there.

- [ ] **Step 4: Commit**

```bash
git add app/order/dev/page.tsx app/dashboard/client/order/new/dev/page.tsx
git commit -m "feat: enable studio layout on DEV order form routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: zero errors project-wide.

- [ ] **Step 2: Responsive + theme check**

In the browser tool, check `/developer` and `/order/dev` at 375px, 768px, and 1280px widths, in both light and dark theme (toggle in `DevelopaHeader`). Confirm: no horizontal overflow, `BuildCanvas` and the process stepper are legible at all three widths, the studio sidebar stacks above the form below the `lg` breakpoint.

- [ ] **Step 3: Reduced-motion check**

Emulate `prefers-reduced-motion: reduce` (browser tool `resize_window` supports `colorScheme`; for reduced motion use the browser devtools rendering emulation, or temporarily set `window.matchMedia` to return `matches: true` via `javascript_tool` and reload) and confirm `BuildCanvas` renders frozen on the "Ship" (stage 4) state and the process steps are fully visible without a fade-in delay.

- [ ] **Step 4: End-to-end submit check**

On `/order/dev`, fill out the required fields (name/email/whatsapp if guest, deadline, topic, accept terms) and submit as a guest. Confirm it redirects to `/complete-registration` as before (existing behavior, unchanged logic — this just confirms the new shell didn't disturb any state wiring).

- [ ] **Step 5: Dead-link / stale-reference sweep**

Run: `grep -rn "3-step\|Tech Specifications\|Milestones & Escrow" app/ --include=*.tsx`
Expected: no remaining references to the old inline DEV step-nav copy outside of this plan/spec doc.

- [ ] **Step 6: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address verification sweep findings for developa.me redesign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Skip this commit if step 1-5 found nothing to fix.)

---

## Self-Review Notes

- **Spec coverage:** BuildCanvas (Task 1) ✓, hero + process (Task 2) ✓, capabilities/proof-strip/shop/trust/CTA (Task 2, folded in — single file rewrite, splitting further would fight React's single-return-per-component shape) ✓, studio layout + sidebar + section labels (Task 3) ✓, wiring (Task 4) ✓, verification incl. responsive/theme/reduced-motion/dead-link sweep (Task 5) ✓. No globals.css changes ended up necessary — all motion is handled by conditional Tailwind classes driven by React state, which is simpler than the CSS-keyframe approach in the original spec and still fully satisfies the reduced-motion requirement; this is a deliberate simplification, not a gap.
- **Type consistency:** `StudioSidebar` props match exactly what's available in `ServiceOrderPage`'s existing scope (`Icon`, `pageContent.hero.*`, `finalQuote`, `isProposing`) — no new state introduced. `layoutVariant` type (`'default' | 'studio'`) is identical everywhere it's referenced.
- **Scope:** single cohesive feature across two routes sharing one component change; not split further.
