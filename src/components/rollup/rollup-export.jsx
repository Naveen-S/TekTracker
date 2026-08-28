"use client";

/**
 * Roll-up export — a leadership PDF/PNG of the whole portfolio (rollup-export.md).
 *
 * Two variants in one dialog: **Executive** (portfolio KPIs, a composition band, a burndown, and
 * the per-scrum-team effort scorecard) and **Full detail** (the same, plus every team's tracks and
 * issue rows, Jira-linked). Three things are chosen at generation time rather than baked in — the
 * effort metric, whether to emphasise risk, and which teams to include.
 *
 * `/rollup` is a server component, so this is a self-mounting client leaf owning its own button,
 * dialog state and toast (the `BugExport` / `RollupDigestButton` shape) rather than the dashboard's
 * useState-in-parent pattern.
 *
 * Every report number comes from ONE `aggregateRollup` recompute over the SELECTED teams, so the
 * preview and the capture can never diverge, and deselecting a team genuinely removes it from the
 * totals, the composition, the burndown and the risk register. Fixed A4 LANDSCAPE sheets are
 * captured offscreen by html2canvas-pro at scale 3 and assembled by jsPDF; every real `<a href>` is
 * re-projected to a transparent pdf.link() so Jira keys stay clickable. Both heavy libraries load
 * on demand via dynamic import.
 */
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import { PrintSheet } from "@/components/export/print-kit.jsx";
import { sortRiskyIssues } from "@/components/dashboard/risk-callouts-panel";
import {
  ExecutiveSummaryPage,
  INLINE_SCORECARD_ROWS,
  INLINE_VELOCITY_ROWS,
  RISK_ROWS_PER_PAGE,
  RiskRegisterPage,
  SCORECARD_ROWS_PER_PAGE,
  TeamDetailPage,
  TeamScorecardPage,
  TrendPage,
  VELOCITY_ROWS_PER_PAGE,
  VelocityScorecardPage,
  VelocitySummaryPage,
  formatDateTime,
} from "@/components/rollup/rollup-export-pages";
import {
  canvasToPngBytes,
  captureOptions,
  fileStamp,
  overlayLinks,
  safeFilePart,
} from "@/lib/export/pdf-capture.js";
import { chunkRows } from "@/lib/export/page-packer.mjs";
import { LANDSCAPE } from "@/lib/export/print-theme.mjs";
import {
  aggregateRollup,
  buildTrendSeries,
  combineSnapshotsByDay,
  getWeeklyVelocity,
} from "@/lib/metrics.mjs";
import {
  defaultRiskEmphasis,
  isSprintComplete,
  orderTeamsByVelocity,
  orderTeamsForReport,
  paginateRollupDetail,
  teamCompositionRow,
  velocityRows,
  velocityTotals,
} from "@/lib/rollup/pdf-layout.mjs";
import { cn } from "@/lib/utils";

const EFFORT_OPTIONS = [
  { value: "both", label: "Delivered / planned" },
  { value: "delivered", label: "Delivered points only" },
  { value: "planned", label: "Planned scope only" },
];

const VARIANTS = [
  { id: "executive", label: "Executive" },
  { id: "detail", label: "Full detail" },
  // Only meaningful once a sprint is over — velocity is a retrospective number, and the report drops
  // health/completion/risk entirely (rollup-export.md).
  { id: "velocity", label: "Velocity", completedOnly: true },
];

