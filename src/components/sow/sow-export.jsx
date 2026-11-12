"use client";

/**
 * Leadership PDF of one SOW (sow-tracker.md (h)) — the page that replaces the project-plan deck.
 * Fixed A4 landscape sheets on the shared export kit: a status brief (KPIs, the phase strip,
 * epics, work by kind), the plan tracker (every phase's milestones and tasks, baseline → current),
 * risks and cross-team dependencies, and an optional ticket appendix. html2canvas-pro captures
 * the sheets and jsPDF keeps every Jira link clickable; both are event-time dynamic imports.
 * The sheets use the print palette, not theme tokens, so they look the same in either theme.
 */
import { useMemo, useRef, useState } from "react";
import { Download, FileDown } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PreviewCanvas, PreviewPager } from "@/components/export/export-dialog-kit";
import { KeyLink, KpiBox, PrintFooter, PrintHeader, PrintSheet, ReportPanel } from "@/components/export/print-kit.jsx";
import { canvasToPngBytes, captureOptions, fileStamp, overlayLinks, safeFilePart } from "@/lib/export/pdf-capture.js";
import { BLUE, GREEN, LANDSCAPE, ORANGE, PURPLE, RED } from "@/lib/export/print-theme.mjs";
import { ITEM_STATUS_LABELS, KIND_LABELS, KIND_SHORT, RISK_STATUS_LABELS, RISK_TYPE_LABELS } from "@/lib/sow/defaults.mjs";
import { formatDay } from "@/lib/sow/timeline.mjs";
import { cn } from "@/lib/utils";

const PLAN_ROWS_PER_PAGE = 22;
const TICKET_ROWS_PER_PAGE = 24;
const EPIC_ROWS = 7;
const RISK_ROWS = 9;
const DEP_ROWS = 14;

const HEALTH_TONE = { COMPLETE: "positive", ON_TRACK: "positive", AT_RISK: "warn", BEHIND: "danger", NOT_STARTED: "ink" };
const ITEM_COLOR = { NOT_STARTED: "#64748b", IN_PROGRESS: BLUE, DONE: GREEN, AT_RISK: ORANGE };
const PHASE_COLOR = { done: GREEN, active: PURPLE, upcoming: "#cbd5e1" };
const STATE_COLOR = { done: GREEN, inProgress: BLUE, todo: "#64748b" };

const pct = (value) => (value === null || value === undefined ? "—" : `${Math.round(value)}%`);
const chunk = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));

