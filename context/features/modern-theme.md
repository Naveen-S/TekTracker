# Modern theme — a blue, sidebar-shell theme alongside Tekion

**Status: Planned (not started) — 2026-07-23.** Post-v1. Requested by Naveen: *"modernize the app
while keeping the current Tekion design as is; have an option in settings to switch themes."* The
visual target is an approved 5-frame design board (see References) built from Naveen's own mockups.

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