export function RollupExport({
  perTeam = [],
  sprint,
  scopeLabel,
  teamSnapshots = [],
  jiraBaseUrl,
  asOf,
}) {
  const [open, setOpen] = useState(false);
  const [toast, showToast] = useToast();

  if (!sprint || perTeam.length === 0) return null;

  return (
    <>
      <Button variant="onDark" size="sm" onClick={() => setOpen(true)}>
        <FileDown /> Export
      </Button>
      {open ? (
        <RollupExportDialog
          perTeam={perTeam}
          sprint={sprint}
          scopeLabel={scopeLabel}
          teamSnapshots={teamSnapshots}
          jiraBaseUrl={jiraBaseUrl}
          asOf={asOf}
          showToast={showToast}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}

function RollupExportDialog({
  perTeam,
  sprint,
  scopeLabel,
  teamSnapshots,
  jiraBaseUrl,
  asOf,
  showToast,
  onClose,
}) {
  const [variant, setVariant] = useState("executive");
  const [effortMode, setEffortMode] = useState("both");
  // A completed sprint should not lead with risk (Naveen, 2026-08-27) — the default follows the
  // sprint's own state/phase, and the reader can still override it either way.
  const [riskEmphasis, setRiskEmphasis] = useState(() => defaultRiskEmphasis(sprint, asOf));
  const [selectedIds, setSelectedIds] = useState(() => new Set(perTeam.map((e) => e.team.id)));
  // Report-scoped team sizes, prefilled from the admin-entered Team.developerCount. Edits never
  // write back — /admin stays the source of truth. An empty string is meaningful: it opts a team
  // out of per-developer rates (see velocityRows' size-resolution note).
  const [teamSizes, setTeamSizes] = useState(() =>
    Object.fromEntries(
      perTeam.map((entry) => [
        entry.team.id,
        entry.team.developerCount != null ? String(entry.team.developerCount) : "",
      ]),
    ),
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Captured once at mount (lazy init keeps render pure) so the "Generated" stamp is stable.
  const [generatedAt] = useState(() => Date.now());
  const offScreenRef = useRef(null);

  const selectedTeams = useMemo(
    () => perTeam.filter((entry) => selectedIds.has(entry.team.id)),
    [perTeam, selectedIds],
  );

  // Single source for every report number, over the SELECTED teams only.
  const combined = useMemo(
    () => aggregateRollup(selectedTeams.map((entry) => entry.metrics)),
    [selectedTeams],
  );

  const capacity = useMemo(() => {
    const configured = selectedTeams.filter((entry) => entry.capacity?.committedPoints != null);
    if (configured.length === 0) return null;
    return {
      committedPoints: configured.reduce((sum, e) => sum + e.capacity.committedPoints, 0),
      configuredTeamCount: configured.length,
      totalTeamCount: selectedTeams.length,
    };
  }, [selectedTeams]);

  // Re-combined over the selected teams so a trimmed report's burndown matches its totals.
  const series = useMemo(() => {
    const rows = teamSnapshots.filter((row) => selectedIds.has(row.teamId));
    if (rows.length === 0) return { points: [], ideal: null, projection: null };
    return buildTrendSeries(combineSnapshotsByDay(rows), sprint, asOf);
  }, [teamSnapshots, selectedIds, sprint, asOf]);

  const sprintComplete = isSprintComplete(sprint, asOf);
  // Velocity is delivered-only by definition, so the effort control is hidden and forced.
  const activeEffortMode = variant === "velocity" ? "delivered" : effortMode;
  const activeRiskEmphasis = variant === "velocity" ? false : riskEmphasis;

  const orderedTeams = useMemo(
    () => orderTeamsForReport(selectedTeams, activeRiskEmphasis),
    [selectedTeams, activeRiskEmphasis],
  );

  const scorecardRows = useMemo(
    () => orderedTeams.map((entry) => ({ composition: teamCompositionRow(entry), metrics: entry.metrics })),
    [orderedTeams],
  );

  const portfolio = useMemo(
    () => teamCompositionRow({ team: { id: null, key: "PORTFOLIO", name: scopeLabel }, metrics: combined }),
    [combined, scopeLabel],
  );

  const velocityData = useMemo(() => {
    if (variant !== "velocity") return null;
    const rows = orderTeamsByVelocity(velocityRows(selectedTeams, teamSizes));
    return { rows, totals: velocityTotals(rows) };
  }, [variant, selectedTeams, teamSizes]);

  const riskyIssues = useMemo(() => {
    if (!activeRiskEmphasis) return [];
    return sortRiskyIssues(
      orderedTeams.flatMap((entry) =>
        entry.metrics.deliveryIssues.map((issue) => ({ ...issue, teamKey: entry.team.key })),
      ),
    );
  }, [orderedTeams, activeRiskEmphasis]);

  // Velocity stays the naive linear model on export paths (§12) — snapshotVelocity is a live-page
  // nicety, and getWeeklyVelocity is the one that carries `projectedPoints`.
  const velocity = useMemo(
    () => getWeeklyVelocity(sprint, combined.completedPoints, combined.points),
    [sprint, combined],
  );

  const lastRefreshed = useMemo(() => {
    const times = selectedTeams
      .map((entry) => (entry.lastSyncedAt ? new Date(entry.lastSyncedAt).getTime() : 0))
      .filter((value) => value > 0);
    return times.length > 0 ? Math.max(...times) : null;
  }, [selectedTeams]);

  const meta = useMemo(
    () => [
      { label: "Teams", value: String(selectedTeams.length) },
      { label: "Data refreshed", value: lastRefreshed ? formatDateTime(lastRefreshed) : "Not synced" },
      { label: "Generated", value: formatDateTime(generatedAt) },
    ],
    [selectedTeams.length, lastRefreshed, generatedAt],
  );

  const footerLeft = `StoryBoard · ${sprint.name} · ${scopeLabel}`;

  const pages = useMemo(() => {
    // The velocity report is a single question — how fast did each team go — so it is the scorecard
    // and nothing else: no trend, no risk register, no issue detail.
    if (variant === "velocity") {
      const rows = velocityData?.rows ?? [];
      const inline = rows.slice(0, INLINE_VELOCITY_ROWS);
      const overflow = chunkRows(rows.slice(INLINE_VELOCITY_ROWS), VELOCITY_ROWS_PER_PAGE);
      return [
        { type: "velocity", rows: inline, showTotals: overflow.length === 0 },
        ...overflow.map((chunk, index) => ({
          type: "velocityOverflow",
          rows: chunk,
          showTotals: index === overflow.length - 1,
        })),
      ];
    }

    // The scorecard is the report's headline answer, so the first teams ride on page 1 beside the
    // KPIs; only a portfolio too big for one sheet spills onto continuation pages.
    const inlineRows = scorecardRows.slice(0, INLINE_SCORECARD_ROWS);
    const overflowChunks = chunkRows(scorecardRows.slice(INLINE_SCORECARD_ROWS), SCORECARD_ROWS_PER_PAGE);

    const result = [
      {
        type: "summary",
        scorecardRows: inlineRows,
        showPortfolio: overflowChunks.length === 0,
      },
    ];

    overflowChunks.forEach((rows, index) =>
      result.push({
        type: "scorecard",
        rows,
        showPortfolio: index === overflowChunks.length - 1,
      }),
    );

    result.push({ type: "trend" });

    if (activeRiskEmphasis && riskyIssues.length > 0) {
      chunkRows(riskyIssues, RISK_ROWS_PER_PAGE).forEach((issues, index) =>
        result.push({ type: "risk", issues, continued: index > 0 }),
      );
    }

    if (variant === "detail") {
      paginateRollupDetail(orderedTeams).forEach((page) =>
        result.push({ type: "detail", sections: page.sections }),
      );
    }

    return result;
  }, [scorecardRows, activeRiskEmphasis, riskyIssues, variant, orderedTeams, velocityData]);

  const nothingSelected = selectedIds.size === 0;
  const totalPages = pages.length;
  // Clamped at render (no clamp effect — the installed set-state-in-effect rule): switching variant
  // or deselecting teams can shrink `pages` below a stored `currentPage`.
  const pageIndex = Math.min(currentPage, totalPages - 1);

  const toggleTeam = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const browseHref = (jiraKey) => (jiraBaseUrl ? `${jiraBaseUrl}/browse/${jiraKey}` : null);

  const renderPage = (pageDef, index) => {
    const shared = { footerLeft, pageNumber: index + 1, totalPages };
    if (pageDef.type === "velocity") {
      return (
        <VelocitySummaryPage
          rows={pageDef.rows}
          totals={velocityData.totals}
          sprint={sprint}
          scopeLabel={scopeLabel}
          velocity={velocity}
          meta={meta}
          showTotals={pageDef.showTotals}
          {...shared}
        />
      );
    }
    if (pageDef.type === "velocityOverflow") {
      return (
        <VelocityScorecardPage
          rows={pageDef.rows}
          totals={velocityData.totals}
          showTotals={pageDef.showTotals}
          {...shared}
        />
      );
    }
    if (pageDef.type === "summary") {
      return (
        <ExecutiveSummaryPage
          combined={combined}
          perTeam={selectedTeams}
          sprint={sprint}
          scopeLabel={scopeLabel}
          velocity={velocity}
          composition={portfolio.segments}
          effortMode={activeEffortMode}
          riskEmphasis={activeRiskEmphasis}
          scorecardRows={pageDef.scorecardRows}
          portfolio={portfolio}
          showPortfolio={pageDef.showPortfolio}
          meta={meta}
          {...shared}
        />
      );
    }
    if (pageDef.type === "scorecard") {
      return (
        <TeamScorecardPage
          rows={pageDef.rows}
          portfolio={portfolio}
          effortMode={activeEffortMode}
          riskEmphasis={activeRiskEmphasis}
          showPortfolio={pageDef.showPortfolio}
          {...shared}
        />
      );
    }
    if (pageDef.type === "trend") {
      return (
        <TrendPage
          combined={combined}
          perTeam={selectedTeams}
          sprint={sprint}
          series={series}
          velocity={velocity}
          capacity={capacity}
          riskEmphasis={activeRiskEmphasis}
          {...shared}
        />
      );
    }
    if (pageDef.type === "risk") {
      return (
        <RiskRegisterPage
          issues={pageDef.issues}
          browseHref={browseHref}
          continued={pageDef.continued}
          totalRisky={riskyIssues.length}
          {...shared}
        />
      );
    }
    return (
      <TeamDetailPage
        sections={pageDef.sections}
        effortMode={activeEffortMode}
        browseHref={browseHref}
        {...shared}
      />
    );
  };

  const handleExport = async (format) => {
    setError("");
    setBusy(true);
    try {
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas-pro")).default;
      const baseName = `${safeFilePart(scopeLabel, "portfolio")}_${safeFilePart(sprint.name, "sprint")}_${variant === "detail" ? "Full" : variant === "velocity" ? "Velocity" : "Executive"}_${fileStamp()}`;
      const pageEls = Array.from(offScreenRef.current.children);
      const capture = captureOptions(LANDSCAPE);

      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        pdf.setProperties({
          title: `${scopeLabel} — ${sprint.name} Portfolio Report`,
          subject: "Multi-team sprint delivery report — Internal",
          author: scopeLabel || "StoryBoard",
          creator: "StoryBoard",
          keywords: "portfolio, roll-up, sprint, delivery, engineering, internal",
        });
        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await html2canvas(pageEls[i], capture);
          const pngBytes = await canvasToPngBytes(canvas);
          if (i > 0) pdf.addPage("a4", "landscape");
          pdf.addImage(pngBytes, "PNG", 0, 0, LANDSCAPE.widthMm, LANDSCAPE.heightMm, undefined, "SLOW");
          overlayLinks(pdf, pageEls[i], LANDSCAPE);
        }
        pdf.save(`${baseName}.pdf`);
      } else {
        // PNG stacks every page into one tall image; capped at scale 2 to stay under the browser's
        // max canvas height for long reports (the PDF path keeps the full scale-3 clarity).
        const pngCapture = { ...capture, scale: 2 };
        const canvases = [];
        for (const el of pageEls) canvases.push(await html2canvas(el, pngCapture));
        const merged = document.createElement("canvas");
        merged.width = canvases[0].width;
        merged.height = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
        const ctx = merged.getContext("2d");
        let y = 0;
        canvases.forEach((canvas) => {
          ctx.drawImage(canvas, 0, y);
          y += canvas.height;
        });
        const link = document.createElement("a");
        link.download = `${baseName}.png`;
        link.href = merged.toDataURL("image/png");
        link.click();
      }

      showToast(format === "pdf" ? "PDF exported" : "Image exported");
      onClose();
    } catch (exportError) {
      setError(exportError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title={`Portfolio Report — ${sprint.name}`}
      description="Pick the view, the effort metric and the teams, check the preview, then export. Jira keys stay clickable in the PDF."
      onClose={busy ? undefined : onClose}
      size="xl"
      footer={
        <>
          {totalPages > 1 && (
            <div className="mr-auto flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                aria-label="Previous page"
                onClick={() => setCurrentPage(Math.max(0, pageIndex - 1))}
                disabled={pageIndex === 0}
              >
                <ChevronLeft />
              </Button>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                Page {pageIndex + 1} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Next page"
                onClick={() => setCurrentPage(Math.min(totalPages - 1, pageIndex + 1))}
                disabled={pageIndex === totalPages - 1}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => handleExport("image")}
            disabled={busy || nothingSelected}
          >
            <Download /> PNG
          </Button>
          <Button onClick={() => handleExport("pdf")} disabled={busy || nothingSelected}>
            {busy ? <Spinner /> : <Download />}
            {busy ? `Exporting ${totalPages} page${totalPages === 1 ? "" : "s"}…` : "Export PDF"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Field label="View">
            <span
              role="group"
              aria-label="Report view"
              className="flex items-center gap-0.5 rounded-full border border-border bg-subtle p-0.5"
            >
              {VARIANTS.map((option) => {
                const active = variant === option.id;
                const locked = option.completedOnly && !sprintComplete;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVariant(option.id)}
                    aria-pressed={active}
                    disabled={busy || locked}
                    title={
                      locked
                        ? "Available once the sprint is complete — velocity is a retrospective number"
                        : undefined
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                      locked && "cursor-not-allowed opacity-45",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </span>
          </Field>

          {variant !== "velocity" && (
          <>
          <Field label="Effort">
            <Select
              value={effortMode}
              onChange={(event) => setEffortMode(event.target.value)}
              disabled={busy}
              aria-label="Effort metric"
            >
              {EFFORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Risk">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <Checkbox
                checked={riskEmphasis}
                onChange={(event) => setRiskEmphasis(event.target.checked)}
                disabled={busy}
              />
              Include risk call-outs
            </label>
          </Field>
          </>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-accent-foreground">
            Include teams
          </span>
          <div role="group" aria-label="Include teams" className="flex flex-wrap gap-1.5">
            {perTeam.map((entry) => {
              const active = selectedIds.has(entry.team.id);
              return (
                <button
                  key={entry.team.id}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => toggleTeam(entry.team.id)}
                  title={entry.team.name}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "border-accent-foreground bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:border-border-strong",
                  )}
                >
                  <span
                    className={cn("size-2 rounded-full bg-current", !active && "opacity-40")}
                    aria-hidden="true"
                  />
                  {entry.team.key}
                </button>
              );
            })}
          </div>
          {nothingSelected && (
            <span className="text-xs text-danger">Select at least one team to export.</span>
          )}
        </div>

        {variant === "velocity" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-accent-foreground">
              Team sizes
            </span>
            <div
              role="group"
              aria-label="Team sizes"
              className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border-subtle bg-subtle px-3 py-2.5"
            >
              {perTeam
                .filter((entry) => selectedIds.has(entry.team.id))
                .map((entry) => (
                  <label
                    key={entry.team.id}
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    title={entry.team.name}
                  >
                    <span className="text-muted-foreground">{entry.team.key}</span>
                    <Input
                      type="number"
                      min="1"
                      max="200"
                      inputMode="numeric"
                      aria-label={`${entry.team.name} team size`}
                      value={teamSizes[entry.team.id] ?? ""}
                      disabled={busy}
                      onChange={(event) =>
                        setTeamSizes((prev) => ({ ...prev, [entry.team.id]: event.target.value }))
                      }
                      className="h-7 w-14 px-2 text-xs"
                    />
                  </label>
                ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Prefilled from Admin · edited here for this report only. Clear a field to report that
              team without a per-developer rate.
            </span>
          </div>
        )}

        <DialogError>{error}</DialogError>

        <div className="rounded-xl border border-border-subtle bg-[#e9eef3] p-2 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
            <span>Responsive preview · A4 landscape</span>
            <span className="font-semibold text-foreground">Internal</span>
          </div>
          <LandscapePreview>
            {totalPages > 0 ? renderPage(pages[pageIndex], pageIndex) : null}
          </LandscapePreview>
        </div>
      </div>

      {/* Offscreen A4 print sheets — what html2canvas-pro captures. Rendered (not display:none) so
          layout runs; parked far off-canvas at natural size (no transform) because overlayLinks
          derives mm-per-px from the live bounding rect. */}
      <div
        ref={offScreenRef}
        className="pointer-events-none fixed top-0 -left-[20000px]"
        aria-hidden="true"
      >
        {pages.map((pageDef, index) => (
          <PrintSheet key={`${pageDef.type}-${index}`}>{renderPage(pageDef, index)}</PrintSheet>
        ))}
      </div>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-accent-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function LandscapePreview({ children }) {
  return (
    <div
      className={cn(
        "relative mx-auto h-[195px] w-[275px] overflow-hidden shadow-lg",
        "min-[375px]:h-[230px] min-[375px]:w-[326px]",
        "min-[480px]:h-[302px] min-[480px]:w-[427px]",
        "sm:h-[413px] sm:w-[584px] md:h-[500px] md:w-[707px] lg:h-[588px] lg:w-[831px]",
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 origin-top-left scale-[0.245]",
          "min-[375px]:scale-[0.29] min-[480px]:scale-[0.38]",
          "sm:scale-[0.52] md:scale-[0.63] lg:scale-[0.74]",
        )}
      >
        <PrintSheet>{children}</PrintSheet>
      </div>
    </div>
  );
}
