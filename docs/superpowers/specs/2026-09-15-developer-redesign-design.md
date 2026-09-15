# developa.me Redesign: `/developer` Landing + `/order/dev` Order Form

**Status:** Approved 2026-09-15. Ready for implementation planning.

## Goal

Redesign `/developer` and `/order/dev` (plus the logged-in mirror `/dashboard/client/order/new/dev`) so they read as a premium, human-built software studio rather than an AI-generated template — while making the "we build software" pitch tangible through a live build animation, tempting the viewer to start a project.

## Design Philosophy

- **Theme-aware, not hardcoded dark.** `DevelopaHeader` already ships a working light/dark `ThemeToggle`; the redesign uses the site's existing CSS custom properties (`bg-primary`, `bg-card`, `border-theme`, `text-primary`/`text-secondary`) so both themes stay correct, instead of hardcoding a fixed `#050505` dark palette.
- **Deliberate departure from the sitewide "Bold SaaS Gradient" look** ([[design-system]]) for these two routes only: no gradient blobs, no glass-panel glow spam, no vague copy. Single `cyan-500` accent (already the DEV brand color sitewide), heavy editorial type contrast, generous whitespace.
- **No terminal-typing effect.** It was in the original plan but is now one of the most common AI-generated-dev-portfolio clichés — the opposite of the brief. The animated centerpiece instead visually *builds a UI*, which is a more literal and more original answer to "animated process of creating a website."
- **A-grade execution bar** (this is what separates "looks fine" from "impressive"):
  - Consistent 8px spacing rhythm; type scale capped to a small number of sizes reused everywhere (no ad-hoc font sizes).
  - All transitions use an eased curve (`cubic-bezier(0.16, 1, 0.3, 1)` — "ease-out-expo" family), never linear or default `ease`.
  - Every interactive element (buttons, tier cards, dots, links) gets a real hover *and* focus-visible state — not just `:hover`, since keyboard/AT users need parity.
  - Decorative animation (`BuildCanvas`) is `aria-hidden="true"`; it communicates nothing screen-reader users need that isn't already in the surrounding text.
  - Verify contrast of `text-secondary` on `bg-card` in both themes meets WCAG AA (4.5:1 body text) — adjust the token usage (not the design) if a specific combination fails.
  - `prefers-reduced-motion`: all keyframe/interval-driven motion freezes on the final "Ship" state instead of stopping mid-cycle.

## `/developer` — Landing Page (full rewrite of `app/developer/page.tsx`)

### Hero
Two-column layout (stacks on mobile, canvas below text).

