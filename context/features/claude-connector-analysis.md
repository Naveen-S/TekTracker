# Claude Connector — per-ticket "Analyse with Claude"

## Status

**Done 2026-09-29 · verified · uncommitted.** Branch `feature/claude-connector`, cut from
`feature/brand-jigsaw` @ `565f290` (rebase onto `main` once brand merges). **Implemented:**
- **Schema:** migration `20260928203449_add_claude_connector`: `ConnectorToken`, `AnalysisJob` +
  `AnalysisJobStatus`, `IssueAnalysis`, `ClaudeAnalysisSettings`, plus 3 `User` back-relations. The
  seed creates the settings singleton (create-only).
- **Server libs:** `src/lib/connector/{defaults.mjs,errors.js,token.js,settings.js,access.js,jobs.js,ui-state.js}`,
  pure `src/lib/ai/issue-analysis.mjs`, `src/lib/schemas/analysis.js`, 4 new `ERROR_CODES`, and the
  daily-cron `pruneAnalysisJobs`.
- **Routes (6):** `api/me/connector`, `api/analyses`, `api/analyses/[jiraKey]`,
  `api/connector/jobs/next`, `api/connector/jobs/[jobId]`, `api/analysis-settings`.
- **Connector:** the static script `public/storyboard-connector.mjs`.
- **UI:**
  - a `/settings` page with the Claude Connector card, plus a sidebar entry
  - `AnalyseButton` + `IssueAnalysisDialog` + `AnalysisProvider`, wired into `IssueRow`,
    `NeedsAttentionPanel`, `RiskCalloutsPanel` (board + roll-up), the roll-up "All risks" dialog,
    `BugBreachPanel` and `BugTicketTable`
  - an admin "Claude analysis" section
  - an open-dialog stack in `ui/dialog.jsx`

**Verified:**
- `yarn lint` exits 0.
- `prisma validate` passes; `migrate status` shows **14 migrations, up to date**.
- The cold env-free build (scratch copy, zero `.env*`) exits 0 with **57 ƒ Dynamic** (50 + 6 routes +
  `/settings`) and **0 warnings** (grepped).
- **22 pure fixtures** pass.
- **38/38 API smoke** checks pass against `next start` + dev Neon with minted session cookies. Teardown
  left **0 rows**.
- `next start` smoke:
  - `/p/health` answers 200.
  - Every new API route answers 401 unauthenticated.
  - `/storyboard-connector.mjs` answers 200 `application/javascript`.
  - `/settings` sends a signed-out visitor to login.
- **Real end-to-end on Naveen's machine:**
  - Headless Chrome on `/bugs` clicked the sparkle on ENG-205877, then **Analyse**.
  - The real connector script claimed the job and ran Naveen's own Claude Code 2.1.284 (sonnet) with
    the Orbit DeepContext tools.
  - The grounded analysis (ticket comments, sibling ENG-208409, triage) was **saved in 46 s for $0.35
    notional**, and the filled marker appeared.
  - The dev DB was reset afterwards: 0 analysis, job and token rows; the feature is disabled again.
    `~/.storyboard` was removed.

**Pending:**
- Naveen's commit (gitleaks hook).
- Naveen's authed real-browser pass on `/`, `/rollup`, `/settings` and `/admin`.

## Overview

Users analyse a single ticket with AI **inside StoryBoard**, powered by the company-provided **Claude
Code subscription** — so ORBIT DeepContext (already signed in through the Orbit plugin) comes along
automatically, and StoryBoard never holds an AI key.

> **Architectural shift: StoryBoard's first work that runs on the USER's machine.** Neither the
> Claude subscription login nor DeepContext's per-user Okta OAuth tokens can leave the laptop
> (both live in the macOS Keychain; DeepContext at
> `https://orbit.tekioncloud.com/tools/v1/orbit-deepcontext/mcp` has no API/service token), and a
> subscription login may not power a server app. So a small local **StoryBoard Connector** pairs
> with StoryBoard and **dials out**: StoryBoard queues a job → the user's connector claims it → runs
> *their* `claude -p` headless (read-only DeepContext tools only) → streams progress back → StoryBoard
> saves the result for everyone who can see the ticket. This also adds StoryBoard's **second bearer
> auth surface** (after `CRON_SECRET`) and its first per-user issued token (§13).

