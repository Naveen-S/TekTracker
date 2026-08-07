# Bug Report PDF export — with clickable Jira links

## Overview

Add an **"Export PDF"** action to the `/bugs` dashboard that downloads a paginated A4 PDF of the bug
report, **where every Jira reference is a clickable link** — issue keys open the issue
(`browse/KEY`), matrix count cells open that exact JQL search, and the by-team drill's keys open
their issues. Requested by Naveen 2026-08-02. Ports the sprint board's `ExportDialog`
(share-view-export.md) idiom to `/bugs`, with one addition it lacks: **clickable link annotations**.

This was parked as out-of-scope in gm-bug-report.md ("PDF/PNG export and share tokens for `/bugs`")
and in enhancing-bug-board.md; now built. Touches project-overview §5, §11.

> **The one hard part: clickable links over a rasterized PDF.** The existing export captures the
> DOM to a PNG via `html2canvas-pro` and drops it into jsPDF (`addImage`) — the result is a picture,
> so its text is not clickable. To make links work, we render offscreen A4 pages containing **real
> `<a href>` elements**, rasterize each page as today, **and then overlay transparent
> `pdf.link(x, y, w, h, { url })` annotations** at each anchor's position (px → mm scaled from its
> `getBoundingClientRect` relative to the page). jsPDF link annotations sit above the image and are
> natively clickable in any PDF reader. No new dependency — jsPDF already ships this API.

## Status

**Done 2026-08-04** (uncommitted, on `feature/enhancing-bug-board`). Reuses the existing
`html2canvas-pro` + `jspdf` deps (dynamic-imported) — **no new dependency**.

Shipped as a **landscape executive report** — reworked 2026-08-04 from the first portrait cut (see
the As-built "Landscape executive rework" note; the portrait-era notes below are earlier iterations
kept for history). `src/components/bugs/bug-export-dialog.jsx` renders fixed **landscape** A4 sheets:
a `BugExecutiveSummary` brief, a **risk-ordered** `BugTeamAppendix` (height-budgeted pagination via
the new pure `src/lib/bug-report/pdf-layout.mjs` — `sortTeamsByRisk`/`paginateTeamAppendix`/`chunkRows`
with fixed row heights that pack multiple small teams per sheet and split large teams with repeated
team/developer headers), and an **optional** `BugOldestAppendix` (a `Checkbox` + limit `Select` in the
dialog). Every sheet is `html2canvas-pro`-rasterized → jsPDF `addImage` → transparent `pdf.link()`
annotations over each real `<a href>`, so issue keys, matrix cells (incl. breached subsets and
combined-scope), and team/developer rows are all clickable. PDF metadata is set via
`pdf.setProperties`. `BugExport` reads the active scope from `BugScopeProvider`; `useBugScope` is
exported from `bug-scope-view.jsx`; `ownerName` is threaded from `bugs-page.jsx`.

**Verified (finish gate 2026-08-04):** `yarn lint` clean; `prisma validate` + `migrate status` up to
date (8 migrations); **cold `rm -rf .next` DB/env-free build green — 44 ƒ Dynamic unchanged**;
jspdf/html2canvas dynamic-imported (absent from the `/bugs` chunk); runtime smoke — `health/db` ok,
authed `/bugs/gm` 200 with the Export button + by-team section, **0 errors**. Earlier (portrait
iteration) a real headless-Chrome PDF confirmed the `/URI` link annotations are embedded + clickable
(334 anchors, `/browse/` + `issues/?jql=`); the landscape rework preserves that link mechanism.

⚠️ **Pending:** commit; Naveen opening a generated PDF in a real reader and clicking through.

## As-built notes (vs. the plan)

- **The JPEG page-image decision was superseded after the 2026-08-04 pixelation review.** The first
  PNG experiment produced a **175 MB** PDF, so the interim export used scale-2 JPEG. The current
  implementation uses compressed, lossless **scale-3 PNG** pages instead: jsPDF's document
  compression plus `SLOW` PNG image compression keeps the 24-page GM report near **8.8 MB** while
  raising embedded page resolution from 192 to **288 PPI** and removing JPEG ringing. Link
  annotations remain vector overlays and are unaffected by the image format.
