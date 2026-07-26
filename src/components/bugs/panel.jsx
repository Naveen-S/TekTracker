import { cn } from "@/lib/utils";

/**
 * The single panel shell for every /bugs section (charts, lists, matrix).
 *
 * Consolidates what were two near-identical local `Panel` copies in bug-charts.jsx and
 * bug-lists.jsx that had drifted apart (mb-4 vs mb-3 header rhythm) — one shell, one rhythm, so a
 * column of panels reads as one system. The optional icon tile is the metric-card idiom
 * (`grid size-7 place-items-center rounded-md` + soft tone tint) reused at panel scale, which is
 * what ties these sections to the KPI row above them.
 *
 * Server component.
 */
const toneTile = {
  brand: "bg-accent text-accent-foreground",
  danger: "bg-danger-soft text-danger-strong",
  warn: "bg-warn-soft text-warn-strong",
  info: "bg-info-soft text-info-strong",
  neutral: "bg-muted text-secondary-foreground",
};

export function Panel({ title, subtitle, icon: Icon, tone = "neutral", aside, className, children }) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card p-5", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-md",
                toneTile[tone] ?? toneTile.neutral,
              )}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      {children}
    </section>
  );
}
