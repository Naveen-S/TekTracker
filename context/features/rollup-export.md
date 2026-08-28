# Roll-up export — leadership PDF/PNG for `/rollup`

**Status: Done + verified 2026-08-28 — uncommitted** (Velocity variant added 2026-08-28) — branch `feature/rollup-export`, off `main` @ `ac606eb`.
Post-v1, not a master-plan step. Presentation-only: no schema change, no new route, no §12 change.

## Overview

`/rollup` was the last major surface with **no export path** — `ed-rollup.md` put "share/export of
the roll-up" explicitly out of scope at migration step 8 and nothing revisited it since. Both `/`
(sprint board) and `/bugs` ship polished PDFs on the shared export kit that
`export-visual-consistency.md` extracted precisely "so the sprint export and any future export share
one look". This is that future export — the third consumer of the kit, and the first on the
**leadership** surface, where an ED/TPM/VP most needs to forward a view into a review deck.

Three variants, one dialog:

- **Executive** — high-level and pictorial: per-scrum-team effort across Roadmap / Tech Debt /
  External bugs / Internal bugs plus a portfolio total, a composition band, and a burndown. Built
  for a reader who will not open a backlog.
- **Full detail** — parity with the scrum-team export: every team, every track, every issue row,
  Jira keys clickable.
- **Velocity** (added 2026-08-28) — offered only for a **completed** sprint: per-scrum-team story
  points per developer, split by work type, plus the portfolio rate. Drops health, completion,
  teams-complete and risk entirely.

Three choices are made **at generation time** rather than baked in (both non-team ones at Naveen's
request): the **effort metric**, whether to **emphasise risk**, and **which teams** to include.

## The Velocity variant (2026-08-28)

Driven by a live leadership ask (Slack, Ankur Agarwal → Naveen): *"I want details of 6 SP per dev per
PDLC sprint, what are we doing/delivering with that … where is that 6SP/Dev going and what we are
achieving in that."* The thread's frame — 12 SP/dev expected, 6 toward GM deliveries, 6 into tech
debt/upgrades — is why the report is not a single velocity number but the **per-developer rate split
across the four work types**. That is the existing composition breakdown, divided by team size.

Ratified with Naveen:

6. **Team size comes from per-team dialog inputs, prefilled from the admin `Team.developerCount`.**
   Report-scoped: edits never write back, `/admin` stays the source of truth. An **absent** entry
   falls back to the admin value; an **explicit blank** does not — the field is prefilled, so
   clearing it is the only way to say "report this team without a rate".
7. **"Per developer" is a rate, not a roster** — delivered ÷ team size per work type. No named
   individuals, so the report adds no personal data and no cross-org ranking.
8. **Scorecard only, one page.** No burndown, no risk register, no issue detail.
9. **Completed sprints only** — `isSprintComplete` (CLOSED, or phase `released`/`ended`), extracted
   from the existing `defaultRiskEmphasis` so the two can never drift. The toggle is disabled with an
   explanatory `title` on a running sprint.
10. **Content deltas:** Sprint health ⇒ literal "Completed"; completion, teams-complete and at-risk
    tiles removed; story points ⇒ delivered only; no health column, no risk call-outs.

### Two correctness properties worth stating

**The overall rate divides sized teams only, on both sides.** Folding an unsized team's points into
the numerator while its people are absent from the denominator inflates the one number leadership
quotes. On live August data with AAI unsized that is 29.2 SP/dev (904 ÷ 31), not 33.1 (1027 ÷ 31) —
a 13% overstatement. The page names the excluded teams underneath.

**Columns reconcile with their row total** (`apportionRounded`, largest-remainder). Rounding each
column independently made the live August row read `310 + 413 + 133 + 172 = 1028` beside a TOTAL of
`1027`, and `39.4` beside a TOTAL/dev of `39.5`. Every column was individually correct and the table
was still wrong — fatal in a report a VP will add up. Exact values are untouched; only the
`*Display` fields are apportioned, so nothing downstream computes off a rounded figure.

### Access — a deliberate call

`/leaderboard` gates "points ÷ developers" behind `LEADERBOARD_ROLES` (TPM excluded). This report
adds **no** new gate: the per-team delivered points are already on `/rollup` for exactly these teams,
`developerCount` is admin config rather than personal data, there are no named individuals and no
ranking across the org. Gating it would also lock out TPM — a `PROGRAM_ROLES` persona whose job is
program reporting. `data.hasLeaderboardAccess` is already on `getRollupData`'s return if this is ever
reconsidered.