function Bar({ value, color = PURPLE }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%`, backgroundColor: color }} />
    </span>
  );
}

function StatusText({ label, color }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold whitespace-nowrap" style={{ color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function PrintJourney({ phases }) {
  return (
    <ol className="mt-2.5 flex">
      {phases.map((phase, index) => {
        const color = PHASE_COLOR[phase.state];
        const gates = phase.items.filter((item) => item.isGate && item.currentDate).slice(0, 2);
        return (
          <li key={phase.id} className="relative min-w-0 flex-1 pr-2">
            {index < phases.length - 1 && <span className="absolute top-[9px] right-0 left-5 h-0.5" style={{ backgroundColor: phase.state === "done" ? GREEN : "#e2e8f0" }} />}
            <span className="relative grid size-5 place-items-center rounded-full text-[9px] font-black text-white" style={{ backgroundColor: color }}>
              {phase.state === "done" ? "✓" : index + 1}
            </span>
            <p className="mt-1 truncate text-[10px] font-black text-[#0f172a]">{phase.name}</p>
            <p className="text-[8px] text-[#64748b] tabular-nums">
              {formatDay(phase.startDate)} – {formatDay(phase.endDate)}
            </p>
            {phase.progress.total > 0 && <p className="text-[8px] font-bold text-[#475569] tabular-nums">{pct(phase.progress.pct)} · {phase.progress.done}/{phase.progress.total}</p>}
            {gates.map((gate) => (
              <p key={gate.id} className="truncate text-[8px] text-[#475569]">
                <span style={{ color: PURPLE }}>◆</span> <span className="font-bold tabular-nums">{formatDay(gate.currentDate)}</span> {gate.title}
                {gate.slip > 0 && <span className="font-bold" style={{ color: ORANGE }}> +{gate.slip}d</span>}
              </p>
            ))}
          </li>
        );
      })}
    </ol>
  );
}

function BriefPage({ view, browseHref }) {
  const { progress, health, launch, phases, risks } = view;
  const epics = progress.epics.slice(0, EPIC_ROWS);
  const openRisks = risks.filter((risk) => risk.status === "OPEN");
  // Counts only: the pre-QA Slack text never leaves the signed-in page (round 2, decision 9).
  const openIssues = view.funnel.reduce((sum, stage) => sum + stage.open, 0);
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-5 gap-3">
        <KpiBox label="Weighted progress" value={pct(progress.overall.pct)} detail={`${progress.overall.done} of ${progress.overall.total} tickets done`} tone="info" />
        <KpiBox label={launch.daysLeft >= 0 ? `Days to ${launch.title}` : launch.title} value={Math.abs(launch.daysLeft)} detail={formatDay(launch.date, { year: true })} />
        <KpiBox label="Health" value={health.label} detail={health.reasons[0] ?? "No flags raised"} tone={HEALTH_TONE[health.key]} />
        <KpiBox label="Open issues" value={openIssues} detail={view.funnel.map((stage) => `${stage.open} ${stage.label}`).join(" · ")} tone={openIssues > 0 ? "danger" : "ink"} />
        <KpiBox label="Launch slip" value={`${launch.slip > 0 ? "+" : ""}${launch.slip} d`} detail={launch.worstSlip ? `Largest: ${launch.worstSlip.title} +${launch.worstSlip.days} d` : "Every date on baseline"} tone={launch.slip > 0 ? "warn" : "positive"} />
      </div>

      <ReportPanel title="Journey" subtitle={`Today ${formatDay(view.today, { year: true })} · ◆ gate milestone`}>
        <PrintJourney phases={phases} />
      </ReportPanel>

      <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-3">
        <ReportPanel title="Epics" subtitle="Weighted progress of each epic's tickets">
          <table className="mt-1.5 w-full table-fixed text-[9px] text-[#0f172a]">
            <tbody>
              {epics.map((epic) => (
                <tr key={epic.key} className="border-b border-[#f1f5f9] last:border-0">
                  <td className="w-[78px] py-1.5"><KeyLink jiraKey={epic.key} href={browseHref(epic.key)} /></td>
                  <td className="truncate py-1.5 pr-2 font-semibold">{epic.summary}</td>
                  <td className="w-[110px] py-1.5"><Bar value={epic.pct} /></td>
                  <td className="w-[34px] py-1.5 text-right font-black tabular-nums">{pct(epic.pct)}</td>
                  <td className="w-[92px] py-1.5 text-right text-[8px] text-[#64748b] tabular-nums">{epic.done}/{epic.total} done · {epic.inProgress} wip</td>
                </tr>
              ))}
            </tbody>
          </table>
          {progress.epics.length === 0 && <p className="mt-2 text-[9px] text-[#64748b]">No epics in the Jira source yet.</p>}
          {progress.epics.length > EPIC_ROWS && <p className="mt-1 text-[8px] text-[#64748b]">+{progress.epics.length - EPIC_ROWS} more epics on the SOW page</p>}
        </ReportPanel>

        <div className="flex min-h-0 flex-col gap-3">
          <ReportPanel title="Work by kind" subtitle="done / total · weight">
            <div className="mt-1.5 flex flex-col gap-1.5">
              {progress.byKind.map((entry) => (
                <div key={entry.kind} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-[9px] text-[#0f172a]">
                  <span className="truncate font-semibold">{KIND_LABELS[entry.kind]}</span>
                  <Bar value={entry.total > 0 ? (entry.done / entry.total) * 100 : 0} color={GREEN} />
                  <span className="text-right text-[8px] text-[#64748b] tabular-nums">
                    {entry.done}/{entry.total}{entry.kind !== "EPIC" && ` · ×${entry.weight}`}
                  </span>
                </div>
              ))}
            </div>
          </ReportPanel>
          <ReportPanel title="Open risks, blockers & decisions" subtitle={`${openRisks.length} open`} className="min-h-0 flex-1">
            <ul className="mt-1.5 flex flex-col gap-1">
              {openRisks.slice(0, 4).map((risk) => (
                <li key={risk.id} className="flex items-baseline gap-1.5 text-[9px] text-[#0f172a]">
                  <span className="shrink-0 text-[7px] font-extrabold tracking-[0.08em] uppercase" style={{ color: risk.type === "BLOCKER" ? RED : risk.type === "RISK" ? ORANGE : BLUE }}>
                    {RISK_TYPE_LABELS[risk.type]}
                  </span>
                  <span className="truncate">{risk.title}</span>
                </li>
              ))}
              {openRisks.length === 0 && <li className="text-[9px] text-[#64748b]">None open.</li>}
              {openRisks.length > 4 && <li className="text-[8px] text-[#64748b]">+{openRisks.length - 4} more on the risks page</li>}
            </ul>
          </ReportPanel>
        </div>
      </div>
    </div>
  );
}

function PlanPage({ rows, browseHref }) {
  return (
    <ReportPanel title="Plan tracker" subtitle="Baseline = first committed date · Current = today's date" className="mt-3">
      <table className="mt-1 w-full table-fixed text-[9px] text-[#0f172a]">
        <thead>
          <tr className="text-left text-[7px] font-extrabold tracking-[0.1em] text-[#64748b] uppercase">
            <th className="py-1.5 font-extrabold">Task</th>
            <th className="w-[84px] font-extrabold">Status</th>
            <th className="w-[66px] font-extrabold">Baseline</th>
            <th className="w-[66px] font-extrabold">Current</th>
            <th className="w-[48px] font-extrabold">Slip</th>
            <th className="w-[300px] font-extrabold">Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.type === "phase" ? (
              <tr key={row.key} className="bg-[#f5f3ff]">
                <td colSpan={6} className="h-[24px] px-2 text-[9px] font-black">
                  {row.phase.name}
                  <span className="ml-2 font-medium text-[#64748b] tabular-nums">
                    {formatDay(row.phase.startDate)} – {formatDay(row.phase.endDate)}{row.continued && " · continued"}
                  </span>
                </td>
              </tr>
            ) : (
              <tr key={row.key} className="border-b border-[#f1f5f9]">
                <td className="h-[24px] truncate pr-2 pl-2">
                  {row.item.isGate && <span style={{ color: PURPLE }}>◆ </span>}
                  <span className={cn(row.item.isGate && "font-bold")}>{row.item.title}</span>
                  {row.item.linked && (
                    <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
                      <KeyLink jiraKey={row.item.linked.key} href={browseHref(row.item.linked.key)} />
                      <span className="font-black tabular-nums">{pct(row.item.linked.pct)}</span>
                    </span>
                  )}
                </td>
                <td><StatusText label={ITEM_STATUS_LABELS[row.item.status]} color={ITEM_COLOR[row.item.status]} /></td>
                <td className="text-[#64748b] tabular-nums">{formatDay(row.item.baselineDate)}</td>
                <td className="font-bold tabular-nums" style={row.item.overdue ? { color: RED } : undefined}>{formatDay(row.item.currentDate)}</td>
                <td className="font-bold tabular-nums" style={{ color: row.item.slip > 0 ? ORANGE : "#94a3b8" }}>
                  {row.item.slip ? `${row.item.slip > 0 ? "+" : ""}${row.item.slip} d` : "—"}
                </td>
                <td className="truncate text-[#475569]">{row.item.overdue ? "Past due. " : ""}{row.item.comment ?? ""}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </ReportPanel>
  );
}

function TicketTable({ rows, browseHref }) {
  return (
    <table className="mt-1 w-full table-fixed text-[9px] text-[#0f172a]">
      <tbody>
        {rows.map((issue) => (
          <tr key={issue.key} className="border-b border-[#f1f5f9] last:border-0">
            <td className="h-[24px] w-[84px]"><KeyLink jiraKey={issue.key} href={browseHref(issue.key)} /></td>
            <td className="truncate pr-2">{issue.summary}</td>
            <td className="w-[74px] text-[8px] font-bold text-[#64748b] uppercase">{KIND_SHORT[issue.kind]}</td>
            <td className="w-[110px] truncate text-[#475569]">{issue.assigneeName ?? "Unassigned"}</td>
            <td className="w-[110px]"><StatusText label={issue.status} color={STATE_COLOR[issue.state]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RisksPage({ view, browseHref }) {
  const deps = view.issues.filter((issue) => issue.isDependency);
  return (
    <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-3">
      <ReportPanel title="Risks, blockers & decisions" subtitle={`${view.risks.filter((risk) => risk.status === "OPEN").length} open of ${view.risks.length}`}>
        <ul className="mt-1.5 flex flex-col">
          {view.risks.slice(0, RISK_ROWS).map((risk) => (
            <li key={risk.id} className="border-b border-[#f1f5f9] py-1.5 text-[9px] text-[#0f172a] last:border-0">
              <p className="flex items-baseline gap-1.5">
                <span className="shrink-0 text-[7px] font-extrabold tracking-[0.08em] uppercase" style={{ color: risk.type === "BLOCKER" ? RED : risk.type === "RISK" ? ORANGE : BLUE }}>{RISK_TYPE_LABELS[risk.type]}</span>
                <span className="min-w-0 flex-1 font-semibold">{risk.title}</span>
                <span className="shrink-0 text-[8px] font-bold text-[#64748b]">{RISK_STATUS_LABELS[risk.status]}</span>
              </p>
              {(risk.ownerName || risk.dueDate || risk.note) && (
                <p className="mt-0.5 truncate text-[8px] text-[#64748b]">{[risk.ownerName, risk.dueDate && `due ${formatDay(risk.dueDate)}`, risk.note].filter(Boolean).join(" · ")}</p>
              )}
            </li>
          ))}
          {view.risks.length === 0 && <li className="py-1.5 text-[9px] text-[#64748b]">Nothing recorded.</li>}
          {view.risks.length > RISK_ROWS && <li className="py-1 text-[8px] text-[#64748b]">+{view.risks.length - RISK_ROWS} more on the SOW page</li>}
        </ul>
      </ReportPanel>
      <ReportPanel title="Cross-team dependencies" subtitle={`${deps.filter((issue) => issue.state !== "done").length} open of ${deps.length}`}>
        {deps.length === 0 ? <p className="mt-2 text-[9px] text-[#64748b]">No tickets outside this SOW&apos;s own projects.</p> : <TicketTable rows={deps.slice(0, DEP_ROWS)} browseHref={browseHref} />}
        {deps.length > DEP_ROWS && <p className="mt-1 text-[8px] text-[#64748b]">+{deps.length - DEP_ROWS} more on the SOW page</p>}
      </ReportPanel>
    </div>
  );
}

/** Flatten the plan into table rows, repeating a phase header when its items spill onto a new page. */
function planPages(phases) {
  const flat = phases.flatMap((phase) => [
    { type: "phase", key: `phase-${phase.id}`, phase },
    ...phase.items.map((item) => ({ type: "item", key: `item-${item.id}`, item, phase })),
  ]);
  return chunk(flat, PLAN_ROWS_PER_PAGE).map((rows, index) =>
    index > 0 && rows[0].type === "item"
      ? [{ type: "phase", key: `phase-${rows[0].phase.id}-cont-${index}`, phase: rows[0].phase, continued: true }, ...rows]
      : rows,
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
      <div className={cn("absolute top-0 left-0 origin-top-left scale-[0.245]", "min-[375px]:scale-[0.29] min-[480px]:scale-[0.38]", "sm:scale-[0.52] md:scale-[0.63] lg:scale-[0.74]")}>
        <PrintSheet>{children}</PrintSheet>
      </div>
    </div>
  );
}

const PAGE_LABEL = { brief: "Status brief", plan: "Plan tracker", risks: "Risks & dependencies", tickets: "Ticket appendix" };

export function SowExportDialog({ view, onClose }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [includeTickets, setIncludeTickets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt] = useState(() => new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }));
  const offScreenRef = useRef(null);
  const { sow, jiraBaseUrl } = view;
  const browseHref = (key) => (jiraBaseUrl ? `${jiraBaseUrl}/browse/${key}` : null);

  const pages = useMemo(() => {
    const result = [{ type: "brief" }, ...planPages(view.phases).map((rows) => ({ type: "plan", rows }))];
    if (view.risks.length > 0 || view.issues.some((issue) => issue.isDependency)) result.push({ type: "risks" });
    if (includeTickets) {
      const tickets = view.issues.filter((issue) => issue.kind !== "EPIC");
      chunk(tickets, TICKET_ROWS_PER_PAGE).forEach((rows) => result.push({ type: "tickets", rows, total: tickets.length }));
    }
    return result;
  }, [view, includeTickets]);

  const pageIndex = Math.min(currentPage, pages.length - 1);

  const renderPage = (page, index) => (
    <>
      <PrintHeader
        eyebrow={`SOW status · ${PAGE_LABEL[page.type]}`}
        pill={sow.program?.name}
        title={sow.name}
        subtitle={sow.description ?? "SOW / program project"}
        meta={[
          { label: "Owner", value: sow.ownerName ?? "—", truncate: true },
          { label: "Launch", value: formatDay(view.launch.date, { year: true }) },
          { label: "Generated", value: generatedAt },
        ]}
      />
      {page.type === "brief" && <BriefPage view={view} browseHref={browseHref} />}
      {page.type === "plan" && <PlanPage rows={page.rows} browseHref={browseHref} />}
      {page.type === "risks" && <RisksPage view={view} browseHref={browseHref} />}
      {page.type === "tickets" && (
        <ReportPanel title="Tickets" subtitle={`${page.total} tickets, epics excluded`} className="mt-3">
          <TicketTable rows={page.rows} browseHref={browseHref} />
        </ReportPanel>
      )}
      <PrintFooter left={`StoryBoard · ${sow.name} · Jira as of ${view.meta.lastRefreshedAt ? new Date(view.meta.lastRefreshedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "never"}`} pageNumber={index + 1} totalPages={pages.length} />
    </>
  );

  const handleExport = async () => {
    setError("");
    setBusy(true);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.setProperties({ title: `${sow.name} — SOW status`, subject: "SOW status report — Internal", author: sow.ownerName || "StoryBoard", creator: "StoryBoard" });
      const capture = captureOptions(LANDSCAPE);
      const pageEls = Array.from(offScreenRef.current.children);
      for (let index = 0; index < pageEls.length; index += 1) {
        const canvas = await html2canvas(pageEls[index], capture);
        const pngBytes = await canvasToPngBytes(canvas);
        if (index > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(pngBytes, "PNG", 0, 0, LANDSCAPE.widthMm, LANDSCAPE.heightMm, undefined, "SLOW");
        overlayLinks(pdf, pageEls[index], LANDSCAPE);
      }
      pdf.save(`${safeFilePart(sow.slug, "sow")}_SOW_Status_${fileStamp()}.pdf`);
      onClose();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "The PDF could not be exported.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      icon={FileDown}
      hero="compact"
      size="xl"
      title={`SOW status report — ${sow.name}`}
      description="A status brief, the plan tracker with baseline and current dates, then risks and dependencies. Jira links stay clickable."
      onClose={busy ? undefined : onClose}
      footerStart={<PreviewPager index={pageIndex} total={pages.length} onChange={setCurrentPage} label={PAGE_LABEL[pages[pageIndex].type]} always />}
      footer={
        <>
          <DialogClose />
          <Button onClick={handleExport} disabled={busy}>
            {busy ? <Spinner /> : <Download />}
            {busy ? `Exporting ${pages.length} pages…` : "Export PDF"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 rounded-lg border border-border-subtle bg-subtle px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <SectionLabel>Report contents</SectionLabel>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">The brief, the plan tracker and the risks page are always included. The full ticket list is optional.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium">
            <Checkbox checked={includeTickets} disabled={busy} onChange={(event) => setIncludeTickets(event.target.checked)} />
            Include ticket appendix
          </label>
        </div>
        <DialogError>{error}</DialogError>
        <PreviewCanvas orientation="landscape">
          <LandscapePreview>{renderPage(pages[pageIndex], pageIndex)}</LandscapePreview>
        </PreviewCanvas>
      </div>
      <div ref={offScreenRef} className="pointer-events-none fixed top-0 -left-[20000px]" aria-hidden="true">
        {pages.map((page, index) => (
          <PrintSheet key={`${page.type}-${index}`}>{renderPage(page, index)}</PrintSheet>
        ))}
      </div>
    </Dialog>
  );
}