- **The clickable-link overlay works exactly as designed** (`pdf.link(x, y, w, h, { url })` in mm,
  y top-down, called per page right after `addImage`), verified against a real downloaded PDF's
  `/URI` entries — not just asserted from the API.
- **`useBugScope` had to be exported** from `bug-scope-view.jsx` (it was a private hook) so the
  export button can read the active scope.
- **The toast lives on the persistent button, not the dialog** — the "PDF exported" toast fires
  after the dialog closes, so `BugExport` owns `useToast`/`<Toast>` and passes `showToast` down
  (the sprint `ExportDialog` receives `showToast` as a prop the same way).

### Refinements after Naveen's first review (2026-08-02, verified in a real PDF)
- **Margins + section rhythm** — page padding `p-8` → `px-11 py-10`, section labels `mt-6`, KPI/matrix
  `mt-4`, so the summary sheet breathes.
- **Team + developer rows are now clickable to a Jira filter** (`key in (…)` over that team's or
  developer's bugs), on top of the already-clickable issue keys — the by-team "table items" are all
  clickable now (verified: matrix-cell JQL links 41 → 182 with the +141 team/dev filter links).
- **Each scrum team starts on a NEW sheet** — pagination is per-team (a large team continues onto
  extra pages, but the next team always begins fresh). GM went 10 → 20 pages.
- **The trend chart fills the remaining space on sheet 1** — a static print `PrintTrend` (open vs.
  past-SLA lines over time, reusing `smoothLinePath`/`smoothAreaPath`; the `< 2 captures` "accrues
  daily" state kept). Verified against the real `gm` report (open 232 / past SLA 106, Jul 21 → Aug 3).

### Leadership-polish pass (2026-08-03, after Naveen reviewed a real export)
- **Every sheet is now a true A4 page** (`h-[1123px]`, `flex flex-col`, `overflow-hidden`) with the
  **footer pinned to the bottom** (`mt-auto` on `PrintFooter`; the print pages are `flex-1 flex-col`).
  Before, content sat top-heavy and the footer floated mid-page over a big empty bottom — it read as
  unfinished. Now each page fills the sheet like a document.
- **The duplicate "Total" column is gone for single-scope exports.** In an External- or Internal-only
  PDF the per-scope Total *is* the grand total, so the extra "Total" column was a confusing duplicate
  (`74 (31)` twice). `showGrandTotal = matrix.scopes.length > 1` drops it; the All export keeps both.
- **More generous, symmetric margins** (`px-13 py-12` ≈ 14mm) and a taller trend chart (`TREND_H`
  190 → 250) so sheet 1 reads as a finished summary.
- **Known headless-only caveat:** an html2canvas font-metric quirk collapses inter-word spaces when
  captured in *headless* Chrome; Naveen's real-browser exports render spaces correctly (confirmed
  against his `…_1353.pdf`). Not a code defect — do not "fix" it by touching text.

### Landscape executive rework (2026-08-04) — the current implementation
The portrait notes above are the first iteration; the export was then rebuilt as a **landscape
executive report** and that is what ships.
- **Landscape A4** (`297×210mm`; `A4_WIDTH_PX = 1123`, `A4_HEIGHT_PX = 794`, `jsPDF({ orientation:
  "landscape" })`) with fixed per-sheet capture (`html2canvas` `width`/`height`/`windowWidth`/
  `windowHeight` pinned), so pages are exact and the footer sits where intended.
- **Three sheet types:** `BugExecutiveSummary` (brief), `BugTeamAppendix` (risk-ordered teams), and
  an **optional** `BugOldestAppendix` gated by a dialog `Checkbox` with a 20/40/60 `Select` limit.
- **`pdf-layout.mjs` replaced the naive row-count pagination** with **height budgeting** — fixed
  visual-row heights (`TEAM_SECTION_HEIGHT`/`DEVELOPER_ROW_HEIGHT`/`ISSUE_ROW_HEIGHT`) packed into a
  `TEAM_PAGE_BODY_HEIGHT` budget: **multiple small teams share a sheet**, a large team **splits with
  repeated team + developer headers** (a developer's issues never orphan). This **supersedes the
  earlier "each team starts on a new sheet"** rule — the packer is denser and split-safe.
- **`sortTeamsByRisk`** orders teams (then developers) by breach count → breach rate → open count, so
  the worst exposure leads the appendix.
- **New clickable targets:** matrix **breached-subset** cells (`cellBreachedJql`) and a
  **combined-scope** cell link (OR of per-scope JQL) in the All view, plus PDF document metadata
  (`pdf.setProperties`). The `pdf.link()` px→mm overlay is unchanged in principle.
- **Two new shared UI atoms** the dialog leans on: `ui/checkbox.jsx` and the existing `ui/select.jsx`.
- This rework was done in a **parallel session**, not this one; the finish-gate verification above
  was run against it as-found (lint + cold build + runtime smoke all green).

### Executive-report redesign (2026-08-03, after review of the 14:24 export)

- **Landscape A4 throughout** (`1123×794px`, 297×210mm) so the category matrix, long Jira
  summaries, priority, and SLA columns have enough horizontal room. The dialog preview scales the
  same fixed sheet across mobile and desktop breakpoints; the captured offscreen sheet remains at
  full resolution.
- **Leadership-first information architecture.** Sheet 1 is now an executive brief with report
  owner, data freshness, generated timestamp, an `Internal` classification, five headline KPIs,
  seven-day movement, SLA exposure, top-three breach concentration, ownership coverage, a trend,
  a compact category/scope matrix, and the five highest-risk teams.
- **Derived metrics use existing report facts only:** breach rate, open and breached movement
  against the capture nearest seven days ago, top-three team concentration, team breach rate, and
  unassigned/untagged exposure. No new persistence or API exists for the export.
- **Risk order supersedes volume order in the PDF.** Teams and developers sort by breached count,
  then breach rate, then open count. The live dashboard keeps its existing order.
- **Height-budgeted pagination replaces fixed row slices.** `pdf-layout.mjs` budgets team section,
  developer, and fixed-height two-line issue rows independently. A continuation repeats its team
  and developer context; a developer heading can never be orphaned at a page bottom. Small teams
  share a sheet when they fit, removing the old mostly-empty pages.
- **Long summaries wrap to two lines** in team and oldest-open appendices. Keys are fixed-width and
  non-wrapping, so hyphenated Jira keys no longer break across lines.
- **Jira status is visible on every team-detail issue row** beside the two-line summary, priority,
  and SLA result. It uses a neutral text badge so workflow state remains readable without relying
  on color semantics or crowding the leadership appendix.
- **The category/scope matrix distinguishes SLA exposure explicitly:** every parenthetical breach
  count is rendered in high-contrast red with an `(n) past SLA` legend. Taller matrix rows and a
  larger panel preserve scanability instead of compressing the additional emphasis.
- **The category/scope matrix now owns the full summary width.** Its type, row height, category
  gutter, and open-to-breach spacing are larger. The former adjacent top-team table was redundant:
  the executive readout still names the highest-risk team and the appendix retains the complete
  breach-ranked team detail.
- **Oldest-open is optional and off by default.** The export dialog offers an explicit checkbox and
  a 20/40/60 row limit. Leadership exports therefore omit the operational list unless the author
  asks for it.
- **All existing Jira drill-through remains:** matrix open/breach values, team names, developer
  names, and issue keys carry PDF link annotations. The landscape annotation conversion uses
  independent x/y scales and clips rectangles to the page bounds.
- **Filename and PDF metadata now identify the artifact as an executive report:**
  `<slug>_Executive_Bug_Report_<scope>_<timestamp>.pdf`, with title, subject, author, creator,
  classification, and keywords populated.

### Print-fidelity pass (2026-08-04, after pixelation review)

- **The report now uses the PCX newsletter's Inter treatment.** Static 400/500/600/700/800/900
  weights avoid synthesized bold faces and canvas' variable-font weight flattening; JetBrains Mono
  remains reserved for Jira keys. The visual system follows the supplied H1 newsletter reference:
  navy `#0f172a` headlines, slate body text, pale blue-gray surfaces, a blue → purple → magenta
  header accent, cyan trend data, and orange/green supporting signals. SLA breaches remain the sole
  high-priority red signal (`#e11d48`).
- **Header line boxes are capture-safe.** The eyebrow, classification pill, report title, and
  subtitle use explicit line heights plus vertical inset; the header itself has enough reserved
  height to keep Inter's ascenders and descenders clear of both `overflow` clipping and the accent
  rule. A 300-DPI crop of the regenerated PDF confirms the uppercase label and title render intact.
- **Trend dates and legend have separate reserved space.** Extra SVG bottom padding keeps the start
  and end dates fully inside the chart viewport, while a fixed-height legend row replaces the old
  negative margin that could mask the date labels. The regenerated 300-DPI chart crop shows both
  dates and both legend labels intact.
- **Lossless 288-PPI capture replaces the 192-PPI JPEG pipeline.** Each fixed 1123×794 sheet is
  captured at scale 3 (3369×2382), encoded to PNG bytes via `canvas.toBlob`, and added to a
  compressed jsPDF with `SLOW` image compression. This removes JPEG block/ringing artifacts from
  type, chart lines, borders, and status pills without making the report impractical to share.
- **Verified against the real 24-page GM export:** `pdfimages` reports 3369×2382 lossless page images
  at 288×288 PPI; 300-DPI crops of the executive matrix and appendix table show crisp glyph edges,
  rules, and red SLA values; the complete 24-page contact sheet has no clipping or overlap.

## Decisions

All ratified with Naveen 2026-08-02 via the plan-approval round:

1. **Downloadable PDF**, an "Export PDF" button on `/bugs` (like the sprint board's Export) — not a
   shareable SharedView link (that stays parked).
2. **All links clickable**: issue keys → `browse/KEY`; matrix count cells → the cell JQL search;
   the breach list + by-team drill keys → their issues; reference chips → their scope JQL.
3. **The PDF captures the current scope toggle selection** (All / External / Internal) — the client
   Export button reads the active scope and exports that view's data.
4. **PROPOSED — re-authored print pages, not reused live components.** Follows the sprint
   `ExportDialog` precedent: static, light-mode, fixed-hex print pages (the live panels are
   dark-hero / interactive / theme-tokened and unsuitable for capture). *Alternative:* capture the
   live DOM — rejected (the by-team accordion is collapsed, the hero is ink, tokens theme-flip).
5. **PROPOSED — content**: (1) Summary page — header (report, scope, generated date) + KPI boxes +
   the category × scope × band matrix (clickable cells); (2) By-team pages — each team's
   open/breached, its developers, and each developer's issues as rows with clickable keys
   (expanded/flat, paginated); (3) Oldest-open + SLA-breach list with clickable keys. Charts
   (priority/category/aging bars) included as a visual page if they rasterize cleanly; they carry no
   links. *Alternative:* matrix-only — rejected, the by-team clickable keys are the point.
6. **PROPOSED — pagination so each offscreen page fits one A4 page** (≤ ~1123px at 794px width, the
   sprint export's 15-rows-per-page precedent), so `addImage` never overflows 297mm and link
   coordinates stay within their page.

## Requirements

### Scope
**(a) Clickable-link PDF helper** — `src/lib/bug-report/pdf-links.mjs` (or inline in the dialog):
`overlayLinks(pdf, pageEl, pageIndexToMm)` — for each `pageEl.querySelectorAll("a[href]")`, compute
`(rect - pageRect)` in px, scale by `210/794` mm/px, and `pdf.link(xMm, yMm, wMm, hMm, { url })`.
Pure-ish (takes a jsPDF instance + a DOM element); no React.

**(b) Export dialog** — `src/components/bugs/bug-export-dialog.jsx` (client): offscreen A4 print
pages (`fixed top-0 -left-500`, 794px, light) + a preview, capture each with `html2canvas-pro`
(`scale: 3`, lossless PNG, `onclone: fonts.ready`), `addImage` per page, then `overlayLinks` per page,
`pdf.save`.
Filename `${slug}_Bug_Report_${scope}_${YYYY-MM-DD_HHMM}.pdf`. Errors via `DialogError`.

**(c) Print page components** (in the dialog file, the sprint `SummaryPage`/`IssuesPage` precedent):
`BugSummaryPrint` (KPIs + matrix w/ `<a>` cells), `BugTeamPrint` (team → dev → issue rows w/ `<a>`
keys, paginated), `BugListPrint` (oldest/breach w/ `<a>` keys). Fixed print hex, light surfaces.

**(d) Data** — the dialog receives the active scope view's already-computed data
(`matrix`, `byTeam`, `breached`, `issues`, `report`, `jiraBaseUrl`, `cellJql`) as props from the
page. **`getBugReportData` already returns per-view everything needed** — no data-layer change;
`cellJql`/`cellBreachedJql` closures compose the clickable cell URLs (same as on-screen).

**(e) Wiring** — an "Export PDF" button in the `/bugs` hero actions (`bugs-actions.jsx` or a sibling
client leaf), enabled when `configured && issues.length > 0`. The button lives inside the
`BugScopeProvider` so it can read the active scope and export that view.

### Mechanism / gotchas
- **jsPDF `pdf.link(x, y, w, h, { url })`** places a clickable rect in **mm** from the page's
  top-left; the captured image also fills 210mm width, so `mm = px * 210/794`. Verify the y-origin
  (jsPDF link y is top-down, same as addImage).
- **One offscreen page element per A4 page.** Paginate content so no page exceeds ~1123px tall
  (297mm), or `addImage`'s scaled height overflows and links on the overflowed region land on the
  wrong page.
- **`html2canvas-pro`, not stock** — the app theme is oklch/`color-mix` (share-view-export decision
  8). Print pages use fixed hex, but the capture lib must still be the pro fork.
- **Static, light-mode print pages** — never capture the ink hero or the interactive accordion.
- **Scope is the CLIENT toggle** — the export button reads it from `BugScopeProvider` context, so
  the PDF matches the screen. `cellJql` for a single-scope view still resolves the full universe.
- **No new dependency, no schema/route change.** `44 ƒ Dynamic` unchanged.
- **Read the installed jsPDF docs** for the `link()` signature (jspdf@2.5.2 — confirm the options
  shape `{ url }` vs `{ pageNumber }`).

### Acceptance criteria
- `yarn lint` green; **cold DB/env-free build green, 44 ƒ Dynamic unchanged**; jspdf/html2canvas-pro
  confirmed still dynamic-imported (absent from the initial `/bugs` chunk).
- **A generated PDF opened in a reader has working links**: clicking an issue key opens
  `…/browse/KEY`; clicking a matrix cell opens `…/issues/?jql=…`; verified by extracting the PDF's
  `/Annots` (or `pdftotext -layout` + a link dump) and asserting the URLs match the on-screen hrefs.
- Live: Export from `/bugs/gm` in each scope (All/External/Internal) produces a PDF whose header
  says the right scope and whose matrix/team/list numbers match the screen.
- Headless-Chrome visual check of the offscreen print pages at 794px (the sprint-export precedent).

### Out of scope
- **PNG export** — the sprint board has it; add later if wanted (the same capture, merged canvas).
- **Shareable read-only `/bugs` link (SharedView token)** — still parked (decision 1).
- **Export of `/rollup` or the sprint board changes** — untouched.
- **Charts as clickable** — charts are visual only; no links.

## Doc-sync (§17 — same change)
- **§5** — extend the bug-report row: "+ PDF export with clickable Jira links".
- **§11** — a note on the `/bugs` Export PDF action.
- **gm-bug-report.md / enhancing-bug-board.md** — flip the parked "PDF export" out-of-scope line to
  a pointer here.
- **current-feature.md** — Status + History per finish-feature.
- **Don't over-claim** — the clickable-link assertion must be verified against a real generated PDF's
  annotations, not just "the `<a>` tags render".

## References
- @context/features/share-view-export.md — the `ExportDialog` capture pipeline being ported.
- `src/components/dashboard/export-dialog.jsx` — offscreen A4 pages + html2canvas-pro + jsPDF.
- `src/lib/bug-report-data.js` (per-view data + `cellJql`), `src/components/bugs/bugs-page.jsx`
  (the scope views), `src/components/bugs/bug-scope-view.jsx` (the active-scope context),
  `src/components/bugs/bug-matrix.jsx` / `bug-team-section.jsx` / `bug-lists.jsx` (the on-screen
  link shapes to mirror in print).
- jsPDF `link()` annotation API (installed `jspdf@2.5.2`).
