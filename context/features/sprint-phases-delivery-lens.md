# Sprint phases (dev → QA/UAT → release) + two-lens metrics

**Requested by Naveen 2026-07-24** (rides on the uncommitted `feature/modern-theme` branch).
Two connected corrections to how a sprint's timeline and health are represented.

## Overview

1. **The sprint does NOT end at dev end.** A sprint runs three windows:
   - **Dev cycle** — `developmentStart → developmentEnd` (the committed build window)
   - **QA / UAT** — `developmentEnd → releaseDate`
   - **Released** — after `releaseDate`

   So the app must never say "Sprint ended" at dev end. It says **"Dev cycle ended · QA/UAT"** until
   the release date, and only "Released" after it. Example (August Release): Dev cycle Jun 25 – Jul 23,
   then QA/UAT until Aug 12, release Aug 12.

2. **Two-lens metrics.** Sprint *delivery health* and *throughput/capacity* are different questions and
   get different scopes:
   - **Delivery lens** (roadmap `FEATURE` + tech debt `TECH_DEBT`, measured against the **dev cycle**):
     the "is the committed sprint on track" signal. Feeds **Sprint Health**, **Completion %**, the
     **At-Risk** card, the **risk call-outs**, and the hero phase-bar dev frontier. Support/regression
     bugs are excluded — they're reactive and mostly surface during QA, so they must not move this
     signal.
   - **Throughput lens** (ALL work — roadmap + tech debt + support + internal bugs): **velocity** and
     **Issues in scope**. Bugs consume real capacity, so velocity now counts everything (it previously
     excluded support — this *widens* it).

## Decisions

All three ratified with Naveen via question prompts 2026-07-24:

1. **Phase bar = HYBRID.** During the dev cycle, delivery completion % (`deliveryAvgProgress`) drives the
   four dev phases (Scope · Design · Develop · Review); once the calendar passes dev end, dev phases are
   Done and QA · UAT · Release light up **by date** (position through the QA/UAT window). Alternatives
   (pure time-driven; minimal relabel) rejected.
2. **At-risk scope = delivery-scoped.** The At-Risk card + risk call-outs count only roadmap + tech-debt
   blocked/behind/at-risk, consistent with Sprint Health. A blocked support bug still shows as its own
   matrix row and counts toward velocity, but is not a "sprint risk".
3. **Metrics window stays the dev cycle.** Per-issue health/velocity time math is unchanged
   (`developmentStart → developmentEnd`) — delivery is still correctly measured against dev end. Only the
   *representation* of the post-dev timeline is new.
4. **Burndown / `SprintSnapshot` / trend stay ALL-WORK (throughput), unchanged.** Deliberate: keeps the
   snapshot contract and burndown history continuous (no schema change, no step in the series), and reads
   as "total remaining work". Delivery health is carried by the cards + phase bar + risk panel instead.
5. **AI digest → delivery-consistent.** Risk narration, `avgProgressPct`, and `healthCounts` in both the
   team and roll-up digest inputs now use the delivery lens (matching the risk panel + Sprint Health);
   `totalIssues/totalPoints/completedPoints` stay all-work as scope/workload context.

## Scope

- `src/lib/metrics.mjs` — new `getSprintPhase(sprint, asOf)` + `formatSprintWindow(sprint)`; two-lens
  `computeSprintMetrics` (adds `deliveryIssues`, `totalDeliveryIssues`, `deliveryPoints`,
  `deliveryCompletedPoints`, `deliveryAvgProgress`, `deliveryHealthCounts`; `sprintHealth` + `riskCount`/
  `blockedCount`/`behindCount`/`atRiskCount` re-scoped to delivery; `velocityPoints`/
  `velocityCompletedPoints` widened to all-work; `bandSprintHealth` params renamed to delivery); mirrored
  in `aggregateRollup`. Removed the old `feature*` fields (`featureHealthCounts`, `totalFeatureIssues`,
  `featureBlockedCount/OnTrackCount/AheadCount`).
- `ui/hero-shell.jsx` — `DaysRemainingPill` now takes `{ sprint, asOf }` and reads the phase.
- `dashboard/sprint-phase-bar.jsx` — hybrid dev-completion / QA-by-date model; takes `sprint` + `asOf`.
- `dashboard/hero.jsx`, `rollup/page.jsx`, `share/[token]/page.jsx`, `admin/admin-panel.jsx`,
  `dashboard/export-dialog.jsx` — eyebrow/subtitle → `formatSprintWindow`; pill → `{ sprint }`.
- `dashboard/metric-grid.jsx` — Completion + Sprint Health caption → delivery fields.
- `dashboard/dashboard.jsx` — phase-bar completion = `deliveryAvgProgress`; risk panel fed
  `metrics.deliveryIssues`.
- `rollup/page.jsx` + `rollup/team-summary-table.jsx` — risk section fed `deliveryIssues`; avg %, pts, and
  band distribution → delivery fields.
- `export-dialog.jsx` — Sprint-health/Completion leadership cards → delivery; velocity stays all-work.
- `lib/ai/digest.mjs` — team + roll-up digest inputs → delivery lens (decision 5).

**Not touched (deliberate):** the Delivery Matrix still lists every filter/row with per-issue health; the
`SprintSnapshot` model, cron, burndown series, and `snapshotValues` stay all-work (decision 4); no schema,
migration, route, or dependency change.

## Acceptance

- ✅ lint clean; DB/env-free build green — **35 ƒ Dynamic (unchanged)**.
- ✅ 22/22 plain-Node fixtures: support-blocked bug excluded from delivery `blockedCount`/`sprintHealth`;
  `totalIssues`/velocity count all, delivery counts roadmap+tech-debt; `aggregateRollup` no Critical leak
  from a support block; phase transitions dev/qa/released/ended; `formatSprintWindow` label.
- ⚠️ **Pending human acceptance (Naveen):** authed visual pass — the pill in each phase (dev → QA → after
  release), the hero window label, the hybrid phase bar, and that Sprint Health / At-Risk / Completion
  now ignore support/bugs while velocity + Issues-in-scope include them.

## Doc-sync (done 2026-07-24)

- project-overview **§12** — rewritten: two-lens block (delivery vs. throughput), the sprint-timeline
  bullet (`getSprintPhase`/`formatSprintWindow`), sprint-health line re-scoped to delivery (was
  FEATURE-only), velocity line widened to all-work; `asOf` bullet adds `getSprintPhase`; reference
  path corrected to `src/lib/metrics.mjs`.
- **§4** glossary — Sprint/Gate now spells out dev cycle → QA/UAT → released (ends at release date);
  Health = delivery lens; Velocity = all-work throughput.
- **§11** — BUILT 2026-07-24 note (phase-aware pill + window eyebrows + hybrid phase bar + two-lens).
- **§16** — ratified decision recorded (2026-07-24, both parts + the reactive-bugs rationale).
- Master-plan step-10 post-v1 clause + header `Last reviewed` bumped to 2026-07-24.
- current-feature.md — history entry appended (rides on the `feature/modern-theme` branch).

## References

- Decisions captured from three AskUserQuestion prompts, 2026-07-24.
- Builds on: trend-burndown.md (phase bar precedent, snapshot velocity), risk-comments-rollup-digest.md
  (risk panel + digest), ed-rollup.md (aggregateRollup), share-view-export.md (`asOf` clock).
