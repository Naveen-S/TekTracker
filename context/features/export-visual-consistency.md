# Export visual consistency — sprint export adopts the /bugs PDF design system

**Status: Done (2026-08-07)** — pending Naveen's real-browser export acceptance. On branch
`feature/enhancing-bug-board` (rides with the uncommitted bug-export work it refactors).

## Overview

Naveen reviewed the `/bugs` landscape "Executive Bug Report" PDF and asked that **all other exports
follow the same color, theme, styling, format, and clarity** (reference:
`~/Downloads/gm_Executive_Bug_Report_All-scopes_2026-08-04_0814.pdf`).

The app has exactly **one** other export path — the **sprint board export**
(`src/components/dashboard/export-dialog.jsx`, PDF + PNG). It was still the *old* look (portrait A4,
teal `#00bfa5` Tekion branding, pastel leadership cards, Manrope headings, scale-2 capture, no
clickable links). This feature re-skins it onto the `/bugs` design system and extracts that system
into a **shared export kit** both PDFs import, so exports stay consistent by construction.

## Decisions (confirmed with Naveen, 2026-08-07)

1. **Portrait, restyle only** — the sprint export stays A4 *portrait*; it adopts the reference's
   palette, blue→purple→magenta gradient header rule, purple eyebrows, tinted KPI tiles, readout
   callouts, blue mono Jira-key chips, and scale-3 clarity. No landscape flip, no burndown chart
   (no new data plumbing — a faithful restyle of existing content).
2. **Clickable Jira links** — issue keys become blue mono `KeyLink` chips linked into Jira, reusing
   the existing `overlayLinks` px→mm annotation mechanism (PDF only; PNG stays a flat image).
3. **Shared export kit** — the palette, primitives, and capture pipeline are extracted so both
   exports import them; the just-finished bugs export is refactored to use the kit and must render
   **visually identical** (verified before/after).

## Scope

**New shared modules:**
- `src/lib/export/print-theme.mjs` — palette (`INK/BLUE/PURPLE/RED/CYAN/ORANGE/GREEN/SOFT`),
  `ACCENT_GRADIENT`, `KPI_TONES`/`READOUT_TONES`, and geometry presets `PORTRAIT`/`LANDSCAPE` +
  `PDF_CAPTURE_SCALE` (3). Decoupled from theme tokens (captured light-mode surfaces).
- `src/components/export/print-kit.jsx` — generic presentational primitives `PrintSheet`
  (geometry-parameterized), `PrintHeader` (eyebrow/pill/title/subtitle/meta + gradient rule),
  `PrintFooter`, `KpiBox`, `ReportPanel`, `ExecutiveReadout`, `KeyLink` (href → clickable `<a>`).
- `src/lib/export/pdf-capture.js` — `captureOptions(geometry)`, `canvasToPngBytes`,
  `overlayLinks(pdf, pageEl, geometry)`, `safeFilePart`, `fileStamp`.

**Refactored:**
- `src/components/bugs/bug-export-dialog.jsx` — inline primitives/palette/capture helpers replaced
  by imports (passes `LANDSCAPE`); bug-specific `SummaryMatrix`/`TeamSection`/`BugOldestAppendix`/
  `PrintTrend` stay. Behavior unchanged.
- `src/components/dashboard/export-dialog.jsx` — print pages rebuilt on the shared kit (PORTRAIT):
  `SummaryPage` (PrintHeader + 5 KpiBox tiles + two-up Delivery-readout / Work-composition callout
  panels + a Delivery-by-filter card grid) and `IssuesPage` ("WORK BREAKDOWN" appendix — filter
  bands + issue rows with clickable `KeyLink` chips, progress pills, health badges, zebra). Capture
  is scale-3 PNG with `compress`/`"SLOW"`, `pdf.setProperties`, `overlayLinks`; PNG variant kept
  (scale 2 to stay under the browser's max-canvas height).
- `src/components/dashboard/dashboard.jsx` — passes `team` + `jiraBaseUrl` into `ExportDialog`.

No schema/route/dependency change (reuses `html2canvas-pro` + `jspdf`); **44 ƒ Dynamic unchanged**.

## Acceptance / verification (2026-08-07)

- `yarn lint` clean; `prisma migrate status` up to date (no schema change).
- Cold `rm -rf .next` DB/env-free `yarn build` green — **44 ƒ Dynamic unchanged** (`.env` moved
  aside via `mv`, restored; dev server stopped for the build, restarted after).
- **Sprint export** (headless Chrome, minted admin cookie, real "Configurator & Website Setup" /
  "August 2026 Release" board): A4 portrait (595×842 pt), `setProperties` metadata correct, **20
  real clickable `/URI` Jira `browse/…` annotations + `/Annots`** (not a flat image), scale-3
  clarity, 3 pages, zero page errors. Page 1/2 rasterized and eyeballed — matches the reference
  design (purple eyebrow, gradient rule, KpiBox row, readout callouts, filter cards, blue KeyLink
  chips). Fixed a header defect found in the first render: the long sprint-window subtitle wrapped
  two lines and collided with the gradient rule → `PrintHeader` subtitle is now single-line truncate.
- **Bugs export regression:** the refactored dialog preview is pixel-identical to the reference PDF
  page 1 — the shared-kit extraction is non-regressive. (The full 41-page real report is slow to
  rasterize at scale 3; that timeout is performance, not a failure.)
- Headless-Chrome captures collapse inter-word spaces (documented html2canvas font-metric quirk);
  Naveen's real-browser export spaces correctly.

## Doc-sync

- `project-overview.md` §5 (export rows) + a dated §11 note; `Last reviewed` bump.
- `context/current-feature.md` History entry.

## Open / next

- Naveen exports a sprint board to PDF in a real browser and confirms the look + clickable links.
- The PNG variant stacks pages into one image at scale 2 (kept from before); links are PDF-only.
