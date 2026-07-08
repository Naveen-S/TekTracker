# UI port — login + team dashboard + minimal admin (migration step 6a)

## Overview

**Production Migration Plan step 6**, scoped to its core: the login page and the **team dashboard**
(Delivery Matrix re-skinned with Tailwind v4 + shadcn, §11) running on **server data** instead of
localStorage, plus a **minimal admin page** (teams/members/sprints) so a fresh DB is fully usable
through the UI. This is the step that makes everything before it *visible* — and its acceptance
includes the deferred **real-Jira sync re-verification** (fresh token → login UI → Sync button →
real issues), per Naveen 2026-07-07 ("let's test it out once we build the UI").

**Split decision:** master-plan step 6 lists login + team dashboard + ED roll-up + admin. That is
2–3 features' worth. This feature is **6a** (login, dashboard, minimal admin — the EM/Lead daily
loop). **6b (ED/TPM multi-team roll-up)** follows as its own feature — it needs read-model/metric
aggregation decisions of its own. Export/Share stay step 8; trend/burndown step 7+.

Port sources: [src/App.jsx](../../src/App.jsx) (shell + wiring),
`src/components/{atoms,molecules,organisms,modals}` (TopBar, HeroPanel, MetricGrid, FilterPanel,
PlannerPanel, IssueRow, LoginForm, modals), [src/hooks/usePersistedSprintState.js](../../src/hooks/usePersistedSprintState.js)
(retired — server data replaces it; only density/collapse survive as localStorage prefs),
[src/utils/sprintMetricsCompute.js](../../src/utils/sprintMetricsCompute.js) +
`useSprintMetrics`/`sprintUtils` (pure metrics, §12).

## Status

**Done 2026-07-08** (one acceptance item outstanding — the ⚠️ real-Jira run below). Implemented all
of (a)–(d), decisions 1–9 as proposed: pure **`lib/metrics.mjs`** (+`lib/use-local-pref.js`),
server-only **`lib/dashboard-data.js`**, client **`lib/api-client.js`**, UI kit
(`components/ui/{input,textarea,label,select,badge,dialog}.jsx`), **`/login`**
(`components/auth/login-form.jsx`), **`/`** dashboard (server `page.jsx` + 10
`components/dashboard/*` client leaves incl. the three dialogs), **`/admin`**
(`components/admin/admin-panel.jsx`); layout metadata fixed; `tekion-logo.svg` copied, scaffold
placeholder page/svgs removed. **Verified:** metrics fixture parity vs the prototype's real bytes —
**16/16** (per-issue percents, all aggregates, sprint health, `getWeeklyVelocity` deep-equal);
`yarn lint` clean; `prisma migrate status` up to date; `yarn build` green + **DB/env-free** (`.env`
moved aside — `/`, `/login`, `/admin` and all 19 API routes `ƒ Dynamic`); **~30-check SSR smoke**
on dev+Neon with minted cookies + a fabricated VIEWER + hand-inserted Issue rows (the stored Jira
token is still dead): unauthenticated `/`+`/admin` → 307 `/login`; login page renders the §11 copy;
matrix SSRs issue rows, FEATURE stage headers, metric cards, hero; **stage-4 PUT → SSR shows the
80% badge** (weighted cascade round-trip); blocked chip renders; **VIEWER sees a disabled matrix
with no Sync/Add-filter/Configure-Sprint chrome and 404s on `/admin`**; no-membership and
no-filters empty states render; admin page lists teams+sprints. Test data cleaned from Neon,
harness deleted. ⚠️ **Naveen's acceptance step:** fresh classic API token → log in at
`/login` → add a real filter → Sync — closes the loop from sync-hybrid-seeding.md and answers the
project-visibility question. **Next:** step 6b (ED roll-up) or step 7 (background job) / step 9
(importer).

## Decisions (PROPOSED 2026-07-07)

