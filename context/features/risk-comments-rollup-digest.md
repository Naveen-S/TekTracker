# Risk comments + roll-up risks dialog + roll-up AI digest

## Overview

Augment the risk-communication path from the team board up to leadership (§2.2 — the reason the
product exists), per Naveen's three asks (2026-07-20):

1. **Board-level risk comments.** Some items the §12 health bands flag as risk are *known and
   agreed* — e.g. dev/QA/PM have aligned that an item hands off to QA late. An EM/Lead can attach
   a short **risk comment** to any called-out issue on `/`, so the risk is communicated upward as
   *managed context*, not a fresh alarm.
2. **Roll-up shows every risk.** `/rollup`'s RiskCalloutsPanel caps at 6 rows (and its overflow
   line says "see the matrix below" — there is no matrix on the roll-up). A **"View all risks"
   dialog** lists every risky issue across teams, with team chips, blocked reasons, and the new
   risk comments — the ED/VP read surface for ask 1.
3. **Roll-up AI digest.** The fast follow parked in ai-insights.md (Out of scope №1): the same
   provider-agnostic platform generates a **portfolio digest** on `/rollup` — combined trend +
   per-team comparison + cross-team risks — "larger information in a jiffy". Risk comments feed
   the prompt so acknowledged risks are narrated as agreed, not escalated.

This extends the deterministic `RiskCalloutsPanel` (trend-burndown iteration, 2026-07-19) and the
ai-insights platform (2026-07-20). Touches project-overview §5 (AI summary row), §9 (data model),
§11 (risk panel notes), §12 (unchanged — comments are annotations, never metric inputs), §16.

> **Key architectural shift: the first schema change since `add_user_isadmin` (2026-06-15).**
> Risk comments are domain data → Postgres (§17), stored as a new nullable column
> **`IssueProgress.riskComment`** — one migration, §9 kept byte-consistent in the same PR
> (prisma-change workflow). Everything else rides on existing plumbing: the progress PUT, the
> `lib/ai/` platform, and one new membership-derived route.

Not the next in-order roadmap step in the strict sense — the master plan is complete — but the
natural successor named by ai-insights.md ("roll-up digest — fast follow") plus a product
iteration on the risk panel. Sequencing: **ai-insights is Done but uncommitted on
`feature/ai-insights`** — this feature branches off it (the ui-polish → share-view-export
precedent) or lands after Naveen commits/merges it.

## Status

Planned 2026-07-20.

## Decisions

The three asks are **ratified (Naveen 2026-07-20)**. The design decisions below are **PROPOSED**
with sensible defaults — flag disagreement at review; none block implementation.

1. **Storage: `IssueProgress.riskComment String?` (max 500), one additive migration.** The row is
   already keyed `(teamId, sprintId, jiraKey)` — the comment survives re-syncs (sync never touches
   existing rows, §6), follows the issue across filters, is naturally sprint-scoped, and reaches
   `/rollup` through reads that already exist. **A non-empty comment IS the acknowledgement** — no
   separate boolean. *Alternatives considered:* a `RiskComment` model (author, timestamps,
   threading) — overkill for one agreed-upon note per issue per sprint, and no history requirement
   exists (the `AiDigest`-table deferral precedent); reusing `blockedReason` — wrong semantics
   (cleared on unblock; blocked ≠ acknowledged) and it would collide with real blocked reasons.
2. **Write path: extend the existing progress PUT — no new route.** `progressWriteSchema` gains
   optional `riskComment: z.string().trim().max(500).nullish()`; the "at least one of" guard
   becomes stage/blocked/riskComment. Unlike `blockedReason`, the comment is **independent of
   `blocked`** and is **never auto-cleared** — only an explicit write clears it (empty/whitespace
   string normalizes to `null` = remove). `TEAM_WRITER_ROLES`, create-on-first-write, checklist
   cascade untouched, `updatedById` attributed — all as today.
3. **Board UI: comment affordance on the risk panel rows; panel stays server-safe.**
   `RiskCalloutsPanel` gains an optional `onEditComment(issue)` callback — rendered as a small
   icon button per risk row only when the prop is passed. `dashboard.jsx` (already a client
   component) passes it when `can.write`; `/rollup` and any server render simply don't (functions
   can't cross the server boundary anyway). Editing opens a new small
   `risk-comment-dialog.jsx` (textarea + Save / Remove → progress PUT → `router.refresh()`, the
   house mutation pattern). Rows with a comment show it inline (the `blockedReason` treatment)
   plus a compact info-tone **"Known"** badge so managed risks read differently at a glance;
   comments are visible to every role, editable by writers.
