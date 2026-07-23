import { AlertTriangle, Bug, Clock, Flame, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SCOPE_TOTAL_BAND_KEY,
  TOTAL_ROW_KEY,
  UNATTRIBUTED_ROW_KEY,
} from "@/lib/bug-report/matrix.mjs";

/**
 * Headline stat cards (gm-bug-report.md (g)2) — the MetricGrid card treatment (3px tone stripe,
 * icon tile, display numerals) reused for bug counts. Server component.
 *
 * Deltas come from the previous CAPTURE, not "yesterday" — snapshot gaps are never zero-filled.
 */
const toneStripe = {
  brand: "bg-primary",
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-info",
  neutral: "bg-border-strong",
};

const toneTile = {
  brand: "bg-accent text-accent-foreground",
  danger: "bg-danger-soft text-danger-strong",
  warn: "bg-warn-soft text-warn-strong",
  info: "bg-info-soft text-info-strong",
  neutral: "bg-muted text-secondary-foreground",
};

function Card({ label, icon: Icon, tone = "neutral", value, detail, delta }) {
  return (
    <article className="relative flex flex-col gap-1.5 overflow-hidden rounded-lg border bg-card p-4 pt-4.5 transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-sm">
      <span className={cn("absolute inset-x-0 top-0 h-0.75", toneStripe[tone])} aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", toneTile[tone])} aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 flex items-baseline gap-2 font-display text-[26px] leading-none font-extrabold tracking-tight">
        {value}
        {delta !== null && delta !== undefined && delta !== 0 && (
          <span className={cn("text-xs font-bold", delta > 0 ? "text-danger" : "text-success")}>
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export function BugKpiCards({ matrix, diff, aging }) {
  const total = matrix.totalRow;
  if (!total) return null;

  const residual = matrix.rows.find((row) => row.rowKey === UNATTRIBUTED_ROW_KEY);

  // The highest-severity band is the first configured one (sortOrder) — usually P0.
  const topBand = matrix.scopes[0]?.bands?.[0] ?? null;
  const topBandCount = topBand
    ? matrix.scopes.reduce(
        (sum, scope) => sum + (total.cells[scope.id]?.[topBand.key]?.count ?? 0),
        0,
      )
    : 0;

  const totalDelta = matrix.scopes.reduce((sum, scope) => {
    const d = diff.delta(TOTAL_ROW_KEY, scope.id, SCOPE_TOTAL_BAND_KEY);
    return d ? sum + d.count : sum;
  }, 0);
  const breachDelta = matrix.scopes.reduce((sum, scope) => {
    const d = diff.delta(TOTAL_ROW_KEY, scope.id, SCOPE_TOTAL_BAND_KEY);
    return d ? sum + d.breachedCount : sum;
  }, 0);

  const oldBugs = (aging.buckets.at(-1)?.count ?? 0) + (aging.buckets.at(-2)?.count ?? 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card
        label="Total open bugs"
        icon={Bug}
        tone="brand"
        value={total.grandTotal.count}
        delta={diff.priorDate ? totalDelta : null}
        detail={matrix.scopes
          .map((scope) => `${scope.name} ${total.cells[scope.id]?.[SCOPE_TOTAL_BAND_KEY]?.count ?? 0}`)
          .join(" · ")}
      />
      <Card
        label="SLA breached"
        icon={Flame}
        tone="danger"
        value={total.grandTotal.breachedCount}
        delta={diff.priorDate ? breachDelta : null}
        detail={
          total.grandTotal.count > 0
            ? `${Math.round((total.grandTotal.breachedCount / total.grandTotal.count) * 100)}% of open bugs`
            : "no open bugs"
        }
      />
      {topBand && (
        <Card
          label={`${topBand.label} open`}
          icon={AlertTriangle}
          tone={topBandCount > 0 ? "warn" : "neutral"}
          value={topBandCount}
          detail={`highest-severity band (${topBand.label})`}
        />
      )}
      <Card
        label="Ageing over 30 days"
        icon={Clock}
        tone={oldBugs > 0 ? "info" : "neutral"}
        value={oldBugs}
        detail={aging.oldest ? `oldest ${aging.oldest.ageDays}d — ${aging.oldest.jiraKey}` : "no dated bugs"}
      />
      <Card
        label="Unmapped status"
        icon={HelpCircle}
        tone={residual && residual.grandTotal.count > 0 ? "warn" : "neutral"}
        value={residual?.grandTotal.count ?? 0}
        detail={
          residual
            ? "not matched by any category — map the status in admin"
            : "every status maps to a category"
        }
      />
    </div>
  );
}
