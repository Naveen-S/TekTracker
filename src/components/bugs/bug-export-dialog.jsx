"use client";

/**
 * Leadership-ready bug report PDF export.
 *
 * The document is re-authored as fixed landscape A4 sheets: one executive brief followed by a
 * risk-ordered team appendix, with an optional oldest-open appendix. html2canvas-pro captures
 * the sheets as lossless 288-DPI PNGs and jsPDF adds transparent annotations over every real
 * anchor, preserving the Jira links. Both heavy libraries remain event-time dynamic imports so
 * opening /bugs does not add them to the initial client bundle.
 */
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileDown, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import { useBugScope } from "@/components/bugs/bug-scope-view";
import {
  cellBreachedJql,
  cellJql,
  SCOPE_TOTAL_BAND_KEY,
  UNATTRIBUTED_ROW_KEY,
} from "@/lib/bug-report/matrix.mjs";
import {
  chunkRows,
  paginateOwnershipAppendix,
  paginateTeamAppendix,
  sortTeamsByRisk,
} from "@/lib/bug-report/pdf-layout.mjs";
import { smoothAreaPath, smoothLinePath } from "@/lib/chart-path.mjs";
import { CYAN, INK, LANDSCAPE, RED } from "@/lib/export/print-theme.mjs";
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

const OLDEST_ROWS_PER_PAGE = 13;
const OLDEST_LIMITS = [20, 40, 60];