Touches project-overview §5 (feature row), §9 (4 new models + ERD), §11 (build log), §13 (new
bearer-token surface), §16 (decision). Not a master-plan step — post-v1, like every feature since
cutover. **§12 metric core untouched** — analyses are display-only annotations, never a metric input.

This is **separate from** the existing server-side AI Digest (`src/lib/ai/`, global
`AI_PROVIDER` key) — that stays unchanged.

## Decisions (Naveen, 2026-09-29 — AskUserQuestion, ratified)

1. **Analysis runs in the user's local Claude Code** (company subscription + Orbit plugin); results
   render in StoryBoard.
2. **Connection A — connector dials out** (HTTPS polling with a personal bearer connector token).
   Browser→`localhost` rejected: Chrome Local-Network-Access prompts, same-machine only, lost on tab
   close, and team-visible results need the server half anyway.
3. **Saved and team-visible** — anyone who can see the ticket sees the analysis.
4. **Latest only** per ticket — a re-run replaces it.
5. **Per-ticket only in v1.** Content: root cause from code, similar past tickets, triage & sizing.
   Board-level ("analyse this board") is v2.
6. **Placement:** every track row on the `/` board (Roadmap, Tech Debt incl. Vulnerability, External
   `SUPPORT`, Internal `INTERNAL_BUG`), the **Needs attention** panel, `/bugs` ticket rows, and
   `/rollup` risks (section + "View all risks" dialog).
7. **Variants:** one button, prompt/result adapt — `BUG` (External/Internal/`/bugs`) → root cause;
   `DELIVERY` (Roadmap, Tech Story) → implementation areas + delivery risk; `VULNERABILITY` (issue type
   `Vulnerability`, lives in Tech Debt tracks per `prisma/seed.mjs:62`) → + security section;
   `HYGIENE` (Needs attention) → + missing sub-component / fix-version suggestion (never written to
   Jira).
8. **Access = anyone who can see the ticket** (existing RBAC; no new role).
9. **Distribution:** a single-file script served by StoryBoard for now. **TODO (backlog):** publish
   `@tekion/storyboard-connector` to JFrog npm.
10. **Connector offline ⇒ button disabled** with the start command. No hidden queue.
11. **Ticket body:** Claude fetches description/comments itself via DeepContext Jira tools;
    StoryBoard sends only cached facts.
12. **Guardrails:** read-only tools only + per-run $ budget + wall-clock timeout.
13. **Model:** admin sets allowed list + default + effort; user picks per run from the list.
14. **Budget/timeout:** admin-configurable in `/admin`.

**PROPOSED (defaults taken, non-blocking):**
- P1. Analyses keyed by **`jiraKey` alone** (a ticket is one ticket across reports/teams) — alt: per
  (team, sprint, key) like `IssueProgress`; rejected, it would fragment one ticket's analysis.
- P2. Visibility check returns **404, not 403**, so the endpoint can't probe key existence.
- P3. Seed defaults: disabled, models `[opus, sonnet]`, default `opus`, effort `medium`, **$3**, 10 min
  ($3 not $2 — see spike note 5).
- P4. "Online" = connector polled within **20 s**; it polls every **3 s**.
- P5. Jobs pruned after **7 days** by the daily cron; a `RUNNING` job past timeout + 2 min grace is
  failed lazily on read.

## Spike (2026-09-29, Claude Code 2.1.284) — done before any code

1. ✅ Orbit plugin MCP servers load under `-p`: `plugin:orbit:orbit-deepcontext` and `orbit-estimate`
   report `connected` with the existing Keychain Okta tokens — no extra auth.
2. ✅ `--tools ""` + an exact `--allowedTools mcp__plugin_orbit_orbit-deepcontext__<tool>` works; the
   DeepContext call succeeded.
