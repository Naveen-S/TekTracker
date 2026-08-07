import { Table2 } from "lucide-react";
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
 * At 5 bands × 2 scopes this is ~13 columns, which is where a flat grid stops being readable. Three
 * devices carry the scan:
 *   1. **Scope grouping** — every scope after the first opens on a strong rule and closes with a
 *      tinted Total column, so "which universe am I in" survives a horizontal scroll. Without it
 *      the P4 │ Total │ P0 boundary between two scopes looks identical to a band boundary.
 *   2. **Magnitude heat** — a low-alpha primary wash scaled to the cell's share of its row max, so
 *      the eye lands on the big numbers first. It composites over the row tints and is never the
 *      only signal: the number itself is always there, and weight steps with it.
 *   3. **A sticky header and a row hover line**, so a long row never loses its label.
 * The first column stays frozen and the rest scroll, exactly like the sprint matrix.
 */

/**
 * Share-of-row-max → a wash + weight step. Theme-safe: `--color-primary` re-hues.
 *
 * The curve matters more than the ceiling. A linear ramp capped at 13% put almost every real cell
 * between 3% and 8% alpha — a single flat haze over the whole table that read as "faded", not as
 * heat, which is most of why this panel looked washed out. `share ** 0.7` opens the mid-range where
 * the cells actually live, and the ceiling goes to 26%; the old hard cutoff at 0.12 is gone too,
 * since it put a visible step in the middle of a continuous scale.
 */
function heat(count, rowMax) {
  if (!count || rowMax <= 0) return { style: undefined, weight: "font-medium" };
  const share = Math.min(count / rowMax, 1);
  return {
    style: {
      backgroundColor: `color-mix(in oklab, var(--color-primary) ${(share ** 0.7 * 26).toFixed(1)}%, transparent)`,
    },
    weight: share >= 0.6 ? "font-bold" : share >= 0.25 ? "font-semibold" : "font-medium",
  };
}

