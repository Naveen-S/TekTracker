# Board polish — points formatting, Jira quick-links, shared program chip

> Status: **Done 2026-08-27.** Branch `program-wise-roll-up` (the same branch that carried
> program-rollup, merged at `bb26f28`). Post-v1 polish round, not a master-plan step.

## Overview

A small cross-cutting polish round on the board (`/`), the roll-up (`/rollup`) and `/admin`,
picked up after the program-rollup merge. Three unrelated-but-adjacent threads:

1. **Story points render as float artifacts.** Points are summed in JS all over the app (per
   track → per team → per sprint → rolled up again), and IEEE-754 addition leaks values like
   `41.260000000000005` into the UI wherever a binary-inexact point value participates. A single
   shared **display boundary** (`formatPoints`) normalizes every points readout.
2. **No fast way to open a track in Jira.** The board's filter cards knew the `jql` /
   `jiraFilterId` but offered no way to reach the issue navigator; the URL-building pattern was
   already duplicated inline in `needs-attention-panel.jsx` and the bug-report components.
3. **The program pill was copy-pasted.** program-rollup left two divergent inline
   implementations of the "{name} program" chip (board hero vs roll-up hero), plus a few loose
   a11y/visual ends in the new admin Programs section.

## Decisions

1. **`formatPoints` lives in `metrics.mjs` but is display-only.** It sits beside the metric core
   rather than in a UI util because every caller is already importing from `metrics.mjs`, and
   because the rounding contract belongs with the numbers it describes. It is **never** fed back
   into a calculation — §12's metric core is untouched (see Non-goals).
2. **Round to ≤2dp, drop trailing zeros** (`String(Math.round(v * 100) / 100)`) rather than
   `toFixed(2)`. `toFixed` would turn the overwhelmingly common integer case `2` into `"2.00"`,
   which is noisier than the bug being fixed. 2dp is chosen because Jira story-point values in
   this org already go to 2dp (`0.13`, `0.38` exist in live data).
3. **Filter-id wins over JQL** in `buildJiraSearchUrl`, matching `bug-lists.jsx`'s existing
   `BugReferenceLinks` precedence — though in practice a `Filter` only ever populates one, per
   its `sourceType`.
4. **The Jira link is a copy-to-clipboard button, not an anchor.** A track's JQL can be long and
   the user usually wants it pasteable; copying also avoids a mid-review tab switch. Failure is
   surfaced through the existing `showToast` rather than swallowed.
5. **One `ProgramChip` component** used verbatim by both heroes, so the board and roll-up read
   identically. Presentational (no hooks) so the server roll-up page can render it directly.

## Scope / as-built

**New**
- `src/lib/metrics.mjs` — `formatPoints(value)`. **Purely additive**: a new exported const, no
  existing function or field touched (the diff is a 10-line insertion).
- `src/lib/jira/url.js` — `buildJiraSearchUrl({ jiraBaseUrl, jql, jiraFilterId })` → issue-navigator
  URL, or `null` when there is no base URL or neither source is set.
- `src/components/ui/program-chip.jsx` — the shared "{name} program" pill.

**`formatPoints` applied at every points readout**
`issue-row.jsx` · `metric-grid.jsx` (Issues in scope) · `filter-panel.jsx` (per-track total) ·
`needs-attention-panel.jsx` · `risk-callouts-panel.jsx` · `rollup-risk-section.jsx`.
Two places already summing into a whole-number readout took `Math.round` for the same reason:
`metric-grid.jsx` Completion denominator, `team-summary-table.jsx`, `export-dialog.jsx`.

**Jira quick-link**
`filter-panel.jsx` gains a per-card copy button (`Copy` icon, `aria-label="Copy Jira link for
{name}"`); `dashboard.jsx` threads `jiraBaseUrl` + `showToast` down.

**Chip + admin polish**
`hero.jsx` and `rollup/page.jsx` both swapped to `<ProgramChip>` (the roll-up's divergent
uppercase "Program" variant is gone). `programs-config.jsx`: `focus-visible` ring + `title` on
the delete button, `role`/`aria-live` on the status message, `bg-info-soft` icon tile.
`admin-panel.jsx`: badge class cleanup.

## Non-goals

- **No change to §12.** No metric, snapshot, or aggregate value moves; `formatPoints` is applied
  strictly at render. No schema change, no migration (**stays at 12**), no new route
  (**stays at 49 ƒ Dynamic**).
- The duplicated inline Jira-URL construction in `needs-attention-panel.jsx` and the bug-report
  components was **not** migrated onto `buildJiraSearchUrl` — out of scope for this round, and
  worth doing when one of those files is next touched.

## Acceptance / verification