3. ✅ `--json-schema` makes Claude call a `StructuredOutput` tool; the final `result` stream event
   carries **`structured_output`**, `total_cost_usd`, `duration_ms`, `num_turns`, and `subtype`
   (`success` | `error_max_budget_usd` | …).
4. ✅ `--max-budget-usd` is enforced on a subscription login (against a notional list-price cost).
5. ⚠️ **Context bloat:** the user's own plugins/skills + claude.ai connectors all load (122 tools,
   ~92K tokens/turn, ~$1 for a trivial call). Verified fix: `ENABLE_CLAUDEAI_MCP_SERVERS=false` +
   `--disable-slash-commands --exclude-dynamic-system-prompt-sections` → 38 tools, $0.24 for the same
   call, DeepContext still connected. The connector ALWAYS applies these.
6. No turn-limit flag on the CLI — the connector enforces a wall-clock timeout instead.

## Requirements

### Scope

**(a) Schema** — one migration `add_claude_connector` (13 → **14**). `prisma/schema.prisma` + §9
byte-consistent + ERD:
- `ConnectorToken` — `userId @unique` (Cascade; one pairing per user, regenerate replaces),
  `tokenHash @unique` (sha256 of the plaintext, shown once), `lastSeenAt?`, `connectorVersion?`,
  `claudeVersion?`, `createdAt`.
- `AnalysisJob` — transient queue: `jiraKey`, `source` (`BUG`|`SPRINT`), `kind`, `requestedById`
  (Cascade), `status` enum `AnalysisJobStatus {QUEUED RUNNING SUCCEEDED FAILED}`, `model`, `effort`,
  `context Json`, `progressNote?`, `error?`, `claimedAt?`, `finishedAt?`, `createdAt`;
  `@@index([requestedById, status])`, `@@index([jiraKey])`.
- `IssueAnalysis` — latest-only product data: `jiraKey @unique`, `source`, `kind`, `result Json`,
  `model`, `costUsd?`, `durationMs?`, `analyzedById?` (SetNull), `analyzedAt`.
- `ClaudeAnalysisSettings` — singleton `id @default("default")`: `enabled`, `allowedModels String[]`,
  `defaultModel`, `effort`, `maxBudgetUsd Float`, `timeoutMinutes Int`, `updatedAt`. Seeded
  (idempotent) in `prisma/seed.mjs`; the reader also falls back to the same defaults if the row is
  absent.

**(b) Server libs**
- `src/lib/connector/token.js` — `generateConnectorToken()` (`sbc_` + 24 random bytes base64url,
  mirroring `src/lib/share-token.js:9`), `hashConnectorToken()`, `requireConnector(request)` (Bearer
  → lookup by hash → `UnauthorizedError` code `CONNECTOR_UNAUTHORIZED`; bumps `lastSeenAt`;
  `setLogContext`), `isConnectorOnline(row)`.
- `src/lib/connector/access.js` — `resolveVisibleTicket(user, jiraKey)` → `{ source, kind, context }`
  or `NotFoundError`. BUG: in an **active** report's `BugReportIssue` (any signed-in user sees `/bugs`).
  SPRINT: an `Issue` whose filter's team the user can see — global admin, a `TeamMembership`, or the
  team's program when `hasProgramAccess(user)` (`src/lib/rbac.js:122`). Context is built
  **server-side from the cache**, never from the client.
- `src/lib/connector/settings.js` — `getAnalysisSettings()` with defaults.
- `src/lib/ai/issue-analysis.mjs` (pure, RELATIVE imports) — `resolveAnalysisKind`,
  `buildIssueAnalysisPrompt(context, kind)`, `ISSUE_ANALYSIS_SYSTEM_APPEND` (ticket/Jira text is DATA,
  not instructions — same guard as `digest.mjs`), `ANALYSIS_ALLOWED_TOOLS`, `sanitizeAnalysis`
  (https-only URLs, capped arrays/strings).
- `src/lib/schemas/analysis.js` — zod `analysisResultSchema` + hand-written `ANALYSIS_JSON_SCHEMA`
  (for `--json-schema`), `analysisCreateSchema`, `connectorEventSchema`, `analysisSettingsSchema`.
