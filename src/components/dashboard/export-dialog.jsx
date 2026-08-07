"use client";

/**
 * Sprint board export — a leadership PDF/PNG of the selected sprint.
 *
 * Restyled onto the shared export design system (print-kit.jsx / print-theme.mjs) so it reads as
 * one family with the /bugs Executive Bug Report: Inter typography, a navy/slate palette with a
 * blue -> purple -> magenta gradient header rule, tinted KPI tiles, readout callouts, and blue
 * mono Jira-key chips. Fixed A4 PORTRAIT sheets are captured offscreen by html2canvas-pro at
 * scale 3 (lossless PNG), assembled by jsPDF, and every real `<a href>` is re-projected to a
 * transparent pdf.link() so issue keys stay clickable. Every report number comes from ONE
 * `computeSprintMetrics` recompute over the selected filters, so preview and capture never
 * diverge. Both heavy libraries load on demand via dynamic import.
 */
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  computeSprintMetrics,
  formatSprintWindow,
  getWeeklyVelocity,
} from "@/lib/metrics.mjs";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { PORTRAIT } from "@/lib/export/print-theme.mjs";
import {
  ExecutiveReadout,
  KeyLink,
  KpiBox,
  PrintFooter,
  PrintHeader,
  PrintSheet,
  ReportPanel,
} from "@/components/export/print-kit.jsx";
import {
  canvasToPngBytes,
  captureOptions,
  fileStamp,
  overlayLinks,
  safeFilePart,
} from "@/lib/export/pdf-capture.js";
import { cn } from "@/lib/utils";

const ISSUES_PER_PAGE = 15;
const DEFAULT_ACCENT = "#2563eb";
const ISSUE_COLS = "grid-cols-[82px_minmax(0,1fr)_64px_52px_92px]";

/* Progress pill: green complete / blue in-progress / slate not-started (print palette). */
const PCT_BADGE = {
  complete: "bg-[#f0fdf4] text-[#16a34a]",
  inProgress: "bg-[#eff6ff] text-[#2563eb]",
  notStarted: "bg-[#f1f5f9] text-[#64748b]",
};

/* Bordered health pills tuned to the print palette (keyed by issue.health.tone). */
const HEALTH_BADGE = {
  danger: "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]",
  warn: "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
  info: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]",
  success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
  neutral: "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]",
};