- `yarn lint` — clean.
- `prisma validate` + `migrate status` — valid, **12 migrations, up to date** (no schema change).
- **Cold DB/env-free build** — `rm -rf .next` with **`.env` *and* `.env.production` moved aside**
  and confirmed absent mid-build (a stricter bar than prior rounds, which left `.env.production`
  in place; the app reads no `STORYBOARD_*` var, so that file was never load-bearing). Passed,
  `.env` restored, route list **49 ƒ Dynamic — unchanged**.
- **Pure fixtures — 24/24 pass.** `formatPoints`: the reported artifact shape, `0.1+0.2`,
  accumulated thirds, integers/halves passing through untouched, ≤2dp ceiling, and defensive
  inputs (`null`/`undefined`/`NaN`/`""`/string). `buildJiraSearchUrl`: filter-id precedence,
  jql-only, filter-only, and all four null paths incl. empty strings.
- **SSR smoke — 21/21 pass** (`next start` + minted iron-session cookie vs Neon, read-only
  against existing rows so there was nothing to tear down): `/`, `/rollup`, `/rollup?program=`
  and `/admin` all 200; `ProgramChip` renders on the board hero **and** the program-scoped
  roll-up hero and is correctly **absent** on the unscoped roll-up; 4 copy buttons on the CALM
  board = exactly its 4 delivery filters (the 5th, `NEEDS_ATTENTION`, is partitioned into its own
  panel); the admin focus ring + `bg-info-soft` tile render; **zero** float artifacts
  (`\d+\.\d{3,} pts`) in any rendered page.
- **Auth gate re-confirmed** on all three pages: unauthenticated requests return Next's
  `NEXT_REDIRECT`-to-`/login` payload and leak no team, sprint, program or user data.
- **Visual acceptance = Naveen** (authed browser pass of the copy button, the toast, and both
  hero chips) — the browser extension has never been connected in this repo.

## As-built notes (vs. the plan)

- **The artifact is real but does not currently manifest.** A full scan of live Neon data (572
  cached issues) found **0** artifacts at every aggregation level — per-filter (0/36), per
  team+sprint (0/10), delivery-only (0/10), roll-up (0/2). The reason is JS's shortest-round-trip
  printing: small sums still print clean. The *source* is nonetheless present — `0.13` (×5
  issues) and `0.38` (×1) are the only binary-inexact point values in the data — and it takes
  only **two** of them landing on an integer-based track to break: `41 + 2×0.13` prints
  `"41.260000000000005"`, exactly the reported shape. So this round is **correct and warranted
  hardening, not a fix for a currently-visible defect**; it will start earning its keep the
  moment those issues regroup (a re-sync, a different filter, or a roll-up total).
- **Next 16 returns HTTP 200 for `redirect()` under `next start`, not just under dev.** The
  carry-forward note in `current-feature.md` scoped this gotcha to Turbopack *dev*; it applies to
  the production server too. The response is a 200 carrying a `NEXT_REDIRECT` payload. Smoke
  assertions must check content, never status — this cost three false failures in the first run.
- **`aria-live` is correctly absent from the `/admin` SSR HTML.** The status paragraph in
  `programs-config.jsx` is inside `{status && (…)}`, so the live region mounts *with* its message.
  Known minor a11y weakness: a live region that appears together with its content is announced
  unreliably by some screen readers. `role="alert"` (the error path) is announced on insertion by
  modern SRs, so the important case works; the `role="status"` success path is the softer one.
  **Left as-is deliberately** — hoisting an always-present wrapper would add an empty `mb-3`
  paragraph to the layout. Worth revisiting if the section grows more messaging.
- **`formatPoints` accepts a string** (`Number("5") → "5"`) as a side effect of the `Number()`
  coercion. Not relied on anywhere; `Issue.storyPoints` is a Prisma `Float` with `@default(0)`.
- **Banker's-rounding edge:** `formatPoints(2.005)` → `"2"`, because `2.005 * 100` is
  `200.49999999999997` in binary. Acceptable at a display boundary; noted so nobody later mistakes
  it for a bug.

## Doc-sync

`context/project-overview.md`: §11 UI/UX build-log row. This spec. `context/current-feature.md`.
No §5 feature row, §9 schema, or §16 decision entry — this round adds no feature, no data-model
change, and no ratified decision.

## References

- Reused seam: `formatDate`/`formatSprintWindow` in `src/lib/metrics.mjs` (the existing precedent
  for display-only helpers living beside the metric core).
- Precedent for the URL builder: `BugReferenceLinks` in `bug-lists.jsx`.
- Extends: `program-rollup.md` (the chip this round de-duplicates), `needs-attention-roster.md`
  (the partitioned track that explains the 4-of-5 copy-button count).