export function BugExport({ exportViews, report, jiraBaseUrl, ownerName }) {
  const [open, setOpen] = useState(false);
  const [toast, showToast] = useToast();
  const { scope, scopeOptions } = useBugScope();
  const key = exportViews[scope] ? scope : "all";
  const view = exportViews[key];
  const scopeLabel =
    key === "all"
      ? scopeOptions.length > 1
        ? "All scopes"
        : (scopeOptions[0]?.name ?? "All")
      : (scopeOptions.find((option) => option.id === key)?.name ?? "All");

  if (!view) return null;
  return (
    <>
      <Button variant="onDark" size="sm" onClick={() => setOpen(true)}>
        <FileDown /> Export PDF
      </Button>
      {open ? (
        <BugExportDialog
          report={report}
          ownerName={ownerName}
          jiraBaseUrl={jiraBaseUrl}
          view={view}
          scopeLabel={scopeLabel}
          showToast={showToast}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <Toast toast={toast} />
    </>
  );
}

function BugExportDialog({ report, ownerName, jiraBaseUrl, view, scopeLabel, showToast, onClose }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [includeOldest, setIncludeOldest] = useState(false);
  const [oldestLimit, setOldestLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt] = useState(() => new Date().toISOString());
  const offScreenRef = useRef(null);

  const fullScope = (scopeId) =>
    report.scopes.find((scope) => scope.id === scopeId) ?? { id: scopeId };
  const jiraSearchHref = (jql) =>
    jiraBaseUrl && jql
      ? `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}`
      : null;
  const cellHref = (scopeId, rowKey, bandKey) =>
    jiraSearchHref(cellJql(fullScope(scopeId), rowKey, bandKey, report));
  const breachCellHref = (scopeId, rowKey, bandKey) =>
    jiraSearchHref(cellBreachedJql(fullScope(scopeId), rowKey, bandKey, report));
  const combinedCellHref = (rowKey, bandKey, breached = false) => {
    const clauses = view.matrix.scopes
      .map((scope) =>
        breached
          ? cellBreachedJql(fullScope(scope.id), rowKey, bandKey, report)
          : cellJql(fullScope(scope.id), rowKey, bandKey, report),
      )
      .filter(Boolean)
      .map((jql) => `(${jql})`);
    return jiraSearchHref(clauses.join(" OR "));
  };
  const browseHref = (jiraKey) =>
    jiraBaseUrl ? `${jiraBaseUrl}/browse/${jiraKey}` : null;
  const keysFilterHref = (keys) =>
    jiraSearchHref(keys.length > 0 ? `key in (${keys.join(", ")})` : null);

  const pages = useMemo(() => {
    const ownershipPages = view.bySprintOwnership?.configured
      ? paginateOwnershipAppendix(view.bySprintOwnership.buckets)
      : [];
    const result = [
      { type: "summary" },
      ...ownershipPages,
      ...paginateTeamAppendix(view.byTeam),
    ];
    if (includeOldest) {
      const rows = view.oldest.slice(0, oldestLimit);
      chunkRows(rows, OLDEST_ROWS_PER_PAGE).forEach((chunk, index) => {
        result.push({
          type: "oldest",
          rows: chunk,
          start: index * OLDEST_ROWS_PER_PAGE,
          total: rows.length,
        });
      });
    }
    return result;
  }, [includeOldest, oldestLimit, view]);

  const totalPages = pages.length;
  const pageIndex = Math.min(currentPage, totalPages - 1);

  const renderPage = (page, index) => {
    const shared = {
      reportName: report.name,
      scopeLabel,
      pageNumber: index + 1,
      totalPages,
    };
    if (page.type === "summary") {
      return (
        <BugExecutiveSummary
          {...shared}
          report={report}
          ownerName={ownerName}
          generatedAt={generatedAt}
          view={view}
          cellHref={cellHref}
          breachCellHref={breachCellHref}
          combinedCellHref={combinedCellHref}
        />
      );
    }
    if (page.type === "ownership") {
      return (
        <BugTeamAppendix
          {...shared}
          sections={page.sections}
          browseHref={browseHref}
          keysFilterHref={keysFilterHref}
          title="Sprint ownership appendix"
          caption="Ours vs dependencies · Jira-linked detail"
          subgroupNoun="sprint"
        />
      );
    }
    if (page.type === "teams") {
      return (
        <BugTeamAppendix
          {...shared}
          sections={page.sections}
          browseHref={browseHref}
          keysFilterHref={keysFilterHref}
        />
      );
    }
    return (
      <BugOldestAppendix
        {...shared}
        rows={page.rows}
        startIndex={page.start}
        totalCount={page.total}
        generatedAt={generatedAt}
        browseHref={browseHref}
      />
    );
  };

  const handleExport = async () => {
    setError("");
    setBusy(true);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const baseName = `${safeFilePart(report.slug, "bug")}_Executive_Bug_Report_${safeFilePart(scopeLabel, "all")}_${fileStamp()}`;
      const pageEls = Array.from(offScreenRef.current.children);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      pdf.setProperties({
        title: `${report.name} — Executive Bug Report`,
        subject: `${scopeLabel} bug health report — Internal`,
        author: ownerName || report.ownerName || "StoryBoard",
        creator: "StoryBoard",
        keywords: "bug health, SLA, engineering, internal",
      });

      const capture = captureOptions(LANDSCAPE);

      for (let index = 0; index < pageEls.length; index += 1) {
        const pageEl = pageEls[index];
        const canvas = await html2canvas(pageEl, capture);
        const pngBytes = await canvasToPngBytes(canvas);
        if (index > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(
          pngBytes,
          "PNG",
          0,
          0,
          LANDSCAPE.widthMm,
          LANDSCAPE.heightMm,
          undefined,
          "SLOW",
        );
        overlayLinks(pdf, pageEl, LANDSCAPE);
      }

      pdf.save(`${baseName}.pdf`);
      showToast("Executive PDF exported");
      onClose();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "The PDF could not be exported.");
    } finally {
      setBusy(false);
    }
  };

  const pageType =
    pages[pageIndex]?.type === "summary"
      ? "Executive brief"
      : pages[pageIndex]?.type === "ownership"
        ? "Ownership appendix"
        : pages[pageIndex]?.type === "teams"
          ? "Team appendix"
          : "Oldest-open appendix";

  return (
    <Dialog
      open
      title={`Executive Bug Report — ${report.name}`}
      description={`A leadership brief for ${scopeLabel}, followed by risk-ordered detail. Jira links remain clickable.`}
      onClose={busy ? undefined : onClose}
      size="xl"
      footer={
        <>
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
              {pageType} · {pageIndex + 1} of {totalPages}
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
          <Button onClick={handleExport} disabled={busy}>
            {busy ? <Spinner /> : <Download />}
            {busy ? `Exporting ${totalPages} pages…` : "Export executive PDF"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 rounded-xl border border-border-subtle bg-muted/35 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Report contents</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Executive brief and team detail are included. The operational oldest-open list is optional.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <Checkbox
                checked={includeOldest}
                disabled={busy}
                onChange={(event) => setIncludeOldest(event.target.checked)}
              />
              Include oldest-open appendix
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Show
              <Select
                aria-label="Oldest-open bug limit"
                value={oldestLimit}
                disabled={busy || !includeOldest}
                onChange={(event) => setOldestLimit(Number(event.target.value))}
                className="h-8 w-20 text-xs"
              >
                {OLDEST_LIMITS.map((limit) => (
                  <option key={limit} value={limit}>
                    {limit}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <DialogError>{error}</DialogError>

        <div className="rounded-xl border border-border-subtle bg-[#e9eef3] p-2 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
            <span>Responsive preview · A4 landscape</span>
            <span className="font-semibold text-foreground">Internal</span>
          </div>
          <LandscapePreview>{renderPage(pages[pageIndex], pageIndex)}</LandscapePreview>
        </div>
      </div>

      <div
        ref={offScreenRef}
        className="pointer-events-none fixed top-0 -left-[20000px]"
        aria-hidden="true"
      >
        {pages.map((page, index) => (
          <PrintSheet key={`${page.type}-${index}`}>{renderPage(page, index)}</PrintSheet>
        ))}
      </div>
    </Dialog>
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

function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function signed(value) {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value}`;
}

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

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function trendComparison(trend = []) {
  if (trend.length < 2) return null;
  const latest = trend.at(-1);
  const target = new Date(latest.capturedOn).getTime() - 7 * 86400000;
  const prior = trend.reduce((closest, point) => {
    if (point === latest) return closest;
    if (!closest) return point;
    return Math.abs(new Date(point.capturedOn).getTime() - target) <
      Math.abs(new Date(closest.capturedOn).getTime() - target)
      ? point
      : closest;
  }, null);
  if (!prior) return null;
  const days = Math.max(
    1,
    Math.round(
      (new Date(latest.capturedOn).getTime() - new Date(prior.capturedOn).getTime()) / 86400000,
    ),
  );
  return {
    days,
    prior,
    latest,
    openDelta: latest.count - prior.count,
    breachedDelta: latest.breachedCount - prior.breachedCount,
  };
}

function BugExecutiveSummary({
  report,
  ownerName,
  generatedAt,
  view,
  scopeLabel,
  cellHref,
  breachCellHref,
  combinedCellHref,
  reportName,
  pageNumber,
  totalPages,
}) {
  const { matrix, aging, trend } = view;
  const total = matrix.totalRow?.grandTotal ?? { count: 0, breachedCount: 0 };
  const riskTeams = sortTeamsByRisk(view.byTeam);
  const topBand = matrix.scopes[0]?.bands?.[0] ?? null;
  const topBandCount = topBand
    ? matrix.scopes.reduce(
        (sum, scope) => sum + (matrix.totalRow?.cells[scope.id]?.[topBand.key]?.count ?? 0),
        0,
      )
    : 0;
  const aging30 = (aging.buckets.at(-1)?.count ?? 0) + (aging.buckets.at(-2)?.count ?? 0);
  const comparison = trendComparison(trend);
  const topThreeBreaches = riskTeams
    .slice(0, 3)
    .reduce((sum, team) => sum + team.breachedCount, 0);
  const concentration = percent(topThreeBreaches, total.breachedCount);
  const unassigned = riskTeams.find((team) => team.isUnassigned);

  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <PrintHeader
        eyebrow="Executive bug health"
        pill="Internal"
        title={report.name}
        subtitle={`${scopeLabel} · Leadership brief`}
        meta={[
          {
            label: "Owner",
            value: ownerName || report.ownerName || "Not assigned",
            truncate: true,
          },
          { label: "Data refreshed", value: formatDateTime(report.lastRefreshedAt) },
          { label: "Generated", value: formatDateTime(generatedAt) },
        ]}
      />

      <div className="mt-3 grid grid-cols-5 gap-2.5">
        <KpiBox
          label="Total open"
          value={total.count}
          detail={`${total.breachedCount} past SLA`}
          tone="ink"
        />
        <KpiBox
          label="Past SLA"
          value={total.breachedCount}
          detail={`${percent(total.breachedCount, total.count)}% of open inventory`}
          tone="danger"
        />
        <KpiBox
          label="7-day movement"
          value={comparison ? signed(comparison.openDelta) : "—"}
          detail={comparison ? `${signed(comparison.breachedDelta)} breached over ${comparison.days}d` : "Trend still accruing"}
          tone={comparison?.openDelta > 0 ? "warn" : "positive"}
        />
        <KpiBox
          label={topBand ? `${topBand.label} open` : "Highest priority"}
          value={topBand ? topBandCount : "—"}
          detail="Highest configured severity"
          tone="info"
        />
        <KpiBox
          label="Ageing > 30d"
          value={aging30}
          detail={aging.oldest ? `Oldest is ${aging.oldest.ageDays} days` : "No dated inventory"}
          tone="warn"
        />
      </div>

      <div className="mt-3 grid h-[218px] grid-cols-[1.15fr_0.85fr] gap-3">
        <ReportPanel title="Portfolio trend" subtitle="Open inventory vs SLA">
          <PrintTrend trend={trend} />
        </ReportPanel>
        <ReportPanel title="Executive readout" subtitle="Movement and concentration">
          <div className="mt-2 grid gap-2">
            <ExecutiveReadout
              label="Trajectory"
              value={
                comparison
                  ? `${signed(comparison.openDelta)} open · ${signed(comparison.breachedDelta)} breached`
                  : "Trend still accruing"
              }
              detail={
                comparison
                  ? `Compared with ${formatShortDate(comparison.prior.capturedOn)} (${comparison.days} days)`
                  : "At least two captures are needed for movement"
              }
              tone={comparison?.openDelta > 0 ? "warn" : "neutral"}
            />
            <ExecutiveReadout
              label="Risk concentration"
              value={`${concentration}% in the top 3 teams`}
              detail={
                riskTeams[0]
                  ? `${riskTeams[0].teamName}: ${riskTeams[0].breachedCount} past SLA`
                  : "No team exposure"
              }
              tone={concentration >= 60 ? "warn" : "neutral"}
            />
            <ExecutiveReadout
              label="Ownership coverage"
              value={unassigned?.count ? `${unassigned.count} unassigned / untagged` : "All bugs mapped to teams"}
              detail={
                unassigned?.breachedCount
                  ? `${unassigned.breachedCount} of those are past SLA`
                  : "No unowned SLA exposure"
              }
              tone={unassigned?.count ? "danger" : "neutral"}
            />
          </div>
        </ReportPanel>
      </div>

      <div className="mt-3 grid h-[264px]">
        <ReportPanel title="Category and scope snapshot" subtitle="Open count with red (n) past SLA">
          <SummaryMatrix
            matrix={matrix}
            cellHref={cellHref}
            breachCellHref={breachCellHref}
            combinedCellHref={combinedCellHref}
          />
        </ReportPanel>
      </div>

      <PrintFooter
        left={`StoryBoard · ${reportName} · ${scopeLabel}`}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />
    </div>
  );
}

function summaryMatrixRows(matrix) {
  const total = matrix.rows.find((row) => row.isTotal);
  const residual = matrix.rows.find((row) => row.rowKey === UNATTRIBUTED_ROW_KEY);
  const categories = matrix.rows
    .filter((row) => !row.isTotal && row !== residual)
    .slice()
    .sort((a, b) => b.grandTotal.count - a.grandTotal.count || a.rowLabel.localeCompare(b.rowLabel));
  const selected = categories.slice(0, residual?.grandTotal.count > 0 ? 4 : 5);
  if (residual?.grandTotal.count > 0) selected.push(residual);
  return { rows: total ? [total, ...selected] : selected, omitted: matrix.rows.length - selected.length - (total ? 1 : 0) };
}

function SummaryMatrix({ matrix, cellHref, breachCellHref, combinedCellHref }) {
  const showGrandTotal = matrix.scopes.length > 1;
  const columnCount =
    matrix.scopes.reduce((count, scope) => count + scope.bands.length + 1, 0) +
    (showGrandTotal ? 1 : 0);
  const dense = columnCount > 13;
  const { rows, omitted } = summaryMatrixRows(matrix);

  return (
    <div className="mt-1.5">
      <table className={cn("w-full table-fixed border-collapse", dense ? "text-[8px]" : "text-[9px]") }>
        <thead>
          <tr className="text-[#475569]">
            <th className="w-[132px] border-b border-[#cbd5e1] px-2 py-1.5 text-left" rowSpan={2}>
              Category
            </th>
            {matrix.scopes.map((scope) => (
              <th
                key={scope.id}
                colSpan={scope.bands.length + 1}
                className="border-b border-l border-[#e2e8f0] px-1 py-1.5 text-center font-extrabold"
              >
                {scope.name}
              </th>
            ))}
            {showGrandTotal ? (
              <th className="border-b border-l-2 border-[#cbd5e1] px-1 py-1.5 text-right" rowSpan={2}>
                Total
              </th>
            ) : null}
          </tr>
          <tr className="text-[#64748b]">
            {matrix.scopes.flatMap((scope) => [
              ...scope.bands.map((band) => (
                <th
                  key={`${scope.id}-${band.key}`}
                  className="border-b border-l border-[#e2e8f0] px-1 py-1.5 text-right font-bold"
                >
                  {band.label}
                </th>
              )),
              <th
                key={`${scope.id}-total`}
                className="border-b border-l border-[#e2e8f0] px-1 py-1.5 text-right font-extrabold"
              >
                Total
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.rowKey}
              className={row.isTotal ? "font-extrabold" : ""}
              style={{ backgroundColor: row.isTotal ? "#eef2ff" : index % 2 ? "#f8fafc" : "#ffffff" }}
            >
              <th className="h-[28px] truncate border-b border-[#e2e8f0] px-2 text-left font-semibold">
                {row.rowLabel}
              </th>
              {matrix.scopes.flatMap((scope) => [
                ...scope.bands.map((band) => (
                  <MatrixCell
                    key={`${row.rowKey}-${scope.id}-${band.key}`}
                    cell={row.cells[scope.id]?.[band.key]}
                    href={cellHref(scope.id, row.rowKey, band.key)}
                    breachHref={breachCellHref(scope.id, row.rowKey, band.key)}
                  />
                )),
                <MatrixCell
                  key={`${row.rowKey}-${scope.id}-total`}
                  cell={row.cells[scope.id]?.[SCOPE_TOTAL_BAND_KEY]}
                  href={cellHref(scope.id, row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                  breachHref={breachCellHref(scope.id, row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                  bold
                />,
              ])}
              {showGrandTotal ? (
                <MatrixCell
                  cell={row.grandTotal}
                  href={combinedCellHref(row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                  breachHref={combinedCellHref(row.rowKey, SCOPE_TOTAL_BAND_KEY, true)}
                  strongDivider
                  bold
                />
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex items-center justify-between text-[9px] text-[#64748b]">
        <span>
          <strong className="font-extrabold" style={{ color: RED }}>(n)</strong> past SLA
        </span>
        {omitted > 0 ? <span>Top categories shown · {omitted} more in team detail</span> : null}
      </p>
    </div>
  );
}

function MatrixCell({ cell, href, breachHref, bold, strongDivider }) {
  if (!cell || cell.count === 0) {
    return (
      <td
        className={cn(
          "h-[28px] border-b border-l border-[#e2e8f0] px-1 text-right text-[#cbd5e1]",
          strongDivider && "border-l-2 border-l-[#cbd5e1]",
        )}
      >
        —
      </td>
    );
  }
  return (
    <td
      className={cn(
        "h-[28px] border-b border-l border-[#e2e8f0] px-1 text-right tabular-nums",
        bold && "font-extrabold",
        strongDivider && "border-l-2 border-l-[#cbd5e1]",
      )}
    >
      {href ? (
        <a href={href} className="text-[#0f172a] underline decoration-[#94a3b8] underline-offset-2">
          {cell.count}
        </a>
      ) : (
        cell.count
      )}
      {cell.breachedCount > 0 ? (
        breachHref ? (
          <a
            href={breachHref}
            className="ml-1.5 font-extrabold underline decoration-[#fda4af] underline-offset-1"
            style={{ color: RED }}
          >
            ({cell.breachedCount})
          </a>
        ) : (
          <span className="ml-1.5 font-extrabold" style={{ color: RED }}>
            ({cell.breachedCount})
          </span>
        )
      ) : null}
    </td>
  );
}

const TREND_W = 610;
const TREND_H = 164;
const TREND_PAD = { top: 14, right: 48, bottom: 38, left: 32 };

function niceTrendStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (multiple * pow >= raw) return multiple * pow;
  }
  return 10 * pow;
}

function PrintTrend({ trend }) {
  if (!trend || trend.length < 2) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-[#cbd5e1] px-4 py-8 text-center text-[9px] text-[#475569]">
        Trend accrues on refresh. At least two captures are needed before movement can be shown.
      </div>
    );
  }

  const innerWidth = TREND_W - TREND_PAD.left - TREND_PAD.right;
  const innerHeight = TREND_H - TREND_PAD.top - TREND_PAD.bottom;
  const peak = Math.max(...trend.map((point) => point.count), 1);
  const step = niceTrendStep(peak / 3);
  const tickMax = Math.ceil(peak / step) * step;
  const ticks = [];
  for (let value = 0; value <= tickMax; value += step) ticks.push(value);
  const x = (index) => TREND_PAD.left + (index / (trend.length - 1)) * innerWidth;
  const y = (value) => TREND_PAD.top + innerHeight - (value / tickMax) * innerHeight;
  const countPoints = trend.map((point, index) => ({ x: x(index), y: y(point.count) }));
  const breachPoints = trend.map((point, index) => ({ x: x(index), y: y(point.breachedCount) }));
  const first = trend[0];
  const last = trend.at(-1);
  const labelCollision = Math.abs(y(last.count) - y(last.breachedCount)) < 13;

  return (
    <>
      <svg
        viewBox={`0 0 ${TREND_W} ${TREND_H}`}
        className="mt-1.5 h-[148px] w-full"
        role="img"
        aria-label={`Open bugs ${last.count}, ${last.breachedCount} past SLA`}
      >
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={TREND_PAD.left}
              x2={TREND_W - TREND_PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text x={TREND_PAD.left - 6} y={y(value) + 3} textAnchor="end" fill="#94a3b8" fontSize="9">
              {value}
            </text>
          </g>
        ))}
        <path d={smoothAreaPath(countPoints, y(0))} fill="#ecfeff" />
        <path d={smoothLinePath(countPoints)} fill="none" stroke={CYAN} strokeWidth="2" strokeLinecap="round" />
        <path d={smoothLinePath(breachPoints)} fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" />
        {trend.map((point, index) => (
          <g key={`${point.capturedOn}-${index}`}>
            <circle cx={x(index)} cy={y(point.count)} r="2.5" fill={CYAN} stroke="#ffffff" strokeWidth="1.25" />
            {point.breachedCount > 0 ? (
              <circle cx={x(index)} cy={y(point.breachedCount)} r="2.5" fill={RED} stroke="#ffffff" strokeWidth="1.25" />
            ) : null}
          </g>
        ))}
        <text x={TREND_W - TREND_PAD.right + 7} y={y(last.count) + 3} fill={INK} fontSize="10" fontWeight="700">
          {last.count}
        </text>
        <text
          x={TREND_W - TREND_PAD.right + 7}
          y={y(last.breachedCount) + (labelCollision ? 14 : 3)}
          fill={RED}
          fontSize="10"
          fontWeight="700"
        >
          {last.breachedCount}
        </text>
        <text
          x={TREND_PAD.left}
          y={TREND_H - 10}
          dominantBaseline="middle"
          fill="#94a3b8"
          fontSize="9"
        >
          {formatShortDate(first.capturedOn)}
        </text>
        <text
          x={TREND_W - TREND_PAD.right}
          y={TREND_H - 10}
          dominantBaseline="middle"
          textAnchor="end"
          fill="#94a3b8"
          fontSize="9"
        >
          {formatShortDate(last.capturedOn)}
        </text>
      </svg>
      <p className="mt-1 flex h-3 items-center gap-3 text-[8px] leading-3 text-[#475569]">
        <span className="flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-[#06b6d4]" /> Open
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-[#e11d48]" /> Past SLA
        </span>
      </p>
    </>
  );
}

function BugTeamAppendix({
  sections,
  browseHref,
  keysFilterHref,
  reportName,
  scopeLabel,
  pageNumber,
  totalPages,
  title = "Team risk appendix",
  caption = "Highest SLA exposure first · Jira-linked detail",
  subgroupNoun = "developer",
}) {
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          {title}
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">{caption}</p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {sections.map((section) => (
          <TeamSection
            key={`${section.team.key}-${section.continued ? "continued" : "start"}`}
            section={section}
            browseHref={browseHref}
            keysFilterHref={keysFilterHref}
            subgroupNoun={subgroupNoun}
          />
        ))}
      </div>

      <PrintFooter
        left={`StoryBoard · ${reportName} · ${scopeLabel}`}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />
    </div>
  );
}

function TeamSection({ section, browseHref, keysFilterHref, subgroupNoun = "developer" }) {
  const { team } = section;
  const teamKeys = team.developers.flatMap((developer) =>
    developer.issues.map((issue) => issue.jiraKey),
  );
  const teamHref = keysFilterHref(teamKeys);

  return (
    <section>
      <div className="flex h-[52px] items-center justify-between rounded-lg border border-[#e2e8f0] border-t-[3px] border-t-[#7c3aed] bg-[#f5f7fb] px-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[14px] font-extrabold">
              {teamHref ? (
                <a href={teamHref} className="text-[#0f172a] underline decoration-[#94a3b8] underline-offset-2">
                  {team.teamName}
                </a>
              ) : (
                team.teamName
              )}
            </h4>
            {team.teamKey ? (
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#64748b]">
                {team.teamKey}
              </span>
            ) : null}
            {section.continued ? (
              <span className="rounded-full border border-[#cbd5e1] bg-white px-1.5 py-0.5 text-[7px] font-extrabold tracking-[0.08em] text-[#64748b] uppercase">
                Continued
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[8px] text-[#64748b]">
            {team.developers.length} {subgroupNoun}{team.developers.length === 1 ? "" : "s"} · {percent(team.breachedCount, team.count)}% breach rate
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-4 text-right tabular-nums">
          <div>
            <strong className="text-[18px] font-black text-[#0f172a]">{team.count}</strong>
            <span className="ml-1 text-[8px] font-bold text-[#64748b]">open</span>
          </div>
          <div>
            <strong className="text-[18px] font-black text-[#e11d48]">{team.breachedCount}</strong>
            <span className="ml-1 text-[8px] font-bold text-[#e11d48]">past SLA</span>
          </div>
        </div>
      </div>
      <div className="mt-2 grid h-6 grid-cols-[82px_minmax(0,1fr)_132px_104px_58px] items-center border-b border-[#cbd5e1] px-2 text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
        <span>Jira key</span>
        <span>Issue summary</span>
        <span>Jira status</span>
        <span>Priority</span>
        <span className="text-right">SLA</span>
      </div>

      {section.developers.map((group) => {
        const developerHref = keysFilterHref(
          group.developer.issues.map((issue) => issue.jiraKey),
        );
        return (
          <div key={`${group.developer.name}-${group.continued ? "continued" : "start"}`}>
            <div className="flex h-6 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-2 text-[8px]">
              <div className="min-w-0 truncate font-bold text-[#334155]">
                {developerHref ? (
                  <a href={developerHref} className="underline decoration-[#94a3b8] underline-offset-2">
                    {group.developer.name}
                  </a>
                ) : (
                  group.developer.name
                )}
                {group.continued ? <span className="ml-1 font-medium text-[#94a3b8]">(continued)</span> : null}
              </div>
              <span className="ml-4 shrink-0 text-[#64748b] tabular-nums">
                {group.developer.count} bugs
                {group.developer.breachedCount > 0 ? (
                  <span className="ml-1 font-bold text-[#e11d48]">· {group.developer.breachedCount} past SLA</span>
                ) : null}
              </span>
            </div>
            {group.issues.map((issue, issueIndex) => (
              <div
                key={`${issue.scopeId}-${issue.jiraKey}`}
                className="grid h-[34px] grid-cols-[82px_minmax(0,1fr)_132px_104px_58px] items-center border-b border-[#eef2f7] px-2 text-[9px]"
                style={{ backgroundColor: issueIndex % 2 ? "#f8fafc" : "#ffffff" }}
              >
                <span>
                  <KeyLink jiraKey={issue.jiraKey} href={browseHref(issue.jiraKey)} />
                </span>
                <span className="line-clamp-2 pr-3 leading-[12px] text-[#334155]">{issue.title}</span>
                <span className="min-w-0 pr-3">
                  <span className="block truncate rounded bg-[#f1f5f9] px-2 py-1 text-[8px] font-bold text-[#475569]">
                    {issue.jiraStatus || "Unknown"}
                  </span>
                </span>
                <span className="truncate pr-2 text-[#64748b]">{issue.priority ?? "No priority"}</span>
                <span className="text-right font-bold tabular-nums">
                  {issue.daysOverSla !== null ? (
                    <span className="text-[#e11d48]">+{issue.daysOverSla}d</span>
                  ) : (
                    <span className="font-medium text-[#94a3b8]">Within</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function BugOldestAppendix({
  rows,
  startIndex,
  totalCount,
  generatedAt,
  browseHref,
  reportName,
  scopeLabel,
  pageNumber,
  totalPages,
}) {
  const asOf = new Date(generatedAt);
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Optional appendix · Oldest open bugs
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">
          {startIndex + 1}–{startIndex + rows.length} of {totalCount} selected · Click a Jira key to open it
        </p>
      </div>
      <table className="mt-3 w-full table-fixed border-collapse text-[9px]">
        <thead>
          <tr className="h-[30px] bg-[#f1f5f9] text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            <th className="w-[88px] border-b border-[#cbd5e1] px-2 text-left">Key</th>
            <th className="border-b border-[#cbd5e1] px-2 text-left">Summary</th>
            <th className="w-[150px] border-b border-[#cbd5e1] px-2 text-left">Status</th>
            <th className="w-[100px] border-b border-[#cbd5e1] px-2 text-left">Priority</th>
            <th className="w-[150px] border-b border-[#cbd5e1] px-2 text-left">Assignee</th>
            <th className="w-[54px] border-b border-[#cbd5e1] px-2 text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((issue, index) => {
            const created = issue.jiraCreatedAt ? new Date(issue.jiraCreatedAt) : null;
            const ageDays = created && !Number.isNaN(created.getTime())
              ? Math.floor((asOf.getTime() - created.getTime()) / 86400000)
              : null;
            return (
              <tr key={`${issue.scopeId}-${issue.jiraKey}`} className="h-[42px]" style={{ backgroundColor: index % 2 ? "#f8fafc" : "#ffffff" }}>
                <td className="border-b border-[#e2e8f0] px-2">
                  <KeyLink jiraKey={issue.jiraKey} href={browseHref(issue.jiraKey)} />
                </td>
                <td className="border-b border-[#e2e8f0] px-2">
                  <span className="line-clamp-2 leading-[12px] text-[#334155]">{issue.title}</span>
                </td>
                <td className="border-b border-[#e2e8f0] px-2 text-[#475569]">{issue.jiraStatus}</td>
                <td className="border-b border-[#e2e8f0] px-2 text-[#475569]">{issue.priority ?? "No priority"}</td>
                <td className="border-b border-[#e2e8f0] px-2 text-[#64748b]">{issue.assigneeName ?? "Unassigned"}</td>
                <td className="border-b border-[#e2e8f0] px-2 text-right font-bold tabular-nums">
                  {ageDays === null ? "—" : `${ageDays}d`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PrintFooter
        left={`StoryBoard · ${reportName} · ${scopeLabel}`}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />
    </div>
  );
}