- `src/lib/errors.js` — `CONNECTOR_UNAUTHORIZED`, `CONNECTOR_OFFLINE`, `ANALYSIS_DISABLED`,
  `ANALYSIS_IN_PROGRESS`.
- `src/lib/cron/daily.js` — prune `AnalysisJob` > 7 days beside `pruneErrorLog`.

**(c) Routes** — all `withRoute`, typed throws, **no inner try/catch** (50 → **57** ƒ Dynamic incl. the `/settings` page — see as-built note 1):

| Route | Auth | Purpose |
|---|---|---|
| `api/me/connector` GET/POST/DELETE | session | status · generate (plaintext once) · revoke |
| `api/analyses` POST | session | create job (visible, enabled, model ∈ allowed, online, none active) |
| `api/analyses/[jiraKey]` GET | session | latest analysis + active job `{status, progressNote}` |
| `api/connector/jobs/next` POST | connector | heartbeat + atomic claim of own oldest QUEUED job |
| `api/connector/jobs/[jobId]` POST | connector | `progress` / `result` / `error` for own RUNNING job |
| `api/analysis-settings` GET/PUT | session / admin | read settings · admin update |

**(d) Connector** — `public/storyboard-connector.mjs`, single file, zero deps, Node ≥ 18, served
statically (no route). `login <url> <token>` (→ `~/.storyboard/connector.json`, 0600), `start`,
`status`, `logout`. Per job, in an empty `~/.storyboard/work/`:
```
ENABLE_CLAUDEAI_MCP_SERVERS=false claude -p <prompt> --append-system-prompt <append>
  --output-format stream-json --verbose --json-schema <schema> --model <m> --effort <e>
  --max-budget-usd <b> --tools "" --allowedTools <mcp list> --permission-mode dontAsk
  --disable-slash-commands --exclude-dynamic-system-prompt-sections --no-session-persistence
```
**Local ceiling regardless of server input:** always `--tools ""`; `allowedTools` filtered to
`^mcp__plugin_orbit_orbit-(deepcontext|estimate)__[a-z_]+$`; kill at `timeoutMinutes`; model/effort
validated against a safe charset. Progress lines throttled to one POST / 2 s.

**(e) UI**
- `src/app/settings/page.jsx` + `src/components/settings/claude-connector-card.jsx`; sidebar nav item
  (`src/components/ui/app-sidebar.jsx`) for everyone.
- `src/components/analysis/analyse-button.jsx` + `issue-analysis-dialog.jsx` (existing `ui/dialog`,
  `ui/select`, `apiFetch`, toast, `BrandLoader`), wired into `IssueRow`
  (`src/components/dashboard/issue-row.jsx`), `NeedsAttentionPanel`, `BugBreachPanel`/`BugTicketTable`
  (`src/components/bugs/bug-lists.jsx`), `RollupRiskSection` (+ its dialog).
- "Analysed" marker: `getDashboardData`, `getBugReportData`, `getRollupData` also return
  `analyzedKeys` (one `findMany … jiraKey in [...]`).
- Admin `SectionCard` "Claude analysis" (`src/components/admin/analysis-settings-config.jsx`).

### Mechanism / gotchas

- **Read the installed Next 16 docs** (`node_modules/next/dist/docs/`) before writing route handlers —
  `params` is async. **Prisma 7**: run `prisma generate` explicitly after `migrate dev` (carry-forward).
- The connector's bearer token rides `Authorization`; the `lib/log.js` redactor already masks it.
- Claim atomically: `updateMany({ where: { id, status: QUEUED } })` and require `count === 1`.
- A job is only ever run by the **requester's own** connector (it spends their subscription).
- Prompt injection: Jira/ticket text Claude fetches is untrusted; the blast radius is bounded by the
  read-only tool allowlist and `--tools ""` (no shell, no file, no web).
- `sanitizeAnalysis` + zod on the server; the dialog renders only https links.
- `public/*.mjs` is scanned by Tailwind — keep class-like strings out of the script.

