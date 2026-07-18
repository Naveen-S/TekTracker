"use client";

/**
 * Export dialog (share-view-export.md (e)) — port of the legacy ExportModal + useExport capture:
 * include/exclude filter toggles, a paged preview (summary page + 15-issue pages), and dedicated
 * offscreen 794px A4 print pages captured client-side. All report numbers come from ONE
 * `computeSprintMetrics` recompute over the selected filters, so preview and capture always match
 * (legacy ExportModal.jsx:21-27). PDF = one page per print page via jsPDF; PNG = merged canvas.
 * `html2canvas-pro` (not stock html2canvas) because the Tailwind v4 theme is oklch/color-mix —
 * proven by the capture spike (decision 8). Both libs load on demand via dynamic import.
 * The report pages follow the legacy export design system verbatim (src/styles.css :1728-2152):
 * teal eyebrow/section labels + 2px teal divider, white bordered metric boxes, 3-col accent
 * filter cards, pastel leadership cards, tinted table chrome with zebra rows. Print-only colors
 * that legacy hardcoded (brand teal, pastels, pct badges) stay fixed hex here too — these are
 * captured light-mode surfaces, never theme-flipped.
 */
import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computeSprintMetrics, formatDate, getWeeklyVelocity } from "@/lib/metrics.mjs";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { cn } from "@/lib/utils";

const ISSUES_PER_PAGE = 15;

/* Same legacy health triplets as issue-row.jsx (text 500 / border 600 / bg 50). */
const HEALTH_BADGE = {
  danger: "border-danger-strong bg-danger-soft text-danger",
  warn: "border-warn-strong bg-warn-soft text-warn",
  info: "border-info-strong bg-info-soft text-info",
  success: "border-success-strong bg-success-soft text-success",
  neutral: "border-border-strong bg-subtle text-muted-foreground",
};

