import { cn } from "@/lib/utils";
import { SCOPE_TOTAL_BAND_KEY } from "@/lib/bug-report/matrix.mjs";

/**
 * The Delivery-Matrix treatment applied to the bug report (gm-bug-report.md (g)3) — the core
 * panel. Rows are categories (Total first, residual last); columns are scope × band, each scope
 * closing with its own Total, then a grand total. Server component.
 *
 * Every cell is a Jira drill-down link built from the SAME config that produced the number
 * (`cellJql`), so "click the cell, see exactly those issues" holds by construction. Breach counts
 * ride as `n (m)` with `m` in the danger tone — the manual report's convention.
 *
 * At 5 bands × 2 scopes this is ~13 columns: the first column is frozen and the rest scroll
 * horizontally, exactly like the sprint matrix.
 */
function Cell({ cell, delta, href, breachedHref, emphasis }) {
  if (!cell || cell.count === 0) {
    return (
      <td className="border-l px-2.5 py-1.5 text-right text-sm text-muted-foreground/50 tabular-nums">
        —
      </td>
    );
  }
  const openTitle = delta
    ? `${cell.count} open · ${delta.count >= 0 ? "+" : ""}${delta.count} since previous capture`
    : `${cell.count} open`;

  return (
    <td className="border-l px-2.5 py-1.5 text-right tabular-nums">
      {/* Count and breach are SIBLING links (nested <a> is invalid HTML): the count opens the
          full cell in Jira, the (m) opens only the SLA-breached subset. */}
      <span className="inline-flex items-baseline gap-1">
        <a href={href} target="_blank" rel="noopener noreferrer" title={openTitle}
          className={cn("text-sm hover:underline", emphasis ? "font-bold" : "font-medium")}>
          {cell.count}
        </a>
        {cell.breachedCount > 0 &&
          (breachedHref ? (
            <a href={breachedHref} target="_blank" rel="noopener noreferrer"
              title={`${cell.breachedCount} SLA-breached`}
              className="text-xs font-bold text-danger hover:underline">
              ({cell.breachedCount})
            </a>
          ) : (
            <span className="text-xs font-bold text-danger">({cell.breachedCount})</span>
          ))}
        {delta && delta.count !== 0 && (
          <span className={cn("text-[10px] font-bold", delta.count > 0 ? "text-danger" : "text-success")}>
            {delta.count > 0 ? "▲" : "▼"}
            {Math.abs(delta.count)}
          </span>
        )}
      </span>
    </td>
  );
}

export function BugMatrix({ matrix, diff, scopes, buildHref, buildBreachHref }) {
  if (matrix.rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3.5">
        <div>
          <h2 className="font-display text-base font-bold">Open bugs by category</h2>
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-danger">(n)</span> = SLA-breached · every cell opens
            that exact set in Jira
            {diff.priorDate ? " · ▲▼ vs previous capture" : ""}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-200 border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th
                rowSpan={2}
                className="sticky left-0 z-1 min-w-45 bg-muted/40 px-4 py-2 text-left text-[11px] font-bold tracking-wider uppercase text-muted-foreground shadow-col"
              >
                Category
              </th>
              {scopes.map((scope) => (
                <th
                  key={scope.id}
                  colSpan={scope.bands.length + 1}
                  className="border-l px-2.5 py-2 text-center text-[11px] font-bold tracking-wider uppercase text-secondary-foreground"
                >
                  {scope.name}
                </th>
              ))}
              <th
                rowSpan={2}
                className="border-l px-3 py-2 text-right text-[11px] font-bold tracking-wider uppercase text-muted-foreground"
              >
                Total
              </th>
            </tr>
            <tr className="bg-muted/40">
              {scopes.flatMap((scope) => [
                ...scope.bands.map((band) => (
                  <th
                    key={`${scope.id}-${band.key}`}
                    className="border-l px-2.5 py-1.5 text-right text-[11px] font-semibold text-muted-foreground"
                  >
                    {band.label}
                  </th>
                )),
                <th
                  key={`${scope.id}-total`}
                  className="border-l px-2.5 py-1.5 text-right text-[11px] font-bold text-secondary-foreground"
                >
                  Total
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr
                key={row.rowKey}
                className={cn(
                  "border-t",
                  row.isTotal && "bg-accent/40 font-semibold",
                  row.isResidual && "bg-warn-soft/40",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-1 px-4 py-2 text-left text-sm font-medium shadow-col",
                    row.isTotal ? "bg-accent/40 font-bold" : row.isResidual ? "bg-warn-soft/40" : "bg-card",
                  )}
                >
                  {row.rowLabel}
                  {row.isResidual && (
                    <span className="ml-1.5 text-[10px] font-normal text-warn-strong">
                      unmapped status
                    </span>
                  )}
                </th>

                {scopes.flatMap((scope) => [
                  ...scope.bands.map((band) => (
                    <Cell
                      key={`${row.rowKey}-${scope.id}-${band.key}`}
                      cell={row.cells[scope.id]?.[band.key]}
                      delta={diff.delta(row.rowKey, scope.id, band.key)}
                      href={buildHref(scope, row.rowKey, band.key)}
                      breachedHref={buildBreachHref(scope, row.rowKey, band.key)}
                      emphasis={row.isTotal}
                    />
                  )),
                  <Cell
                    key={`${row.rowKey}-${scope.id}-total`}
                    cell={row.cells[scope.id]?.[SCOPE_TOTAL_BAND_KEY]}
                    delta={diff.delta(row.rowKey, scope.id, SCOPE_TOTAL_BAND_KEY)}
                    href={buildHref(scope, row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                    breachedHref={buildBreachHref(scope, row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                    emphasis
                  />,
                ])}

                <td className="border-l px-3 py-2 text-right tabular-nums">
                  <span className="text-sm font-bold">{row.grandTotal.count}</span>
                  {row.grandTotal.breachedCount > 0 && (
                    <span className="ml-1 text-xs font-bold text-danger">
                      ({row.grandTotal.breachedCount})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
