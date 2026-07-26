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

/**
 * `lead` promotes a card to the row's headline: it spans two columns and steps the numeral up a
 * size. Five identically-weighted cards give "Total open bugs" exactly the same voice as
 * "Unmapped status" — a hygiene footnote — so the row has no entry point. One lead card gives the
 * eye somewhere to land first and lets the rest read as its supporting detail.
 */
function Card({ label, icon: Icon, tone = "neutral", value, detail, delta, deltaTitle, lead }) {
  return (
    <article
      className={cn(
        "relative flex flex-col gap-1.5 overflow-hidden rounded-lg border bg-card p-4 pt-4.5 transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-sm",
        lead && "sm:col-span-2 lg:col-span-1 xl:col-span-2",
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-0.75", toneStripe[tone])} aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", toneTile[tone])} aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</p>
      </div>
      <p
        className={cn(
          "mt-1 flex items-baseline gap-2 font-display leading-none font-extrabold tracking-tight tabular-nums",
          lead ? "text-[38px]" : "text-[26px]",
        )}
      >
        {value}
        {delta !== null && delta !== undefined && delta !== 0 && (
          <span
            title={deltaTitle}
            className={cn(
              "text-xs font-bold whitespace-nowrap",
              delta > 0 ? "text-danger" : "text-success",
            )}
          >
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

  const since = diff.priorDate
    ? `since the previous capture on ${new Date(diff.priorDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })}`
    : undefined;

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      aria-label="Bug report summary metrics"
    >
      <Card
        lead
        label="Total open bugs"
        icon={Bug}
        tone="brand"
        value={total.grandTotal.count}
        delta={diff.priorDate ? totalDelta : null}
        deltaTitle={since}
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
        deltaTitle={since}
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