export function ExportDialog({ sprint, filters, progressByKey, onClose, showToast }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set(filters.map((f) => f.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      filterIssues.forEach((issue) => rows.push({ kind: "issue", issue }));
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

  const handleExport = async (format) => {
    setError("");
    setBusy(true);
    try {
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas-pro")).default;
      // Date + time in the filename so same-day exports don't collide as "(1)", "(2)", …
      const now = new Date();
      const stamp = `${now.toISOString().split("T")[0]}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const baseName = `${sprint.name.replace(/\s+/g, "_")}_Week${velocity.weeksElapsed}_Report_${stamp}`;
      const pageEls = Array.from(offScreenRef.current.children);
      // onclone: html2canvas measures layout in a cloned iframe whose webfonts load
      // independently — without waiting, text metrics come from the fallback font and
      // baselines/line breaks drift in the capture.
      const captureOptions = {
        scale: 2,
        logging: false,
        backgroundColor: "#ffffff",
        width: 794,
        onclone: (clonedDoc) => clonedDoc.fonts.ready,
      };

      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await html2canvas(pageEls[i], captureOptions);
          if (i > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, (canvas.height * 210) / canvas.width);
        }
        pdf.save(`${baseName}.pdf`);
      } else {
        const canvases = await Promise.all(
          pageEls.map((el) => html2canvas(el, captureOptions)),
        );
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
    <Dialog open title={`Sprint Report — ${sprint.name}`} onClose={busy ? undefined : onClose} className="max-w-4xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-accent-foreground">
              Include filters
            </span>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((filter) => {
                const active = selectedIds.has(filter.id);
                const accent = filter.accentColor ?? "#00a892";
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
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => handleExport("pdf")} disabled={busy || nothingSelected}>
              <Download /> {busy ? "Exporting…" : "Export PDF"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleExport("image")}
              disabled={busy || nothingSelected}
            >
              <Download /> Export PNG
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-subtle p-4">
          <div className="mx-auto w-198.5 bg-white p-8 shadow-sm">
            {page.type === "summary" ? (
              <SummaryPage
                sprint={sprint}
                selectedFilters={selectedFilters}
                exportIssues={exportIssues}
                exportMetrics={exportMetrics}
                velocity={velocity}
              />
            ) : (
              <IssuesPage rows={page.rows} pageNumber={pageIndex} totalPages={totalPages} />
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
            >
              ← Previous
            </Button>
            <span className="text-xs font-semibold text-muted-foreground">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, pageIndex + 1))}
              disabled={pageIndex === totalPages - 1}
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Offscreen A4 print pages — what html2canvas-pro actually captures. Rendered (not
          display:none) so layout runs; parked far off-canvas like the legacy .export-offscreen. */}
      <div ref={offScreenRef} className="fixed top-0 -left-500" aria-hidden="true">
        <div className="w-198.5 bg-white p-8">
          <SummaryPage
            sprint={sprint}
            selectedFilters={selectedFilters}
            exportIssues={exportIssues}
            exportMetrics={exportMetrics}
            velocity={velocity}
          />
        </div>
        {pages.slice(1).map((issuePage, index) => (
          <div key={index} className="w-198.5 bg-white p-8">
            <IssuesPage rows={issuePage.rows} pageNumber={index + 1} totalPages={totalPages - 1} />
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/* Teal section label / eyebrow (legacy .export-section-label / .export-eyebrow — brand teal). */
function SectionLabel({ children, className }) {
  return (
    <p className={cn("text-[11px] font-bold tracking-[0.08em] uppercase text-[#00bfa5]", className)}>
      {children}
    </p>
  );
}

/* Pastel leadership cards (legacy styles.css :1880-1918). Legacy styled its "warn" band
   identically to "good", so only good/risk/completion/projected exist. */
const OVERALL_CARD = {
  good: { box: "border-[#bbf7d0] bg-[#f0fdf4]", label: "text-[#15803d]", value: "text-[#14532d]" },
  risk: { box: "border-[#fed7aa] bg-[#fff7ed]", label: "text-[#c2410c]", value: "text-[#7c2d12]" },
  completion: { box: "border-[#bfdbfe] bg-[#eff6ff]", label: "text-[#1d4ed8]", value: "text-[#1e3a8a]" },
  projected: { box: "border-[#fde68a] bg-[#fffbeb]", label: "text-[#b45309]", value: "text-[#78350f]" },
};

function OverallCard({ tone, label, value, detail }) {
  const colors = OVERALL_CARD[tone];
  return (
    <div className={cn("rounded-md border px-5 py-4", colors.box)}>
      <span className={cn("block text-[11px] font-bold tracking-[0.08em] uppercase", colors.label)}>
        {label}
      </span>
      <strong className={cn("mt-2 block font-display text-[32px] leading-[1.05] font-extrabold", colors.value)}>
        {value}
      </strong>
      <span className={cn("mt-1 block text-[11px]", colors.label)}>{detail}</span>
    </div>
  );
}

function SummaryPage({ sprint, selectedFilters, exportIssues, exportMetrics, velocity }) {
  const inProgressCount = exportIssues.filter((issue) => issue.percent > 0 && issue.percent < 100).length;
  const healthStatus = exportMetrics.sprintHealth.status;
  const completionPct =
    exportMetrics.points > 0
      ? Math.round((exportMetrics.completedPoints / exportMetrics.points) * 100)
      : 0;
  const featuresOnTrack = exportMetrics.featureOnTrackCount + exportMetrics.featureAheadCount;

  const generatedOn = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const healthTone = ["At Risk", "Critical"].includes(healthStatus) ? "risk" : "good";

  return (
    <div className="text-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Sprint Report</SectionLabel>
          <h3 className="mt-1 font-display text-2xl font-extrabold">{sprint.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {formatDate(sprint.developmentStart)} – {formatDate(sprint.developmentEnd)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[11px] text-muted-foreground">Generated on</span>
          <strong className="mt-0.5 block text-[13px] font-bold text-foreground">{generatedOn}</strong>
        </div>
      </div>
      <div className="mt-4 h-0.5 bg-[#00bfa5]" />

      <SectionLabel className="mt-5">
        This week&apos;s update — week {velocity.weeksElapsed} of {velocity.totalWeeks}
      </SectionLabel>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <ReportMetricBox
          label="Week"
          value={`${velocity.weeksElapsed} / ${velocity.totalWeeks}`}
          detail={velocity.onTrack ? "On pace" : "Behind pace"}
        />
        <ReportMetricBox
          label="Velocity"
          value={`${velocity.velocity} pts`}
          detail={`per week · ${velocity.weeksNeeded}w needed`}
        />
        <ReportMetricBox
          label="In progress"
          value={inProgressCount}
          detail={`of ${exportIssues.length} issues`}
        />
        <ReportMetricBox
          label="Blocked"
          value={exportMetrics.blockedCount}
          detail={`${exportMetrics.behindCount} behind · ${exportMetrics.atRiskCount} at risk`}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {selectedFilters.map((filter) => {
          const filterIssues = exportIssues.filter((issue) => issue.filterId === filter.id);
          const fp = filterIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
          const fc = filterIssues.reduce(
            (sum, issue) => sum + (issue.storyPoints * issue.percent) / 100,
            0,
          );
          const fpct = fp > 0 ? Math.round((fc / fp) * 100) : 0;
          const done = filterIssues.filter((issue) => issue.percent === 100).length;
          const active = filterIssues.filter((issue) => issue.percent > 0 && issue.percent < 100).length;
          const accent = filter.accentColor ?? "#00a892";
          return (
            <div
              key={filter.id}
              className="rounded-md border bg-white px-4 py-3"
              style={{ borderLeft: `4px solid ${accent}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong className="block text-sm font-bold text-foreground">{filter.name}</strong>
                  <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                    {WORKFLOWS[filter.workflowType].name}
                  </span>
                </div>
                <span className="shrink-0 font-display text-lg font-extrabold text-foreground">
                  {fpct}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {done} done · {active} active · {filterIssues.length} total
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${fpct}%`, backgroundColor: accent }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <SectionLabel className="mt-5">Overall sprint metrics</SectionLabel>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <OverallCard
          tone={healthTone}
          label="Sprint health"
          value={healthStatus}
          detail={`${featuresOnTrack}/${exportMetrics.totalFeatureIssues} features on track`}
        />
        <OverallCard
          tone="completion"
          label="Completion"
          value={`${completionPct}%`}
          detail={`${Math.round(exportMetrics.completedPoints)} / ${exportMetrics.points} story points`}
        />
        <OverallCard
          tone="projected"
          label="Projected"
          value={`${Math.round(velocity.projectedPoints)} pts`}
          detail="by end of sprint"
        />
      </div>
    </div>
  );
}

function ReportMetricBox({ label, value, detail }) {
  return (
    <div className="rounded-md border bg-white px-4 py-3">
      <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-muted-foreground">{label}</p>
      <strong className="mt-1 block font-display text-2xl leading-[1.1] font-extrabold text-foreground">
        {value}
      </strong>
      <span className="mt-1 block text-[11px] text-muted-foreground">{detail}</span>
    </div>
  );
}

/* Legacy table chrome (styles.css :1986-2116). */
const TH = "border-b-2 border-border px-3 py-2 text-left text-[11px] font-bold tracking-[0.06em] uppercase text-muted-foreground whitespace-nowrap";
const TD = "border-b border-border-subtle px-3 py-2 align-middle";

/* Progress pill colors — legacy .export-pct-badge--* fixed print hex (:2043-2045). */
const PCT_BADGE = {
  complete: "bg-[#ecfdf5] text-[#065f46]",
  inProgress: "bg-[#f0f9ff] text-[#0369a1]",
  notStarted: "bg-muted text-muted-foreground",
};

function IssuesPage({ rows, pageNumber, totalPages }) {
  return (
    <div className="text-foreground">
      <SectionLabel>Work breakdown by filter</SectionLabel>
      <table className="mt-3 w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-muted">
            <th className={cn(TH, "w-22")}>Key</th>
            <th className={TH}>Title</th>
            <th className={cn(TH, "w-20 text-center")}>Progress</th>
            <th className={cn(TH, "w-18 text-center")}>Stages</th>
            <th className={cn(TH, "w-22.5 text-center")}>Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (row.kind === "filter-header") {
              const { filter, count, fp, fc, fpct } = row;
              const accent = filter.accentColor ?? "#00a892";
              return (
                <tr key={`fh-${filter.id}-${index}`}>
                  <td
                    colSpan={5}
                    className="border-t border-border-subtle bg-subtle px-4 py-3"
                    style={{ borderLeft: `4px solid ${accent}` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center text-sm font-bold text-foreground">
                        <span
                          className="mr-2 inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                        {filter.name}
                      </span>
                      <span className="font-display text-lg font-extrabold text-foreground">
                        {fpct}%
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {WORKFLOWS[filter.workflowType].name} · {count} issues
                      </span>
                      <span>
                        {Math.round(fc)} / {fp} pts
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${fpct}%`, backgroundColor: accent }}
                      />
                    </div>
                  </td>
                </tr>
              );
            }
            const { issue } = row;
            const totalStages = WORKFLOWS[issue.workflowType].stages.length;
            const pctTone =
              issue.percent === 100 ? "complete" : issue.percent > 0 ? "inProgress" : "notStarted";
            return (
              <tr key={issue.jiraKey} className="even:bg-subtle">
                <td className={cn(TD, "font-mono text-[11px] font-semibold text-accent-foreground whitespace-nowrap")}>
                  {issue.jiraKey}
                </td>
                <td className={TD}>
                  {issue.title.length > 55 ? `${issue.title.slice(0, 55)}…` : issue.title}
                </td>
                <td className={cn(TD, "text-center")}>
                  <span
                    className={cn(
                      "inline-block rounded-full px-1.75 py-0.5 text-[11px] font-bold",
                      PCT_BADGE[pctTone],
                    )}
                  >
                    {issue.percent}%
                  </span>
                </td>
                <td className={cn(TD, "text-center whitespace-nowrap")}>
                  {totalStages > 0 ? `${issue.completedStages} / ${totalStages}` : "—"}
                </td>
                <td className={cn(TD, "text-center")}>
                  <span
                    className={cn(
                      "inline-block rounded-sm border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap",
                      HEALTH_BADGE[issue.health.tone] ?? HEALTH_BADGE.neutral,
                    )}
                  >
                    {issue.health.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 border-t border-border-subtle pt-2 text-right text-[11px] text-muted-foreground">
        Page {pageNumber} of {totalPages}
      </p>
    </div>
  );
}