1. **Reads: server components fetch via Prisma directly** (coding-standards) — the dashboard page
   loads teams/sprint/filters+issues/progress server-side and computes metrics there with the pure
   metrics lib; no new read-model API routes. **Writes: client components `fetch` the step-4/5
   route handlers** (they exist, are RBAC-gated and curl-proven), then `router.refresh()` to
   re-render the server data. **No Server Actions in 6a** — they'd be thin wrappers over the same
   routes (domain-apis decision 1's "if ergonomics want them" hasn't materialized); revisit if forms
   get painful.
2. **Routing:** `/login` (public) · `/` = the dashboard (auth-gated), team/sprint chosen via
   **searchParams `?team=&sprint=`** with sensible defaults (first membership team; its ACTIVE
   sprint, else latest) — header dropdowns update the URL, no nested route tree yet (6b may add
   one) · `/admin` (global-admin-gated): create/edit teams, add/remove members by email, create
   sprints + change state. Sprint config also reachable from the dashboard hero (admin-only button,
   §13.3).
3. **Auth gate: per-page server check** — `getCurrentUser()` in the server components;
   `redirect("/login")` when null; `/admin` also checks `isAdmin` (404 for non-admins). No
   middleware (iron-session unseal wants the node runtime; per-page is simpler and sufficient).
4. **Metrics: pure port to `web/src/lib/metrics.mjs`**, translated to the new shapes — input is
   `(filters with cached issues, progress rows keyed by jiraKey, sprint)` instead of
   `(dynamicFilters, issueStages, sprintConfig)`; workflow keys become the Prisma enums. Same
   formulas (§12: weighted %, health bands, sprint health, naive velocity). `.mjs` + relative
   imports so it stays plain-Node testable (house pattern). Unit-check the port against the
   prototype's outputs on a fixture.
5. **UI kit: add shadcn-style components manually, only as needed** (dialog, input, select, badge,
   toast/sonner-lite) — same hand-written approach as Feature 2 (ui.shadcn.com was unreachable);
   Tailwind v4 tokens from `globals.css`; light default, dark supported. No new npm UI deps.
6. **Add-filter UX keeps prototype parity**: the modal POSTs the filter (CRUD) then immediately
   triggers `POST …/sync` so issues appear right away (the step-5 split made these two calls).
   Sync errors surface the route's `{ error }` (401 reconnect / 502 Jira) in the alert modal/toast.
7. **RBAC-aware chrome, server-enforced always**: UI hides what the role can't do (VIEWER: no
   toggles/add/sync; non-admin: no Configure Sprint / no `/admin` link) using `myRole` from the
   teams payload + `isAdmin` from the user — but every mutation stays server-gated regardless
   (step 4). No client-side security.
8. **localStorage keeps exactly two ephemeral prefs** (§17): `viewDensity`,
   `filtersPanelCollapsed` — client-only, read after mount (no hydration mismatch). The
   `?share=` URL-restore path is **not ported** (step 8 replaces it with `SharedView`).
9. **The legacy Vite app stays untouched** — 6a reaches feature parity for the daily loop in `web/`;
   cutover (step 10) still waits for export/share (step 8) + importer (step 9).

## Requirements

### Scope

**(a) Pure metrics — `web/src/lib/metrics.mjs`**
- Port `computeSprintMetrics` + `getHealthStatus` + velocity/days helpers from
  `sprintMetricsCompute.js`/`sprintUtils.js` onto the new shapes (decision 4): join Issue cache ↔
  IssueProgress by `jiraKey` (owning row per §9), weights/stages from `workflows.mjs`. Health
  bands, sprint health, velocity formulas unchanged (§12). Keep it storage-free.

**(b) Data assembly — `web/src/lib/dashboard-data.js`**
- Server-only helper: given `(userId, teamId?, sprintId?)` → resolve my teams + roles, the selected
  team + sprint (defaults per decision 2), filters with issues (sortOrder), progress rows, and
  computed metrics. One place the dashboard page calls; 6b's roll-up will generalize it.

