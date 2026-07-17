# Share view + export (migration step 8)

## Overview

Replace the prototype's **base64-URL share** with the server-persisted **`SharedView` token** from
[project-overview.md](../project-overview.md) §9, and **port the PDF/PNG export**. This is
**Production Migration Plan step 8**, the next in-order step (1–7 are Done). It closes §14.3
("Share view encodes the whole dataset in the URL") and realizes §13 hardening item 4 ("short
token, optional expiry; never embed the dataset"), and it's why ui-polish was pulled ahead —
share/export render the components that re-skin just landed.

Two halves:

1. **Share view** — `POST` creates a `SharedView` row (live or frozen) and returns a short URL
   `/share/<token>`; the recipient opens a **read-only** server-rendered board (Hero + MetricGrid +
   matrix) with no session required. Replaces the legacy flow
   ([App.jsx:64-81](../../src/App.jsx#L64-L81) encode → [usePersistedSprintState.js:66-95](../../src/hooks/usePersistedSprintState.js#L66-L95)
   decode) which breaks URL limits on real sprints, leaks data into browser history, and is never
   live.
2. **Export** — port the legacy `ExportModal` + `useExport` (client-side capture of dedicated
   offscreen A4 pages → multi-page PDF via jsPDF, or one merged PNG), with include/exclude filter
   toggles and a paged preview, recomputing metrics over the selected subset so preview and capture
   match ([ExportModal.jsx:21-27](../../src/components/modals/ExportModal.jsx#L21-L27)).

> **Key architectural shift from the prototype.** The legacy share URL *is* the dataset (base64 of
> config+filters+stages); the target share URL is a **capability token** resolving to
> server-rendered data — live (current rows) or frozen (a `snapshot` Json captured at share time).
> The dataset never enters a URL again. The `SharedView` model shipped verbatim in the `init`
> migration — **this step needs no schema change and no migration.**

## Status

**Done 2026-07-12.** All of (a)–(f) implemented as proposed: `lib/share-token.js` (192-bit
base64url), `getShareData`/`buildShareSnapshot` in `lib/dashboard-data.js`, optional `asOf`
through `getHealthStatus`/`getWeeklyVelocity`/`computeSprintMetrics` (**plus** `MetricGrid`/
`PlannerPanel`/`IssueRow` props — see as-built), `lib/schemas/share.js`, nested
`POST/GET …/shares` + flat `DELETE /api/shares/[shareId]`, public `app/share/[token]/page.jsx`
(no auth gate, `robots: noindex`, generic invalid/expired state), `share-dialog.jsx` +
`export-dialog.jsx` + Hero Share/Export buttons. Deps: **`html2canvas-pro@2.2.3` +
`jspdf@2.5.2`** (exact), dynamically imported. **The capture spike passed** (decision 8): a
temporary page captured the oklch theme + `color-mix()` tints + hero gradients through
html2canvas-pro under headless Chrome (`SPIKE_OK`, 51KB PNG dataURL) — no hex-fallback needed;
spike page deleted. **Verified:** lint clean; `prisma validate` + `migrate status` up to date
(**no schema change, no migration**); **DB/env-free build green — 27 `ƒ Dynamic`** incl.
`/share/[token]` and both share routes; `jspdf` confirmed **absent from the dashboard chunk**
(dynamic-import split real); **25/25 plain-Node `asOf` fixtures** (band shifts at fixed clocks,
determinism, Date/ISO parity, aggregates asOf-independent); **37/37 SSR smoke on dev+Neon**
(fabricated SHSMK team/sprint/filters/progress + writer/viewer/stranger users, minted cookies:
cookie-less share page renders matrix+metrics with **no session chrome**, noindex meta; create
gates 401/403/400×3; **frozen-vs-live divergence proven** — progress PUT moved the live page
65%→80% while the frozen page held 65%; list scoping own-vs-admin + viewer 403; revoke
403/401/200→invalid→404; expired + unknown tokens → same generic page, HTTP 200 no redirect).
Fixture torn down (0 leftovers), harnesses deleted, `.env` restored, dev server restarted.
⚠️ Human acceptance remains: create/copy/open a share logged-out in a browser + export a real
board to PDF/PNG (piggybacks the still-open ui-polish side-by-side eyeball + 6a real-Jira run).

## Decisions

Decisions 1 and 8's *what* follow the master plan and §9/§13. **2–10 are PROPOSED** (sensible
defaults, flag if you disagree). None block implementation.

1. **Share = `SharedView` row + public page `/share/[token]`.** Master plan step 8 verbatim. The
   token replaces `?share=<base64>`; the legacy app keeps its flow until cutover.
2. **PROPOSED: `/share/[token]` requires no session — the token is the bearer capability.** This is
   the first public HTML page (the step-7 cron route was the first session-less API route; auth is
   per-page gates, so a public page is just a page that doesn't gate). Read-only render; expiry
   enforced at read time; unknown/expired/revoked tokens all get the same generic "link is invalid
   or has expired" page (don't reveal which). Page metadata sets `robots: noindex`.
   *Alternative considered:* require any signed-in user (§13.4's "optional auth requirement") —
   deferred; it would need a `requiresAuth` column (schema change) and defeats the VP-without-
   an-account use case. Revisit if a share ever needs tighter scoping.
3. **PROPOSED: creating a share requires a team WRITER role** (`TEAM_WRITER_ROLES`,
   [rbac.js:38](../../web/src/lib/rbac.js#L38); global-admin bypass as everywhere). VIEWER is
   excluded: minting a public link is a broader grant than viewing. One share = **one team's board
   in one sprint** — the server validates every `filterIds` entry belongs to `(teamId, sprintId)`
   and is non-empty. Cross-team / roll-up shares are out of scope (the `SharedView` model has no
   team column; a share's team is derived from its filters).
4. **PROPOSED: app-generated high-entropy token**, `crypto.randomBytes(24).toString('base64url')`
   (~32 chars, 192 bits), supplied explicitly on create instead of relying on the schema's
   `@default(cuid())` — cuid v1 is timestamp+counter-based, guessable enough to be wrong for a
   capability URL. App-level only; no migration.
5. **PROPOSED: implement both live and frozen shares** (the schema's `isLive` + `snapshot`).
   - **Live** (`isLive: true`, default): render resolves `includedFilterIds` → current
     `Filter`+`Issue`+`IssueProgress` rows at request time. Filters deleted since sharing silently
     drop out (all gone → the generic invalid/expired page). Staleness shown from `lastSyncedAt`.
   - **Frozen** (`isLive: false`): `snapshot` Json stores
     `{ capturedAt, sprint: {name, developmentStart, developmentEnd}, filters: [{…filter, issues}], progress: […] }`
     — the *inputs*, not computed metrics; the page recomputes with the same pure functions.
     Sprint fields are frozen too so a later admin date-edit can't shift frozen numbers.
6. **PROPOSED: thread an optional `asOf` date through the time-dependent metrics functions**
   (`getHealthStatus`, `getWeeklyVelocity`, `computeSprintMetrics`), defaulting to `new Date()`.
   Frozen shares pass `asOf = snapshot.capturedAt` so health/velocity are genuinely frozen — today
   they read `new Date()` internally ([metrics.mjs:41](../../web/src/lib/metrics.mjs#L41)), which
   would make a "frozen" share's health drift as days pass. Backward-compatible (all existing
   callers pass nothing); also an honesty upgrade for §17's "metrics are pure functions".
7. **PROPOSED: routes follow the existing tree** —
   `POST/GET /api/teams/[teamId]/sprints/[sprintId]/shares` (create; list for the dialog) and flat
   `DELETE /api/shares/[shareId]` (revoke — creator or global admin; not a team-role check). List
   returns the **caller's own** shares for that team+sprint (admin: all of that team+sprint's).
   Same `{ error }` + status-mapping contract via `route-helpers.js`; zod schema in
   `lib/schemas/share.js`. Expiry: optional `expiresAt` ISO datetime in the body (the dialog offers
   presets: 7 days / 30 days / never). No cleanup job — expiry is checked at read (retention is a
   non-goal).
8. **PROPOSED: export stays a client-side DOM capture, but with `html2canvas-pro` instead of
   `html2canvas`.** ⚠️ The `web/` theme is Tailwind v4 **oklch** + ui-polish `color-mix()`; stock
   html2canvas 1.4.1 throws on modern color functions (browsers now serialize computed oklch as
   oklch, not rgb). `html2canvas-pro` is the drop-in fork that parses them. `jspdf` pinned to the
   legacy-parity `2.5.2` (exact, per the frozen-versions convention; evaluate 3.x at install only
   if 2.5.2 misbehaves under Next). Both **dynamically imported** at export time (legacy parity,
   keeps them out of the main bundle). **Spike the capture first** — one offscreen page through
   html2canvas-pro on the dev server before porting the rest; if it fails on our CSS, fall back to
   hex-only self-contained styles on the print pages (they're dedicated components anyway).
   *Alternative considered:* server-side rendering (puppeteer/satori) — heavier, new infra, not the
   port the plan asks for.
9. **PROPOSED: the share page reuses the dashboard components read-only** — `HeroShell`-based
   header (sprint name, dates, days-remaining pill, "Shared view · read-only" badge, live/frozen +
   staleness line), `MetricGrid`, and the matrix (`PlannerPanel` + `IssueRow`) with all write
   handlers null (the 6a VIEWER read-only path). No TopBar, no sidebar, no dialogs, no sync. Render
   density = the stored `viewDensity` (creator's pref at share time), overriding the local-pref
   default. Data assembly is a new server-only `getShareData(token)` beside the existing
   `getDashboardData`/`getRollupData`.
10. **PROPOSED: Hero gains the §11 Share + Export buttons** (`onDark` glass variant, disabled until
    filters exist; hidden on the welcome state), completing the ui-port note "Export/Share buttons
    wait for step 8". Share create → copy URL to clipboard + success toast (ui-polish pattern);
    clipboard blocked → the AlertDialog shows the URL to copy manually (legacy parity,
    [App.jsx:75-80](../../src/App.jsx#L75-L80)). Errors keep the AlertDialog. Export success →
    toast; anyone who can see the board (incl. VIEWER) can export — it's a client-side capture of
    what they already see, no new server surface.

## Requirements

### Scope

**(a) Data + token layer — `web/src/lib/`**
- `lib/share-token.js` (or fold into an existing lib): `generateShareToken()` per decision 4.
- `lib/dashboard-data.js`: add `getShareData(token)` — load the `SharedView` (+ sprint relation);
  `null` for unknown token, revoked (row gone), or `expiresAt < now`. Live: batched reads of
  filters (`id IN includedFilterIds`, ordered by `sortOrder`, with issues) + progress rows for the
  derived team+sprint (same two-query shape as `getDashboardData`). Frozen: parse `snapshot`.
  Either way return `{ sprint, filters, progressByKey, metrics, isLive, capturedAt/lastSyncedAt,
  viewDensity }` with metrics from `computeSprintMetrics(..., asOf)` (decision 6). Also a
  `buildShareSnapshot(filters, progress, sprint)` helper the POST route uses (dates → ISO strings).
- `lib/metrics.mjs`: optional `asOf` param on `getHealthStatus`/`getWeeklyVelocity`/
  `computeSprintMetrics` (decision 6), default now; no caller changes elsewhere.

**(b) API routes + schema (follow the [api-route] skill / step-4 patterns: `force-dynamic`,
`parseJsonBody` + zod, `handleRouteError`, `{ error }` bodies)**
- `lib/schemas/share.js`: create body `{ filterIds: string[] (nonempty cuids), isLive: boolean
  (default true), expiresAt: ISO datetime optional/nullable, viewDensity: 'dense'|'relaxed'
  (default 'dense') }`.
- `app/api/teams/[teamId]/sprints/[sprintId]/shares/route.js` — `POST` (writer role, decision 3):
  validate filterIds ⊆ that team+sprint's filters (else 400), build snapshot when frozen, create
  with app-supplied token + `createdById`; return `{ id, token, url: /share/<token>, isLive,
  expiresAt }`. `GET`: list per decision 7 (id, token, isLive, expiresAt, createdAt,
  includedFilterIds — enough for the dialog's manage list).
- `app/api/shares/[shareId]/route.js` — `DELETE`: creator or global admin (else 403/404), delete
  row, `{ ok: true }`.

**(c) Public share page — `web/src/app/share/[token]/page.jsx`**
- Server component, `force-dynamic`, **no auth gate** (decision 2), `robots: noindex` metadata.
  ⚠️ Next 16: `params` is **async** — verify against `node_modules/next/dist/docs/` first
  (`web/AGENTS.md`).
- `getShareData(token)` → null renders the generic invalid/expired state (styled, with the app
  name; no redirect to /login). Otherwise render per decision 9. New thin components under
  `components/share/` only where the dashboard ones can't be reused as-is (e.g. a banner; pass
  density down as a prop override rather than reading the local pref).

**(d) Share dialog + Hero wiring — `web/src/components/dashboard/`**
- `share-dialog.jsx`: live/frozen toggle, expiry preset select, create → clipboard + toast
  (fallback per decision 10); a "Manage" list of existing shares (from the GET) with copy + revoke.
  Included filters = all current board filters by default (matching the legacy "share the exact
  view"); a filter-subset picker is optional — skip unless trivial.
- `hero.jsx` + `dashboard.jsx`: Share + Export buttons (decision 10), gated `can.write` for Share;
  dialogs mounted beside the existing ones, busy state via the existing transition pattern.

**(e) Export — `web/src/components/dashboard/export-dialog.jsx` (+ deps)**
- Port `ExportModal` ([ExportModal.jsx](../../src/components/modals/ExportModal.jsx)): filter
  include/exclude toggles, paged preview (summary page + 15-issue pages), offscreen 794px-wide A4
  print pages (`SummaryPage`, `IssuesPage` as local components restyled with the ui-polish tokens),
  single metrics recompute over the selected subset via the pure `computeSprintMetrics` (client-safe
  `.mjs`).
- Port the capture ([useExport.js](../../src/hooks/useExport.js)) inside the dialog (one consumer —
  no separate hook needed): `await document.fonts.ready` (now next/font Manrope/Inter/Mono), scale
  2, white background; PDF = jsPDF A4 portrait one page per print page; PNG = merged canvas
  download. Filename `${sprintName}_Week${weeksElapsed}_Report_${YYYY-MM-DD}`.
- Deps: `html2canvas-pro` + `jspdf@2.5.2`, exact versions, `web/` only (decision 8). **Spike the
  oklch capture before porting the full modal.**

**(f) No env, no schema, no migration.** No new env vars (the share URL is built from
`window.location.origin` client-side and returned relative from the API); `SharedView` shipped in
`init`; decision 6 is code-only.

### Mechanism / gotchas

- **html2canvas vs Tailwind v4 colors is the landmine of this step** (decision 8). Verify early
  with a real capture on the dev server, not at the end.
- **Next 16 async `params`** on both `[token]` and `[shareId]` — same shape step 4 confirmed for
  the domain routes; read the installed docs, not training data.
- **The public page must never leak session chrome**: no TopBar, no `can` flags, no user object in
  props. It also must not cache — `force-dynamic` like every other page, and the DB/env-free build
  invariant must hold (page executes nothing at build).
- **Snapshot Json dates land as ISO strings** after `JSON` round-trip. `metrics.mjs` already
  coerces (`new Date(sprint.developmentStart)`), and `formatDate` takes any value — but verify the
  frozen render path against real snapshot data, not just live rows.
- **`includedFilterIds` is a plain `String[]`** — no FK. Live shares must treat missing ids as
  deleted filters (skip), and the POST must validate ids server-side (decision 3) so a caller can't
  smuggle another team's filter into a share.
- **Progress rows for live shares** are keyed `(teamId, sprintId, jiraKey)` — derive the teamId
  from the loaded filters (they're all one team per decision 3), don't store it.
- **Clipboard API needs a secure context / can be blocked** — the fallback dialog path (decision
  10) is not optional polish; it's the only path over plain http on some setups.
- **`PlannerPanel`/`MetricGrid` reuse**: they take server-computed props already; the share page
  passes `canWrite=false`-equivalent (null handlers). If either reads the density local pref
  internally, lift it to a prop with the pref as the dashboard's default — don't fork the
  component.

### Acceptance criteria

- `yarn lint` + `yarn build` green in `web/`; build stays **DB/env-free**; `/share/[token]` and the
  new API routes are `ƒ Dynamic`; `prisma migrate status` unchanged (no migration).
- Curl/SSR smoke against dev+Neon (minted cookies, fabricated fixture like 6b's):
  - Writer creates a live share → 200 + token; the URL renders **without any cookie** (200,
    metric grid + matrix markup, no Sync/Add/Configure buttons, noindex meta).
  - VIEWER create → 403; filterIds from another team → 400/403; empty filterIds → 400.
  - Frozen share: mutate a progress row after sharing → frozen page's numbers **unchanged** (and
    health stable thanks to `asOf`), live share's numbers **changed**.
  - `expiresAt` in the past → generic invalid/expired page; `DELETE` by creator → page invalid;
    `DELETE` by non-creator non-admin → 403/404; unknown token → same generic page.
  - List returns only the caller's shares (admin: all for that team+sprint).
- Pure-fixture checks for `asOf` (same inputs + fixed `asOf` → identical health across runs) and
  existing metrics fixtures still pass untouched.
- **Export capture spike proven** on the dev server (one page → canvas → dataURL without a color
  parse error) before the full port; dialog SSR-renders; deps only load on demand (build output
  shows them split out).
- **Human acceptance (Naveen, browser):** create/copy/open a share in a logged-out window; export
  a real board to PDF and PNG and eyeball them. Piggybacks the still-open ui-polish side-by-side
  eyeball + 6a real-Jira UI run.

### Out of scope

- **Roll-up / cross-team shares** and sharing from `/rollup` — no team column on `SharedView`;
  revisit post-v1 if EDs ask.
- **`requiresAuth` on shares** (§13.4's optional auth) — needs a schema change; deferred until a
  concrete need (decision 2).
- **Share-link rate limiting / audit log, snapshot retention or cleanup jobs** — internal tool,
  192-bit tokens, read-time expiry is enough for v1.
- **Export of the roll-up page**, scheduled/emailed reports, and the **Gemini narrative** on
  exports — post-v1 (§16).
- **Importer** ([seed.md](./seed.md), step 9) and cutover (step 10).

## As-built notes (vs. the spec)

- **`html2canvas-pro@2.2.3`** was latest at install (spec left the version open); `jspdf@2.5.2`
  as planned — 2.5.2 behaved under Next/Turbopack, so jsPDF 3.x was never evaluated. Capture
  options ported verbatim from the legacy hook (scale 2, white bg, width 794).
- **`asOf` threads wider than decision 6 named.** `MetricGrid`, `PlannerPanel`, and `IssueRow`
  compute velocity/health themselves at render, so each gained an optional `asOf` prop (default
  undefined = now) — without it a frozen share's *matrix pills and velocity card* would drift
  even though the top-line metrics didn't. Dashboard and `/rollup` pass nothing; behavior there
  is unchanged.
- **Frozen shares don't render `DaysRemainingPill`** — a live countdown over frozen data is
  incoherent; they get a "Frozen snapshot" chip instead. Live shares keep the pill on the real
  clock.
- **The snapshot freezes the sprint window too** (`name`/dates inside `snapshot.sprint`), so a
  later admin date-edit can't shift frozen numbers; and it **trims progress rows to the keys in
  the shared filters' issues** rather than freezing the whole team+sprint progress set.
- **Manage-list scope is sprint + creator (admin: whole sprint), not team-intersected** —
  `SharedView` has no team column and a frozen share may reference only deleted filters, so
  team-derivation can't be made reliable; rows carry resolvable `filterNames` for display
  instead. A creator with two teams sees their own other-team shares for the same sprint in the
  dialog; labeled by filter names, judged harmless for an internal tool.
- **Dialog errors render inline** (AddFilterDialog's error-box pattern), not via the app-level
  AlertDialog — an app alert would layer over the still-open dialog. The created share link
  **always renders inline with a Copy button**, which subsumes the clipboard-blocked fallback
  (decision 10's AlertDialog fallback path never needs to exist).
- **No separate `useExport` hook** — the capture lives inside `export-dialog.jsx` (single
  consumer). The legacy page-clamp `useEffect` was replaced by a render-time clamp: the
  installed `react-hooks/set-state-in-effect` rule (the one that shaped 6a's `useLocalPref`)
  rejects it, and the clamp was redundant anyway. `ShareDialog`'s list loader keeps its
  setState in `.then` callbacks for the same rule.
- **`ExportDialog` uses our `Dialog` chrome** ("Sprint Report — <name>" title, actions in the
  body row) instead of the legacy header-actions layout; offscreen pages park at `-left-500`
  (canonical spacing classes per the installed Tailwind lint, ui-polish precedent). Success
  closes the dialog + toasts, legacy parity.
- **No filter-subset picker in `ShareDialog`** (spec: "skip unless trivial") — a share always
  covers the whole current board; the export dialog is where per-filter selection lives.
- **Past `expiresAt` is rejected at create (400)** — small validation addition beyond the spec.
- **Smoke ran against the already-running dev server** (found on :3002 — Naveen's, presumably
  for the ui-polish eyeball); it hot-compiled the new routes. It was stopped for the env-free
  production build (dev and build share `.next`) and **restarted afterwards** (answers 200).

## Doc-sync (§17 — do in the same PR)

- **§5 "Share view" row**: [PARTIAL] → **[BUILT in `web/`]** (token route `/share/[token]`, live +
  frozen, expiry; legacy app keeps the base64 URL until cutover — say so). **"Export PDF / PNG"
  row**: note the `web/` port (html2canvas-pro + jsPDF over the re-skinned print pages).
- **§13 item 4**: mark **implemented in `web/`** — short token, expiry, revocation; "optional auth
  requirement" explicitly **not** built (don't over-claim).
- **§14.3**: mark fixed in `web/` (legacy unchanged until cutover).
- **§11**: flip the 6a note's "Export/Share buttons wait for step 8".
- **§12**: note the `asOf` param if decision 6 lands (metrics now take an explicit clock).
- **Master plan step 8** → DONE + as-built decisions (public token page, writer-role create,
  html2canvas-pro, asOf threading).
- **Do NOT** touch §7 (legacy snapshot), the step-9/10 rows, or claim any Redis/Gemini/auth-gated
  shares. Record as-built deviations in this file.

## References

- @context/project-overview.md — §4 (Share view / Export glossary), §5 (both rows), §9
  (`SharedView` model + rationale), §11 (Hero buttons), §13 item 4, §14.3, §16 (share-token
  decision), Production Migration Plan step 8
- Legacy source to port: [App.jsx:64-81](../../src/App.jsx#L64-L81) (`handleShare`),
  [usePersistedSprintState.js:66-95](../../src/hooks/usePersistedSprintState.js#L66-L95)
  (`?share=` restore — being replaced), [useExport.js](../../src/hooks/useExport.js) (capture),
  [ExportModal.jsx](../../src/components/modals/ExportModal.jsx) (toggles, pages, offscreen
  capture tree)
- `web/` reuse points: [dashboard-data.js](../../web/src/lib/dashboard-data.js)
  (`getDashboardData` read shape to mirror), [metrics.mjs](../../web/src/lib/metrics.mjs)
  (`computeSprintMetrics`/`getHealthStatus`/`getWeeklyVelocity` — `asOf` touch points),
  [rbac.js](../../web/src/lib/rbac.js) (`TEAM_WRITER_ROLES`, `requireTeamRole`),
  `web/src/lib/api/route-helpers.js`, `web/prisma/schema.prisma` (`SharedView`)
- @context/features/ui-polish.md (HeroShell/toast/dialog patterns the dialogs + share page reuse),
  @context/features/ui-port.md (VIEWER read-only matrix precedent, transition busy pattern),
  @context/features/domain-apis.md (route/RBAC/zod patterns)
- `web/AGENTS.md` + `node_modules/next/dist/docs/` (async `params`, metadata/robots — read first)
