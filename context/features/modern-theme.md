# Modern theme — a blue, sidebar-shell theme alongside Tekion

Post-v1. Requested by Naveen: *"modernize the app while keeping the current Tekion design as is;
have an option in settings to switch themes."* The visual target is an approved 5-frame design
board (see References) built from Naveen's own mockups.

> **History note.** A first attempt (`feature/theme-switcher`, 2026-07-23) shipped a *recolor-only*
> indigo theme. Once Naveen supplied mockups it was clear the real Modern theme is **blue + a left
> sidebar (a layout shift)**, so that attempt was **reverted in full** and this plan replaces it. The
> switching *mechanism* it proved out (class on `<html>` + no-FOUC boot script + `useLocalPref`) is
> carried forward here; only the palette and the added layout are new.

## Overview

Add a second theme, **"Modern"** (blue `#2f6bff`, cool canvas, dark **left sidebar** navigation,
monochrome status chips, retained dark hero), selectable from the user menu alongside the
**untouched Tekion** default. Unlike the reverted attempt, Modern is **not** recolor-only — it is a
**layout shift**: nav moves from the top bar into a persistent sidebar. Everything is gated on a
single `theme-modern` class on `<html>`, so Tekion renders byte-for-byte as today.

## Status

**Done 2026-07-26.** Phases A–C (mechanism + tokens, app shell + sidebar, component parity)
shipped 2026-07-24 as planned, then the branch (`feature/modern-theme`) carried a long run of
Naveen-directed follow-ups through 2026-07-26 — see `context/current-feature.md`'s History for
the dated, per-change detail (hero delivery phase bar, chart curve smoothing, the sprint-timeline
+ two-lens-metrics rework, a full UI/UX pass on `/bugs` + `/admin`, a chart-palette rebuild, a
self-inflicted build-break fix, and finally the dropdown redesign + sidebar-in-Tekion change below).
This spec's own `## Status` line was never updated when Phases A–C landed; it is corrected here
rather than backfilled per-iteration.

**Final verification (2026-07-26):** `yarn lint` clean; `prisma validate` + `migrate status` up to
date (**no schema change across the entire arc**); **env-free cold `yarn build` green — 35 ƒ
Dynamic, unchanged** from before Modern theme work began; runtime smoke against a freshly rebuilt
dev server (unauthenticated `/` correctly serves the login page, not the dashboard; `/api/cron/daily`
401s on a bad bearer; `/api/health/db` reports a live DB connection; all four `AppShell` pages — `/`,
`/rollup`, `/bugs`, `/admin` — return 200 authenticated) plus a headless-Chrome (Playwright, system
Chrome) visual pass across both themes at desktop and three responsive breakpoints, since the Claude
browser extension was not connected for any capture in this arc.

⚠️ **Pending human acceptance (Naveen):** an authed visual pass in a real browser across both themes
has not happened for any point in this feature's history — every verification pass here and in the
linked History entries used headless capture instead.