**(c) Pages + components under `web/src/app/` and `web/src/components/`**
- `/login/page.jsx` — port `LoginForm` (§11 copy: email, API token + create-token hint, "Connect to
  Jira", Tekion footer); on 200 → `router.push("/")`.
- `/page.jsx` (dashboard, server component): TopBar (app name, team+sprint selectors, search, Add
  filter, Sync, user, logout), Hero (sprint name/dates/days-left, density toggle, admin-only
  Configure Sprint), MetricGrid (Health / Issues / Velocity / At-risk), workspace grid: FilterPanel
  (connected-JQL sidebar, collapse, remove/reorder) + PlannerPanel (Delivery Matrix: rows grouped
  by filter, stage-checkbox columns per workflow, health chip + blocked toggle per row).
  Client leaves: selectors, search, modals, matrix interactions.
- `/admin/page.jsx` — minimal, form-over-API: teams list + create; per-team members add(email,
  role)/change/remove; sprints list + create + state PATCH. Thin — polish is post-v1.
- Interactions wire to existing routes: stage toggle → `PUT …/progress/[jiraKey]`; blocked →
  same route; add filter → `POST …/filters` (+`fromTemplateId` support later, keep simple now);
  remove → `DELETE`; reorder → `PUT …/filters/order`; sync → `POST …/sync`; sprint config →
  `PATCH /api/sprints/[id]`; provisioning → team/member routes. After each: `router.refresh()`.
- Modals ported: AddFilter, SprintConfig (admin), Alert. Export modal/menu **not ported** (step 8).

**(d) No schema change, no new deps, no new env.**

### Mechanism / gotchas

- **Next 16 server/client split**: default server components; `'use client'` only for interactive
  leaves (coding-standards). `searchParams` and `cookies()` are async — read the installed docs
  again before the page shells (house discipline; same class as the `params` gotcha).
- **Stage toggle semantics**: send **target state** `{ stage: { index, completed } }` — the server
  owns the cascade (step 4); the UI optimistically updates then `router.refresh()` reconciles.
- **VIEWER rendering**: matrix renders read-only (checkboxes disabled), not hidden rows.
- **Density/collapse hydration**: read localStorage in `useEffect` after mount with SSR-safe
  defaults (dense, expanded) to avoid hydration mismatch.
- **Empty states**: no membership → "ask an admin to add you" panel (§16 provisioning); team with
  no filters → the welcome/Add-filter hero (prototype parity); sprint with no ACTIVE → latest.

### Acceptance criteria

- **Flows (dev server + Neon, minted-cookie or real login):** login page renders; bad creds show
  the 401 message; `/` unauthenticated redirects to `/login`. As admin: create team + sprint +
  member via `/admin` UI; add a JQL filter via the modal → sync fires; matrix renders cached
  issues grouped by filter with stage checkboxes sized to the workflow; clicking stage 4 checks
  0–4 (server cascade reflected after refresh); blocked toggle + reason; remove filter leaves
  progress (verifiable by re-adding); reorder persists; density + collapse survive reload;
  VIEWER (fabricated) sees read-only matrix and no admin chrome; non-admin gets no `/admin`.
- **Metrics:** ported module reproduces the prototype's numbers on a shared fixture (health bands,
  weighted %, velocity); dashboard cards match hand-computed values for the fixture.
- **⚠️ Real-Jira re-verification (Naveen):** fresh classic API token → login through the UI → real
  JQL filter → Sync → real issues in the matrix and seeded checklists (closes the loop left open in
  sync-hybrid-seeding.md — also answers the project-visibility question).
- **Hygiene:** `yarn lint` + `yarn build` green, build DB/env-free; no `.ts/.tsx` source; no
  `tailwind.config.*`; server components don't import client-only modules.

### Out of scope