4. **Roll-up read path: comments + blocked reasons attach per team — progress maps never merge.**
   `getRollupData`'s progress select adds `blockedReason` + `riskComment` (the roll-up panel shows
   neither today), and each `perTeam` entry's issues get the two fields attached from **that
   team's own** progress map (§9: the same jiraKey may exist in two teams) before the page
   flat-maps them. The roll-up panel then renders comments/reasons inline exactly like `/`.
5. **"View all risks" dialog on `/rollup` — a small client wrapper, read-only.** New
   `components/rollup/rollup-risk-section.jsx` (client) receives the serialized risky issues +
   trend series from the server page and renders the existing `RiskCalloutsPanel` (no hooks — it
   already renders inside the client `dashboard.jsx`) plus a "View all risks (N)" affordance
   (shown whenever N > 0; it also replaces the roll-up's inaccurate "see the matrix below"
   overflow line). The dialog lists **every** risky issue — severity badge, team chip, linked
   jiraKey, title, points, blocked reason, risk comment (untruncated) — worst-first, read-only
   (roll-up takes no writes, ed-rollup decision 6). *Alternative considered:* raising the panel
   cap instead — rejected, the two-up row was just compacted (2026-07-19) and N teams × risks
   doesn't fit a half-width card.
6. **Roll-up digest route: `POST /api/rollup/ai-digest`, body `{ sprintId }`.** The roll-up is
   membership-derived, not team-scoped, so the team route tree doesn't fit — a flat route (the
   `DELETE /api/shares/[shareId]` precedent) with a zod-validated body. Access mirrors the
   `/rollup` page exactly: `requireUser`, then reuse `getRollupData(user, { sprintId })` — 403
   when the caller has zero teams, 404 when the sprint doesn't exist, 400 when combined
   `totalIssues === 0` (the empty-board guard precedent). Same 503/502/500 AI error mappings as
   the team digest route. Route count 28 → **29 ƒ Dynamic**.