function formatDateTime(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ExportDialog({
  sprint,
  team,
  filters,
  progressByKey,
  capacity,
  jiraBaseUrl,
  onClose,
  showToast,
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set(filters.map((f) => f.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Captured once at mount (lazy init keeps render pure) so the header "Generated" time is stable.
  const [generatedAt] = useState(() => Date.now());
  const offScreenRef = useRef(null);

  const selectedFilters = useMemo(
    () => filters.filter((filter) => selectedIds.has(filter.id)),
    [filters, selectedIds],
  );

  // Single source for every report number — preview and capture can't diverge.
  const exportMetrics = useMemo(
    () => computeSprintMetrics(selectedFilters, progressByKey, sprint),
    [selectedFilters, progressByKey, sprint],
  );
  const exportIssues = exportMetrics.issues;

  const allRows = useMemo(() => {
    const rows = [];
    selectedFilters.forEach((filter) => {
      const filterIssues = exportIssues.filter((issue) => issue.filterId === filter.id);
      if (!filterIssues.length) return;
      const fp = filterIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
      const fc = filterIssues.reduce((sum, issue) => sum + (issue.storyPoints * issue.percent) / 100, 0);
      const fpct = fp > 0 ? Math.round((fc / fp) * 100) : 0;
      rows.push({ kind: "filter-header", filter, count: filterIssues.length, fp, fc, fpct });
      filterIssues.forEach((issue, i) => rows.push({ kind: "issue", issue, zebra: i % 2 === 1 }));
    });
    return rows;
  }, [selectedFilters, exportIssues]);

  const pages = useMemo(() => {
    const result = [{ type: "summary" }];
    for (let i = 0; i < allRows.length; i += ISSUES_PER_PAGE) {
      result.push({ type: "issues", rows: allRows.slice(i, i + ISSUES_PER_PAGE) });
    }
    return result;
  }, [allRows]);

  // Velocity over ALL included items (legacy parity — every selected filter's effort counts).
  const velocity = useMemo(
    () => getWeeklyVelocity(sprint, exportMetrics.completedPoints, exportMetrics.points),
    [sprint, exportMetrics],
  );

  const lastRefreshed = useMemo(() => {
    const times = selectedFilters
      .map((filter) => (filter.lastSyncedAt ? new Date(filter.lastSyncedAt).getTime() : 0))
      .filter((value) => value > 0);
    return times.length > 0 ? Math.max(...times) : null;
  }, [selectedFilters]);

  const meta = useMemo(
    () => [
      { label: "Team", value: team?.name ?? "—", truncate: true },
      { label: "Data refreshed", value: lastRefreshed ? formatDateTime(lastRefreshed) : "Not synced" },
      { label: "Generated", value: formatDateTime(generatedAt) },
    ],
    [team, lastRefreshed, generatedAt],
  );
  const footerLeft = `StoryBoard · ${sprint.name} · ${team?.name ?? "Sprint report"}`;

  const toggleFilter = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const nothingSelected = selectedIds.size === 0;
  const totalPages = pages.length;
  // Clamped at render (no clamp effect — the installed set-state-in-effect rule): deselecting
  // filters can shrink `pages` below a stored `currentPage`, and navigation math uses pageIndex.
  const pageIndex = Math.min(currentPage, totalPages - 1);
  const page = pages[pageIndex];

  const browseHref = (jiraKey) => (jiraBaseUrl ? `${jiraBaseUrl}/browse/${jiraKey}` : null);

  const renderPage = (pageDef, index) =>
    pageDef.type === "summary" ? (
      <SummaryPage
        sprint={sprint}
        selectedFilters={selectedFilters}
        exportIssues={exportIssues}
        exportMetrics={exportMetrics}
        velocity={velocity}
        capacity={capacity}
        meta={meta}
        footerLeft={footerLeft}
        pageNumber={index + 1}
        totalPages={totalPages}
      />
    ) : (
      <IssuesPage
        rows={pageDef.rows}
        browseHref={browseHref}
        footerLeft={footerLeft}
        pageNumber={index + 1}
        totalPages={totalPages}
      />
    );

  const handleExport = async (format) => {
    setError("");
    setBusy(true);
    try {
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas-pro")).default;
      const baseName = `${safeFilePart(sprint.name, "sprint")}_Week${velocity.weeksElapsed}_Report_${fileStamp()}`;
      const pageEls = Array.from(offScreenRef.current.children);
      const capture = captureOptions(PORTRAIT);

      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
        pdf.setProperties({
          title: `${sprint.name} — Sprint Report`,
          subject: "Sprint delivery report — Internal",
          author: team?.name || "StoryBoard",
          creator: "StoryBoard",
          keywords: "sprint, delivery, velocity, engineering, internal",
        });
        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await html2canvas(pageEls[i], capture);
          const pngBytes = await canvasToPngBytes(canvas);
          if (i > 0) pdf.addPage("a4", "portrait");
          pdf.addImage(pngBytes, "PNG", 0, 0, PORTRAIT.widthMm, PORTRAIT.heightMm, undefined, "SLOW");
          overlayLinks(pdf, pageEls[i], PORTRAIT);
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
      title={`Sprint Report — ${sprint.name}`}
      description="Pick the filters to include, check the preview, then export. Jira keys stay clickable in the PDF."
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
            {busy ? "Exporting…" : "Export PDF"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-accent-foreground">
              Include filters
            </span>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((filter) => {
                const active = selectedIds.has(filter.id);
                const accent = filter.accentColor ?? DEFAULT_ACCENT;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => toggleFilter(filter.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      active ? "text-foreground" : "border-border text-muted-foreground hover:border-border-strong",
                    )}
                    style={
                      active
                        ? {
                            borderColor: accent,
                            backgroundColor: `color-mix(in srgb, ${accent} 10%, white)`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={cn("size-2 rounded-full", !active && "opacity-40")}
                      style={{ backgroundColor: accent }}
                      aria-hidden="true"
                    />
                    {filter.name}
                  </button>
                );
              })}
            </div>
            {nothingSelected && (
              <span className="text-xs text-danger">Select at least one filter to export.</span>
            )}
          </div>
        </div>

        <DialogError>{error}</DialogError>

        <div className="rounded-xl border border-border-subtle bg-[#e9eef3] p-2 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
            <span>Responsive preview · A4 portrait</span>
            <span className="font-semibold text-foreground">Internal</span>
          </div>
          <PortraitPreview>{renderPage(page, pageIndex)}</PortraitPreview>
        </div>
      </div>

      {/* Offscreen A4 print sheets — what html2canvas-pro captures. Rendered (not display:none) so
          layout runs; parked far off-canvas. */}
      <div
        ref={offScreenRef}
        className="pointer-events-none fixed top-0 -left-[20000px]"
        aria-hidden="true"
      >
        {pages.map((pageDef, index) => (
          <PrintSheet key={`${pageDef.type}-${index}`} geometry={PORTRAIT}>
            {renderPage(pageDef, index)}
          </PrintSheet>
        ))}
      </div>
    </Dialog>
  );
}

function PortraitPreview({ children }) {
  return (
    <div
      className={cn(
        "relative mx-auto h-[404px] w-[286px] overflow-hidden shadow-lg",
        "min-[480px]:h-[517px] min-[480px]:w-[365px]",
        "sm:h-[606px] sm:w-[429px]",
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 origin-top-left scale-[0.36]",
          "min-[480px]:scale-[0.46] sm:scale-[0.54]",
        )}
      >
        <PrintSheet geometry={PORTRAIT}>{children}</PrintSheet>
      </div>
    </div>
  );
}

function SummaryPage({
  sprint,
  selectedFilters,
  exportIssues,
  exportMetrics,
  velocity,
  capacity,
  meta,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  const healthStatus = exportMetrics.sprintHealth.status;
  // Delivery lens (roadmap + tech debt) drives the health/completion figures; velocity + story
  // points stay all-work (two-lens model, sprint-phases-delivery-lens.md).
  const completionPct =
    exportMetrics.deliveryPoints > 0
      ? Math.round((exportMetrics.deliveryCompletedPoints / exportMetrics.deliveryPoints) * 100)
      : 0;
  const overallPct =
    exportMetrics.points > 0
      ? Math.round((exportMetrics.completedPoints / exportMetrics.points) * 100)
      : 0;
  const atRisk =
    exportMetrics.deliveryHealthCounts.atRisk + exportMetrics.deliveryHealthCounts.behind;

  // Worst-first delivery breakdown (mirrors metric-grid.jsx's DELIVERY_BANDS).
  const deliveryBreakdown =
    [
      ["blocked", "blocked"],
      ["behind", "behind"],
      ["atRisk", "at risk"],
      ["onTrack", "on track"],
      ["ahead", "ahead"],
      ["done", "done"],
    ]
      .filter(([key]) => exportMetrics.deliveryHealthCounts[key] > 0)
      .map(([key, label]) => `${exportMetrics.deliveryHealthCounts[key]} ${label}`)
      .join(" · ") || "no delivery issues";

  const healthKpiTone =
    healthStatus === "Critical" ? "danger" : healthStatus === "At Risk" ? "warn" : "positive";
  const healthReadoutTone =
    healthStatus === "Critical" ? "danger" : healthStatus === "At Risk" ? "warn" : "neutral";
  const round = (n) => Math.round(n);

  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <PrintHeader
        eyebrow="Sprint delivery"
        pill="Internal"
        title={sprint.name}
        subtitle={formatSprintWindow(sprint)}
        meta={meta}
      />

      <div className="mt-3 grid grid-cols-5 gap-2.5">
        <KpiBox label="Sprint health" value={healthStatus} detail={deliveryBreakdown} tone={healthKpiTone} />
        <KpiBox
          label="Completion"
          value={`${completionPct}%`}
          detail={`${round(exportMetrics.deliveryCompletedPoints)} / ${round(exportMetrics.deliveryPoints)} delivery pts`}
          tone="info"
        />
        <KpiBox
          label="Weekly velocity"
          value={`${velocity.velocity} pts`}
          detail={`per week · ${velocity.weeksNeeded}w to finish`}
          tone="ink"
        />
        <KpiBox
          label="At risk"
          value={atRisk}
          detail={`${exportMetrics.blockedCount} blocked`}
          tone={atRisk > 0 ? "warn" : "positive"}
        />
        <KpiBox
          label="Story points"
          value={`${round(exportMetrics.completedPoints)} / ${round(exportMetrics.points)}`}
          detail={`${overallPct}% delivered · all work`}
          tone="positive"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <ReportPanel title="Delivery readout" subtitle="Roadmap + tech debt · dev cycle">
          <div className="mt-2 grid gap-2">
            <ExecutiveReadout
              label="Sprint health"
              value={healthStatus}
              detail={deliveryBreakdown}
              tone={healthReadoutTone}
            />
            <ExecutiveReadout
              label="Completion"
              value={`${completionPct}% of delivery scope`}
              detail={`${round(exportMetrics.deliveryCompletedPoints)} of ${round(exportMetrics.deliveryPoints)} pts complete`}
              tone="info"
            />
            <ExecutiveReadout
              label="Projected finish"
              value={`${round(velocity.projectedPoints)} pts by sprint end`}
              detail={`${velocity.onTrack ? "On pace" : "Behind pace"} · week ${velocity.weeksElapsed} of ${velocity.totalWeeks}`}
              tone={velocity.onTrack ? "neutral" : "warn"}
            />
          </div>
        </ReportPanel>
        <ReportPanel title="Work composition" subtitle="Committed vs tech debt vs unplanned">
          <div className="mt-2 grid gap-2">
            <ExecutiveReadout
              label="Committed (roadmap)"
              value={`${round(exportMetrics.committedCompletedPoints)} / ${round(exportMetrics.committedPoints)} pts`}
              detail={
                capacity?.committedPoints != null
                  ? `of ${round(capacity.committedPoints)} pt capacity`
                  : "Customer-committed scope"
              }
              tone="info"
            />
            <ExecutiveReadout
              label="Tech debt"
              value={`${round(exportMetrics.techDebtCompletedPoints)} / ${round(exportMetrics.techDebtPoints)} pts`}
              detail="Planned, not customer-committed"
              tone="warn"
            />
            <ExecutiveReadout
              label="Unplanned bugs"
              value={`${round(exportMetrics.unplannedCompletedPoints)} / ${round(exportMetrics.unplannedPoints)} pts`}
              detail="Support + internal bugs"
              tone="danger"
            />
          </div>
        </ReportPanel>
      </div>

      <ReportPanel title="Delivery by filter" subtitle="Weighted completion per track" className="mt-3">
        <div className="mt-2 grid grid-cols-3 gap-2">
          {selectedFilters.map((filter) => (
            <FilterCard key={filter.id} filter={filter} exportIssues={exportIssues} />
          ))}
        </div>
      </ReportPanel>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

function FilterCard({ filter, exportIssues }) {
  const issues = exportIssues.filter((issue) => issue.filterId === filter.id);
  const fp = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const fc = issues.reduce((sum, issue) => sum + (issue.storyPoints * issue.percent) / 100, 0);
  const fpct = fp > 0 ? Math.round((fc / fp) * 100) : 0;
  const done = issues.filter((issue) => issue.percent === 100).length;
  const active = issues.filter((issue) => issue.percent > 0 && issue.percent < 100).length;
  const accent = filter.accentColor ?? DEFAULT_ACCENT;
  return (
    <div
      className="rounded-lg border border-[#e2e8f0] border-t-[3px] bg-white px-3 py-2"
      style={{ borderTopColor: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block truncate text-[10px] font-extrabold text-[#0f172a]">
            {filter.name}
          </strong>
          <span className="mt-0.5 block truncate text-[8px] font-medium text-[#64748b]">
            {WORKFLOWS[filter.workflowType].name}
          </span>
        </div>
        <span className="shrink-0 text-[16px] leading-none font-black tabular-nums text-[#0f172a]">
          {fpct}%
        </span>
      </div>
      <p className="mt-1 text-[8px] text-[#64748b]">
        {done} done · {active} active · {issues.length} total
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#eef2f7]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${fpct}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

function IssuesPage({ rows, browseHref, footerLeft, pageNumber, totalPages }) {
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Work breakdown
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">By filter · Jira-linked detail</p>
      </div>

      <div
        className={cn(
          "mt-3 grid h-6 items-center border-b border-[#cbd5e1] px-2 text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]",
          ISSUE_COLS,
        )}
      >
        <span>Jira key</span>
        <span>Issue summary</span>
        <span className="text-center">Progress</span>
        <span className="text-center">Stages</span>
        <span className="text-right">Health</span>
      </div>

      <div className="flex flex-col">
        {rows.map((row, index) =>
          row.kind === "filter-header" ? (
            <FilterBand key={`fh-${row.filter.id}-${index}`} row={row} />
          ) : (
            <IssueRow
              key={`${row.issue.jiraKey}-${index}`}
              issue={row.issue}
              href={browseHref(row.issue.jiraKey)}
              zebra={row.zebra}
            />
          ),
        )}
      </div>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

function FilterBand({ row }) {
  const { filter, count, fp, fc, fpct } = row;
  const accent = filter.accentColor ?? DEFAULT_ACCENT;
  return (
    <div
      className="mt-2 flex items-center justify-between gap-3 rounded-md border border-[#e2e8f0] border-t-[3px] bg-[#f5f7fb] px-3 py-1.5"
      style={{ borderTopColor: accent }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <strong className="block truncate text-[10px] font-extrabold text-[#0f172a]">
            {filter.name}
          </strong>
          <span className="block truncate text-[8px] text-[#64748b]">
            {WORKFLOWS[filter.workflowType].name} · {count} issue{count === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-baseline gap-3 text-right">
        <span className="text-[8px] text-[#64748b] tabular-nums">
          {Math.round(fc)} / {fp} pts
        </span>
        <span className="text-[16px] leading-none font-black tabular-nums text-[#0f172a]">
          {fpct}%
        </span>
      </div>
    </div>
  );
}

function IssueRow({ issue, href, zebra }) {
  const totalStages = WORKFLOWS[issue.workflowType].stages.length;
  const pctTone =
    issue.percent === 100 ? "complete" : issue.percent > 0 ? "inProgress" : "notStarted";
  return (
    <div
      className={cn(
        "grid h-[34px] items-center border-b border-[#eef2f7] px-2 text-[9px]",
        ISSUE_COLS,
      )}
      style={{ backgroundColor: zebra ? "#f8fafc" : "#ffffff" }}
    >
      <span>
        <KeyLink jiraKey={issue.jiraKey} href={href} />
      </span>
      <span className="line-clamp-2 pr-3 leading-[12px] text-[#334155]">{issue.title}</span>
      <span className="text-center">
        <span
          className={cn(
            "inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold tabular-nums",
            PCT_BADGE[pctTone],
          )}
        >
          {issue.percent}%
        </span>
      </span>
      <span className="text-center tabular-nums text-[#64748b]">
        {totalStages > 0 ? `${issue.completedStages} / ${totalStages}` : "—"}
      </span>
      <span className="text-right">
        <span
          className={cn(
            "inline-block rounded-sm border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap",
            HEALTH_BADGE[issue.health.tone] ?? HEALTH_BADGE.neutral,
          )}
        >
          {issue.health.status}
        </span>
      </span>
    </div>
  );
}
