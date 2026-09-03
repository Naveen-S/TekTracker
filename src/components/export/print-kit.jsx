/**
 * Shared print primitives for the app's leadership PDF exports (the /bugs Executive Bug Report
 * design system, extracted so the sprint export and any future export render as one family).
 *
 * These are pure presentational components — no hooks, no browser APIs — captured into a PDF by
 * html2canvas-pro. They hardcode the print palette (print-theme.mjs) rather than theme tokens so
 * the sheet looks the same regardless of the viewer's active app theme. `PrintSheet` is a fixed
 * A4 box (default landscape) whose `mt-auto` footer pins to the bottom of the page.
 */
import { cn } from "@/lib/utils";
import {
  ACCENT_GRADIENT,
  KPI_TONES,
  LANDSCAPE,
  READOUT_TONES,
} from "@/lib/export/print-theme.mjs";

/** The physical A4 sheet html2canvas captures. Pass `geometry={PORTRAIT}` for a portrait page. */
export function PrintSheet({ geometry = LANDSCAPE, children }) {
  return (
    <div
      className="flex flex-col overflow-hidden bg-white px-8 py-7 font-sans antialiased"
      style={{ width: geometry.widthPx, height: geometry.heightPx }}
    >
      {children}
    </div>
  );
}

/**
 * Report header: purple eyebrow + optional pill, a big title + subtitle, a right-aligned meta grid,
 * and the signature blue->purple->magenta gradient rule pinned to the bottom edge.
 * `meta` = [{ label, value, truncate? }]; set `truncate` on values that may overflow (e.g. names).
 */
export function PrintHeader({ eyebrow, pill, title, subtitle, meta = [] }) {
  return (
    <header className="relative flex h-[82px] items-start justify-between gap-8 pb-4 text-[#0f172a]">
      <div className="min-w-0 pt-px">
        <div className="flex min-h-5 items-center gap-2.5">
          <span className="inline-flex items-center py-0.5 text-[10px] leading-[14px] font-extrabold tracking-[0.16em] uppercase text-[#7c3aed]">
            {eyebrow}
          </span>
          {pill ? (
            <span className="inline-flex min-h-5 items-center rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[8px] leading-3 font-extrabold tracking-[0.12em] text-white uppercase">
              {pill}
            </span>
          ) : null}
        </div>
        <h3 className="mt-0.5 truncate py-0.5 text-[25px] leading-[30px] font-black tracking-[-0.015em]">
          {title}
        </h3>
        {subtitle ? (
          <p className="truncate text-[10px] leading-4 font-medium text-[#64748b]">{subtitle}</p>
        ) : null}
      </div>
      {meta.length > 0 ? (
        <dl
          className="grid shrink-0 gap-x-6 text-right text-[9px]"
          style={{ gridTemplateColumns: `repeat(${meta.length}, minmax(0, 1fr))` }}
        >
          {meta.map((item) => (
            <div key={item.label}>
              <dt className="font-bold tracking-[0.08em] text-[#64748b] uppercase">{item.label}</dt>
              <dd
                className={cn(
                  "mt-1 font-bold text-[#0f172a]",
                  item.truncate ? "max-w-[150px] truncate" : "whitespace-nowrap",
                )}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] rounded-full"
        style={{ backgroundImage: ACCENT_GRADIENT }}
      />
    </header>
  );
}

/** Page footer: left provenance line, centered classification pill, right page counter. */
export function PrintFooter({ left, pill = "Internal", pageNumber, totalPages }) {
  return (
    <footer className="mt-auto grid h-[22px] grid-cols-[1fr_auto_1fr] items-end border-t border-[#e2e8f0] pt-2 text-[8px] text-[#94a3b8]">
      <span className="truncate">{left}</span>
      <span className="rounded-full bg-[#f5f3ff] px-2 py-0.5 font-extrabold tracking-[0.1em] text-[#7c3aed] uppercase">
        {pill}
      </span>
      <span className="text-right tabular-nums">
        Page {pageNumber} of {totalPages}
      </span>
    </footer>
  );
}

/** Tinted KPI tile: colored top border, soft fill, big numeral, one-line caption. */
export function KpiBox({ label, value, detail, tone = "ink" }) {
  const colors = KPI_TONES[tone] ?? KPI_TONES.ink;
  return (
    <div
      className="h-[76px] rounded-lg border border-[#e2e8f0] border-t-[3px] px-3 py-2"
      style={{ borderTopColor: colors.borderColor, backgroundColor: colors.backgroundColor }}
    >
      <p className="text-[8px] font-extrabold tracking-[0.1em] uppercase text-[#64748b]">{label}</p>
      <strong
        className="mt-1 block text-[24px] leading-none font-black tracking-tight tabular-nums"
        style={{ color: colors.color }}
      >
        {value}
      </strong>
      <span className="mt-1 block truncate text-[9px] text-[#475569]">{detail}</span>
    </div>
  );
}

/** Bordered panel with a header row (title + right-aligned subtitle). */
export function ReportPanel({ title, subtitle, children, className }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-[#e2e8f0] pb-1.5">
        <h4 className="shrink-0 text-[11px] font-black tracking-[-0.01em] text-[#0f172a]">{title}</h4>
        {subtitle ? (
          <span className="text-right text-[8px] whitespace-nowrap text-[#64748b]">{subtitle}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Left-accented readout callout inside a ReportPanel. */
export function ExecutiveReadout({ label, value, detail, tone }) {
  const colors = READOUT_TONES[tone] ?? READOUT_TONES.neutral;
  return (
    <div
      className="rounded-md border-l-[3px] px-2.5 py-1.5"
      style={{ borderLeftColor: colors.borderColor, backgroundColor: colors.backgroundColor }}
    >
      <p className="text-[7px] font-extrabold tracking-[0.1em] uppercase text-[#64748b]">{label}</p>
      <p className="mt-0.5 truncate text-[10px] font-bold text-[#0f172a]">{value}</p>
      {detail ? <p className="mt-0.5 truncate text-[8px] text-[#475569]">{detail}</p> : null}
    </div>
  );
}

/** Monospace Jira-key chip. Renders an `<a>` when `href` is given (overlayLinks makes it clickable). */
export function KeyLink({ jiraKey, href }) {
  const className =
    "inline-flex h-5 items-center whitespace-nowrap rounded border border-[#bfdbfe] bg-[#eff6ff] px-1.5 font-mono text-[9px] font-bold text-[#1e3a8a]";
  return href ? (
    <a href={href} className={className}>
      {jiraKey}
    </a>
  ) : (
    <span className={className}>{jiraKey}</span>
  );
}