7. **Portfolio digest input/prompt: new pure builders in `digest.mjs`, same output contract.**
   `buildRollupDigestInput` composes: sprint window, combined §12 metrics (`aggregateRollup`
   output), combined trend/projection + snapshot velocity, a **per-team summary line each**
   (key/name, issues, pts done/total, avg %, health band, blocked count, staleness) so the model
   can compare teams, and the worst-N risks **across teams** (same Blocked → Behind → At Risk
   points-desc ordering, cap ~12, now carrying `teamKey`, `blockedReason`, `riskComment`).
   `buildRollupDigestPrompt`: ED/VP audience, compare teams and name the ones needing attention,
   and **treat commented risks as known/agreed — report them as managed context, never as new
   alarms** (ask 1's purpose, stated explicitly). Comments are Jira-adjacent free text → same
   injection-guard data framing. **The output contract (`digestContract`) is unchanged** — team
   attribution lives in the callout text; `sanitizeDigest` works as-is against the cross-team key
   set. *Alternative:* adding `teamKey` to the callout contract — deferred; keeps the schema
   shared and both providers' JSON modes untouched.
8. **Roll-up digest UI: reuse `AiDigestDialog` via an `endpoint` prop.** Generalize the dialog's
   `base` prop to the full endpoint URL + optional intro copy + a `body` payload; `/` passes
   `${base}/ai-digest`, roll-up passes `/api/rollup/ai-digest` with `{ sprintId }`. New tiny
   client `components/rollup/rollup-digest-button.jsx` (Sparkles button + dialog state) rendered
   in the roll-up hero row, gated on `aiEnabled` — `getRollupData` additionally returns
   `aiEnabled: isAiConfigured()` (same UI-affordance-only caveat; the route re-checks).
9. **Risk comments also feed the existing team digest.** `buildDigestInput`'s worst-N issues gain
   `riskComment` (from the same `progressByKey`), and the team system prompt gets the same
   known/agreed instruction — the board digest and the roll-up digest tell one consistent story.
   Small, but it's what makes ask 1 land everywhere leadership reads.
10. **Share/export surfaces stay comment-free and digest-free.** The share page renders no risk
    row (trend-burndown decision) and the export pages don't render comments — unchanged. The
    frozen-share snapshot keeps its current progress field selection (no `riskComment`), so
    nothing new enters frozen artifacts.

## Requirements

### Scope

**(a) Schema + migration (prisma-change workflow)**
- `prisma/schema.prisma`: `riskComment String?` on `IssueProgress` (after `blockedReason`), with a
  `///` doc comment (known/accepted-risk note; presence = acknowledged; survives sync).
- Migration `add_issueprogress_riskcomment` via `yarn db:migrate` (never `db push`); regenerate
  client; seed unaffected (verify `prisma/seed.mjs` touches no IssueProgress — it doesn't).
- project-overview §9 Prisma block updated in the same change (byte-consistency, §17); the ER
  diagram's trimmed attributes don't list `blockedReason`, so no diagram change.

**(b) Write path**
- `src/lib/schemas/progress.js`: optional `riskComment` (trim, max 500, nullish); superRefine
  becomes "at least one of stage / blocked / riskComment".
- `src/app/api/teams/[teamId]/sprints/[sprintId]/progress/[jiraKey]/route.js`: persist
  `riskComment` (undefined → keep existing; empty/whitespace → null) independent of the
  blocked/blockedReason logic.

**(c) Board UI (`/`)**
- `src/lib/dashboard-data.js` `getDashboardData`: progress select adds `riskComment`.
- `src/components/dashboard/risk-callouts-panel.jsx`: render `riskComment` inline on risk rows
  (both boards) + "Known" info badge; optional `onEditComment` prop → per-row edit button.
- New `src/components/dashboard/risk-comment-dialog.jsx` (client): textarea (500 max, counter),
  Save / Remove → `apiFetch` progress PUT → refresh + toast; inline error.
- `src/components/dashboard/dashboard.jsx`: dialog state + `onEditComment` wiring when
  `can.write`.

**(d) Roll-up risks (`/rollup`)**
- `src/lib/dashboard-data.js` `getRollupData`: progress select adds `blockedReason` +
  `riskComment`; `perTeam` issues carry both (attached per team, §9); returns `aiEnabled`.
- New `src/components/rollup/rollup-risk-section.jsx` (client): wraps `RiskCalloutsPanel` +
  "View all risks (N)" + the all-risks dialog (read-only, worst-first, team chips, linked keys,
  reasons + comments); replaces the direct panel render in `src/app/rollup/page.jsx`.

**(e) Roll-up AI digest**
- `src/lib/ai/digest.mjs`: pure `buildRollupDigestInput` / `buildRollupDigestPrompt`
  (decision 7); `buildDigestInput`/team prompt gain `riskComment` + the known/agreed line
  (decision 9). All plain-Node testable.
- New `src/app/api/rollup/ai-digest/route.js` (decision 6) + a small zod body schema
  (`{ sprintId: z.string() }`, in `src/lib/schemas/ai.js`).
- `src/components/dashboard/ai-digest-dialog.jsx`: `endpoint`/`body`/intro-copy generalization
  (decision 8); `/` call site updated in `dashboard.jsx`.
- New `src/components/rollup/rollup-digest-button.jsx` + hero wiring in
  `src/app/rollup/page.jsx`, gated on `aiEnabled`.

### Mechanism / gotchas

- **Read the installed Next 16 docs first** (`node_modules/next/dist/docs/`, AGENTS.md) for the
  new route (async `params` n/a — flat route, but body parsing + `force-dynamic` conventions) and
  before touching server/client component boundaries. Prisma 7 + Tailwind v4 cautions apply as
  ever.
- **Migration discipline:** `yarn db:migrate` against Neon with a named migration; `prisma
  migrate status` must show 3 migrations in sync; build stays DB/env-free.
- **Comments are annotations, never metric inputs** — nothing in `metrics.mjs` reads
  `riskComment`; §12 numbers cannot shift. The panel/dialog/digest are the only consumers.
- **§9 keying discipline:** never merge progress maps across teams on the roll-up — attach
  comment/reason fields inside each team's own map before flat-mapping (decision 4).
- **Sync/cron safety:** the sync engine's create-only seeding and the snapshot job never touch
  `riskComment` — verify with the survives-sync smoke, no code expected.
- **Server → client serialization:** the roll-up risk section and digest button are client leaves
  fed by the server page (RollupTopBar precedent); Dates in the trend series serialize fine, but
  pass only what the components need.
- **Prompt injection:** `riskComment` joins titles/blockedReason as attacker-adjacent free text —
  data-not-instructions framing in both prompts; output stays plain React text; only validated
  jiraKeys become links (`sanitizeDigest` unchanged).
- **Cost posture unchanged:** roll-up digest is user-initiated only; worst-N cap + per-team
  one-liners keep the payload bounded even at N teams; `maxOutputTokens` stays ~2048 unless the
  live smoke shows truncation.
- **No env reads at module load** in anything new (DB/env-free build invariant).

### Acceptance criteria

- `yarn lint` green; `prisma validate` + `migrate status` up to date (**3 migrations**);
  **DB/env-free build green — 29 ƒ Dynamic** (exactly the roll-up digest route added). (/verify)
- **Plain-Node fixtures** (scratchpad): roll-up digest input — per-team summary pick, cross-team
  worst-N ordering + cap + `teamKey`/`riskComment` pass-through, prompt determinism + the
  known/agreed + injection-guard lines; team digest input now carrying `riskComment`; progress
  schema accepts comment-only writes, rejects >500 and empty-payload.
- **SSR/API smoke on dev+Neon** (minted-cookie pattern, fabricated fixture, teardown to 0):
  - PUT riskComment: writer 200 (comment-only body), VIEWER 403, unknown key 404, >500 chars 400;
    empty string clears to null; blocked/unblock round-trip leaves the comment untouched.
  - A re-sync (mock Jira or engine call) leaves the comment intact.
  - `/` panel shows comment + Known badge; edit affordance present for writer, absent for VIEWER.
  - `/rollup` panel shows comments/reasons with team chips; "View all risks (N)" lists ALL risky
    issues (fabricate > 6 across 2 teams) incl. per-team comment attachment for a colliding
    jiraKey in two teams.
  - Roll-up digest route: unauth 401, zero-membership 403, unknown sprint 404, empty board 400,
    dormant 503; mock-provider 200 with the contract shape; `AI_PROVIDER` flip → identical digest
    (swap proof re-run); prompt payload contains team summaries + commented risk marked known.
  - Share page (live + frozen) and export render **no comments, no digest affordance**.
- **Live smoke:** one real roll-up digest generation against the configured provider.
- ⚠️ Human acceptance (Naveen): add a comment to a real at-risk issue on `/`, see it on
  `/rollup` (panel + dialog), generate a real roll-up digest and judge whether commented risks
  read as "known/agreed".

### Out of scope

- **Threaded/multi-author comments, comment history, author+timestamp display** — revisit if one
  note per issue per sprint proves insufficient (would be the `RiskComment`-model feature).
- **Comment affordance in the Delivery Matrix rows** — the ask is the risk panel; a matrix-wide
  annotation column is its own UX decision.
- **Comments in share/export surfaces** — deliberate exclusion (decision 10); an export
  "known risks" section belongs to the export-narrative post-v1 idea.
- **Risk comments influencing health/metrics** (e.g. an "accepted" state that downgrades
  severity) — comments are communication, not scoring; a real ack-workflow would be a §12 change.
- **Digest persistence/caching, streaming, rate limiting** — unchanged from ai-insights.md.
- **Remaining §16 AI use cases** (Q&A, stage suggestions) and export-embedded narrative.

## Doc-sync (§17 — same PR)

- **§9**: `riskComment` in the `IssueProgress` block (schema byte-consistency) + one line in the
  entity rationale (annotation, survives sync, never a metric input).
- **§5**: "AI summary (pluggable provider)" row — roll-up digest now BUILT (was "fast follow");
  Q&A + stage suggestions remain open. Risk call-out row/§11 notes mention comments + the
  roll-up all-risks dialog.
- **§11**: the trend/risk-row note — comment affordance on `/`, comments + View-all dialog +
  AI digest on `/rollup`.
- **§16**: append — risk comments decision (IssueProgress column, ratified asks 2026-07-20);
  roll-up digest amendment (fast follow delivered).
- **Master plan step 10 post-v1 clause**: roll-up digest done; remaining ideas shrink to export
  narrative, Q&A, stage suggestions.
- **ai-insights.md**: Out-of-scope №1 annotated "→ built, see risk-comments-rollup-digest.md".
- **current-feature.md**: Status/History per the finish-feature ritual.
- **Don't over-claim:** comments deliberately absent from share/export; digest contract
  unchanged (no per-team callout field); no failover automation; matrix has no comment UI.

## References

- @context/project-overview.md — §2.2 (leadership visibility), §9 (IssueProgress + keying), §12
  (metrics purity), §16 (AI decisions), §17 (conventions).
- @context/features/ai-insights.md — the platform this rides on; roll-up digest parked in Out of
  scope №1; injection-guard + mock-provider + swap-proof precedents.
- @context/features/trend-burndown.md — RiskCalloutsPanel as-built (worst-N ordering, subgrid
  rows, roll-up flat-map).
- @context/features/ed-rollup.md — membership-derived access, §9 never-merge rule, read-only
  roll-up (decision 6).
- @context/features/domain-apis.md — progress PUT semantics (idempotent target-state, decision 5).
- `src/components/dashboard/risk-callouts-panel.jsx` (rows to extend; `MAX_ISSUE_ROWS`, overflow
  line), `src/components/dashboard/ai-digest-dialog.jsx` (to generalize),
  `src/components/dashboard/dashboard.jsx` (wiring), `src/app/rollup/page.jsx` (flat-map +
  hero), `src/components/rollup/rollup-top-bar.jsx` (client-leaf precedent).
- `src/lib/dashboard-data.js` (`getRollupData`, `getDigestData`), `src/lib/ai/digest.mjs`,
  `src/lib/schemas/{progress,ai}.js`, `src/lib/rbac.js`,
  `src/app/api/teams/[teamId]/sprints/[sprintId]/{progress/[jiraKey],ai-digest}/route.js`,
  `prisma/schema.prisma` (`IssueProgress`).