## Decisions (confirmed with Naveen)

1. **One dialog, a segmented Executive / Full-detail toggle** — not two hero buttons. The roll-up
   hero already carries the countdown pill and AI Digest; this adds exactly one button.
2. **Full detail means per-issue rows** — true parity with the scrum-team export (~40–60 A4 pages at
   today's ~572 issues). The team pills trim it before generating.
3. **A4 landscape for both variants** (`LANDSCAPE`, 1123x794px / 297x210mm). A multi-team scorecard
   needs the width; `/bugs` set the precedent that a leadership report goes landscape.
4. **Effort metric is a dialog control**, not a fixed reading (Naveen: *"For effort metric ask that
   during report generation."*). `both` (default) / `delivered` / `planned`. It drives the bar
   **geometry** as well as the numerals, so the control changes the picture, not just the digits.
5. **Risk emphasis is a dialog control with a state-derived default** (Naveen: *"for completed
   sprint there is no point in highlighting the risk. Give option for this also during report
   generation."*). Off when the sprint is `CLOSED` or its phase is `released`/`ended`; on otherwise;
   always overridable.

## What risk emphasis changes

| | Risk **on** | Risk **off** |
|---|---|---|
| KPI tile 4 | **At risk** — `atRisk + behind`, `N blocked` | **Teams complete** — `N of M`, tone positive |
| Risk register page | present | dropped |
| Scorecard row order | worst-health-first (`TONE_RANK`, mirrors `TeamSummaryTable`) | delivered points descending — an achievement ranking |
| Burndown projection | drawn when present | already `null` past `developmentEnd` — no special-casing needed |

## Effort modes

| Mode | Scorecard cell | Bar geometry |
|---|---|---|
| `both` (default) | `48 / 78 · 62%` | planned-width lane with a delivered fill inside — the on-screen scoreboard's zone/fill grammar |
| `delivered` | `48` | segments sized by delivered points |
| `planned` | `78` | segments sized by planned points |

Per-**issue** rows in the detail variant are unaffected — they always show percent, stages and
health, exactly as the sprint export does.

## Architecture

`/rollup` is a **server component**, so the dashboard's `useState`-in-parent pattern is unavailable.
`RollupExport` follows the `BugExport` / `RollupDigestButton` shape: one `"use client"` leaf owning
its own button, dialog state and toast.

**No new query and no new API route** — every figure is already on the page. `perTeam[i].metrics`
carries `committedPoints` / `techDebtPoints` / `externalPoints` / `internalPoints` with their
`*CompletedPoints` twins plus `issues[]`; `combined` (`aggregateRollup`) carries the identical field
names for the portfolio total. `perTeam` **already crosses the server/client boundary today**
(`RollupStoryPoints` receives `teams={perTeam}`), so the dialog adds no payload.

### Files

New:

| File | Contents |
|---|---|
| `src/lib/export/page-packer.mjs` | Height-budgeted section packer, **moved** from `src/lib/bug-report/pdf-layout.mjs`. Pure. |
| `src/lib/rollup/pdf-layout.mjs` | Pure roll-up layout — `paginateRollupDetail`, `orderTeamsForReport`, `effortCells`, `defaultRiskEmphasis`, `teamCompositionRow`. |
| `src/components/rollup/rollup-export.jsx` | `"use client"` — button, dialog, controls, capture flow. |
| `src/components/rollup/rollup-export-pages.jsx` | Print page components + print-hex visuals. Presentational, no hooks. |

Modified:

| File | Change |
|---|---|
| `src/app/rollup/page.jsx` | Mount `RollupExport` in the hero action row beside `RollupDigestButton`. |
| `src/lib/bug-report/pdf-layout.mjs` | Import the packer from the shared module; re-export the constants so existing importers are untouched. **No behavior change.** |
| `src/lib/export/print-theme.mjs` | Add `WORK_TYPE_PRINT`. Purely additive. |
| `src/lib/dashboard-data.js` | Select `developerCount` on **both** team paths (`getMembershipContext` and the program-scoped query) — the Velocity report's divisor. Additive. |

### On moving the packer

`packSections` was module-private in `bug-report/pdf-layout.mjs`. The roll-up detail pages need
exactly its three-level packing (team -> track -> issues, against the bug report's team -> developer
-> issue). The repo has direct precedent: `export-visual-consistency.md` decision 1 extracted the
whole print kit out of `/bugs` into `src/lib/export/` + `src/components/export/` the first time a
second consumer appeared, and `src/lib/export/` is where shared export machinery lives. The move is
a pure-function relocation with no signature change, guarded by a byte-parity fixture against the
existing `/bugs` inputs.

## Print palette for the four work types

The on-ink palette (`--on-ink-cat-*`) is built for a **dark** surface and is theme-reactive; the
print sheet is white and must be theme-independent. `WORK_TYPE_PRINT` reuses the mapping the sprint
export's "Work composition" panel already ships, so the two exports agree by construction:

| Work type | Token | Hex |
|---|---|---|
| Committed (Roadmap) | `BLUE` | `#2563eb` |
| Tech Debt | `ORANGE` | `#f97316` |
| External Bugs | `RED` | `#e11d48` |
| Internal Bugs | `PURPLE` | `#7c3aed` |

**Deliberate deviation:** the app's on-ink "solid = planned, hatch = reactive bug" texture grammar is
**not** carried into print. The hatch utilities colour-mix against `var(--ink)`, so they are simply
wrong on white and must be re-authored regardless; and on white these four hues are far enough apart
that texture is not load-bearing for CVD the way it is on ink (where brand vs. cat-3 sits at
ΔE 4.8). If the grammar is wanted in print later, add it as an SVG `pattern` fill — SVG is proven to
survive capture (`PrintTrend`), whereas a repeating-linear-gradient is untested on this path.

## Capture rules honoured

- Print pages are **re-authored**, never captured live components (`bug-report-pdf-export.md` d4).
- SVG is painted with **literal hex presentation attributes**, never Tailwind classes or
  `currentColor` — token-driven paint does not survive the capture. `PrintTrend` is the reference.
- `await document.fonts.ready` before the dynamic import; `captureOptions` also awaits fonts in the
  cloned document.
- `html2canvas-pro` and `jspdf` are dynamic-imported at event time, so neither lands in the initial
  bundle.
- The offscreen container is **rendered, not display:none**, parked far off-canvas at natural size
  with **no CSS transform** — `overlayLinks` derives mm-per-px from the live bounding rect.
- `overlayLinks` runs **after** `addImage` for each page (jsPDF annotates the current page).
- PNG caps at `scale: 2` and stacks pages into one tall canvas; no link annotations.
- Every points figure goes through `formatPoints` (float artifacts).
- `externalPoints + internalPoints === unplannedPoints` — never sum all five buckets.
- `metrics.committedPoints` (FEATURE scope) is not `capacity.committedPoints` (admin target).

## Invariants

- **No new route** — build stays at **49 ƒ Dynamic**.
- **No schema change** — **12 Prisma migrations**, untouched.
- **§12 metric core untouched** — this reads `computeSprintMetrics` / `aggregateRollup` output and
  adds nothing to it.

## As-built notes

### Page structure changed during the build (and why)

The plan put the burndown on page 1 and the team scorecard on page 2. Rendering it proved that
wrong twice, and the measurements are worth keeping:

1. **Page 1 had ~35% dead space** with only KPIs + composition + burndown/readout on it.
2. Filling it by stretching the panels just moved the dead space *inside* them, and the burndown
   letterboxed badly — a flat 1000x200 viewBox stretched into a tall box strands the chart in a
   middle band.
3. Pulling the scorecard up onto page 1 *with* the burndown did not fit: measured 838px of content
   against a 738px body, and the scorecard silently clipped **80px (three team rows)** because its
   panel is `overflow-hidden`.

**Shipped structure** — the scorecard is the headline the feature was asked for, so it owns page 1
and the burndown moved to its own sheet where it is actually legible:

| Page | Contents |
|---|---|
| 1 | Header · 5 KPI tiles · portfolio composition band · **effort-by-scrum-team scorecard** (up to `INLINE_SCORECARD_ROWS = 12` teams, then continuation pages) |
| 2 | Sprint burndown (full width, taller `VB_H = 360` viewBox) + four delivery readouts across the foot |
| 3+ | Risk register, 18 rows/page — only when risk emphasis is on |
| then | Full-detail team -> track -> issue pages (packed) |

At today's data a released sprint's executive report is **2 pages**; with risk on, **4**; full detail
for 6 teams / 410 issues is **32**.

### Aggregate points are rounded, not `formatPoints`-ed

First render showed `1027.19 / 1117.54` on the KPI tile. Every other aggregate readout in the app
(`export-dialog.jsx` KPI tiles, `team-summary-table.jsx`) uses `Math.round`, so `effortCells` and the
aggregate readouts now do too — weighted completion makes these sums fractional, and unrounded they
read as noise rather than precision. Rounding also disposes of the IEEE-754 artifacts `formatPoints`
guards elsewhere. **Per-issue** points in the risk register keep `formatPoints`, since one story
genuinely can be half a point.

### One additive data change

`getRollupData` now also returns **`teamSnapshots`** (the raw per-team snapshot rows). The export
lets the reader deselect teams, and `combinedSnapshots` has already summed `teamId` away — a
portfolio burndown that still included a dropped team would be a silently wrong number in a
leadership document. The dialog re-runs the same pure `combineSnapshotsByDay` over just the selected
teams. Purely additive: no existing field changed, and the rows are tiny (one per team per day).

### Small a11y improvement

The team-pill group gained `role="group"` + `aria-label="Include teams"`, matching the variant
toggle. It also makes the group unambiguous to select against — without it a `button[aria-pressed]`
selector also matches the Executive/Full-detail toggle.

## Verification (2026-08-27)

| Check | Result |
|---|---|
| `yarn lint` | clean |
| `prisma validate` + `migrate status` | valid · **12 migrations**, unchanged, in sync |
| Cold DB/env-free build (`rm -rf .next`, both `.env` and `.env.production` moved aside and confirmed absent) | exit 0 · **49 ƒ Dynamic**, unchanged · no `Environments:` line |
| Bundle split | `/rollup` initial payload references **none** of the 3 chunks carrying real html2canvas/jsPDF internals |
| Packer move parity | **byte-identical** output over a synthetic spread (tiny team, empty team, continuation-forcing team, both paginators, 3 body heights) — captured before the move, re-run after |
| Pure fixtures | **65/65** — `defaultRiskEmphasis` across state x phase, `effortCells` all modes incl. zero/undefined, `orderTeamsForReport` both orderings + non-mutation, `tracksForTeam` grouping/order, `paginateRollupDetail` orphan rule + continuation flags + no lost/duplicated issues |
| SSR smoke (`next start` + minted iron-session cookie vs Neon, read-only) | **19/19** — button renders for my-teams and `?program=`; auth gate leaks no team/sprint/program/user data; zero float artifacts in visible text |
| Browser render (headless Chromium) | **42/42**, stable over 4 consecutive runs — dialog opens, all controls present, every sheet mounts, burndown SVG draws, risk default flips by phase, effort modes change output, no console errors, **no sheet overflows or clips content** |
| Real capture path | **9/9** — PDF downloads, page count matches the report, landscape A4 `MediaBox [0 0 841.89 595.28]`, UTF-16 metadata decodes to the right title |
| Clickable Jira links | risk-on export: 4 pages / **29** link annotations / 29 distinct browse URLs; single-team full detail: 9 pages / **88** |

**The overflow guard was proven non-vacuous**: forcing `RISK_ROWS_PER_PAGE = 40` made it fail with
`pastEdge 382`. Note the guard deliberately uses `sheet.scrollHeight > clientHeight` plus a clipping
sweep — a page-column `scrollHeight` comparison was tried and rejected as it rounds up (the shipped
`/bugs` export shows the same phantom +3 on every page) and drifted 3/6/12 between runs, while
`getBoundingClientRect` measures an exact 738-against-738 fit.

### Verification — full suite re-run at feature close (2026-08-28)

| Step | Result |
|---|---|
| Lint | `yarn lint` clean |
| Tests | **None by design.** Weight carried by pure fixtures + smoke below. |
| Pure fixtures | rollup layout **65/65** · velocity **88/88** · packer-move parity **byte-identical** |
| Schema / migrations | `prisma validate` valid · **12 migrations**, "Database schema is up to date" |
| Production build | Cold `rm -rf .next` with **both** `.env` and `.env.production` moved aside and confirmed absent → **exit 0**, **49 ƒ Dynamic** (unchanged), no `Environments:` line; env restored |
| Bundle split | `/rollup`'s initial payload references **none** of the 3 chunks carrying real html2canvas/jsPDF internals |
| Health | `/p/health` 200 · `/api/health/db` **200** (real Neon connectivity) |
| SSR smoke | **20/20** — authed 200 renders; anon **and** a garbage session cookie leak no team, sprint, program, headcount or user identity; an unknown sprint id degrades to a rendered page; no float artifacts in visible text (scanner proven non-vacuous) |
| Browser E2E | **30/30** — all three variants render; executive keeps its KPI set, scorecard, trend page and burndown SVG; effort + risk controls still drive output; risk defaults off on a released sprint; detail paginates with Jira anchors; velocity is one page with exactly its five KPI labels and **no** health/completion/teams-complete/at-risk/risk-register; a cleared team size raises the exclusion caveat; velocity **disabled** on the still-running September sprint; **no sheet overflows or clips on any variant** |
| PDF capture | Velocity PDF exports — one page, landscape A4 `MediaBox [0 0 841.89 595.28]`, filename carries `_Velocity_` |
| Cross-check vs `/leaderboard` | **all 6 teams agree exactly** (39.5 / 31.2 / 27.9 / 26.0 / 25.4 / 20.4). Both surfaces also moved together after an unrelated DX/D360 sync mid-verification, which is itself evidence the report tracks live data rather than a cache. |

### As-built notes — Velocity variant (vs. the plan)

1. **`apportionRounded` was not in the plan.** The first render exposed that independently rounded
   columns do not sum to their row total — live August printed `310 + 413 + 133 + 172 = 1028` beside a
   TOTAL of `1027`, and `39.4` beside a TOTAL/dev of `39.5`. Added largest-remainder apportionment;
   exact values are untouched and only `deliveredDisplay`/`perDevDisplay` are rounded, so nothing
   downstream computes off a rounded figure. A fixture asserts naive rounding really does break on
   those numbers, so the guard cannot silently become vacuous.
2. **Size resolution needed a rule the plan did not state.** An **absent** key in `sizeByTeamId` falls
   back to the admin `Team.developerCount`; an **explicit blank** does not. The dialog prefills every
   field, so clearing one is the only way to opt a team out of per-dev rates — a fallback there would
   make that impossible. Found by a fixture whose first expectation was wrong.
3. **Own pagination constants.** The velocity rows are two-line, so `INLINE_VELOCITY_ROWS = 8` /
   `VELOCITY_ROWS_PER_PAGE = 12` rather than reusing the executive table's 12/16.
4. **Open item settled:** no `CUSTOM`-workflow filter exists in live data (`Filter` holds only
   FEATURE / TECH_DEBT / SUPPORT / INTERNAL_BUG / NEEDS_ATTENTION), so the four columns sum exactly to
   the all-work total and **no "Other" column was added**. TOTAL still reads `completedPoints`, so it
   stays correct if a CUSTOM track ever appears — the columns would simply stop summing to it.
5. **`isSprintComplete` was extracted, not written fresh** — `defaultRiskEmphasis` is now its
   negation, with a fixture asserting they are exact inverses across state × phase so they cannot drift.
6. **A latent TDZ bug was caught before it shipped:** the derived `activeRiskEmphasis` was initially
   declared below its first use in a `useMemo` dependency array, which would have thrown at runtime.
   ESLint did not flag it (`no-use-before-define` is off in this config).

### Independent data-integrity audit (2026-08-28)

Prompted by a report of deleted / wrongly-updated filter data. **The export was excluded as a cause,
measured rather than argued:** the diff adds zero write calls, and driving all three variants with
non-GET requests intercepted produced **32 GETs and 0 writes**. The writes were attributable to board
actions ~1h earlier — DX and D360 synced at 08:02/08:04 UTC with `updatedById = null` (sync engine),
a DX "Internal Bugs" filter created at 08:02, and a CALM progress row edited at 08:09 by
`naveens@tekion.com`. Two genuine data findings were handed back and remain **open, unrelated to this
feature**: DX → Tech Debt caches **0 issues** after its sync (its `sub-component[dropdown]` list may be
stale), and CALM carries **66 orphaned TECH_DEBT progress rows** against 3 live issues (its filter is
the original 07-08 "Tech Debt & Vulnerabilities", never regenerated by Sprint Start). Also surfaced:
`IssueProgress` has **no `createdAt`**, so a freshly-seeded row and one overwritten by "Sync stages"
are indistinguishable after the fact — a real observability gap if stage overwrites need auditing.

**Not verified here (Naveen's step):** authed real-browser visual acceptance — the headless capture
is known to collapse inter-word spacing (`bug-report-pdf-export.md`), so type spacing must be judged
in a real browser.