function Cell({ cell, delta, href, breachedHref, emphasis, rowMax, groupStart, isScopeTotal }) {
  const edge = cn(
    "px-2.5 py-1.5 text-right tabular-nums transition-colors",
    groupStart ? "border-l-2 border-l-border-strong" : "border-l",
    isScopeTotal && "bg-muted/35",
  );

  if (!cell || cell.count === 0) {
    return <td className={cn(edge, "text-sm text-muted-foreground/45")}>—</td>;
  }

  const { style, weight } = heat(cell.count, rowMax);
  const openTitle = delta
    ? `${cell.count} open · ${delta.count >= 0 ? "+" : ""}${delta.count} since previous capture`
    : `${cell.count} open`;

  return (
    <td className={edge} style={isScopeTotal ? undefined : style}>
      {/* Count and breach are SIBLING links (nested <a> is invalid HTML): the count opens the
          full cell in Jira, the (m) opens only the SLA-breached subset. */}
      <span className="inline-flex items-baseline gap-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={openTitle}
          className={cn(
            "text-sm underline-offset-2 hover:underline",
            emphasis ? "font-bold" : weight,
          )}
        >
          {cell.count}
        </a>
        {cell.breachedCount > 0 &&
          (breachedHref ? (
            <a
              href={breachedHref}
              target="_blank"
              rel="noopener noreferrer"
              title={`${cell.breachedCount} SLA-breached`}
              className="text-xs font-bold text-danger underline-offset-2 hover:underline"
            >
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

export function BugMatrix({ matrix, diff, scopes, buildHref, buildBreachHref, emphasizeScopeId = null }) {
  if (matrix.rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"
            aria-hidden="true"
          >
            <Table2 className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight font-bold">Open bugs by category</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every cell opens that exact set in Jira
              {diff.priorDate ? " · ▲▼ vs the previous capture" : ""}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] whitespace-nowrap text-muted-foreground">
          <span className="font-bold text-danger">(n)</span> past SLA
        </p>
      </header>

      {/* Capped so a long category list scrolls inside the panel and the header can pin against
          it — an overflow-x ancestor is a scroll container on both axes, which is what makes
          `sticky` work here at all (the sprint matrix precedent). */}
      <div className="max-h-[min(38rem,75vh)] overflow-auto">
        <table className="w-full min-w-200 border-collapse text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky top-0 left-0 z-3 min-w-45 bg-secondary px-4 py-2.5 text-left text-[11px] font-bold tracking-wider uppercase text-muted-foreground shadow-col"
              >
                Category
              </th>
              {scopes.map((scope, scopeIndex) => {
                // External is highlighted (enhancing-bug-board.md decision 1) in the All view only —
                // one accent channel (a dot + primary-tinted name), not a full column recolour.
                const emphasized = scope.id === emphasizeScopeId;
                return (
                  <th
                    key={scope.id}
                    colSpan={scope.bands.length + 1}
                    className={cn(
                      "sticky top-0 z-2 bg-secondary px-2.5 py-2.5 text-center text-[11px] font-bold tracking-wider uppercase",
                      emphasized ? "text-primary" : "text-secondary-foreground",
                      scopeIndex === 0 ? "border-l" : "border-l-2 border-l-border-strong",
                    )}
                  >
                    {emphasized && (
                      <span
                        className="mr-1 inline-block size-1.5 rounded-full bg-primary align-middle"
                        aria-hidden="true"
                      />
                    )}
                    {scope.name}
                  </th>
                );
              })}
              <th
                rowSpan={2}
                className="sticky top-0 z-2 border-l-2 border-l-border-strong bg-secondary px-3 py-2.5 text-right text-[11px] font-bold tracking-wider uppercase text-secondary-foreground"
              >
                Total
              </th>
            </tr>
            <tr>
              {scopes.flatMap((scope, scopeIndex) => [
                ...scope.bands.map((band, bandIndex) => (
                  <th
                    key={`${scope.id}-${band.key}`}
                    className={cn(
                      // Highest-severity band first: it carries the most weight of the group.
                      "sticky top-[2.4rem] z-2 bg-secondary px-2.5 py-1.5 text-right text-[11px]",
                      bandIndex === 0
                        ? "font-bold text-secondary-foreground"
                        : "font-semibold text-muted-foreground",
                      bandIndex === 0 && scopeIndex > 0
                        ? "border-l-2 border-l-border-strong"
                        : "border-l",
                    )}
                  >
                    {band.label}
                  </th>
                )),
                <th
                  key={`${scope.id}-total`}
                  className="sticky top-[2.4rem] z-2 border-l bg-secondary px-2.5 py-1.5 text-right text-[11px] font-bold text-secondary-foreground"
                >
                  Total
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              // Heat is relative to the row's own biggest band cell, so a small category is still
              // readable instead of being uniformly washed out by the Total row's magnitude.
              const rowMax = Math.max(
                ...scopes.flatMap((scope) =>
                  scope.bands.map((band) => row.cells[scope.id]?.[band.key]?.count ?? 0),
                ),
                0,
              );

              return (
                <tr
                  key={row.rowKey}
                  className={cn(
                    "group border-t transition-colors",
                    row.isTotal && "bg-accent/40 font-semibold",
                    row.isResidual && "bg-warn-soft/40",
                    !row.isTotal && !row.isResidual && "hover:bg-muted/40",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-1 px-4 py-2 text-left text-sm font-medium shadow-col transition-colors",
                      row.isTotal
                        ? "bg-accent/40 font-bold"
                        : row.isResidual
                          ? "bg-warn-soft/40"
                          : "bg-card group-hover:bg-muted/40",
                    )}
                  >
                    {row.rowLabel}
                    {row.isResidual && (
                      <span className="ml-1.5 text-[10px] font-normal text-warn-strong">
                        unmapped status
                      </span>
                    )}
                  </th>

                  {scopes.flatMap((scope, scopeIndex) => [
                    ...scope.bands.map((band, bandIndex) => (
                      <Cell
                        key={`${row.rowKey}-${scope.id}-${band.key}`}
                        cell={row.cells[scope.id]?.[band.key]}
                        delta={diff.delta(row.rowKey, scope.id, band.key)}
                        href={buildHref(scope, row.rowKey, band.key)}
                        breachedHref={buildBreachHref(scope, row.rowKey, band.key)}
                        emphasis={row.isTotal}
                        rowMax={rowMax}
                        groupStart={bandIndex === 0 && scopeIndex > 0}
                      />
                    )),
                    <Cell
                      key={`${row.rowKey}-${scope.id}-total`}
                      cell={row.cells[scope.id]?.[SCOPE_TOTAL_BAND_KEY]}
                      delta={diff.delta(row.rowKey, scope.id, SCOPE_TOTAL_BAND_KEY)}
                      href={buildHref(scope, row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                      breachedHref={buildBreachHref(scope, row.rowKey, SCOPE_TOTAL_BAND_KEY)}
                      emphasis
                      rowMax={rowMax}
                      isScopeTotal
                    />,
                  ])}

                  <td className="border-l-2 border-l-border-strong bg-muted/35 px-3 py-2 text-right tabular-nums">
                    <span className="text-sm font-bold">{row.grandTotal.count}</span>
                    {row.grandTotal.breachedCount > 0 && (
                      <span className="ml-1 text-xs font-bold text-danger">
                        ({row.grandTotal.breachedCount})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