### Acceptance criteria

- `yarn lint` exit 0 · `prisma migrate status` → **14 migrations**, up to date · cold env-free build
  (`rm -rf .next`, `.env` + `.env.production` moved aside) → exit 0, **57 ƒ Dynamic**, 0 warnings
  (grep the log).
- Pure fixtures: `resolveAnalysisKind` (all 4 kinds), prompt builder (BUG + SPRINT; HYGIENE carries
  sub-components + fixVersions), `sanitizeAnalysis`, zod accept/reject.
- API smoke (dev + Neon, minted `sealData` cookies, teardown to 0 rows): offline POST → 409
  `CONNECTOR_OFFLINE`; poll claims; invalid result → 400; valid → `IssueAnalysis` row; non-visible
  SPRINT key → 404; revoked token → 401; non-admin settings PUT → 403.
- End-to-end: dev server + local connector → Analyse on a `/bugs` row, a board Tech Debt row, a
  Needs-attention row → live progress → result renders → marker after refresh. The real DeepContext
  run + authed browser pass are **Naveen's acceptance**.

### Out of scope

- Board-level / multi-issue analysis (v2) · writing anything to Jira · npm package publishing
  (backlog TODO) · analysis history (latest only) · Windows-specific connector testing · exporting
  analyses in PDF reports · server-side (BYOK) analysis — the existing AI Digest remains the
  server-side AI path.

## Doc-sync (on landing, same PR)

- project-overview §5 new row **[BUILT]**; §9 schema + ERD (4 models, 1 enum); §11 build-log row;
  §13 new item 7 (connector bearer token: hashed at rest, per-user, revocable, scope = connector
  routes only); §16 ratified decision; §14 — nothing closed.
- current-feature carry-forward: invariants **57 ƒ Dynamic / 14 migrations**; backlog: publish
  `@tekion/storyboard-connector`, board-level analysis.
- Don't over-claim: real DeepContext end-to-end is unverified until Naveen's acceptance run.

## References

- Approved plan: `/Users/naveen/.claude/plans/i-want-to-take-purrfect-valiant.md`
- @context/project-overview.md §5, §9, §11, §13, §16
- `src/lib/share-token.js:9` · `src/lib/rbac.js:71,122` · `src/lib/auth.js:138` ·
  `src/lib/api/route-helpers.js:52,311` · `src/lib/errors.js:30` · `src/lib/cron/daily.js:179` ·
  `src/lib/dashboard-data.js:127,315` · `src/lib/bug-report-data.js:59` · `src/lib/ai/digest.mjs`

## As-built notes (vs. the spec)

1. **57 ƒ Dynamic, not 56.** The plan counted the 6 new API routes but not the new `/settings` page.
2. **Long-poll, not a 3 s poll.** `POST /api/connector/jobs/next` holds each request for up to 15 s,
   re-checking every 1.5 s. It answers 200 with the job as soon as one is claimed, or 204 when the
   hold expires. This gives near-instant pickup at about 4 requests a minute instead of 20, and about
   4 `route.ok` log lines instead of 20. The "online" window widened from 20 s to **30 s** so it still
   covers one held request. It never claims once `request.signal` is aborted. The connector's fetch
   timeout is 45 s.
3. **The server enforces decision 7.** `sanitizeAnalysis(result, kind)` keeps `security` only for
   VULNERABILITY and `hygiene` only for HYGIENE. On the first live run the model filled a hygiene
   suggestion on a plain BUG, even though the prompt asked for null where a section doesn't apply.
4. **In `resolveAnalysisKind`, Vulnerability wins over Needs-attention.** A Vulnerability ticket in the
   NA panel gets the security analysis, not the hygiene one.
5. **Page components compute `analyzedKeys`.** `/`, `BugsPage` and `/rollup` call
   `getAnalysisUiState(keys)` and pass the result to `AnalysisProvider`, instead of
   `getDashboardData`, `getBugReportData` and `getRollupData` each growing a field. This leaves the
   core loaders untouched, and a disabled feature costs one settings read.