**Committed and merged to `main`** as `8240dce` ("UI Polish.") — Naveen committed and
fast-forward-merged `feature/modern-theme` from a parallel session mid-way through this session's
own finish-feature pass, so the code (including this session's dropdown/sidebar work) landed on
`main` before this Status section did.

## As-built notes (vs. the spec)

- **Sidebar promoted to both themes (2026-07-26), reversing decisions 3/4/6 and the "Tekion renders
  pixel-identical to today" acceptance bullet below.** Per Naveen, the left-nav sidebar
  (`ui/app-sidebar.jsx`) is no longer Modern-exclusive: visibility flipped from
  `hidden modern:lg:flex` to `hidden lg:flex`, and the top bars' now-redundant nav links/brand block
  flipped from `modern:lg:hidden` to `lg:hidden` (dashboard, roll-up, and bugs top bars; the admin
  hero's back button; the bugs page footer link; the `SkeletonChrome` loading placeholder). Tekion
  and Modern now share one shell, differentiated by palette/token only — not by layout. `bg-ink`
  plus the themed `--primary`/`--accent` tokens re-hue the sidebar automatically (teal active state
  under Tekion, blue under Modern) with no per-theme branching in the component.
- **Dropdown component rebuilt (2026-07-26), not in the original scope.** `ui/select.jsx` gained a
  drawn `ChevronDown` (replacing the OS glyph via `appearance-none`), hover/focus-ring treatment
  matching `Input`/`Button`, and a real `cva`-based `variant="onDark"`. That variant closes a latent
  bug found during the work: `bugs-actions.jsx`'s report switcher had been passing
  `className="onDark"`, which is not a Tailwind utility and had silently done nothing since it
  shipped. Native `<select>` is kept (the ui-port.md no-Radix decision still holds) — only the
  trigger is custom; the OS option popup is unchanged.
- **Substantial post-launch scope growth beyond the original Overview**, all "per Naveen" ad-hoc
  requests riding this same branch rather than separate specs: a hero sprint-timeline/delivery
  phase bar, monotone-cubic chart curve smoothing + gradient fills, a `/bugs` + `/admin` UI/UX pass
  (hero instrumentation, matrix magnitude-heat, KPI hierarchy), and a dataviz-validated chart-palette
  rebuild (see `context/features/sprint-phases-delivery-lens.md` for the timeline/two-lens-metrics
  piece specifically, which is its own ratified spec layered on top of this one). Each iteration is
  individually verified and logged in `current-feature.md`'s History rather than re-planned here.
- **No dark mode, no schema/migration/route/dependency changes** across the entire arc — both
  unchanged from the original plan.

## Decisions

1. **Two themes, class-based swap.** `:root` stays Tekion (untouched, default). Modern lives in an
   additive `:root.theme-modern { … }` block (specificity 0,2,0 > `:root`). Values come from the
   approved board: primary `#2f6bff`, ring `#6366f1`→`#2f6bff`, canvas `#eef1f5`, surface `#fff`,
   ink `#17181b`, `--radius` ~`0.75rem`, destructive `#ef5350`.
2. **Persistence = `localStorage` + a no-FOUC boot script** (carried from the reverted attempt):
   the choice is an ephemeral UI pref (§17) via `useLocalPref`; a blocking inline `<script>` in
   `layout.jsx` applies the class before first paint; `suppressHydrationWarning` on `<html>`.
3. **Layout swap is CSS-driven, not SSR-driven** *(recommended; the key architectural call)*.
   Because the theme is a client-only localStorage value, the server cannot know it without a flash.
   So the app shell renders **both** chromes and the theme class reveals the right one: the sidebar
   is `display:none` by default and shown under `.theme-modern`; the shell wrapper flips
   `flex-direction` column→row under `.theme-modern`. This keeps the toggle **instant, flash-free,
   and server-change-free**. *(Alternative considered: a cookie the server reads to render one shell
   — cleaner markup but changes the persistence model and couples layout to the request; deferred.)*
4. **Shared `AppShell`** wraps the four authenticated pages (`/`, `/rollup`, `/bugs`, `/admin`):
   a dark sidebar (nav) + a slim top-bar slot (page actions) + `<main>`. `/login` and
   `/share/[token]` do **not** get the shell — they stay default Tekion (a shared board must not
   repaint to a viewer's theme).
5. **Sidebar** owns nav (My board · Roll-up · Bug report · Admin) with active-route highlight
   (`usePathname`) and a **collapse ↔ icon-rail** toggle (frame 01's compact state), state in a
   second `localStorage` pref (`sidebar`, default expanded). Avatar + logout + the **theme toggle**
   live in the sidebar footer under Modern.
6. **Top bars stay, but shed nav under Modern.** The existing per-page top bars keep their nav links
   + product/logo block under Tekion; under Modern those are CSS-hidden (the sidebar owns them) and
   the top bar keeps only page actions (Sync, Add filter, report switcher, Digest) + avatar. No
   logic is duplicated — same components, theme-scoped visibility.
7. **Monochrome blue status chips under Modern.** Health pills (On track/At risk/Behind/Ahead) and
   risk badges (Blocked/Behind/At risk) render as a uniform blue chip via a theme-scoped override on
   the badge component. **Semantic color survives only** in matrix dots, metric/KPI card accents,
   and SLA-breach counts — exactly as the board shows.
8. **Carve-outs kept Tekion-branded** (unchanged from the plan we agreed): PDF/PNG **exports** and
   the **dataviz-validated bug-chart series palette**. No schema change, no migration, no new route,
   no new dependency (icons via existing `lucide-react`; charts stay hand-rolled SVG).

## Scope — phased

**Phase A · Mechanism + Modern tokens (recolor).** `globals.css`: additive `:root.theme-modern`
blue block + theme-scoped `hero-panel`/`::selection`/`--shadow-brand` re-hue. `layout.jsx`: boot
script + `suppressHydrationWarning`. New `components/ui/theme-toggle.jsx` (`useLocalPref`, imperative
class flip). → Every surface recolors blue; Tekion untouched.

**Phase B · App shell + sidebar (the layout shift).** New `components/ui/app-shell.jsx` +
`components/ui/app-sidebar.jsx`. Wrap `/`, `/rollup`, `/bugs`, `/admin` in `AppShell`. CSS: the
`.theme-modern` layout swap (sidebar reveal + wrapper `flex-direction`), sidebar collapse pref,
active-route highlight. Move nav into the sidebar; hide top-bar nav/logo under Modern.

**Phase C · Component parity to the board.** Monochrome status chips (theme-scoped badge override);
metric/KPI accent parity; matrix tinted rows + cleaner borders; hero re-hue verification; avatar +
logout + theme toggle into the sidebar footer under Modern; responsive behavior (sidebar → top
drawer on narrow widths).

**Files (anticipated):** `src/app/globals.css`, `src/app/layout.jsx`; new
`src/components/ui/{theme-toggle,app-shell,app-sidebar}.jsx`; `src/app/{page,rollup/page,bugs/page,admin/page}.jsx`
(wrap in shell); `src/components/{dashboard/top-bar,rollup/rollup-top-bar,bugs/bugs-top-bar}.jsx`
(theme-scoped nav hiding); the status/health `badge` component + `metric-grid`, `planner-panel`,
`bug-matrix` for Modern tints. No API, Prisma, or route files.

## Non-goals

Dark mode (the `.dark` set stays dormant; trivial to add later on this same mechanism); DB/cookie
persistence; SSR-conditional shells; recoloring exports or the validated bug-chart palette; a
sidebar on `/login` or `/share`; any change to Tekion's rendering, the data model, metrics, or
routes.

## Acceptance

- `yarn lint` clean; `prisma migrate status` unchanged (no schema change).
- **DB/env-free `yarn build` green; ƒ Dynamic count unchanged** (no new routes).
- **Tekion renders pixel-identical to today** (additive CSS + CSS-gated shell — default path untouched).
- Modern shows the dark sidebar + blue palette + monochrome chips across `/`, `/rollup`, `/bugs`,
  `/admin`; `/login` and `/share` stay Tekion.
- Theme toggle is instant, persists across reloads, and produces **no hydration warning**; sidebar
  collapse persists.
- Visual pass in **both** themes against the design board (headless capture; a browser pass if the
  extension is connected).

## Doc-sync

- This spec.
- `context/current-feature.md` — Current Feature / Status / Goals / Notes + History.
- `context/project-overview.md` — §10 Styling row; §11 (the "dark-mode toggle … post-v1" note) once
  the feature is BUILT (not at plan time).

## Decisions locked (2026-07-23)

- **Layout persistence:** `localStorage` + CSS-reveal (decision 3). ✓
- **Typography:** keep the Manrope / Inter / JetBrains Mono stack unchanged. The **"wow" is an
  explicit goal** — a premium, delightful first impression — carried by the shell, motion, and polish
  rather than a new typeface: Phase C budgets tasteful micro-interactions (sidebar expand/collapse
  ease, nav hover, a smooth theme-swap color transition, refined elevation) within
  `prefers-reduced-motion`.
- **Sidebar collapse:** in v1 — an explicit expand/collapse control, state in a `localStorage` pref.

## References

- **Design board (approved):** https://claude.ai/code/artifact/d84f5b02-0e84-401f-a303-e2ab50a9d520
  — five frames (My board, Roll-up, Dense board, Bug report, Admin) on one token set.
- Naveen's three source mockups (2026-07-23).
- Reverted attempt: `feature/theme-switcher` (mechanism reused; palette + layout superseded).
- context/features/ui-polish.md (the Tekion design system these tokens extend).
