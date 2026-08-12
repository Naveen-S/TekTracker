# StoryBoard — Project Overview: Build History (archive)

> Verbatim dated build entries and ratified-decision bodies moved out of
> `context/project-overview.md` on 2026-08-11 to keep that canonical doc scannable.
> **Append-only; do not rewrite** (same convention as the rename/path notes there). The
> overview keeps a one-line current-state summary + a pointer here and to the per-feature
> `context/features/*.md` spec for each item.
>
> Conventions unchanged: "Sprint Tracker"/"TekTracker" = StoryBoard (rename 2026-07-31);
> `web/...` paths are pre-cutover (2026-07-18) and mean today's repo root.

---

## §5 — Feature-list note history (as of 2026-08-11)

The full original §5 feature table, before its Notes cells were condensed. Per-feature detail
also lives in the linked `context/features/*.md` files.

| Feature | State | Notes |
|---|---|---|
| Add Jira filters (by filter ID or JQL) | **[BUILT]** | `useSprintData.handleAddFilter`. **`web/` UI: AddFilter dialog → CRUD POST + immediate sync** (step 6a, 2026-07-08). |
| Update stages per work item | **[BUILT]** | Manual checklist; `toggleStage`. Not Jira-derived. **`web/` UI: matrix cells → idempotent PUT w/ server-owned cascade** (step 6a, 2026-07-08; hybrid-seeded since step 5). **[Bulk sync 2026-08-10]** a per-track **"Sync stages" button** in the matrix header pulls the latest Jira status for one track (Roadmap/Tech Debt/External/Internal) and re-derives every issue's stages from it — the user-triggered **overwrite** variant of the deferred re-seed-forward (confirm first; unmapped statuses never wiped; `updatedById` reset so it's idempotent). New `syncFilterStagesFromJira` + `.../filters/[filterId]/sync-stages` route (**45 → 46 ƒ Dynamic**); no schema change. See context/features/sync-stages-from-jira.md. |
| Mark work item as blocked | **[BUILT]** | `toggleBlocked`. **`web/` UI: health chip → PUT blocked** (step 6a, 2026-07-08). |
| Remove Jira filter | **[BUILT]** | `handleRemoveFilter` (wipes stages). **`web/` UI: DELETE — progress survives by design (§9)** (step 6a, 2026-07-08). |
| Sync Jira (pull live status) | **[BUILT]** | Legacy: `handleSyncAll`; diffs added/removed issues. **`web/`: server-side sync engine + `POST …/sync` route with hybrid stage seeding** (step 5, 2026-07-07). |
| Configure sprint (dates, name) | **[PARTIAL]** | Legacy modal has no gating and no first-class sprint. **`web/`: admin-gated API (step 4) + admin-only UI (SprintConfig dialog + `/admin`, step 6a, 2026-07-08)**; legacy app ungated until cutover. |
| Reorder filters | **[BUILT]** | Drag + priority default sort. **`web/` UI: drag → PUT `…/filters/order`** (step 6a, 2026-07-08). |
| Export PDF / PNG | **[BUILT]** | Legacy: client-side `html2canvas` + `jsPDF`; include/exclude filters. **`web/` port (step 8, 2026-07-12): `html2canvas-pro` (Tailwind-v4-oklch-safe) + `jsPDF` over re-skinned offscreen A4 pages, dynamic-imported.** **[Restyled 2026-08-07]** the sprint export now shares the `/bugs` PDF design system via a new **shared export kit** (`lib/export/print-theme.mjs` palette/tones/geometry + `components/export/print-kit.jsx` primitives `PrintSheet`/`PrintHeader`/`PrintFooter`/`KpiBox`/`ReportPanel`/`ExecutiveReadout`/`KeyLink` + `lib/export/pdf-capture.js`): A4 portrait with a blue→purple→magenta gradient header rule, purple eyebrows, tinted KPI tiles, readout callouts, and **clickable blue Jira-key chips** (`overlayLinks` px→mm annotations), captured at scale 3. The `/bugs` export was refactored onto the same kit (renders identical). No schema/route/dependency change; 44 ƒ Dynamic unchanged. See context/features/export-visual-consistency.md. |
| Share view | **[BUILT in `web/` — 2026-07-12, step 8]** | Legacy still encodes the dataset into a base64 URL until cutover. **`web/`: server-persisted `SharedView` → public read-only `/share/[token]`** (192-bit token, live or frozen w/ `asOf`-pinned metrics, expiry, revocation); see context/features/share-view-export.md. |
| Multi-team / ED roll-up | **[BUILT in `web/` — 2026-07-08]** | Team + membership model and admin APIs came in step 4 (2026-07-07); the roll-up *view* is step 6b: read-only `/rollup` server page (combined `MetricGrid` + per-team table via pure `aggregateRollup`), membership-derived, no Sync — staleness from `lastSyncedAt`. |
| Trend / burndown / "projected by end of sprint" | **[BUILT — data 2026-07-09, UI 2026-07-19]** | Daily per-team `SprintSnapshot` rows written by the step-7 cron (`POST /api/cron/daily`); the burndown panel (ideal/actual/projection SVG + snapshot-based velocity) renders on `/` and `/rollup` (context/features/trend-burndown.md). |
| AI summary (pluggable provider) | **[BUILT in part — 2026-07-20, extended 2026-07-21]** | Provider-agnostic platform (`src/lib/ai/` — Gemini + Anthropic fetch adapters, switched by `AI_PROVIDER` env; §16 amendment) behind the on-demand **"AI Digest"** dialog on `/` — §16 use cases 1–2 (risk call-outs + leadership narrative). **Roll-up digest BUILT 2026-07-21**: `POST /api/rollup/ai-digest` + `AiDigestDialog` reused on `/rollup` — a portfolio prompt comparing every team, with known/agreed risk comments (below) narrated as managed context. Q&A + stage suggestions still open. See context/features/ai-insights.md and context/features/risk-comments-rollup-digest.md. |
| Risk call-out comments + roll-up all-risks dialog | **[BUILT — 2026-07-21]** | `IssueProgress.riskComment` lets a Lead/EM annotate a called-out risk as known/agreed (e.g. a planned late QA hand-off) so it reaches ED/VP as managed context, not a fresh alarm — editable from the risk panel on `/` (writer roles), read-only everywhere else. `/rollup`'s risk panel now shows every team's comments/blocked reasons and a "View all risks" dialog listing every risky issue across teams (replacing an inaccurate "see the matrix below" line). See context/features/risk-comments-rollup-digest.md. |
| Bug report dashboards (`/bugs`) | **[BUILT — 2026-07-21]** | Config-driven bug matrix + executive dashboard: rows = categories (ordered Jira **status** lists with a fallback category), columns = scope (External/Internal, each its own Jira universe) × priority band (P0–P4), cells = open count with an SLA-breach overlay. **Everything is admin config** — universes (saved filter id or JQL), category→status mapping, SLA days per (scope, priority), bands — so a second dashboard (e.g. Honda) is configuration, not code. Cached + nightly cron + manual Refresh; classification is read-time so config edits apply instantly. **[Enhanced 2026-08-02]** an External/Internal/**All** scope toggle now drives the whole page (matrix, KPIs, charts, and the new sections) with External highlighted — instant client-side over three server-pre-rendered subtrees; a **"Bugs by scrum team"** section groups bugs by scrum team via a **read-time, FK-less join** from each bug's Jira sub-component (a new `BugReportIssue.subComponent` column) to the `JiraSubComponent → Team` catalog, with a per-team → per-developer → inline-issue drill and an "Unassigned/Untagged" bucket. One additive migration; **44 ƒ Dynamic unchanged** (no new routes). Also a **downloadable landscape executive PDF** ("Export PDF" in the hero) of the current scope view — an executive brief + a risk-ordered team appendix (+ optional oldest-open appendix, height-budgeted pagination in `lib/bug-report/pdf-layout.mjs`), html2canvas-pro + jsPDF (existing deps), with **clickable Jira links** (issue keys, matrix cells incl. breached subsets, and team/developer rows) added as jsPDF `link()` annotations over the rasterized sheets. **[Enhanced 2026-08-04]** a config-driven **sprint-ownership** grouping (`BugReport.sprintOwnershipPattern`, e.g. `GM-*`): within the active scope, bugs are called out as **ours** (Jira sprint matches the pattern) vs **dependencies** (another team's sprint) vs **no sprint**, via a read-time match against a new raw-fact column `BugReportIssue.jiraSprintName` — a drill section (bucket → sprint → issues) + a KPI card + a PDF appendix, all scope-toggle-aware. `*` wildcard / no-`*` prefix / comma-OR; one additive migration, **44 ƒ Dynamic unchanged** (no new routes). Verified live on `gm`: 145/233 bugs tagged → Ours 136 · Dependencies 9 · No sprint 88. See context/features/gm-bug-report.md, context/features/enhancing-bug-board.md, context/features/bug-report-pdf-export.md, and context/features/bug-sprint-ownership.md. |
| Admin settings / RBAC | **[PARTIAL]** | Server-side RBAC live in the `web/` domain APIs (step 4, 2026-07-07): `User.isAdmin` + `TeamMembership.role` guards (`lib/rbac.js`) on teams/sprints/filters/progress. Admin UI exists for teams/members/sprints (step 6a) and **bug-report config (2026-07-21)**; broader settings UI still absent. |
| One-Click Sprint Start | **[BUILT — 2026-07-26]** | Admin-maintained `JiraComponent`/`JiraSubComponent` catalog (a Jira project's Component field value → many literal Sub-components, each claimed by at most one Team) + per-team Jira Issue Type overrides + `Sprint.fixVersions`. A dashboard action (`TEAM_MANAGER_ROLES` — same gate as manual filter creation, **no RBAC change**) generates a team's missing Roadmap/Tech Debt/Internal Bug/External Bug filters against an **existing** Sprint (never creates one — Sprint stays admin-only) from generated JQL, skipping any track that already exists. External Bug scopes by the **parent Component name AND the team's sub-components** (both AND'd — amended below), not parent-only as first shipped. **[Corrected 2026-07-27]** Naveen's real Jira run caught two JQL bugs the spec got wrong: the team's own tracks scope via a *custom* Jira field (`"sub-component[dropdown]"`), not the standard `component` field; and field naming/order/quoting/a trailing `ORDER BY` all needed to match his instance's real conventions. Same day, Naveen also amended External Bug to AND the sub-component clause alongside the parent-Component clause (was parent-only). See context/features/one-click-sprint-start.md (Status + As-built notes). |
| Velocity / LeaderBoard (`/leaderboard`) | **[BUILT — 2026-07-27]** | A gamified "healthy competition" screen: a **team velocity leaderboard** (teams ranked by `completedPoints ÷ Team.developerCount`, a new admin-entered field — not a dynamically-derived assignee count) and an **org-wide developer leaderboard** (individuals ranked by points delivered, aggregated across every scrum team via `Issue.assigneeAccountId`), both with a sprint-scoped view (default: active sprint) and an all-time cumulative view. **No new snapshot table** — unlike `SprintSnapshot`'s daily-cron pattern, history here is computed **live** from the already-persisted `Issue`/`IssueProgress` rows, made safe by a bundled bugfix gating the manual "Sync Jira" action away from `CLOSED` sprints (their historical data must stay frozen). Gated to a new, deliberately narrower `LEADERBOARD_ROLES = [EM, ED, VIEWER]` (global admin bypasses; **TPM is excluded**, unlike everywhere else TPM is grouped with ED) — Leads/Members instead see a personal, non-competitive "my stats" card (their own points only, no rank) on `/`. See context/features/leaderboard.md. |
| Committed / Tech Debt / Unplanned work breakdown + per-sprint capacity | **[BUILT — 2026-07-29]** | A three-way story-point composition breakdown — **Committed** (`FEATURE`/Roadmap only), **Tech Debt** (`TECH_DEBT`), **Unplanned Bugs** (`SUPPORT` + `INTERNAL_BUG`) — badged as "two types" (Committed alone vs. Tech Debt + Unplanned Bugs grouped), shown next to every "total story points" figure on `/`, `/rollup`, `/share/[token]`, and the PDF/PNG export. **Purely additive/display-only** — never wired into Sprint Health, Completion %, At-Risk, or the existing delivery/throughput lens (§12). Paired with a new admin-configurable, **per-team-per-sprint** `SprintCapacity` target (a Committed-points-only budget, e.g. "Configurator + Website Setup: 24") — a per-sprint join table rather than a static `Team` field like `developerCount`, since committed scope can shift release to release — edited via a new admin matrix screen (one sprint at a time, all teams, plus a "duplicate to another sprint" action). Admin-only, no RBAC change. `/leaderboard` deliberately untouched. **[Redesigned 2026-07-29, same day]** — the breakdown's chip row was replaced by a full **delivery scoreboard** on an ink surface (composition rail whose segment width = share of planned scope and solid fill = delivered, in `condensed`/`relaxed` variants; `/rollup` gets the only per-card Condensed/Relaxed toggle). Presentation only — 44 ƒ Dynamic unchanged, no schema/route/dependency change. See context/features/committed-unplanned-work.md. **[Bifurcated + per-team chart 2026-08-09]** — **Unplanned Bugs splits into External (`SUPPORT`) + Internal (`INTERNAL_BUG`)** across all four surfaces (`/`, `/rollup`, `/share/[token]`, export), and `/rollup` gains a **"By team" chart view** (toggle `Condensed·Relaxed·By team`): one horizontal stacked bar per team (length ∝ that team's committed+tech-debt+bug load, segments = the four work types, sorted heaviest-first) — the one lens the portfolio totals can't show. (A composition **donut** was tried first and dropped — it only re-drew the same composition the rail already shows; the board has no chart, just the bifurcation.) Additive only — `metrics.mjs` gains `external*`/`internal*` fields beside the untouched `unplanned*` (before/after fixture diff proves every prior field byte-identical); a new validated categorical token `--on-ink-cat-4` orchid `#d385b0` carries Internal (solid = planned work, **hatch = reactive bug**; hue sub-divides). No schema/route/dependency change (45 ƒ Dynamic, incl. office-deployment `/p/health`). See context/features/unplanned-split-and-chart.md. |
| Default scrum team & release (per-user board default) | **[BUILT — 2026-08-11]** | Each user can pin a **default team + release** so the board (`/`) opens on their own board instead of the alphabetically-first team + ACTIVE gate. Two nullable `User` columns (`defaultTeamId`/`defaultSprintId`, one additive migration **9 → 10**) resolved **server-side** in `getDashboardData`/`getSprintSelection` (team pref before `teams[0]`; a new optional `fallbackSprintId` above the ACTIVE default so a pinned release is honored even once CLOSED, falling back only if deleted) — no flash, syncs across devices. Set via a **star** in the top bar (`Star` toggle next to the selectors: pin current view / click again to clear; filled = current view is the default) writing to a new self-service `PATCH /api/me` (`requireUser`; 403 on pinning a non-member team) — the app's **first `User`-self-mutation route** (**46 → 47 ƒ Dynamic**). Board-only (`/rollup`/`/leaderboard` unchanged); additive/display-only, no §12 metric or RBAC change. See context/features/default-team-release.md. |

---

## §11 — UI/UX build log (full entries)

The 22 dated `[BUILT …]` blockquotes moved out of §11, in original order. §11 now carries a
compact build-log table pointing to these and to each feature spec.

> **[BUILT in `web/` 2026-07-08, step 6a]** — login + team dashboard + minimal `/admin` re-skinned
> with Tailwind v4 + hand-written shadcn-style components on **server data**
> (`usePersistedSprintState` retired; localStorage keeps only density/collapse): `/login`, `/`
> (server component + client leaves: TopBar w/ team+sprint selectors, Hero, MetricGrid, FilterPanel,
> PlannerPanel matrix, AddFilter/SprintConfig/Alert dialogs), `/admin`. Export/Share buttons
> **landed with step 8 (2026-07-12)** — Hero "Share View" (ShareDialog: live/frozen, expiry,
> manage/revoke list, clipboard+toast) and "Export" (ExportDialog: filter toggles, paged preview,
> PDF/PNG via `html2canvas-pro`+`jsPDF`), plus the public read-only `/share/[token]` page; ED
> roll-up views are step 6b; dark-mode toggle and loading skeletons stay post-v1. See
> context/features/ui-port.md and context/features/share-view-export.md.
>
> **[BUILT in `web/` 2026-07-10 — ui-polish, step-6 addendum]** — the deferred polish landed as a
> full re-skin to the **legacy design system** (`src/styles.css` is the reference): legacy type
> stack (Manrope display / Inter body / JetBrains Mono via `next/font/google`), `#F4F7FA` canvas +
> ink-tinted shadow scale + motion tokens + health-triplet tokens in `globals.css` `@theme`, one
> shared ink Hero (`ui/hero-shell.jsx` + `hero-panel` utility: dual teal radial glows, glass
> `onDark` buttons, days-remaining pill) reused by `/` and `/rollup`, legacy matrix treatment
> (accent spines + `color-mix` section tints, teal key chips, 3-state bordered stage badges w/
> hover glow rings, bordered health pills, frozen first column), metric cards w/ tone stripes +
> icon tiles + display numerals, lucide icons replacing text glyphs, **success toasts**
> (`ui/toast.jsx`; errors keep the alert modal; admin `window.confirm` → styled confirm), and
> deterministic accent-palette assignment on filter creation (`accentColor`, the only
> non-presentation change). **A second "Modern" theme (blue + a dark nav sidebar) shipped 2026-07-24
> (modern-theme.md); the dark-mode toggle and loading skeletons remain post-v1** (the `.dark`
> token set stays dormant). See context/features/ui-polish.md.
>
> **[BUILT 2026-07-24 — Modern theme]** — a second, selectable **"Modern"** theme alongside the
> untouched **Tekion** default (theme switcher in the top bar + admin header; a `theme-modern` class
> on `<html>` set by a no-FOUC boot script + localStorage). Unlike a recolor, Modern is a **layout
> shift**: a shared `AppShell` renders a dark left-nav **sidebar** (active-route highlight,
> collapse↔icon-rail) on `/`, `/rollup`, `/bugs`, `/admin`, revealed only under Modern via
> `hidden modern:lg:flex` (CSS-reveal — Tekion is byte-for-byte unchanged); the top-bar nav hides
> under Modern (`modern:lg:hidden`), and below `lg` Modern falls back to top-bar nav. Blue `#2f6bff`
> tokens, **monochrome blue status chips** (semantic color survives in matrix dots + card accents +
> breach counts), a blue-re-hued ink hero, and a cross-fade on theme swap. `/login` + `/share` and
> the PDF exports + validated bug-chart palette stay Tekion-branded. No schema/migration/route/
> dependency change. See context/features/modern-theme.md.
>
> **[BUILT 2026-07-26 — sidebar promoted to Tekion too + dropdown redesign]** — the left-nav sidebar
> is **no longer Modern-exclusive**: it now reveals at `lg+` in **both** themes (`hidden lg:flex`,
> was `hidden modern:lg:flex`), so Tekion is **no longer byte-for-byte unchanged from pre-Modern-theme
> Tekion** — both themes share the `AppShell`/sidebar layout, differentiated by token/palette only;
> `bg-ink` plus the themed `--primary`/`--accent` tokens re-hue it automatically per theme with no
> per-theme branching. `ui/select.jsx` was also rebuilt: a drawn chevron replaces the OS glyph
> (`appearance-none`), hover/focus states now match `Input`/`Button`, and a real `cva`
> `variant="onDark"` fixed a latent bug (the bug-report switcher had been passing the no-op
> `className="onDark"` since it shipped). No schema/migration/route/dependency change. See
> context/features/modern-theme.md As-built notes.
>
> **[BUILT in `web/` 2026-07-08, step 6b]** — **`/rollup`**, the ED/TPM/EM multi-team roll-up:
> a read-only server page (one client leaf: sprint selector + "My board" + logout) rendering the
> **combined `MetricGrid`** (via pure `aggregateRollup`) over an SSR **per-team summary table**
> (key/name, my role, issues, pts done/total, avg %, health chip, 5-band counts, blocked,
> `lastSyncedAt` staleness, "Open board →" into `/?team=&sprint=`), sorted worst health first.
> Entry: a TopBar "Roll-up" link on `/` when the user has ≥2 teams or is admin (the URL renders a
> harmless 1-team roll-up otherwise). Deliberately **no Sync** here (§14.9 rate-limit storm) —
> freshness is step 7's cron. See context/features/ed-rollup.md.
>
> **[BUILT 2026-07-19 — trend/burndown row, post-v1 item 1]** — a two-up row (`xl:grid-cols-2`,
> stacking below xl) under the `MetricGrid` on `/` (per-team) and `/rollup` (per-day summed over
> teams w/ "N of M teams" tooltips). Left: server-safe `TrendPanel`
> (`components/dashboard/trend-panel.jsx`; hand-rolled inline SVG, **no charting dep**): ideal
> line (latest total → 0 across the sprint window), teal actual burndown w/ markers + endpoint
> label, dashed trailing-7-day projection, today marker, legend, stat chips + projected-finish
> badge; 0 snapshots renders a **visible** "trend data accrues daily" state (deliberate — cron
> scheduling on Tekion infra is still pending). Right: **`RiskCalloutsPanel`**
> (`risk-callouts-panel.jsx`, iterated in per Naveen 2026-07-19) — the **deterministic
> forerunner of the §16 Gemini risk-call-outs use case** (the AI narrative stays post-v1):
> trend signals (no burn / off pace) + worst issues first (Blocked → Behind → At Risk, points
> desc, capped w/ overflow line), blocked reasons inline, linked Jira keys on both boards
> (roll-up too since 2026-07-20), team-key chips on `/rollup`, column-aligned rows via
> subgrid (2026-07-20), all-clear state. Frozen/live shares and exports deliberately show no
> trend/risk row. See context/features/trend-burndown.md.
>
> **[BUILT 2026-07-21 — risk comments + roll-up all-risks dialog + roll-up AI Digest]** —
> `RiskCalloutsPanel` renders `riskComment` inline with a "Known" badge (managed/agreed risk, not
> a fresh alarm) and, on `/` only, a per-row edit affordance for writer roles (new
> `risk-comment-dialog.jsx`, PUT to the existing progress route). `/rollup` gained
> `rollup-risk-section.jsx`: the same panel plus a "View all (N)" chip opening a read-only dialog
> listing **every** risky issue across every team (team chips, blocked reasons, comments,
> worst-first) — replacing the panel's inaccurate "see the matrix below" overflow line on the
> roll-up (there is no matrix there). The roll-up hero also gained an **AI Digest** button
> (`rollup-digest-button.jsx` → `POST /api/rollup/ai-digest`) generating a portfolio digest that
> compares every team and narrates commented risks as known/agreed. See
> context/features/risk-comments-rollup-digest.md.

> **[BUILT 2026-07-21 — `/bugs`, the bug-report dashboard]** — a new top-level route (plus
> `/bugs/[slug]` for multi-report) reusing the shared ink `HeroShell`, MetricGrid card treatment
> and matrix idiom: hero (owner, staleness, refreshed-by, report switcher + Refresh, error banner
> when the last refresh aborted) · 5 KPI cards with previous-capture deltas · **the matrix**
> (frozen first column, ~13 columns = 2 scopes × 5 bands + scope totals + grand total, `n (m)`
> with breach in the danger tone, every cell a composed Jira drill-down) · a two-up row (SVG trend
> + SLA breach call-outs) · a three-up row (priority mix / category mix / ageing) · oldest-bugs
> table · reference chips. Charts are **hand-rolled inline SVG — no charting dependency** (the
> TrendPanel precedent), palette validated with the dataviz validator (teal/blue CVD ΔE 19.9).
> TopBar gains a "Bugs" link on `/` and `/rollup` when a report exists. See
> context/features/gm-bug-report.md.

> **[BUILT 2026-08-02 — `/bugs` scope toggle + Bugs-by-scrum-team drill]** — the hero gained a
> **page-level scope lens** — an on-ink segmented control `[ External · Internal · All ]` (the
> `rollup-story-points` glass-pill grammar) with External carrying a persistent accent dot — that
> drives the ENTIRE page. Under it, a new **"Bugs by scrum team"** panel: ranked horizontal bars per
> team (the Category-mix `Bar` grammar, `bg-danger` breach under-rail), worst-first with an
> **"Unassigned / Untagged"** bucket last, that **click-expands** into per-developer bars (`AvatarChip`
> + count) and, one level deeper, an inline issue list + a `key in (…)` Jira link. In the All view
> the matrix's External scope-group header + the KPI "Total open" per-scope detail lead with a
> restrained External accent. Mechanism (enhancing-bug-board.md decision 2): the page pre-renders
> **three scope subtrees** (All/External/Internal) and a `BugScopeProvider` + two `BugScopeSlot`s
> (hero pressure bar + body) mount only the selected one, so switching is a **client swap with no
> network round-trip** and the panels stay server components. `Bar`/`AvatarChip` roots became
> `<span>` so they nest validly inside the expand `<button>`s. No new routes (44 ƒ Dynamic
> unchanged); one additive `BugReportIssue.subComponent` column. See
> context/features/enhancing-bug-board.md.

> **[BUILT 2026-08-02 — `/bugs` PDF export with clickable Jira links]** — an **"Export PDF"** hero
> action downloads a paginated A4 PDF of the **current scope selection** (`bug-export-dialog.jsx`):
> a summary page (KPIs + the category × scope × band matrix), by-team pages (team → developer →
> issues), and an oldest-open table. It ports the sprint board's `ExportDialog` capture
> (`html2canvas-pro` → jsPDF `addImage`, both dynamic-imported, no new dep) and adds the one thing it
> lacked — **clickable links**: the print pages carry real `<a href>` elements and, after each page
> is rasterized, transparent `pdf.link(x, y, w, h, { url })` annotations are overlaid at each
> anchor's position (px → mm), so issue keys open the issue and matrix cells open that JQL search in
> any PDF reader. Page images are **JPEG 0.92** (a multi-page PNG report ran to 175 MB; JPEG → ~6 MB).
> Verified against a real generated PDF's `/URI` annotations. No schema/route/dependency change,
> 44 ƒ Dynamic unchanged. See context/features/bug-report-pdf-export.md.

> **[BUILT 2026-08-04 — the `/bugs` PDF was reworked to a landscape executive report]** — the
> portrait note above is the first iteration; the export now ships as **landscape** A4: a
> `BugExecutiveSummary` brief, a **risk-ordered** `BugTeamAppendix` (worst SLA exposure first), and an
> **optional** oldest-open appendix (a `Checkbox` + 20/40/60 `Select` in the dialog). The naive
> row-count pagination was replaced by **height-budgeted** packing in the new pure
> `lib/bug-report/pdf-layout.mjs` (`sortTeamsByRisk`/`paginateTeamAppendix`/`chunkRows`) — multiple
> small teams share a sheet and large teams split with repeated team + developer headers (this
> supersedes the earlier "each team on its own sheet"). Matrix **breached-subset** and
> **combined-scope** cells are now clickable too, and the PDF carries document metadata
> (`pdf.setProperties`). Same `pdf.link()` overlay mechanism, still html2canvas-pro + jsPDF (no new
> dep), 44 ƒ Dynamic unchanged. See context/features/bug-report-pdf-export.md.

> **[BUILT 2026-08-04 — `/bugs` sprint-ownership grouping (ours vs dependencies)]** — within the
> active scope the page now calls out, and groups by, **Jira sprint ownership**: a bug whose
> `jiraSprintName` matches the report's `sprintOwnershipPattern` (e.g. `GM-*`) is **ours**, a bug in a
> non-matching sprint is a **dependency** on another team, and an un-sprinted bug is its own **No
> sprint** bucket. Surfaced as a new drill `Panel` (`bug-sprint-ownership-section.jsx`: three callout
> tiles + bucket → sprint → inline-issue drill with `key in (…)` Jira links), a KPI card in
> `bug-kpi-cards.jsx` (`Ours / dependencies`, the row grows to `xl:grid-cols-7` when configured), and a
> **PDF ownership appendix** (`paginateOwnershipAppendix` in `pdf-layout.mjs` reusing the parametrized
> `BugTeamAppendix`). Config-driven per report (a new "Sprint ownership" admin section, rides the
> existing config Save); matcher = `*` wildcard / no-`*` prefix / comma-OR, case-insensitive. One raw
> fact is fetched by the refresh (the Sprint field id resolved env → `/field` discovery →
> `customfield_10020`, `/field` fetched once and shared with sub-component discovery); everything else
> is **read-time**, so a pattern edit re-renders instantly with no Jira refresh. One additive
> migration (`BugReportIssue.jiraSprintName` + `BugReport.sprintOwnershipPattern`), **44 ƒ Dynamic
> unchanged** (no new routes), no RBAC change. Verified live on `gm` (145/233 tagged → Ours 136 ·
> Dependencies 9 · No sprint 88; read-time reclassification proven across pattern changes with no
> refresh). See context/features/bug-sprint-ownership.md.

> **[BUILT 2026-08-07 — the sprint export adopts the `/bugs` PDF design system]** — per Naveen
> ("follow similar color, theme, styling and format for all the exports… even the clarity should be
> very similar"), the sprint board export (`dashboard/export-dialog.jsx`, the app's only other
> export) was re-skinned from its old teal/pastel/Manrope portrait look onto the `/bugs` Executive
> Bug Report design system, extracted into a **shared export kit**: `lib/export/print-theme.mjs`
> (palette `INK/BLUE/PURPLE/RED/…` + `ACCENT_GRADIENT` + `KPI_TONES`/`READOUT_TONES` + `PORTRAIT`/
> `LANDSCAPE` geometry), `components/export/print-kit.jsx` (`PrintSheet`/`PrintHeader`/`PrintFooter`/
> `KpiBox`/`ReportPanel`/`ExecutiveReadout`/`KeyLink`), and `lib/export/pdf-capture.js`
> (`captureOptions`/`canvasToPngBytes`/`overlayLinks`/`fileStamp`/`safeFilePart`). Both exports now
> import the kit — the `/bugs` export (landscape) was refactored onto it and renders **identical**,
> the sprint export (portrait, restyle only per Naveen) gains the gradient header rule, purple
> eyebrows, tinted KPI tiles, Delivery-readout / Work-composition callout panels, a "WORK BREAKDOWN"
> appendix with **clickable blue Jira-key chips** (`overlayLinks` px→mm annotations, PDF only), and
> scale-3 clarity + `pdf.setProperties` metadata. No schema/route/dependency change; **44 ƒ Dynamic
> unchanged**. Verified live: a real sprint PDF carries 20 clickable `/URI` Jira `browse/…`
> annotations, and the refactored `/bugs` preview is pixel-identical to the reference PDF. See
> context/features/export-visual-consistency.md.

> **[BUILT 2026-07-24 — sprint timeline (dev → QA/UAT → release) + two-lens metrics]** — the
> days-remaining pill is now **phase-aware** across `/`, `/rollup`, `/share` (dev cycle countdown →
> **"Dev cycle ended · QA/UAT · Nd to release"** → "Released"; "Sprint ended" only without a release
> date), hero/admin/export **eyebrows spell out both cycles** (`formatSprintWindow`), and the hero
> **phase bar is hybrid** — delivery completion % drives Scope·Design·Develop·Review during the dev
> cycle, then QA·UAT·Release light up by date. Metrics are re-scoped to **two lenses** (§12): Sprint
> Health / Completion / At-Risk / risk call-outs = **delivery** (roadmap + tech debt, dev cycle);
> velocity + Issues-in-scope = **all work**. Support/regression bugs keep their Delivery-Matrix rows
> but no longer move the delivery signal. No schema/migration/route/dependency change. See
> context/features/sprint-phases-delivery-lens.md.

> **[BUILT 2026-07-25 — hero timeline UI + live release countdown]** — a leadership-readable
> refresh of the hero timeline (same `feature/modern-theme` branch, presentation only). The flat
> days-remaining pill is replaced by a live **release countdown** (`ui/release-countdown.jsx`, a
> client leaf: a progress ring + a ticking `d·h·m·s` clock with blinking colons and a shimmer sweep;
> phase-aware tone, urgent-red under 3 days, green "Released") — still server-safe via the
> `DaysRemainingPill` wrapper, and frozen shares still show "Frozen snapshot". On `/` the hero phase
> bar became a **sprint timeline** (`dashboard/sprint-phase-bar.jsx`): two macro-cycle status chips —
> **`✓ Dev cycle · Completed`** then **`● QA / UAT · In progress`** (green check / pulsing dot per
> phase, so "dev done, QA started" reads at a glance) — over the seven phases grouped
> `Scope·Design·Develop·Review │ QA·UAT·Release` with partial-fill animated bars, and it hosts the
> countdown at its right end. The countdown moved out of the hero copy line to the hero **top-right**
> on `/`, `/rollup`, `/share`. The **Relaxed/Dense view toggle was retired** — density is fixed at
> "dense" (still rides into `SharedView.viewDensity` + matrix padding; the dashboard dropped its
> `DENSITY_KEY` localStorage pref, the collapse pref stays). New `--on-ink-success` token +
> `sweep`/`blink` keyframes in `globals.css`; **no schema/migration/route/dependency change**. See
> context/features/modern-theme.md and context/features/sprint-phases-delivery-lens.md.

> **[BUILT 2026-07-26 — One-Click Sprint Start]** — a new **"Jira components"** catalog `SectionCard`
> on `/admin` (Component name+projectKey → many Sub-components, each expandable with an
> "Unassigned"/"Claimed by `<Team>`" badge, one-at-a-time add forms — no bulk import), plus the
> admin **Team create/edit dialog** (`team-config-dialog.jsx` — the first team-edit affordance;
> admin previously could only create, never edit) with a Component picker + sub-component claim
> checklist and a collapsed "Advanced: Issue Type overrides" section. Both existing Sprint forms
> (admin inline create, `SprintConfigDialog`) gained a `fixVersions` text input. On the dashboard, a
> new Hero **"Sprint Start"** action (`TEAM_MANAGER_ROLES`, same gate as manual filter creation)
> opens `sprint-start-dialog.jsx`: pick an existing `PLANNING`/`ACTIVE` Sprint (never creates one —
> Sprint stays admin-only), preview the 4 tracks' generated JQL client-side (same pure builder the
> server uses), submit to generate whichever of Roadmap/Tech Debt/Internal Bug/External Bug don't
> already exist, syncing immediately. See context/features/one-click-sprint-start.md.

> **[BUILT 2026-07-27 — real favicon + brand icon]** — the generic default Next.js favicon (never
> replaced since the 2026-06-12 scaffold) is now the actual Tekion mark Naveen supplied: `app/
> icon.png` (Next's auto-served special file) + a regenerated multi-size `app/favicon.ico`
> (16/32/48px, packed via a throwaway `sharp` script, not committed) for legacy contexts. The same
> image (`public/app-icon.png`, a plain static asset so it's decoupled from the favicon-specific
> metadata convention) now also appears at the top of `ui/app-sidebar.jsx`, replacing the
> hand-drawn CSS "T" tile placeholder from the modern-theme sidebar work — wrapped in a `next/link`
> to `/`, matching the click-logo-to-go-home convention. No schema/migration/route/dependency
> change (this is unrelated to One-Click Sprint Start; it landed in the same session as a separate,
> small ask).

> **[BUILT 2026-07-27 — Velocity / LeaderBoard]** — a new top-level **`/leaderboard`** page (5th
> sidebar entry, `Trophy` icon, gated to `hasLeaderboardAccess`): a **Team Velocity Leaderboard**
> (ranked cards: rank badge, team name, `completedPoints ÷ developerCount`, unconfigured-team
> footnote with an admin link) and an **org-wide Developer Leaderboard** (ranked list: rank badge,
> `AvatarChip` initials, name, team tag, points), side by side in an `xl:grid-cols-2` section under
> a plain `HeroShell` header; a `LeaderboardTopBar` client leaf offers a sprint selector + a
> **This sprint / All-time** toggle (`?sprint=&view=`). Rank 1 on both boards gets a **podium
> treatment** — an accent-tinted card, a bigger `RankBadge` (`lg`, Crown icon) carrying the house
> "sweep" sheen already used on the hero countdown ring (`release-countdown.jsx`), and a bigger
> display numeral — added in an `impeccable` (`bolder` playbook) design pass that reuses only
> existing tone tokens (`bg-accent`/`text-accent-foreground`/`shadow-brand`), so it re-hues
> automatically under both themes with no new primitives. New shared `ui/avatar-chip.jsx`
> (initials-only, no avatar images exist for Jira assignees) retrofit into the 3 previously
> copy-pasted inline avatar circles (`top-bar.jsx`/`bugs-top-bar.jsx`/`rollup-top-bar.jsx`) and new
> `ui/rank-badge.jsx`. LEAD/MEMBER (excluded from the full board) instead see a small
> `MyStatsCard` on `/` — their own points delivered (this sprint + all-time), deliberately with no
> rank or comparison — inserted right after the dashboard's `Hero`. No dark-mode work involved (out
> of scope, as ever, per §10). See context/features/leaderboard.md.

> **[BUILT 2026-07-28 — Story Points Delivered highlight]** — per Naveen ("Total Story Points
> delivered by a team is extremely important... highlight it with micro animation across the
> app"), a new `StoryPointsHighlight` card on `/`, `/rollup` (portfolio-wide, "N teams"), and
> `/share/[token]`: a peer-sized **Delivered / Planned** pair (all-work `completedPoints`/`points`,
> matching the Leaderboard's own basis) in the proven `bg-accent`/`shadow-brand`/house-"sweep"
> treatment from the Leaderboard's rank-1 podium card — reused, not reinvented, so it re-hues
> under both themes automatically. Delivered carries the extra emphasis (a count-up animation +
> the glow); Planned stays real-sized but quieter, per Naveen's mid-build correction that Planned
> deserved visual weight too, not just a caption. New `useCountTransition` hook + shared
> `ui/animated-number.jsx` (a `useSyncExternalStore`-driven counter, mirroring
> `release-countdown.jsx`'s `useLiveNow`) animate a number ONLY when its value changes while
> mounted — first paint always renders the true static value with no JS required — and were
> retrofit into the Leaderboard's and `MyStatsCard`'s numerals for one consistent motion language.
> No schema/migration/route change.

> **[BUILT 2026-07-29 — Committed / Tech Debt / Unplanned breakdown + per-sprint capacity]** — per
> Naveen's handwritten "work division" notes, `StoryPointsHighlight` (on `/`, `/rollup`, and
> `/share/[token]`) gained a new chip row below its Delivered/Planned pair: a standalone
> **Committed** figure (Roadmap/`FEATURE` only) and a **Tech Debt** + **Unplanned Bugs**
> (`SUPPORT`+`INTERNAL_BUG`) pair grouped under one bordered pill — "two types" at the headline
> level without losing the tech-debt-vs-bugs distinction the notes draw. When a team's new
> admin-configured committed capacity is set, the Committed chip appends "· N capacity" (and
> `/rollup`'s portfolio figure appends an "N of M teams configured" caveat when not every team has
> one set yet). `team-summary-table.jsx` gained one "Committed / Cap" column; the PDF/PNG export's
> `SummaryPage` gained a matching three-box row. New admin "Committed Capacity" `SectionCard`: a
> sprint picker + one capacity input per team, saved as one batched `PUT`, plus a "duplicate to
> another sprint" action. **Purely additive** — Sprint Health, Completion %, At-Risk, and the
> existing delivery/throughput lens (§12) are untouched; `/leaderboard` is untouched too. See
> context/features/committed-unplanned-work.md.

> **[BUILT 2026-07-29 — `StoryPointsHighlight` redesigned as the delivery scoreboard]** — same day,
> per Naveen ("extremely important section… every detail in it is represented well"), the card
> above was **replaced, not tweaked**: the chip row it describes is gone. Presentation only — no
> schema/migration/route/dependency change, **44 ƒ Dynamic unchanged**, and all three call sites
> (`/`, `/rollup`, `/share/[token]`) keep their existing props. Seven choices ratified with Naveen
> before any code: full scoreboard footprint · **ink surface** (the hero's material, not the pale
> accent tint — this is the number leadership opens the page for) · totals lead · one authored
> arrival · **Committed branded, the other two neutral** · over-capacity flagged · hover reveals
> precision. As built: a headline `256 / 319` pair with a **composition rail** whose segment WIDTH
> is each type's share of planned scope and whose solid FILL is what's delivered — so the rail's
> lit area *is* the headline %, composition and completion in one shape. **Two variants** (Naveen,
> same day: "it's occupying a lot of real estate" / "in the Rollup screen keep this view, but give
> an option to have condense/relax"): `condensed` (the default — `/` and `/share/[token]`) puts the
> headline beside the rail and prints the per-type detail as a one-line legend, landing at **148px,
> down from 428px**; `relaxed` stacks them and gives each type a full-scale track. `/rollup` — where
> the portfolio breakdown IS the page and nothing below competes for the fold — defaults to
> `relaxed` and is the ONLY screen with a **Condensed/Relaxed toggle**, a new client leaf
> `rollup/rollup-story-points.jsx` over `useLocalPref` (§17 ephemeral-pref rules; note this is a
> per-card control, NOT a revival of the app-wide density toggle retired 2026-07-25).
> **Palette (measured, two channels).** The first cut gave Tech Debt and Unplanned Bugs two greys;
> at 6.7:1 and 4.2:1 on ink they read as background, not as categories. They are now two new
> theme-neutral tokens — `--on-ink-cat-2` **gold `#e3a72f`** (Naveen: "can we use this colour, I
> really like these", pointing at the `/bugs` Ageing ramp) and `--on-ink-cat-3` **rose `#f2a8b6`**.
> The Ageing ramp is deliberately **not** reused verbatim: it was authored against a white card, so
> on ink its two darkest steps collapse to 3.4:1 and 2.2:1 — `--age-*` is untouched and this is the
> same hue re-pitched for the opposite background. **Unplanned Bugs stays hatched** (`.sp-stripe`,
> now tinted cat-3) because brand↔cat-3 is the one pair colour alone cannot carry (worst-case ΔE 4.8
> under deuteranopia in Tekion); texture is that pair's second channel and must not be "simplified"
> away. Knock-on: the over-capacity marker was amber, which sits ΔE 6.4 from the new gold and would
> have read as a fourth category — so `--on-ink-warn` became **`--on-ink-alert` red `#ff5f56`**,
> clearing every categorical slot by ΔE ≥ 8.1. On the rail the capacity tick is drawn **only when committed scope has overrun the
> target** — under target there is nothing to point at, and a tick pinned to the segment's edge
> would imply capacity equals scope; the legend states the headroom in words instead. Hovering any
> work type dims the other two — **pure CSS `:has()`, so the card stays a server component** — and
> nothing is hover-only: every figure is also static text. Motion is one ~0.8s sequence (scope
> drawn → fills grow → capacity marker drops) using new `sp-draw`/`sp-fill`/`sp-mark` keyframes,
> all with `backwards` fill so they hand the property back and never outrank the hover rule.
> `useCountTransition` gained an opt-in `countOnMount` (the first-paint-is-truth guarantee is
> preserved for every other caller, and the reset-to-zero is hidden under the numeral's entrance
> fade, so the flash the 2026-07-28 pass avoided still cannot occur) and, in the same pass, **a
> real bug fix**: its `getSnapshot` sampled the clock on every call, which React flags as "the
> result of getSnapshot should be cached to avoid an infinite loop". The eased value is now
> computed once per rAF frame and cached, with `getSnapshot` only reading it back — this fixes
> every caller (both leaderboards and `MyStatsCard`), not just the scoreboard.

> **[BUILT 2026-08-09 — Unplanned bifurcated (External / Internal) + a per-team composition chart]**
> — per Naveen ("in the unplanned work there are two categories external and internal, let's try to
> bifurcate those in our view… and give a chart-like view based on a view option"), the scoreboard's
> **Unplanned Bugs** segment splits into **External** (`SUPPORT`) + **Internal** (`INTERNAL_BUG`) on
> `/`, `/rollup`, `/share/[token]` and the PDF/PNG export. For the chart: a composition **donut** was
> tried first and **dropped** — Naveen ("the chart representation is not adding any value") was right,
> a donut of the same four numbers the rail already shows adds nothing. It was replaced by a **"By
> team" chart on `/rollup`** (toggle `Condensed · Relaxed · By team`, the `rollup-story-points.jsx`
> client leaf over `useLocalPref` → new `rollup-composition-chart.jsx`): one horizontal stacked bar
> per team, length ∝ that team's committed+tech-debt+bug load, segments = the four work types, sorted
> heaviest-first with delivered/planned/% per row — the one lens the portfolio totals + aggregate rail
> can't show (which teams carry which kind of work). The **board has no chart** — just the condensed
> scoreboard, now bifurcated. Presentation + additive metric fields only: `metrics.mjs` gains
> `external*`/`internal*` beside the untouched `unplanned*` (before/after fixture diff proves every
> prior field byte-identical; `external + internal == unplanned`). The 4th categorical channel is a
> **validated** token `--on-ink-cat-4` orchid `#d385b0` (worst-case CVD ΔE ≥ 11.6 vs brand-both-
> themes/gold/rose/alert-red; **purple/violet was rejected — it collapses against Modern's blue under
> CVD**), encoding **solid = planned work, hatch = reactive bug** (`.sp-stripe` / `.sp-stripe-2`),
> hue sub-dividing the two bugs. No schema/route/dependency change — **45 ƒ Dynamic unchanged** (incl.
> office-deployment `/p/health`). See context/features/unplanned-split-and-chart.md.

---

## §16 — Ratified-decision bodies (full text)

The full original §16 decisions list, before its long entries were condensed to
headline + essence + reference in the overview.

- **Stage model: HYBRID.** Seed `stageCompletion` from `StatusStageMapping` on first sync; manual
  edits win and persist thereafter (`seededFromStatus` keeps the baseline).
- **Auth: personal Jira API tokens, encrypted at rest** (AES-GCM, key in a secret store). Atlassian
  OAuth 3LO deferred, not rejected.
- **Language: JavaScript**, with zod validation at every API boundary + JSDoc typedefs on domain shapes.
- **Hosting: app on Tekion internal infra; database on Neon.**
- **Migration: fresh Next.js App Router app in a `web/` subfolder of this repo**; port hooks/components
  over; both apps runnable until parity, then promote `web/` to root and delete the Vite app.
  *(Amended 2026-07-18 with Naveen, executed at cutover: the Vite app was **backed up into
  `legacy/`, not deleted** — it stays startable there for reference, Node 20 only. See
  context/features/cutover.md.)*
  - **Deferred follow-up (added 2026-06-14): bump the runtime to Node 22 (≥22.12) once the Vite app is
    retired.** Today both apps share one Node and the legacy Vite 2 app pins us to Node 20.19.4; a
    transitive Prisma dep wants Node ≥22, worked around by `ignore-engines true` in `web/.yarnrc`.
    **[DONE 2026-07-18 at cutover]** — `.nvmrc` (22) + `engines >=22.12` added, the `.yarnrc` shim
    deleted; fresh install under Node 22.22.2 passes the engine check natively. The "re-verify the
    Vite app on 22" clause is void — the legacy app is retired-in-place on Node 20.
- **Filter templates: keep** (team-level `FilterTemplate`).
- **Roll-up grouping: single implicit org** — no `Org` table; sprints are global; ED views are
  membership-derived.
- **IssueProgress: one shared row per (team, sprint, jiraKey)**; owning workflow = highest-priority
  filter containing the key.
- **localStorage data: one-time importer** into Sprint/Filter/IssueProgress (don't lose current sprints).
  *(Dropped 2026-07-18 — no legacy localStorage data remains to import; master-plan step 9 skipped.)*
- **Internal Bugs: reuse the 4-stage workflow** (no dedicated stage set).
- **Provisioning: admin-managed** — seeded ADMIN creates teams and assigns members/roles; users sign in
  with Jira and wait to be added to a team.
- **Gemini: post-v1**, all four candidate use cases approved in principle (risk call-outs, narrative,
  Q&A, stage suggestions); start with risk call-outs + narrative since they need no new data plumbing
  beyond snapshots. *(Amended 2026-07-20 with Naveen: the integration is a **provider-agnostic AI
  platform** — all AI specifics behind `src/lib/ai/`'s neutral `generateJson` contract, provider
  switched by `AI_PROVIDER` env so downtime/cost switching needs zero code changes; **Gemini demoted
  to the first adapter**, an Anthropic adapter ships alongside to prove the abstraction. Risk
  call-outs + narrative BUILT 2026-07-20 as the "AI Digest" dialog; Q&A + stage suggestions open.)*
  *(Amended 2026-07-21 with Naveen: three follow-ups ratified — (1) **known/agreed risk
  comments** — `IssueProgress.riskComment`, a Lead/EM annotation communicating that a called-out
  risk is already understood and accepted (e.g. an intentionally late QA hand-off), so it reaches
  ED/VP as managed context rather than a fresh alarm; (2) **`/rollup` shows every risk** via a
  "View all risks" dialog (the roll-up's risk panel was capped at 6 rows with no way to see the
  rest); (3) **roll-up AI Digest** — the "fast follow" flagged 2026-07-20 is now built: a
  portfolio prompt comparing every team, with commented risks narrated as known/agreed in both
  the team and roll-up digests. All three BUILT 2026-07-21; see
  context/features/risk-comments-rollup-digest.md. Remaining open AI ideas: Q&A, stage
  suggestions, export-embedded narrative.)*
- **Bug report dashboards (ratified 2026-07-21 with Naveen).** A config-driven bug matrix +
  executive dashboard at `/bugs`, automating the hand-built daily GM bug report. Ratified:
  (1) rows/columns/cells are all **admin configuration — nothing is hardcoded**, and the app ships
  with an empty config; (2) a **new top-level route**, not a `/rollup` tab (the roll-up is
  sprint-scoped, this is not); (3) **cached + daily cron + manual Refresh**, not live-on-open;
  (4) full executive dashboard in v1, with the `gm-security-vulnerabilities-tracker` PDF as a
  **visual reference only**; (5) each scope universe is a **saved Jira filter id or raw JQL**;
  (6) **SLA breach is app-computed** from configurable days per (scope, priority) —
  `created + days < now` — *(this REVERSED an earlier same-day ratification that SLA would be a
  Jira filter; the computed model is authoritative)*; (7) **snapshot every cell daily**;
  (8) categories are ordered **Jira status lists**, and unmatched statuses fall back to a
  **configurable fallback category** (Engineering Team) — *(this REVERSED the earlier residual-row
  design; the residual row now renders only when no fallback is configured)*; (9) **five bands by
  default (P0–P4)** rather than a grouped `P2+`, "so charts and graphs are more intuitive";
  (10) **multi-report from day one** so "the same dashboard for Project = Honda" is configuration,
  not code. Explicitly NOT an AI task: priority→band and status→category are finite, auditable
  mappings — AI narrates these numbers, it never computes them. See
  context/features/gm-bug-report.md.
- **Sprint timeline + two-lens metrics (ratified 2026-07-24 with Naveen).** Two connected
  corrections, ratified via three decision prompts (see §12, §11, and
  context/features/sprint-phases-delivery-lens.md):
  (1) **A sprint ends at the release date, not dev end.** It runs **dev cycle
  (`developmentStart→developmentEnd`) → QA/UAT (`developmentEnd→releaseDate`) → released**; the app
  must never say "Sprint ended" at dev end — it says **"Dev cycle ended · QA/UAT"** until release.
  Same representation on the hero: the **phase bar is HYBRID** — delivery completion % drives the
  four dev phases during the dev cycle, then QA/UAT/Release light up **by date** (chosen over pure
  time-driven and minimal-relabel alternatives).
  (2) **Two lenses.** *Delivery health* (roadmap + tech debt, against the dev cycle) drives Sprint
  Health, Completion %, the At-Risk card and risk call-outs; *throughput/capacity* (all work) drives
  velocity and Issues-in-scope. Naveen's framing: support + internal bugs are **reactive** work that
  mostly surfaces after dev-end when QA starts, so they must NOT move the "is the committed sprint on
  track" signal — but **for velocity and per-member capacity everything counts** (bugs are real
  effort). So velocity **widened** to all work (it previously excluded support). At-risk is
  **delivery-scoped** (a blocked support bug is not a "sprint risk" — it keeps its matrix row).
  Follow-on calls: the **burndown / `SprintSnapshot` / trend stay all-work (throughput)** so the
  snapshot contract + history stay continuous (no schema change); the AI digest narrates the delivery
  lens. Metric *time math* is unchanged (delivery still measured against the dev cycle).
- **One-Click Sprint Start (ratified 2026-07-26 with Naveen, drafted from his org spreadsheet +
  a Jira screenshot).** Automates onboarding a scrum team's 4 Jira filters from a reusable admin
  catalog instead of hand-typed JQL every sprint. Seven ratified points, **two of which reversed
  the first draft plan** (flagged explicitly since they were caught by Naveen reviewing that draft,
  not decided up front):
  (1) a **manually admin-entered `JiraComponent`/`JiraSubComponent` catalog** — one at a time, no
  bulk import, no live Jira discovery — each sub-component claimed by at most one Team;
  (2) **per-track Jira Issue Type mapping is a global default, per-team overridable**, mirroring the
  existing `storyPointsFieldId`/`sprintFieldId` pattern: Roadmap=`Story`, Tech Debt=`Tech Story`,
  Internal Bug=`Bug` (team's own project), External Bug=fixed `ENG` project/`Tap Ticket` type;
  (3) **`Sprint.fixVersions`** is manually typed, no live Jira version lookup, and can span
  multiple versions (base + hotfix patches);
  (4) **REVERSED from the first draft:** the dashboard action never creates a Sprint — *"There is
  only one sprint for all, only admin creates the sprint, don't allow individual EM or lead create
  the sprint"* — so there is **no RBAC carve-out**, the action needs exactly the
  `TEAM_MANAGER_ROLES` gate manual filter creation already has;
  (5) re-running the action is safe — existing tracks are skipped, never duplicated;
  (6) with no `PLANNING`/`ACTIVE` sprint to select, the dialog just points at admin;
  (7) **REVERSED from the first draft:** External Bug scopes by the team's **parent Component name
  only**, not its fine-grained sub-components — *"ENG would be the project, DR_GM will be added as
  a component, subComponent can be missing"* — a `/bugs`-tab follow-up (calling out ENG issues
  with no sub-component tag) was flagged as a related but explicitly out-of-scope idea. See
  context/features/one-click-sprint-start.md.
  **Amended 2026-07-27 with Naveen, after his real Jira acceptance run:** two corrections to the
  generated JQL itself. First, the team's own tracks (Roadmap/Tech Debt/Internal Bug) scope
  sub-components via a **custom Jira field** (`"sub-component[dropdown]"`), not the standard
  `component` field the spec assumed — plus field naming (`type`/`fixversion`), clause order, and
  quoting all needed to match his instance's real JQL conventions (a literal is quoted only when it
  contains whitespace), with a trailing `ORDER BY issuetype ASC`. Second, point (7) above is
  **partially reversed again**: *"Even the external filter should use subcomponent in the filter
  creation"* — confirmed as an addition, not a replacement, so External Bug now ANDs **both** the
  parent-Component clause and the sub-component clause. See context/features/one-click-sprint-start.md
  (Status + As-built notes) for the exact JQL shapes.
- **Velocity / LeaderBoard (ratified 2026-07-26/27 with Naveen, drafted from a two-sentence
  handwritten spec via a clarifying-question pass).** A gamified team + developer story-point
  leaderboard. Nine ratified points: (1) "delivered" points reuse the **existing weighted
  stage-completion metric** (partial credit), not a binary Jira-status-Done cutoff; (2) work scope
  = **all work / throughput lens** (Roadmap + Tech Debt + Support + Internal Bugs), matching the
  existing Velocity card; (3) the team leaderboard's "points ÷ developers" divisor is a new
  **admin-entered `Team.developerCount`** field, not a dynamically-derived distinct-assignee count
  (stability over precision — a one-ticket helper from another team shouldn't inflate a team's
  apparent headcount); (4) **both** a sprint-scoped view (default active sprint) and an all-time
  cumulative view, for both boards; (5) the full org-wide board is gated to a **new, deliberately
  narrower `LEADERBOARD_ROLES = [EM, ED, VIEWER]`** — TPM is excluded even though it's grouped with
  ED everywhere else in `rbac.js`, and holding one of these roles on ANY team unlocks the ENTIRE
  org-wide board, not just the viewer's own teams; (6) LEAD/MEMBER instead get a personal,
  non-competitive "my stats" card (own points only, no rank, no comparison) on `/`, matched via
  `User.jiraAccountId === Issue.assigneeAccountId` — zero new roster/identity modeling needed;
  (7) a **bundled bugfix**: `syncTeamSprint` now rejects syncing an already-`CLOSED` sprint (409),
  closing a real gap that would otherwise let a re-sync silently overwrite the frozen historical
  data this feature depends on; (8) unassigned issues still count toward a team's total (consistent
  with existing Completion/Velocity cards) but are excluded from individual attribution; (9) **no
  backfill mechanism needed** — the key architectural discovery of this feature: since `Issue`/
  `IssueProgress` rows persist per closed sprint once decision 7 lands, ALL historical per-developer
  and per-team data (not just going-forward data) can be computed LIVE, on demand — a deliberate
  departure from the `SprintSnapshot` daily-cron precedent used by trend/burndown, made possible
  because "sprint on sprint" wants one number per completed sprint, not a within-sprint daily trend.
  Design pass used the `impeccable` skill's `bolder` playbook to add a podium treatment for rank 1,
  reusing only existing tone tokens and the house "sweep" motif — no new design primitives. See
  context/features/leaderboard.md.
- **Committed / Tech Debt / Unplanned work breakdown + per-sprint capacity (ratified 2026-07-28/29
  with Naveen, drafted from two handwritten "work division" notebook pages via several
  clarifying-question rounds).** Ten ratified points: (1) **three-way segmentation, badged as two
  types** — Committed = `FEATURE` only (non-negotiable, customer-committed); Tech Debt =
  `TECH_DEBT` (planned ahead of time, internally but not customer-committed) as its own visible
  segment; Unplanned Bugs = `SUPPORT` + `INTERNAL_BUG` merged into one segment; displayed as
  Committed standing alone vs. Tech Debt + Unplanned Bugs grouped, delivering "two types" at the
  headline level; (2) **display-only, additive** — zero change to Sprint Health, Completion %,
  At-Risk, or the existing delivery/throughput lens (§12); a before/after fixture diff proved every
  pre-existing `metrics.mjs` field byte-identical; (3) **capacity compares Committed only** — Tech
  Debt and Unplanned Bugs never get a configured target; (4) **screens** = `/`, `/rollup`,
  `/share/[token]`, Export — explicitly **NOT** `/leaderboard`, which stays a single all-work
  points ranking; (5) **capacity is per-team PER SPRINT**, a new `SprintCapacity` join model —
  deliberately not a static `Team` field like `developerCount`, since committed scope can shift
  release to release; (6) **one admin matrix screen** (sprint picker + one row per team, one
  batched save) plus a **"duplicate to another sprint"** action, explicitly requested so admins
  don't retype every release; (7) **admin-only RBAC**, matching Sprint config's existing
  global-admin-only gate — no carve-out, no new role group; (8) the roll-up's portfolio capacity
  total **sums whatever teams ARE configured**, with an "N of M teams configured" caveat, rather
  than hiding the comparison for partial configuration; (9) `team-summary-table.jsx` gets **one new
  column** (Committed/Capacity), not a full per-team three-way breakdown — the fuller split stays
  portfolio-level; (10) the duplicate action **confirms before overwriting** a target sprint that
  already has configured rows, but proceeds silently into an empty one. See
  context/features/committed-unplanned-work.md.
  **Amended 2026-07-29 with Naveen (presentation only — no ratified decision reversed):** the
  headline UI the ten points above were planned against (a **chip row** under Delivered/Planned) was
  **replaced the same day** by the full **delivery scoreboard** — seven further choices ratified
  before any code (full scoreboard footprint · ink surface · totals lead · one authored arrival ·
  Committed branded with the other two neutral · over-capacity flagged · hover reveals precision),
  plus **two variants** (`condensed` default on `/` and `/share/[token]`; `relaxed` default on
  `/rollup`, the only screen with a per-card Condensed/Relaxed toggle — deliberately NOT a revival of
  the app-wide density toggle retired 2026-07-25). Two new measured palette tokens were required
  (`--on-ink-cat-2` gold, `--on-ink-cat-3` rose) and `--on-ink-warn` was renamed
  `--on-ink-alert` red, because amber sat ΔE 6.4 from the new gold and would have read as a fourth
  category; **`.sp-stripe` hatching on Unplanned Bugs is load-bearing for CVD** (brand↔cat-3 is
  ΔE 4.8 worst-case under deuteranopia), not decoration. Decisions 1–10 above are unchanged; only
  the presentation is. See §11's dated note and the feature spec's "Second pass" Status section.
- **Enhancing the Bug Board — scope toggle, by-team grouping, per-developer drill (ratified
  2026-08-02 with Naveen, from his handwritten "Enhancing Bug Board" note).** Five ratified
  decisions: (1) the External/Internal/**All** scope toggle defaults to **All with External
  highlighted** (not External-only) and governs the WHOLE page; (2) the toggle is **instant
  client-side** — three scope views pre-rendered server-side, a `BugScopeProvider`/`BugScopeSlot`
  mounts the selected one, so the panels stay server components and there is no network round-trip;
  (3) a bug's team is its Jira **sub-component → `JiraSubComponent.teamId`, resolved at READ time**
  (a new `BugReportIssue.subComponent` raw-fact column; the first `BugReport`↔`Team` link, FK-less,
  per §9's amended rationale); (4) unmapped/untagged bugs go to an **"Unassigned" bucket** (never
  hidden — doubles as the missing-sub-component-tag hygiene signal, satisfying the parked ENG-tag
  idea); (5) the developer drill is an **inline issue list + a `key in (…)` Jira link**, grouping by
  `assigneeName` (the bug cache has no `assigneeAccountId`). **Amended during the real-Jira
  acceptance run:** field-id **discovery is ambiguous** on Tekion's instance (two "Sub-component"
  dropdown fields share the JQL clause `sub-component[dropdown]`; the real values live in
  `customfield_13108`), so an explicit **`JIRA_SUBCOMPONENT_FIELD_ID` env override** was added
  (decision 6's escape hatch), with name-discovery as the fallback. One additive migration, no new
  routes (**44 ƒ Dynamic unchanged**), no RBAC/admin change (reuses the existing catalog). See
  context/features/enhancing-bug-board.md.
- **Bug Board — sprint-ownership grouping / ours vs dependencies (ratified 2026-08-04 with Naveen,
  from his note "group things that start with GM-\* ... anything apart doesn't directly belong to us
  but are dependencies to address with the dependent teams").** Six ratified decisions: (1) the
  signal is the Jira **Sprint field**, matched against a per-report `BugReport.sprintOwnershipPattern`
  (e.g. `GM-*`); three buckets in fixed order **Ours** (matches) → **Dependencies** (a non-matching
  sprint) → **No sprint** (empty — its OWN bucket, not folded into Dependencies, so it doubles as a
  missing-sprint hygiene signal); (2) matcher semantics: `*` is a wildcard, a pattern with **no `*` is
  a prefix**, comma/newline-separated patterns are **OR'd**, case-insensitive; (3) surfaced as a
  dedicated drill **section + a top KPI card** (both scope-toggle-aware for free, living in the
  per-scope pre-rendered body subtree) **plus a PDF appendix**; (4) **read-time, config-driven** —
  a new raw-fact column `BugReportIssue.jiraSprintName` is the only thing the refresh adds; the
  classification is computed at read time so editing the pattern in `/admin` re-renders instantly with
  no Jira refresh (the sub-component / band / category / SLA precedent); the matrix stays
  `category × scope × band` (ownership is a separate grouping, not a matrix axis); (5) the Sprint
  field id resolves env `JIRA_SPRINT_FIELD_ID` → `/field` discovery → `customfield_10020`, and the
  `/field` metadata is fetched **once** and shared with sub-component discovery; (6) no new API route
  (the pattern rides the existing config-document Save) and no RBAC change. **Real-Jira acceptance:**
  the standard Sprint field resolved cleanly (no env override needed), a live refresh tagged 145/233
  bugs, and `GM-*` classified Ours 136 · Dependencies 9 (`AEP-*`/`AI-*`/`ZEB-*` sprints) · No sprint
  88 — with read-time reclassification proven across pattern changes without a refresh. One additive
  migration, **44 ƒ Dynamic unchanged** (no new routes). See context/features/bug-sprint-ownership.md.
- **Unplanned work bifurcation (External / Internal) + a chart view (ratified 2026-08-09 with
  Naveen).** The **External/Internal split** applies to **all four** scoreboard surfaces (`/`,
  `/rollup`, `/share/[token]`, export), not only the two Naveen named — consistency is near-free since
  they share one component. Held decisions from committed-unplanned-work.md carry over: display-only,
  additive to the §12 metric core (`external*`/`internal*` fields added beside `unplanned*`),
  `/leaderboard` untouched. **The chart went through two passes:** first a composition **donut**
  (initially chosen from the AskUserQuestion pass), which Naveen reviewed and rejected — *"the chart
  representation is not adding any value"* (a donut of the same four numbers the rail already shows
  adds nothing). Ratified replacement (second AskUserQuestion): a **per-team composition chart on
  `/rollup` only** (toggle `Condensed · Relaxed · By team`) showing which teams carry which kind of
  work — a dimension the portfolio totals can't show; the **board gets no chart**, just the
  bifurcation. Lesson recorded: a chart that only re-encodes numbers already on screen is not a
  value-add. The palette was **decided as design director** (Naveen delegated via `/impeccable`), not
  asked: a CIEDE2000 + Machado-2009-CVD sweep rejected purple (fails against Modern's blue) and
  settled on orchid `--on-ink-cat-4` `#d385b0` with the **solid = planned / hatch = reactive-bug**
  two-channel encoding. See context/features/unplanned-split-and-chart.md.

---

## Production Migration Plan — step 10 completion narrative (full text)

The verbatim step-10 line (cutover + every post-v1 feature's completion), moved out of the
Production Migration Plan.

10. Cutover, then post-v1 — promote web/ to repo root, delete the Vite app; then burndown/trend UI from snapshots, then Gemini (risk call-outs + narrative first). **[DONE 2026-07-18 (cutover half)]** — two-phase `git mv` on `feature/cutover`: the Vite app (src/, server.js, docs/, lockfiles, untracked .env/node_modules/dist) **retired into `legacy/` instead of deleted** (ratified with Naveen 2026-07-18; startable there under Node 20 — verified :3000/:3001 answer) with plaintext-token `.sessions/` deleted; then `web/*` promoted to root (101 renames, history follows via `git log --follow`). Node 22 bump landed with it (`.nvmrc`, `engines >=22.12`, `.yarnrc` shim deleted, fresh install under 22.22.2). Config/docs: root `.gitignore` = web's + re-added `.claude/*` rules, `turbopack.root` pin kept (dual lockfile with `legacy/yarn.lock`), package renames (`sprint-tracker` / `sprint-tracker-legacy`), CLAUDE.md/AGENTS.md/README.md rewritten for the single-app root, `.claude/skills` `web/`-path sweep (+ `verify-web` renamed `verify`, per Naveen), `legacy/**` added to ESLint ignores (the only config-behavior change). Zero app-code changes; no schema change, no migration. Verified at root under Node 22: lint clean; `prisma validate` + `migrate status` up to date; **DB/env-free build green, 27 ƒ Dynamic (same as step 8)**; dev-server smoke on :3002 — unauth 307, login 200, unknown share → generic page, cron bad-bearer 401, `health/db` ok against Neon, minted-admin dashboard SSR with full chrome. **Deployment re-pointing (build from repo root) is a deploy-time task.** See context/features/cutover.md. *Post-v1 clause:* **trend/burndown UI DONE 2026-07-19** — snapshot-fed `TrendPanel` on `/` + `/rollup` with the trailing-7-day projection, plus the §12 velocity swap (`snapshotVelocity` override w/ naive fallback; share/export untouched); no schema change/migration/deps/routes (see context/features/trend-burndown.md). **AI insights (risk call-outs + narrative) DONE 2026-07-20** — provider-agnostic AI platform (`src/lib/ai/`: neutral `generateJson` + Gemini/Anthropic fetch adapters, env-switched with loud-fail config and a dormant unconfigured state) behind the on-demand "AI Digest" dialog on `/` (`POST …/ai-digest` — **28 ƒ Dynamic**); no schema change, no migration, no new deps (see context/features/ai-insights.md). **Risk comments + roll-up all-risks dialog + roll-up AI Digest DONE 2026-07-21** — `IssueProgress.riskComment` (one additive migration — the first schema change since `add_user_isadmin`) lets a known/agreed risk be communicated to leadership as managed context; `/rollup`'s risk panel now surfaces every team's comments/blocked reasons plus a "View all risks" dialog listing every risky issue across teams; the roll-up hero gained an AI Digest button (`POST /api/rollup/ai-digest` — **29 ƒ Dynamic**) generating a portfolio digest that compares teams and narrates commented risks as known/agreed (see context/features/risk-comments-rollup-digest.md). **Bug report dashboards DONE 2026-07-21** — the config-driven bug matrix + executive dashboard at `/bugs` (+ `/bugs/[slug]`): 7 new models + one migration (the largest schema change since `init`), 4 new API routes + 2 pages (**29 → 35 ƒ Dynamic**), and the **first non-sprint-scoped read path in the app**. Everything about a report is admin config — scope universes (saved filter id or JQL), category→status mapping with a fallback category, SLA days per (scope, priority), and P0–P4 bands — so a second dashboard (Honda) is configuration, not code; classification is read-time so config edits apply with no Jira refresh (see context/features/gm-bug-report.md). **Sprint timeline (dev → QA/UAT → release) + two-lens metrics DONE 2026-07-24** (implemented on the `feature/modern-theme` branch) — a sprint now ends at its release date, not dev end: phase-aware days-remaining pill (`"Dev cycle ended · QA/UAT · Nd to release"`), window-spelling eyebrows (`formatSprintWindow`), and a **hybrid** hero phase bar (completion drives the dev phases, then QA/UAT/Release light up by date); metrics split into a **delivery lens** (roadmap + tech debt, dev cycle → Sprint Health / Completion / At-Risk / risk call-outs) and a **throughput lens** (all work → velocity, now incl. support + bugs, + Issues-in-scope). Burndown/`SprintSnapshot`/trend deliberately stay all-work; **no schema/migration/route/dependency change**, 35 ƒ Dynamic unchanged (see context/features/sprint-phases-delivery-lens.md). **Hero timeline UI + live release countdown DONE 2026-07-25** (same branch, presentation only) — the flat days-remaining pill became a live animated **release countdown** (progress ring + ticking `d·h·m·s` clock, `ui/release-countdown.jsx`) repositioned to the hero top-right; the hero phase bar became a **sprint timeline** with two macro-cycle status chips (`✓ Dev cycle · Completed` → `● QA / UAT · In progress`) over partial-fill animated phase bars; and the **Relaxed/Dense view toggle was retired** (density fixed at "dense"). New `--on-ink-success` token + `sweep`/`blink` keyframes; no schema/migration/route/dependency change (see context/features/modern-theme.md). **One-Click Sprint Start DONE 2026-07-26** — a config-driven answer to hand-typed onboarding: an admin-maintained `JiraComponent`/`JiraSubComponent` catalog (a Jira project's Component field value → many literal Sub-components, each claimed by at most one Team, entered one at a time — no bulk import, no live Jira lookup) plus per-team Jira Issue Type overrides and `Sprint.fixVersions`; a new dashboard "Sprint Start" action (`TEAM_MANAGER_ROLES` — same gate as manual filter creation, no RBAC change) generates a team's missing Roadmap/Tech Debt/Internal Bug/External Bug filters against an **existing** Sprint (never creates one — Sprint stays admin-only), skipping tracks that already exist; External Bug scopes by the parent Component name only, not the team's sub-components (2 new models + 5 new Team/Sprint fields, one migration, 6 new routes — **35 → 41 ƒ Dynamic**; see context/features/one-click-sprint-start.md). **[Corrected 2026-07-27]** Naveen's real Jira acceptance run caught the generated JQL was wrong (custom `"sub-component[dropdown]"` field, not standard `component`; field naming/order/quoting/a trailing `ORDER BY` all needed to match his instance) — fixed same day, plus an amendment ANDing the sub-component clause into External Bug too (was parent-Component-only); no schema/route change, 41 ƒ Dynamic unchanged (see context/features/one-click-sprint-start.md As-built notes). **Velocity / LeaderBoard DONE 2026-07-27** — a gamified team + developer story-point leaderboard at `/leaderboard`: teams ranked by `completedPoints ÷ Team.developerCount` (a new admin-entered field) and developers ranked org-wide by points delivered, both sprint-scoped and all-time. One additive schema field (`Team.developerCount`, one migration — **41 → 42 ƒ Dynamic**), a bundled bugfix gating manual sync away from `CLOSED` sprints, and — the key simplification — **no new snapshot table**, since historical data is computed live off the already-persisted `Issue`/`IssueProgress` rows now that the sync-gate fix keeps them frozen. Gated to a new, deliberately narrower `LEADERBOARD_ROLES` (excludes TPM); LEAD/MEMBER get a personal "my stats" card on `/` instead. See context/features/leaderboard.md. **Committed / Tech Debt / Unplanned work breakdown + per-sprint capacity DONE 2026-07-29** — a three-way story-point composition breakdown (Committed = `FEATURE` only, Tech Debt = `TECH_DEBT`, Unplanned Bugs = `SUPPORT`+`INTERNAL_BUG`, badged as "two types") shown next to every total-points figure on `/`, `/rollup`, `/share/[token]`, and Export — purely additive, zero change to Sprint Health/Completion/At-Risk/the delivery-throughput lens; a new per-team-per-sprint `SprintCapacity` model (one migration — **44 ƒ Dynamic (42 → 44)**, the 2 new capacity routes) backs a Committed-points-only admin target, edited via a new admin matrix screen (sprint picker + one row per team, plus a "duplicate to another sprint" action), admin-only, no RBAC change. `/leaderboard` deliberately untouched. **Redesigned the same day (2026-07-29, presentation only)** — the chip row was replaced by the full **delivery scoreboard**: an ink-surface card whose composition rail encodes share-of-scope as segment width and delivered as solid fill, in `condensed` (default on `/` and `/share/[token]`, 148px down from 428px) and `relaxed` (default on `/rollup`, the only screen with a per-card Condensed/Relaxed toggle) variants; two new measured palette tokens (`--on-ink-cat-2` gold, `--on-ink-cat-3` rose), `--on-ink-warn` renamed `--on-ink-alert` red, CVD-load-bearing `.sp-stripe` hatching retained, and a real `useCountTransition` `getSnapshot`-caching bug fix that also fixed both leaderboards and `MyStatsCard`; **44 ƒ Dynamic unchanged**, no schema/migration/route/dependency change. See context/features/committed-unplanned-work.md. **Enhancing the Bug Board DONE 2026-08-02** — three additions to `/bugs`: an External/Internal/All scope toggle driving the whole page (External highlighted; instant client-side over three server-pre-rendered subtrees), a "Bugs by scrum team" section joining each bug's Jira sub-component to the `JiraSubComponent → Team` catalog **at read time** (the first `BugReport`↔`Team` link, FK-less), and a per-team → per-developer → inline-issue drill with an "Unassigned/Untagged" bucket. One additive migration (`BugReportIssue.subComponent`), **44 ƒ Dynamic unchanged** (no new routes), no RBAC change; a `JIRA_SUBCOMPONENT_FIELD_ID` env override resolves which of an instance's several "Sub-component" fields to read. Verified live against the real `gm` report (155/233 bugs mapped into 6 real teams). See context/features/enhancing-bug-board.md. This **satisfies the parked "call out ENG issues with no sub-component tag" idea** (the Unassigned bucket). **`/bugs` PDF export DONE 2026-08-02** — a downloadable landscape executive PDF (brief + risk-ordered team appendix + optional oldest-open appendix) of the current scope view, html2canvas-pro + jsPDF (existing deps) with clickable Jira-link annotations; no schema/route change, 44 ƒ Dynamic unchanged (see context/features/bug-report-pdf-export.md). **Bug Board sprint-ownership grouping DONE 2026-08-04** — within the active scope, bugs are called out as **ours** (Jira sprint matches a per-report `sprintOwnershipPattern` like `GM-*`) vs **dependencies** (another team's sprint) vs **no sprint**, via a read-time match against a new raw-fact column `BugReportIssue.jiraSprintName`: a drill section + a KPI card + a PDF appendix, all config-driven and scope-toggle-aware. One additive migration (`jiraSprintName` + `sprintOwnershipPattern`), **44 ƒ Dynamic unchanged** (no new routes), no RBAC change; verified live on `gm` (Ours 136 · Dependencies 9 · No sprint 88; read-time reclassification proven) (see context/features/bug-sprint-ownership.md). **Unplanned work bifurcation + per-team chart DONE 2026-08-09** — the delivery scoreboard's **Unplanned Bugs** segment splits into **External** (`SUPPORT`) + **Internal** (`INTERNAL_BUG`) across `/`, `/rollup`, `/share/[token]` and the PDF/PNG export, and `/rollup` gains a **"By team" chart** (toggle `Condensed·Relaxed·By team`, `rollup-composition-chart.jsx`): one horizontal stacked bar per team by committed/tech-debt/bug load, sorted heaviest-first — a lens the portfolio totals can't show. (A composition **donut** shipped first and was dropped on Naveen's review — "not adding any value"; it only re-drew the rail's composition. The board has no chart, just the bifurcation.) Additive + presentation only: `metrics.mjs` gains `external*`/`internal*` beside the untouched `unplanned*` (before/after fixture diff clean; `external + internal == unplanned`), a validated categorical token `--on-ink-cat-4` orchid `#d385b0` carries Internal (**solid = planned, hatch = reactive bug**; purple rejected — fails CVD vs Modern's blue), hand-rolled inline-SVG bars (no dep). No schema/route/dependency change — **45 ƒ Dynamic unchanged** (44 + office-deployment `/p/health`); verified by fixtures, cold DB/env-free build, and a headless-Chrome screenshot round on the live PCX/GM ACTIVE sprint (all 4 work types). See context/features/unplanned-split-and-chart.md. **Sync stages from Jira (per track) DONE 2026-08-10** — a per-track **"Sync stages" button** in the delivery-matrix header (one per Roadmap/Tech Debt/External Bug/Internal Bug track): it pulls the latest Jira status for that filter and re-derives every one of its issues' stage checklists from it via `StatusStageMapping`, **overwriting** existing rows behind a confirm that names how many carry manual edits — the user-triggered, per-track **overwrite** variant of the create-only sync's deferred "re-seed forward" (sync-hybrid-seeding.md decision 5). Non-destructive on unmapped statuses (counted, never wiped), preserves blocked/risk fields, honors the owning workflow, and resets `updatedById` to null so re-runs are idempotent. New pure `resolveStageResync` (`seeding.mjs`) + `syncFilterStagesFromJira` (`engine.js`, reuses `refreshFilterCache`/`buildSeededStages`/`owningWorkflowType`) + `POST .../filters/[filterId]/sync-stages` (writer roles) — **45 → 46 ƒ Dynamic**; `dashboard-data.js` exposes `manuallyEdited`; matrix button + confirm `<Dialog>` in `planner-panel.jsx`/`dashboard.jsx`. No schema/migration/dependency change (9 migrations). Verified: lint; cold DB/env-free build (46 ƒ Dynamic); 5/5 `resolveStageResync` fixtures; 4/4 guard smoke (401/403/404/409) with minted iron-session cookies against Neon. Live Jira happy-path is Naveen's browser acceptance. See context/features/sync-stages-from-jira.md. Remaining post-v1 ideas: export-embedded narrative, AI Q&A over sprint data, stage suggestions, a share link for `/bugs`, and leaderboard rank-delta ("moved since last sprint") arrows.