6. **Why `ui/dialog.jsx` gained an open-dialog stack.** The roll-up "All risks" dialog opens the
   analysis dialog, and every dialog listened for keys on `document`, so one Escape closed both. Now
   only the top of a module-level stack handles Escape and Tab. The stack lives in its own `[open]`
   effect with a stable ref, so a parent re-render (a new `onClose` identity) can't reorder it.
7. **Distribution and pairing.** The script is served statically at `/storyboard-connector.mjs`. The
   Settings card builds the one-time pair command in the click handler from `window.location.origin`,
   so the command carries the public origin as seen through the proxy. It is shown once; only the
   token's sha256 is stored.
8. **Measured costs.** A real sonnet analysis cost **$0.35 notional in 46 s**, so the **$3** default is
   comfortable headroom. Most of the pickup and dialog-load latency in dev was round trips from this
   laptop to Neon us-east (about 400 ms a query); production runs against internal Postgres.
9. **Connector hardening beyond the spec.**
   - `login` refuses a non-https URL other than localhost, and a malformed token.
   - Model names must match `^[\w.\-[\]]{1,64}$` and effort must be in the allowed list.
   - The budget is clamped to 0.1–50 and the timeout to 1–60 minutes.
   - Progress posts are best-effort and throttled to one every 2 s.
10. **Error visibility.** A failed job's message is shown only to its requester, via the dialog's
    "Last attempt failed" line. Other viewers see the last good analysis.
11. **Mobile.** The sidebar (lg+) carries the Settings link. The Settings page has its own top bar,
    and the analysis dialog's offline notice links to `/settings`, so a phone can reach it. The other
    pages' mobile top bars have no Settings link, because pairing is a terminal task.
12. **The public share view does not show the button.** `/share/[token]` reuses `IssueRow` but
    mounts no `AnalysisProvider`, so the button renders nothing there.
13. **The analysis dialog is portalled to `document.body`.** This was found in Naveen's browser pass
    on 2026-09-29. The dialog had been rendered in place inside `IssueRow`'s sticky key column, whose
    `sticky z-1` creates a stacking context. A `fixed`, `z-50` dialog there was still trapped
    underneath the matrix header and the other rows' sticky cells, which painted over the modal.
    `AnalyseButton` now uses `createPortal(…, document.body)`. This is SSR-safe because `open` only
    becomes true from a click. It is local to the analysis button: every other dialog in the app
    mounts at page level. Verified in headless Chrome on :3002: the overlay is a direct child of
    `body`, `elementFromPoint` inside the panel hits the dialog, and Escape closes it.
14. **Office DB migration bundle** (added 2026-09-29). The office Postgres is reached only via the
    jumpserver, and migrations there are hand-run, so migration 14 ships as a bundle:
    `output/storyboard-dba-migration-2026-09-29-add_claude_connector/` (+ `.zip`).
    - **Files:** `00-preflight` · `01-migrate` · `02-verify` · README · manifest · SHA256SUMS ·
      VALIDATION. There is **no grants file**: Naveen runs it as the `DATABASE_URL` user, which owns
      every table, and the bootstrap's `04` access script was never needed either.
    - **Generator:** the new, committed `scripts/dba-migration-bundle.mjs --applied-through
      20260903130840_add_error_log`.
    - **Rehearsed on a throwaway PostgreSQL 15.17** in the office model: one app role owns the
      database and ran the 2026-09-22 bootstrap `00`–`03`, then this bundle.
      - `00`/`01`/`02` pass.
      - The new tables are owned by the app role, which has CRUD with no grants.
      - As that role, `prisma migrate deploy` reports "No pending migrations to apply" and
        `migrate diff` against `schema.prisma` finds no difference.
      - The re-run, injected-failure (full rollback), partial-state and wrong-start refusals all
        pass.
    - **Must be applied BEFORE the image with this migration rolls out.**
    - New project skill: `.claude/skills/dba-migration-bundle/`. `prisma-change` (step 8) and
      `finish-feature` (step 5) now point to it.
