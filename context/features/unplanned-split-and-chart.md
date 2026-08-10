# Unplanned work → External / Internal split + a per-team composition chart

**Status: Done + verified 2026-08-09** (branch `feature/unplanned-split-chart`, off `main` @ `d631492`).
A follow-on to committed-unplanned-work.md — presentation-only, purely additive to the metric core.

## Overview

Two connected asks from Naveen:

1. **Bifurcate Unplanned work.** The delivery scoreboard (`StoryPointsHighlight`) split story points
   three ways — **Committed** (`FEATURE`), **Tech Debt** (`TECH_DEBT`), **Unplanned Bugs**
   (`SUPPORT` + `INTERNAL_BUG` merged). Naveen: *"In the unplanned work there are two categories
   external and internal, let's try to bifurcate those in our view (Sprint board and rollup)."* So
   Unplanned splits into **External** (`SUPPORT` — customer/support-reported, the "External Bug"
   track in one-click-sprint-start.md) and **Internal** (`INTERNAL_BUG`). Applied to **all four**
   scoreboard surfaces — `/`, `/rollup`, `/share/[token]`, PDF/PNG export.
2. **A chart view.** *"Give a chart-like view based on a view option."* Designed with the
   **impeccable** skill.

## The chart — two passes (a dropped donut, then the per-team chart)

- **First pass (dropped): a composition donut.** A two-ring donut of the same Committed/TechDebt/
  External/Internal composition, toggled on both `/` and `/rollup`. Naveen's verdict: *"the chart
  representation is not adding any value"* — correct: a donut of the same four numbers the rail
  already shows re-encodes the composition without revealing anything new (the rail **is** already a
  chart). Removed entirely.
- **Second pass (shipped): a per-team composition chart on `/rollup`.** The one lens the portfolio
  totals and the aggregate rail can't give — **which teams carry which kind of work**. One horizontal
  stacked bar per team, length ∝ that team's total committed+tech-debt+bug load, segments = the four
  work types, sorted heaviest-first, with delivered/planned/% per row. On the **board there is no
  chart** (Naveen: "on the board, just remove it") — `/` is back to the plain condensed scoreboard,
  now bifurcated.
