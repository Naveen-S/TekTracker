# Sync Jira — completed and Blocked Jira statuses

> Bug fix (not a master-plan step). Branch `fix/GM-11768-sync-jira-status-rules` off `main` @ `9d53308`.
> Requested by Naveen, 2026-11-05. Jira: **GM-11768** (Tech Story under epic GM-3651).

## Status

**Done 2026-11-10.** Implemented in `src/lib/sync/seeding.mjs` (status lists + `resolveBlockedRule`
/ `resolveStatusRules`; completed statuses in `buildSeededStages`), `src/lib/sync/engine.js` (both
`syncTeamSprint` and `syncFilterStagesFromJira`) and `src/components/dashboard/dashboard.jsx` (toast
counts).
- **Verification:**
  - `eslint src`: 0 problems;
  - `prisma validate` passes, `migrate status` up to date, **16 migrations, no schema change**;
  - env-free Node 22 build in a clean copy (0 `.env` files): exit 0, **67 ƒ**, 0 warning lines,
    both sync routes `ƒ`;
  - **15/15 pure fixtures**;
  - **31/31 runtime smoke**, real engine against real Jira (read-only) and Neon via `next start`.
    A throwaway team held six live issues (UAT ×2, Won't Fix, Blocked ×2, Done). It covered
    401 unauthenticated on both routes; forward-complete with `updatedById` null; Blocked set;
    a hand-set block kept; a sync-set block lifted; new rows sized 10 / 4; summary counts equal to
    the rows; a second Sync Jira a no-op; and Sync stages leaving a Blocked row's stages alone, not
    calling Blocked unmapped. **Torn down to 0 rows.**
- **Pending:** Naveen's authed pass on a real team; the commit.

## Overview

Two board bugs, both because the top-level **Sync Jira** ignored the issue's Jira status once a
progress row existed (it is create-only, sync-hybrid-seeding.md decision 5):

1. **Finished work stayed unfinished.** An issue already on the board that moved to UAT, Testing,
   Support Validation, Support Clarification, Won't Fix or Not Applicable kept its old, partly
   checked list, so it read as At Risk / Behind. Several of those statuses also had no
   `StatusStageMapping` row on some workflows (Support Clarification and Won't Fix had none at all),
   so even a new row seeded empty.
2. **Jira "Blocked" never reached the board.** Health only goes Blocked when someone flags the row
   by hand.

## Decisions

1. **Completed statuses are a code list, not mapping rows.** `COMPLETED_JIRA_STATUSES`
   (`src/lib/sync/seeding.mjs`) = the six requested statuses plus Done, Closed and Released (already
   terminal in every seed mapping). Matched case-insensitively, typographic apostrophe folded. Code,
   so it holds on every workflow without re-seeding the office DB.
2. **Top-level Sync Jira forward-completes.** For an existing row whose status is completed and
   whose checklist is not all checked, the sync checks every stage, stamps `seededFromStatus` and
   resets `updatedById` to null (status-derived, the sync-stages-from-jira.md convention). Already
   complete → no write, so re-syncs are no-ops. This replaces the hand edit: Jira says it is done.
3. **Blocked status blocks the row.** Status `Blocked` sets `blocked: true` with
   `blockedReason = "Blocked in Jira"` (`JIRA_BLOCKED_REASON`), on new and existing rows. A row
   that is already blocked keeps its own reason.
4. **The sync only lifts its own blocks.** When the status moves off Blocked, the row is unblocked
   only if its reason is still exactly `"Blocked in Jira"`. A hand-set block is never undone. (No
   schema column: the reason string is the marker. If someone edits that reason, the block becomes
   theirs.)
5. **Everything else stays create-only.** A non-terminal status still never moves an existing row's
   stages; that remains the per-track "Sync stages" button's job.
6. **Scope = `syncTeamSprint`.** So it applies to the Sync Jira button, One-Click Sprint Start and the
   daily cron alike.
7. **[Amended 2026-11-05, Naveen] The per-track "Sync stages" behaves the same.** It already
   overwrites stages from status, so the completed list reaches it through `buildSeededStages`.
   It now also runs the same Blocked rule (`resolveBlockedRule`, shared with `resolveStatusRules`).
   A Blocked status leaves that row's stages alone and is no longer reported as an unmapped status.
   The toast adds "N blocked in Jira · N unblocked".

## Effects to expect

- A Blocked **roadmap or tech-debt** issue makes Sprint Health **Critical** (§12: any blocked
  delivery issue). That is the existing rule, now fed by Jira.
- Completed issues count toward completed points, so velocity and the burndown move on the next
  sync or cron run.
- The sync toast adds "N completed from Jira · N blocked in Jira · N unblocked" when non-zero.

## Scope

- `src/lib/sync/seeding.mjs`: `COMPLETED_JIRA_STATUSES`, `BLOCKED_JIRA_STATUSES`,
  `JIRA_BLOCKED_REASON`, `isCompletedJiraStatus`, `isBlockedJiraStatus`, `resolveBlockedRule`,
  `resolveStatusRules`;
  `buildSeededStages` checks every stage for a completed status.
- `src/lib/sync/engine.js` `syncTeamSprint`: steps 3–4 apply the rules; returns `statusCompleted`,
  `statusBlocked`, `statusUnblocked`. `syncFilterStagesFromJira`: the Blocked rule (two `updateMany`
  writes, block / lift), Blocked excluded from the unmapped count; returns `statusBlocked`,
  `statusUnblocked`.
- `src/components/dashboard/dashboard.jsx`: toast counts for both syncs.
- No schema change, no migration, no new route: **67 ƒ / 16 migrations unchanged**. §12 metric code
  untouched (it already reads `stageCompletion` and `blocked`).

## Acceptance

- [x] 15/15 pure fixtures (incl. the shared Blocked rule, and Sync stages never wiping stages on a
      Blocked status) (all six statuses in any case; seed on all four workflows; forward-complete;
      idempotent; Blocked sets, keeps a manual block, lifts only its own; Blocked → Won't Fix in one
      pass; zero-stage workflow untouched).
- [x] eslint clean on changed files; env-free Node 22 build exit 0, 67 ƒ, 0 warnings.
- [x] 31/31 runtime smoke on a throwaway team against real Jira + Neon (see Status).
- [ ] Naveen: Sync Jira and a track's Sync stages on a real team with a UAT / Won't Fix issue and a
      Blocked issue.

## As-built notes (vs. the spec)

1. **Done / Closed / Released joined the completed list.** Naveen asked for six statuses; the three
   that were already terminal in every seed mapping were added so a row that reached Done after it
   was seeded also completes on Sync Jira (same bug, same fix).
2. **Forward-complete counts existing rows only.** `statusCompleted` counts rows the sync completed;
   a brand-new row seeded complete is counted under `progressSeeded`, as before.
3. **Status-derived writes reset `updatedById` to null**, following sync-stages-from-jira.md, so a
   forward-completed row no longer counts as "manually edited" in the Sync stages confirm. A
   hand-set block or `riskComment` is untouched by this.
4. **Sync Jira's existing-row writes stay one `update` per changed row** (in the 30 s transaction)
   rather than `updateMany` groups: re-evaluation and the status rules merge into a per-row patch,
   and only rows that actually change are written. Sync stages' Blocked writes are two
   `updateMany` calls (block / lift), because they have only two payloads.
5. **A Blocked status in Sync stages still doesn't write stages.** It is excluded from the unmapped
   count and warning, but `resolveStageResync` still treats it as unmapped for the stage write, so an
   existing checklist is never wiped to all-false.
6. **The smoke adapts to live statuses.** Jira had moved since the cache: GM-9952 had gone from
   Code Review to UAT and ENG-219319 from Support Clarification to Done. The assertions read the
   status each sync wrote back, and also require every rule to run at least once. Support
   Clarification is covered by the pure fixtures only.
7. **Verification ran in a scratch copy** with its own `node_modules`, so Naveen's `yarn dev` on
   :3002 was never stopped or clobbered.
