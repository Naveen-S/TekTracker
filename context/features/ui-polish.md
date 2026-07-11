# UI polish — visual parity with the legacy app (step-6 addendum)

## Overview

Close the look-and-feel gap between the `web/` UI (steps 6a/6b) and the legacy Vite app. The port
was a *functional* re-skin — server data, RBAC chrome, correct flows — but visually it regressed to
"flat white boxes with thin gray borders": scaffold-default Geist fonts, no shadow/elevation system,
no motion, text-glyph icons, and the per-filter accent color reduced to a 10px dot. Naveen's verdict
(2026-07-09): it looks amateurish next to the prototype. This feature re-skins `web/` to the
**legacy design system** — which *is* the §11 spec realized ("modern, minimal, in sync with Tekion
standards … micro-interactions, smooth transitions, hover states, toast notifications").

**Not a numbered master-plan step.** Step 6 is Done; this is its deferred polish (§11 note: "toasts
… loading skeletons are post-6a polish"), pulled forward per Naveen before step 8 — sensible
ordering, since step 8 (share view + export) renders these same components to outside audiences.

**The reference spec is [src/styles.css](../../src/styles.css)** (2,152 lines, tokens at `:6-111`)
— the legacy system is *light-mode-first*, brand **teal `#00BFA5` on ink-navy `#0B1620`**, on an
app canvas of `#F4F7FA`. Two design-system catalogs (legacy + web/, explored 2026-07-09) are
condensed into the Scope below so implementation shouldn't need to re-derive them.

> **Key shift:** `web/` today has *semantic tokens without a design system* — correct teal/slate
> values in `@theme`, but no display font, no shadows, no motion tokens, no page canvas, and
> components that don't use what exists (lucide-react installed but never imported; `tw-animate-css`
> imported but unused; `.dark` token set + chart palette defined but dead). This feature makes the
> token layer complete and then makes every component consume it — a re-skin, **zero logic/API/data
> changes** (one tiny exception: accent assignment, decision 7).

## Status

**Done 2026-07-10** — all 9 decisions implemented as proposed; the deferred step-6 polish is
landed. Implemented (a)–(h): legacy font stack via `next/font/google`
(Manrope/Inter/JetBrains Mono replacing Geist, `web/src/app/layout.jsx`) + the full token layer in
`globals.css` (`#F4F7FA` canvas, ink-tinted `--shadow-xs…xl` + `--shadow-brand`/`--shadow-col`,
legacy easings, health-triplet tokens `success/info/warn/danger` ×3, `--color-ink`/on-ink accents,
`rise`/`toast-out` keyframes, `hero-panel` `@utility`, teal `::selection`); UI kit (button
hover-lift + brand glow + **`onDark` glass variant**; dialog ink-blur overlay + rise entrance +
tone strips + lucide `X`; badge tones tokenized; **new `ui/toast.jsx`** (`useToast` + ink pill,
`animate-toast`); ActivityPill → ink pill; **new server-safe `ui/hero-shell.jsx`**); chrome
(TopBar h-14 + display-font product block + ink avatar + `RefreshCw`/`Plus`; shared Hero with dual
teal radial glows, eyebrow, days-remaining pill w/ urgent variant, glass welcome grid — `/rollup`'s
copy-pasted gradient replaced); metric cards (3px tone stripe + 28px icon tile + display 26/800
numerals + hover lift); matrix + sidebar (real `border-subtle` gridlines replacing `gap-px`,
frozen first column w/ `shadow-col`, `color-mix` 6% section tints + accent dots, 3px accent
spines, teal key chips, tri-state completion pills, **3-state bordered stage badges w/ hover glow
rings/done wash/blocked rings**, bordered health pills from the legacy triplets, sidebar cards w/
drag states + search box + accent bars, collapsed rail); login (420px radius-16 p-10 card,
display title, spinner while connecting); admin (`window.confirm` → styled destructive confirm
dialog, lucide icons, tokenized status); rollup table tokenized (bands, blocked, teal link);
**AddFilter sends deterministic palette `accentColor`** (count % 5, red excluded — the only
non-presentation change; the step-4 schema already accepted it). **Verified:** `yarn lint` clean;
`prisma validate` + `migrate status` up to date (no schema change, no migration, **no new deps —
`package.json` untouched**); **DB/env-free build green** (`.env` moved aside; 24 routes/pages
`ƒ Dynamic`; `next/font` self-hosts fine offline-from-env); **token audits pass** (no `Geist`, no
`#0b1620/#15303f` hex left in components, no raw `text-blue-700`-class tone maps, lucide imported
in 6 files, no `tailwind.config.*`, no `window.confirm`); **29/29 SSR smoke on dev+Neon** (minted
admin cookie; auth 307s; login copy/display-font/radius-16/footer; dashboard 200 with
`hero-panel`, tone stripes, display numerals, lucide svgs, `border-[1.5px]` stage badges, health
pills, `sticky left-0` + `shadow-col`, inline accent spines + `color-mix` tints, no `gap-px`;
rollup hero shell + token bands + teal link; admin sections) — **against Naveen's real synced
data** (1 team / 2 filters / 73 issues; render-only, no writes); **compiled-CSS checks** confirm
`hero-panel` gradients, `shadow-brand`, `animate-toast`, health tokens, and all three font
families in the production bundle. ⚠️ Remaining acceptance is Naveen's **side-by-side browser
eyeball** (`:3000` vs `:3002`) — client-only behaviors (toast firing, dialog/hover motion,
density feel) are code-reviewed, not machine-verified (6a precedent); the still-open 6a
real-Jira UI run can piggyback. **Next:** step 8 (share view + export) or step 9 (importer).

## Decisions (PROPOSED 2026-07-09 — sensible defaults, flag disagreements)

1. **Faithful translation, not a redesign — and not a CSS-file port.** The legacy `styles.css` is
   the visual spec; implement it as Tailwind v4 utilities + `@theme` tokens in `globals.css`
   (coding-standards: Tailwind for all styling, no global class stylesheet). Where a legacy value
   has no utility equivalent, add a **token** (shadow, easing, font) rather than scattering
   arbitrary values. *Alternative considered:* importing `styles.css` wholesale — rejected: it
   defeats the Tailwind migration and would fight the existing kit.
2. **Typography: replace Geist with the legacy stack via `next/font/google`** — **Manrope**
   (display: headings, big numerals, product name), **Inter** (body), **JetBrains Mono** (issue
   keys, JQL). Exposed as `--font-display` / `--font-sans` / `--font-mono` in `@theme`. This is the
   single highest-leverage change. No new npm dep (`next/font` is built in).
3. **Light-first stays; no dark-mode toggle in this feature.** The legacy app is light-only; §11's
   dark mode remains post-v1 (the existing `.dark` token set stays as dead-but-ready capability).
   Skeletons also stay out — the legacy app has none (server-rendered pages show data or empty
   states; the ActivityPill covers in-flight mutation feedback).
4. **Icons: adopt `lucide-react`** (already a dependency, currently unused) for chrome — Search,
   GripVertical, RefreshCw (sync spin), Plus, X, chevrons/collapse, LogOut — exactly where the
   legacy app used lucide. **Keep text glyphs for data-driven marks** (stage `✓`/`○`, health
   `⊗ ✓ ↗ → ⚠ ↓`, legend) — that's legacy parity, and they come from `metrics.mjs`.
5. **Toasts for non-blocking success feedback; AlertDialog stays for errors.** Port the legacy
   `.share-toast` pattern (fixed bottom-right, ink bg, white text, rise-in/fade-out ~3s,
   `styles.css:169-177`) as `ui/toast.jsx`. Sync-complete / filter-added / saved successes move
   from the blocking alert modal to toasts; errors keep the modal. Admin's `window.confirm`
   (delete team) is replaced with the styled confirm dialog. *Alternative:* adding `sonner` —
   rejected, no new deps needed for one toast style.
6. **One shared `Hero` surface.** The ink-panel treatment (`#0B1620` + the two teal radial-gradient
   glows + glass on-dark buttons) is currently copy-pasted three times (`hero.jsx` ×2 branches,
   `rollup/page.jsx`). Extract the panel shell so dashboard + rollup share it, matching the legacy
   `.hero-panel` exactly (`styles.css:381-443`).
7. **Filter accent colors get assigned at creation** (the only non-presentation change). Legacy
   picked from `['#7c3aed','#0891b2','#ea580c','#16a34a','#f59e0b']` (violet/cyan/orange/green/
   amber — red excluded) at transform time (`src/jiraService.js:236-244`); `web/` filters today have
   `accentColor = null` → everything renders default teal. The AddFilter dialog will send
   `accentColor` picked **deterministically by existing-filter count % palette length** (stable
   across re-renders, unlike legacy's random). The step-4 create route already accepts
   `accentColor` (§9 column exists — verify the zod schema passes it through). Existing null
   accents keep rendering teal-default. *Alternative:* a server-side default in the route —
   rejected, the client already knows the count and the route stays untouched.
8. **No interaction-logic changes.** No optimistic updates (the noted 6a follow-up stays parked),
   no new routes, no schema change, no changes to `metrics.mjs` / `dashboard-data.js` / any
   `lib/` logic. Presentation only, plus decision 7's one-field dialog payload.
9. **Density modifier tightens like legacy `.dense`** (`styles.css:1377-1395`): keep the existing
   two-value density pref, map compact to legacy's tightened paddings/cell heights.

## Requirements

### Scope

**(a) Token layer — `web/src/app/globals.css` + `web/src/app/layout.jsx`**
- Fonts (decision 2): three `next/font/google` families in `layout.jsx` (Manrope 400–800,
  Inter 400–700, JetBrains Mono 400–600), wired in `@theme` as `--font-display`/`--font-sans`/
  `--font-mono` (replacing the Geist vars). Base body size 14px, antialiased (already set).
- **Shadow tokens** (the missing elevation system, legacy `:92-98`):
  `--shadow-xs: 0 1px 2px rgba(11,22,32,.04)` · `--shadow-sm: 0 1px 3px rgba(11,22,32,.06), 0 1px
  2px rgba(11,22,32,.04)` · `--shadow-md: 0 4px 12px rgba(11,22,32,.07), 0 2px 4px rgba(11,22,32,.04)`
  · `--shadow-lg: 0 12px 32px rgba(11,22,32,.10), 0 4px 8px rgba(11,22,32,.05)` ·
  `--shadow-xl: 0 24px 56px rgba(11,22,32,.16)` · `--shadow-brand: 0 6px 18px rgba(0,191,165,.30)`
  (teal glow under primary buttons). Registered so `shadow-xs`…`shadow-brand` utilities emit them.
- **Motion tokens** (legacy `:101-106`): `--ease-out: cubic-bezier(.22,1,.36,1)`,
  `--ease-in-out: cubic-bezier(.65,0,.35,1)`; durations 120/180/280ms. Keyframes `rise` (opacity +
  translateY(8px)→0) and `fade-out` for toast/dialog entrances (tw-animate-css may cover these —
  prefer its utilities if equivalent).
- **Page canvas**: body/app background `#F4F7FA` (legacy `--bg-app`) so white cards separate by
  contrast + shadow, not border alone. Add `--bg-subtle: #F7F9FB` / `--bg-app` style tokens as
  needed (today `--muted #EEF2F6` is the only muted surface).
- `::selection` teal-100 on ink; link hover `underline-offset` 3px (base layer).

**(b) UI kit — `web/src/components/ui/`**
- `button.jsx`: primary gains hover `translateY(-1px)` + `--shadow-brand` glow, active settles;
  secondary/outline hover-lift + shadow-xs; add an **on-dark variant** (`rgba(255,255,255,.08)` bg,
  `.14` border, white text, `backdrop-blur`, hover `.15`/`.24`) replacing the per-instance
  `border-white/30 bg-transparent…` overrides hand-patched in hero/rollup today.
- `dialog.jsx`: overlay `rgba(11,22,32,.56)` + `backdrop-blur`, panel entrance `rise` ~220ms,
  shadow-xl (already), radius-12. Optional tone strip (3px top) for the alert dialog's
  error/success tones (legacy `:1487-1490`).
- `badge.jsx`: keep tone API; align tints with legacy pairs (success `#ECFDF5`/`#065F46` etc.).
- **New `ui/toast.jsx`** (decision 5): fixed bottom-right 24px, ink bg, white 13px/600, radius-8,
  shadow-lg, `pointer-events-none`, rise-in then fade-out ~3s; a tiny client hook/context or
  callback prop — keep it dependency-free.
- `spinner.jsx` / ActivityPill: restyle pill to the ink-bg toast look (it currently reads as a
  stray white chip).
- Replace glyph buttons (`⟳ ✕ + → ← ⋮⋮ ↗`) with lucide icons across components (decision 4).

**(c) Chrome — TopBar + Hero**
- `top-bar.jsx`: 56px bar, shadow-xs, logo 22px + 1px divider + stacked product block
  ("Sprint Tracker" display-font 14/700 over "Engineering · Internal" 11px muted); right side 36px
  icon buttons, Add filter (secondary) + Sync Jira (primary, RefreshCw spinning while syncing),
  avatar = 32px **ink** pill with white initials (legacy `:253-273`; today it's pale teal).
- `hero.jsx` (decision 6): panel = `#0B1620` + `radial-gradient(ellipse at 100% 0%,
  rgba(0,191,165,.22), transparent 50%)` + `radial-gradient(ellipse at 0% 100%, rgba(0,191,165,.09),
  transparent 60%)`, radius-16, padding 28/32, hairline `rgba(255,255,255,.05)` border. Eyebrow =
  teal-200 11px/700 uppercase tracking `0.10em`; h1 display 30px/800 tracking `-0.02em`; copy
  `white/65`. **Days-remaining pill**: `rgba(0,191,165,.18)` bg / teal-200 text / `.25` border;
  **urgent** (<3 days) flips to red (`rgba(220,38,38,.18)` / `#FCA5A5`). Welcome state: centered,
  min-height 320px, glass sprint badge + translucent `white/7` feature-item grid with teal icons
  (legacy `:454-530`). `/rollup`'s inline copy of the gradient switches to the shared component.

**(d) Metric cards — `metric-grid.jsx`**
- Card: white, radius-8, padding 14/16, **3px top accent stripe** colored by tone (teal/green/
  amber/red, default slate — legacy `::before`, `:557-567`), **28px icon tile** (tone-tinted bg),
  label 11px/700 uppercase tracking `0.06em`, **value in display font 26px/800 tracking `-0.02em`**,
  hover `shadow-sm` + `translateY(-1px)`. Replaces the current flat box + 8px dot; drop the raw
  `bg-emerald-500`-style local map for token-mapped tones.

**(e) Delivery Matrix + sidebar — `planner-panel.jsx`, `issue-row.jsx`, `filter-panel.jsx`**
- **Grid chrome:** replace the `gap-px` faux-gridline hack with real `border-subtle`
  (`#EAEEF3`-class) right/bottom cell borders; header cells 11px/700 uppercase muted on subtle bg;
  **sticky first column** with the right-edge scroll shadow `4px 0 8px rgba(11,22,32,.05)` and
  sticky header (legacy `:888-940`) — verify sticky-inside-`overflow-x-auto` behaves in the ported
  markup; keep the data-driven inline `gridTemplateColumns`.
- **Filter section header:** background = `color-mix(in srgb, <accent> 6%, white)` via inline style
  (data-driven, allowed per 6a precedent) + 8px accent dot + "N items · workflow" count (legacy
  `:948-971`); replaces today's 4px left rule.
- **Issue cell:** 3px **accent left spine**; Jira key as mono 11px/600 teal-700 chip on teal-050;
  completion badge tri-state (muted / info-tint / success-tint pill); title 13px/500 2-line clamp;
  metadata 11px/600 with `·` separators; accent-colored 3px mini progress bar; row hover washes all
  cells to subtle bg; min-height 80px (comfortable) (legacy `:973-1094`).
- **Stage cells** (the core interaction): inner ~28×24 badge with three states — done: `✓` on
  `rgba(16,185,129,.13)` + `1.5px rgba(16,185,129,.45)` border, `#047857`; current: `○` on
  `rgba(14,165,233,.10)` + `.38` border, `#0369A1`; pending: `○` ghost ring (transparent,
  slate-300 text, 1.5px border). Cell hover → teal-050 bg; hover on done/current badge → 4px glow
  ring; `:active` scale-98; done cells get the faint green wash `rgba(16,185,129,.06)`; blocked →
  danger-bg badge + red glow + caption (legacy `:1096-1147`).
- **Health chip:** bordered pill (1.5px, min-width 65px) with icon + 11px/700 label, colors from
  the metrics `tone` map (aligned to legacy's exact triplets, `src/workflows.js:107-175`), hover
  lift + shadow-sm — replaces the plain Badge-in-button.
- **Sidebar:** sticky below the topbar; "Connected JQL" eyebrow in teal-700; search box on subtle
  bg with lucide Search icon and teal focus-within; filter cards hover-lift with border-strong +
  shadow-xs; JQL preview as mono 11px chip on muted; stat chips as muted pills; 3px accent-colored
  progress bar; drag states (dragging 40% + dashed; drag-over teal border + teal-050 bg + 2px
  teal-100 ring); red-tinted remove button; collapsed 52px rail with vertical-rl label (legacy
  `:626-842`).
- Matrix footer strip (subtle bg, dot separators) if trivially cheap.

**(f) Login — `login-form.jsx`**
- Card: max-width 420px, radius-16, padding 40, `0 4px 24px rgba(0,0,0,.08)` shadow, centered on
  the `#F4F7FA` canvas; logo 28px; title 1.5rem/700 display; teal "Create token ↗" link right of
  the label; footer "Engineering · Internal Tool · Tekion Corp"; **Spinner in the submit button**
  while connecting (today text-only) (legacy `:1434-1602`).

**(g) Feedback + admin + rollup alignment**
- Success paths (sync done, filter added, config saved, member added) → toast (decision 5); errors
  stay in AlertDialog; admin `window.confirm` → styled confirm dialog.
- Admin panel inherits the kit restyle (buttons/inputs/dialogs/icons) — no deeper redesign
  ("polish is post-v1" stands for its layout).
- Rollup table: header/hover treatment stays, but band glyph colors + "Open board →" link move
  from raw `text-blue-700`-style utilities to semantic tokens; the hero switches to (c)'s shared
  component.

**(h) No schema change, no migration, no new npm dependency, no new env, no new API route.**
   The only payload change is the AddFilter dialog sending `accentColor` (decision 7).

### Mechanism / gotchas

- **Read the installed Tailwind v4 + Next 16 docs first** (`node_modules/next/dist/docs/`,
  `web/AGENTS.md` discipline): `next/font/google` multi-family setup, and how `@theme` registers
  **shadow** (`--shadow-*`) and **font** (`--font-*`) namespaces so utilities emit them — v4
  CSS-config specifics likely differ from training data. No `tailwind.config.*` may appear.
- **Accent-derived values stay inline `style`** (data-driven — 6a precedent): the `color-mix`
  section-header tint, the accent spine/dot/bar colors, and `gridTemplateColumns`. Everything
  else must be tokens/utilities — no other inline styles, no hex in components (the current
  hardcoded hero gradient and the raw `emerald/blue/amber/red-600` maps get tokenized).
- **`* { border-border }`** in the base layer means bare `border` utilities already recolor when
  tokens change — but the fix for flatness is canvas contrast + shadows, not more borders.
- **Sticky column + sticky header inside `overflow-x-auto`**: sticky headers don't work against
  the *page* scroll from inside a scroll container — replicate the legacy nesting (scroll container
  owns x-overflow only) and verify with real overflow.
- **SSR smoke greps will shift**: 6a/6b smoke checks grep rendered markup (e.g. `80<!-- -->%`);
  class-level assertions from those harnesses are gone (harnesses were deleted), but re-verify the
  *behavioral* SSR checks still pass post-restyle.
- **Fonts and build determinism**: `next/font/google` downloads at build time — confirm `yarn
  build` stays green offline/DB-free (fonts are cached in `.next/cache`; if the sandbox blocks
  fetch, note the fallback — self-hosted via `next/font/local` is the escape hatch).
- Keep `rollup/team-summary-table.jsx` a **server component** (its header comment explains why) —
  restyle without adding `"use client"`.
- Density: apply legacy `.dense` deltas via the existing `viewDensity` pref conditional classes —
  don't reintroduce a global stylesheet class.

### Acceptance criteria

- **Hygiene:** `yarn lint` + `yarn build` green in `web/`; build stays **DB/env-free**; no
  `tailwind.config.*`; no `.ts/.tsx` source; no new deps (`package.json` diff empty except nothing);
  `prisma migrate status` unchanged (no migration).
- **Token audit (grep-able):** Manrope/Inter/JetBrains Mono wired (no `Geist` references);
  `--shadow-brand` + shadow tokens present in `globals.css`; no hardcoded `#0b1620`/`#15303f`
  gradient hex left in components (moved to the shared hero/tokens); no raw
  `text-blue-700`/`bg-emerald-500`-class utilities left in metric-grid/rollup-table/badge maps;
  `lucide-react` imported (glyph buttons gone from top-bar/filter-panel/dialog).
- **SSR smoke (dev + Neon, minted cookie or real login):** the 6a/6b behavioral checks still hold —
  matrix renders rows/stage cells/health chips, stage PUT round-trips, VIEWER read-only, `/admin`
  gating, `/rollup` table + link visibility, login page copy. New: toast markup renders on a
  success mutation; AddFilter POST carries `accentColor` from the palette; section headers emit
  the `color-mix` inline style.
- **Visual acceptance (Naveen, in-browser):** legacy app (`:3000`) vs `web/` (`:3002`)
  side-by-side — login, dashboard (hero, metric cards, sidebar, matrix incl. hover/active/blocked
  states, density toggle), admin, rollup. This is the workflow's "verify in the browser" step and
  the definition of done for "no longer amateurish". The still-open 6a real-Jira UI acceptance
  (login → add real filter → Sync) can piggyback on the same session.

### Out of scope

- **Dark-mode toggle** (post-v1; `.dark` tokens stay dormant) · **loading skeletons** (no legacy
  counterpart) · **optimistic stage updates** (parked 6a follow-up) · **export/share UI + its
  print design system** (step 8 — legacy `styles.css:1604-2151` ports then) · **velocity explain
  modal + gradient velocity card** (simplified card was a 6a decision; revisit with the trend UI,
  step 10) · **trend/burndown UI** (step 10) · **admin layout redesign** (post-v1) · **legacy app
  changes** (frozen until cutover).

## As-built notes (vs. the spec)

- **Canonical spacing classes over arbitrary values.** The installed Tailwind lint
  (`suggestCanonicalClasses`) pushed `h-[3px]`→`h-0.75`, `min-w-[900px]`→`min-w-225`,
  `max-w-[1600px]`→`max-w-400`; arbitrary values survive only where no canonical exists
  (`border-[1.5px]`, `text-[11px]/[13px]/[26px]`, `tracking-widest` ≈ legacy `0.10em`).
- **Sticky matrix header row skipped — actual-behavior parity.** Sticky-top inside an
  `overflow-x:auto` container is inert against page scroll (the scroll container becomes the
  sticky containing block), so the legacy `.matrix-header{position:sticky;top:56px}` never
  actually stuck either. The frozen **left** column (which does work inside x-scroll) is
  implemented with the `shadow-col` edge.
- **No blocked caption inside stage cells.** Legacy pinned a `<small>` caption; here blocked
  renders as danger badges + red glow rings across the row plus the ⊗ Blocked health pill —
  `blockedReason` isn't in the row payload, so a caption had nothing to say.
- **Toasts carry a condensed one-liner** (`condenseSync`: "N filters · +a/−r issues · seeded")
  instead of the modal's per-filter multiline list; errors keep the full AlertDialog. Sprint save
  toasts via a new `onSaved` callback on SprintConfigDialog (the dialog owns its own transition,
  so the parent needed a hook).
- **Health-pill colors are tone classes, not inline hex.** Legacy applied the `workflows.js`
  triplets as inline styles; `HEALTH_PILL` maps the metrics `tone` to token classes carrying the
  same values (text 500 / border 600 / bg 50) — keeps "no hex in components" intact.
- **`ui/hero-shell.jsx` has no `"use client"`** so `/rollup` (server page) renders it
  server-side; the ink gradient lives in the `hero-panel` `@utility` (globals.css), not markup.
- **Token layer split**: shadows/motion/keyframes are a static `@theme` block; color/font tokens
  stay `var()`-referenced in `@theme inline` so the dormant `.dark` overrides keep working.
- **Welcome-hero feature grid copy is new** (legacy's `.welcome-features` content didn't survive
  the port): three product-truthful items (multiple filters / stage lifecycle / leadership
  metrics) with lucide icons.
- **Density stays the 6a two-value pad swap** (`py-1.5`/`py-3`) rather than replicating every
  legacy `.dense` delta cell-for-cell.
- **Smoke was render-only against real data.** The dev DB now holds Naveen's real synced team
  (2 filters, 73 issues — the token is alive), so no PUT round-trips were fired; write paths are
  unchanged from 6a except the create-only `accentColor` field. Existing filters keep
  `accentColor = null` → teal default (per decision 7, not backfilled).
- **Full-bleed + responsive pass (iterate, 2026-07-10, per Naveen).** The port had kept a
  `max-w-400` (1600px) centered cap that the legacy `.app-shell` never had — removed on `/` and
  `/rollup` (admin keeps `max-w-4xl`: a centered settings form). Legacy breakpoints translated to
  Tailwind steps: workspace sidebar+matrix **stack below `xl`** (~legacy 1180px; sidebar
  sticky/max-h only at `xl`, collapsed rail lies flat horizontally when stacked); metric grid
  `1 → sm:2 → lg:3 → xl:5` (~legacy 760/1180/1400); both top bars wrap (`min-h-14 flex-wrap`)
  with the product text block hidden below `sm`; hero/login/admin gain mobile paddings. On very
  large screens the matrix's `fr`-based `minmax` columns absorb the width natively (legacy's
  1920px column widening not needed). Verified: lint + DB/env-free build green, **11/11 SSR
  smoke** (full-width mains, stack/step classes, wrapping bars; fresh minted cookie — the first
  one had hit its 1h TTL and 307'd, a smoke-harness gotcha worth remembering).

## Doc-sync (§17 — same PR)

- §11: update the 6a note — polish landed (toasts, motion, elevation, legacy type/token system);
  dark-mode toggle + skeletons remain post-v1. §5: no state changes (rows already BUILT) — only if
  wording mentions "modal alerts for now", flip it to toasts.
- **Do NOT over-claim:** dark mode is still absent; step 8 export/share untouched; the master-plan
  step list gains no new number — reference this as a step-6 addendum in the History line only.
- Record as-built deviations in this file; update current-feature.md (Status → Done + History).

## References

- @context/project-overview.md — §11 UI/UX (the spec this realizes), §5, §17
- @context/features/ui-port.md — 6a as-built + deferred-polish list ·
  @context/features/ed-rollup.md — 6b surfaces
- **Legacy reference:** [src/styles.css](../../src/styles.css) — tokens `:6-111`, topbar `:213-273`,
  hero `:381-530`, metrics `:535-607`, sidebar `:626-842`, matrix `:847-1198`, modals `:1203-1344`,
  dense `:1377-1395`, login `:1434-1602`, toast `:169-177`; accent palette
  [src/jiraService.js:236-244](../../src/jiraService.js#L236-L244); health triplets
  [src/workflows.js:107-175](../../src/workflows.js#L107-L175). Gotcha: legacy `--bg-base`/
  `--bg-surface` (login) are **undeclared** — read them as `#F4F7FA`/`#FFFFFF`.
- **Current state:** `web/src/app/globals.css` (tokens to grow), `web/src/app/layout.jsx` (fonts),
  `web/src/components/{ui,dashboard,auth,admin,rollup}/**` (surfaces listed in Scope)
- `web/AGENTS.md` — installed-docs discipline (Tailwind v4 `@theme` namespaces, `next/font`)