- **Representation refinement (Naveen: "provide spacing and represent this better… similar to our
  per-team view with hover effect").** The bars adopt the `/bugs` "Bugs by scrum team" grammar: a
  **full-width track lane** (`bg-white/[0.07]`) with a partial fill = the team's share of the heaviest
  team's load, so a light team reads as a short bar in a visible lane rather than a stub in empty
  space; taller bars, generous row padding + a row-hover highlight. Plus the scoreboard's own
  **hover-isolation** — the card is a `.sp-board` and every segment + legend chip is a `.sp-part`
  tagged `data-part={type}`, so hovering one work type (or its legend chip) keeps it lit across every
  team while the rest dim ("where is the bug load concentrated?"). Reuses the existing globals.css
  rules — zero new CSS.

## Decisions (confirmed with Naveen)

1. **External = `SUPPORT`, Internal = `INTERNAL_BUG`.** Labels "External Bugs" / "Internal Bugs" on
   the scoreboard; "External" / "Internal" in the per-team chart legend.
2. **Additive-only in the metric core** — `unplanned*` fields kept intact; `external*`/`internal*`
   added alongside. Proven with a before/after fixture diff (§12 purity invariant); `external +
   internal == unplanned`.
3. **Chart = per-team composition on `/rollup` only** (Naveen chose this over "remove entirely" and
   "trend chart"). Board chart removed. Roll-up toggle: `Condensed · Relaxed · By team`.

## Palette (validated, not eyeballed)

A 4th category needs a channel that separates on the **ink surface** across BOTH themes' brand hue
(Tekion teal `#7fe3d5` / Modern blue `#9db8ff`), gold `#e3a72f`, rose `#f2a8b6` and alert-red
`#ff5f56`, in normal + protanopia + deuteranopia. A CIEDE2000 + Machado-2009-CVD sweep showed:

- **Purple/violet collapses against Modern's blue under CVD** (ΔE < 5) — rejected.
- Greens collide with success-green; magentas collide with rose; warm corals sit muddy against the
  existing warm set.
- **Orchid `#d385b0` clears everything** — worst-case CVD ΔE: rose 12.2 · brand-Tekion 10.1 ·
  brand-Modern 15.4 · gold 34.5 · alert-red 23.6 · success 18.4. Contrast on ink 6.7:1 (Tekion) /
  6.6:1 (Modern).

**Structure:** TEXTURE encodes planned-vs-reactive — **solid fill = planned work** (Committed, Tech
Debt), **hatch = reactive bug** (External rose `.sp-stripe`, Internal orchid `.sp-stripe-2`); **hue
sub-divides** the two bugs. New token `--on-ink-cat-4` (theme-neutral, like cat-2/cat-3). The per-team
chart reuses the same fills, so both views share one visual language.

## Change surface

- **`src/lib/metrics.mjs`** — `EXTERNAL_TYPES`/`INTERNAL_TYPES` sets; six new fields
  (`external*`/`internal*`) in `computeSprintMetrics` + `aggregateRollup`; `UNPLANNED_TYPES` and all
  `unplanned*` fields untouched (fallback + export).
- **`src/components/dashboard/story-points-highlight.jsx`** — `TYPES` gains `external`/`internal`
  (keeps `unplanned` as a mutually-exclusive fallback for pre-split frozen shares); 4-entry animation
  arrays; relaxed grid → `grid-cols-2 lg:grid-cols-4`; extracted `CompositionLegend`; exported pure
  `compositionBreakdown(metrics)` helper (split-or-`unplanned`-fallback). No chart variant here.
- **`src/components/rollup/rollup-composition-chart.jsx`** (new) — the per-team stacked-bar chart
  (`/bugs` bar grammar), presentational, bundled client-side via the toggle leaf.
- **`src/components/rollup/rollup-story-points.jsx`** — owns the `Condensed · Relaxed · By team`
  toggle (`useLocalPref`); renders `StoryPointsHighlight` for the two densities, `RollupCompositionChart`
  for "By team".
- **Call sites** — `dashboard.jsx` renders the plain `StoryPointsHighlight` (no toggle) with the
  split breakdown; `rollup/page.jsx` passes `teams={perTeam}`; `share/[token]/page.jsx` uses
  `compositionBreakdown`.
- **`src/components/dashboard/export-dialog.jsx`** — the "Unplanned bugs" readout → two rows.
- **`src/app/globals.css`** — `--on-ink-cat-4` token + alias, `.sp-stripe-2`, `sp-grow` keyframe (for
  the per-team bars), hover-isolation rules extended to `external`/`internal`, token docblock updated.

## Verification

- **Additive proof:** `computeSprintMetrics`/`aggregateRollup` before/after diff shows only the six
  added fields; every prior field byte-identical. `external + internal == unplanned` (team + rollup).
- `yarn lint` clean.
- Cold `rm -rf .next` DB/env-free build green with `.env` absent — **45 ƒ Dynamic unchanged** (44 +
  office-deployment `/p/health`; no new routes). No schema change (9 migrations).
- impeccable `detect.mjs` → `[]` on every changed component.
- **Headless-Chrome (Playwright) screenshot round** on the live PCX/GM ACTIVE sprint (all 4 work
  types): `/` (no toggle, bifurcated), `/rollup` By-team (desktop + mobile — PCX tech-debt-heavy,
  D360/DX bug-heavy read at a glance), `/rollup` Relaxed (4-col). Toggle clamps a stale `chart`
  pref → `relaxed`.
- **Naveen's authed visual pass** (both themes, real PDF export) remains his acceptance step.

## Notes / carry-forward

- **`--on-ink-cat-4` orchid `#d385b0`** is the validated 4th categorical hue on ink. Purple/violet is
  NOT an option (fails CVD vs Modern's blue). A 5th category faces an even tighter hue space; reach
  for a texture/second channel before a new hue.
- **A chart that only re-encodes numbers already shown adds no value** — the per-team chart earns its
  place by adding a dimension (per-team composition) the totals/rail can't show.
- `metrics.mjs`/`SprintSnapshot`/`IssueProgress`/health/velocity untouched — display-only. Frozen
  shares captured before this change fall back to the merged "Unplanned Bugs" segment.