- **ED/TPM multi-team roll-up** (6b — next feature candidate), **export PDF/PNG + share links**
  (step 8), **trend/burndown** (step 7+), **FilterTemplate management UI** (post-6a; API exists),
  **Gemini** (post-v1), **legacy-app changes/cutover** (step 10).

## Doc-sync (§17 — same PR)

- §5: flip the UI-dependent rows' notes ("Update stages", "Mark blocked", "Remove/Reorder filter",
  "Configure sprint" gains UI-level admin gating in `web/`); "Add Jira filters" + "Sync Jira" note
  the `web/` UI. §11 note the re-skin landing. §13.3 → UI gating done. Master plan step 6 →
  **partial (6a)**, ED roll-up outstanding. Record as-built deviations below; update
  current-feature.md.

## As-built deviations from the spec

- **Prefs hook instead of read-after-mount:** the installed `react-hooks` ESLint rules
  (`set-state-in-effect`) reject the spec'd "read localStorage in `useEffect`" pattern — added
  `lib/use-local-pref.js` (`useSyncExternalStore`: server snapshot = default, client snapshot =
  localStorage, same-tab emitter) — cleaner and hydration-safe.
- **Add-filter dialog requires a display name for BOTH source types** (the step-4 create API
  requires `name`; the prototype derived it from the fetched Jira filter, which now only refreshes
  `jql` at sync).
- **No optimistic stage updates in 6a**: click → `PUT` → `router.refresh()` (spec said "optimistic
  update, then refresh"); cells disable while a write is in flight. Latency is acceptable on
  dev+Neon; an optimistic overlay is a noted follow-up if it feels laggy in real use.
- **Search stays in the FilterPanel** (prototype placement) rather than the §11 header; the
  prototype's dead TopBar nav links were not ported — an admin-only **Admin** link took their spot.
- **VelocityMetric simplified** into a standard metric card (pts/wk + weeks-needed pace detail).
- **Semantic tones, two data-driven inline styles:** metrics.mjs emits `tone` keys mapped to
  Tailwind classes (no hex in components); inline `style` survives only where values are data
  (filter `accentColor` from the DB, `gridTemplateColumns` from the stage count).
- **metrics.mjs is stricter than the prototype on cross-workflow keys**: percent/health always use
  the OWNING workflow's weights (the prototype silently fell back to count-based percent on a
  length mismatch). Single-workflow keys are identical — the 16-check parity fixture proves it.
  Cross-filter duplicate counting (an issue in two filters counts twice in aggregates) is kept
  as prototype parity.
- **Verification had no browser automation**: flows were exercised as SSR HTML assertions + the
  same API calls the client leaves make (minted `sealData` cookies, fabricated VIEWER, Issue cache
  rows inserted directly — sync is blocked on the dead token). Density/collapse persistence and
  client-side dialog behavior are code-reviewed, not machine-verified; they get eyeballed in
  Naveen's real-token acceptance run.
- **SSR text-interpolation gotcha** (for future smoke greps): JSX `{percent}%` renders as
  `80<!-- -->%` in the HTML stream — grep accordingly.

## References

- @context/project-overview.md — §3 personas, §5 features, §11 UI/UX spec, §12 metrics, §16
  provisioning, Migration Plan step 6
- @context/coding-standards.md — server-components-by-default, `'use client'` rules, Tailwind v4
  (no config file), file organization
- @context/features/{domain-apis,sync-hybrid-seeding}.md — the API surface this UI consumes
- Port sources: `src/App.jsx`, `src/components/**`, `src/hooks/{usePersistedSprintState,
  useSprintMetrics}.js`, `src/utils/{sprintMetricsCompute,sprintUtils}.js`, `src/styles.css`
- `web/src/app/globals.css` (Tekion tokens) · `web/src/components/ui/button.jsx` (Feature-2
  pattern) · `web/AGENTS.md` (installed-docs discipline)