- **Left:** existing `Badge` ("Development Pipeline"), display-italic headline (`font-display italic`, matches current convention), one concrete sub-paragraph (no filler), two CTAs: `Start a project` (primary, links `/order/dev`) and `Browse scripts` (secondary, links `/developer/shop`).
- **Right: `BuildCanvas`** — new component, `app/components/BuildCanvas.tsx`. A browser-chrome card (traffic-light dots + fake address bar `developa.me/preview` + a corner tag) whose body cycles through 4 stages on a ~3.5s interval:
  1. **Brief** — dashed-outline wireframe blocks (nav/hero/3 cards). Tag: `wireframe.sketch`.
  2. **Structure** — blocks solidify to flat gray fills. Tag: `structure.html`.
  3. **Style** — cyan-tinted nav/hero, card icons appear, real-looking button. Tag: `ui.css`.
  4. **Ship** — a small "Deployed ✓" pill slides in top-right. Tag: `deployed`.
  - A single-line `font-mono` code ticker beneath the card crossfades a short snippet per stage (e.g. `git init project-brief` → `npm install @developa/scaffold` → `tailwind build --minify` → `vercel deploy --prod`).
  - 4 progress dots below, clickable to jump stages directly (also gives the component a non-decorative interactive affordance for anyone who *does* want to inspect it, while the whole region stays `aria-hidden` for AT since it's redundant with the surrounding copy).
  - Implementation: local `useState` stage index + `useEffect`/`setInterval`, CSS transitions on class change — no animation library. Interval pauses on `prefers-reduced-motion` and on the tab being backgrounded (`document.visibilityState`).

### Process — "How it works"
4-step stepper (Brief → Scope call → Milestones → Delivery), horizontal on desktop / stacked on mobile. `IntersectionObserver` fade-up per step; the connecting line between steps animates its width/scale as it enters view (echoes the hero's "building" motif). Static, fully visible fallback under reduced motion.

### Services — "What we build"
Asymmetric 2-column grid: one large feature card (Web Applications) containing a small **static** mini browser-mockup (reuses `BuildCanvas`'s visual language at stage 3, frozen — no separate component, just a style variant) + smaller cards for the remaining capabilities. Content stays driven by `developer_page_settings` (`hero`, `capabilities` keys) exactly as today — admin editability in `/admin/dev-shop` is unaffected; only the rendering/styling of the grid changes.

### Proof strip
Plain text row, qualitative claims only (per user decision — no fabricated counts):
`Fixed-fee milestones · Full source & IP transfer on delivery · Dev lead reviews every brief personally · Structured escrow, no upfront lump sum`

### Script shop teaser & Trust cards
Kept (same content/links), restyled to drop the glow-card treatment and match the new visual language.

### Final CTA
Typographic panel (headline + one button), no terminal-prompt gimmick.

## `/order/dev` — Order Form

### Approach: opt-in layout variant on the shared component
Add `layoutVariant?: 'default' | 'studio'` to `ServiceOrderPageConfig` in `app/components/ServiceOrderPage.tsx`, defaulting to `'default'`. Content/resume/statistics order pages pass nothing and are byte-for-byte unaffected. `app/order/dev/page.tsx` and `app/dashboard/client/order/new/dev/page.tsx` both pass `layoutVariant="studio"`.

When `layoutVariant === 'studio'`:
- **Outer shell** becomes a 2-column grid at `lg+` (~34%/66% split), single column on mobile/tablet with the sidebar stacked above the form (not sticky below `lg`).
- **Sidebar** (`lg:sticky lg:top-header-28`):
  - "What happens next" — 4 numbered steps (Brief → Scope call with dev lead → Milestone build → Source + IP handover), icon + short copy each.
  - **Quote preview** panel pinned below the steps: re-renders the *same* `finalQuote`/`selectedTier`/`words` state the form already computes — no new pricing logic, just a second read of existing derived values.
- **Form column:** identical `Card` sections and fields as today. Each section gets a small `font-mono` label above it (`// 01 — Project Scope`, `// 02 — Architecture`, `// 03 — Timeline & Budget`, etc., numbered to match the sections actually present) and a `border-l-2 border-cyan-500/40` accent on the section container. This replaces the existing DEV-only 3-step nav bar block (lines ~335–353 of `ServiceOrderPage.tsx` today) — the sidebar supersedes it for the studio variant.
- **No change** to validation, submit, pricing calculation, file upload, wallet/card payment branching, or terms-of-service handling. Only the outer JSX shell and section headings branch on `layoutVariant`.

## Files touched

| File | Change |
|---|---|
| `app/components/BuildCanvas.tsx` | New — hero build animation |
| `app/developer/page.tsx` | Full rewrite |
| `app/components/ServiceOrderPage.tsx` | Add `layoutVariant` prop + studio shell branch; remove now-superseded DEV step-nav block for studio |
| `app/order/dev/page.tsx` | Pass `layoutVariant="studio"` |
| `app/dashboard/client/order/new/dev/page.tsx` | Pass `layoutVariant="studio"` |
| `app/globals.css` | New keyframes/utility classes for `BuildCanvas`, guarded by `prefers-reduced-motion` (same pattern as existing `.aurora-bg`) |

No new DB tables, routes, or migrations required.

## Verification Plan
1. `npx tsc --noEmit` — zero errors.
2. Browser check at 375px / 768px / 1280px, both light and dark theme, on `/developer`, `/order/dev`, and `/dashboard/client/order/new/dev` (logged in) — no overflow, animations fire, hover/focus states visible.
3. `prefers-reduced-motion: reduce` — confirm `BuildCanvas` and the process-stepper fade-ins freeze in a complete, legible state rather than stopping mid-transition.
4. Submit `/order/dev` end-to-end as a guest and confirm the studio shell didn't disturb existing state/handlers (real submission logic untouched, but the shell around it moved).
5. Grep the codebase for anything else that assumed the old DEV step-nav block's markup/classes.
6. Per [[responsive-and-bug-sweep-standard]]: sweep for dead links introduced by the rewrite (shop link, order link, anchors) before calling this done.
