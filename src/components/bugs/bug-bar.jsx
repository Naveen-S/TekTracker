/**
 * Shared horizontal-bar primitives for the /bugs panels — the `Bar` + `Legend` that the chart
 * panels (bug-charts.jsx) and the by-scrum-team section (bug-team-section.jsx) both draw
 * (enhancing-bug-board.md (e)). Extracted verbatim so the team bars read as the same instrument as
 * the priority/category/ageing bars — one grammar, one under-rail treatment for SLA breach.
 *
 * COLOUR (dataviz skill — computed in globals.css, never picked here): `--chart-cat-1/2` are
 * categorical series identity (slot 1 = the active theme's hue); `--age-1..4` an ordinal ramp;
 * `--danger` is status, reserved for SLA breach. Server-safe (no hooks) so both server and client
 * callers can render it.
 */

/** Ordinal age ramp, oldest darkest. Literal classes so Tailwind can see them. */
export const AGE_FILL = ["bg-age-1", "bg-age-2", "bg-age-3", "bg-age-4"];
export const SCOPE_FILL = ["bg-chart-cat-1", "bg-chart-cat-2"];

/** Label-column widths for the shared `<Bar>` track — literal classes, no computed grid template. */
export const TRACK = {
  wide: "grid-cols-[minmax(6.5rem,auto)_1fr_auto]",
  band: "grid-cols-[2.5rem_1fr_auto]",
  bucket: "grid-cols-[5rem_1fr_auto]",
  team: "grid-cols-[minmax(9rem,auto)_1fr_auto]",
};

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={`size-2.5 rounded-[2px] ${item.fill}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * One horizontal bar built from ordered segments, with its value directly labelled.
 *
 * Segments are solid — a fade toward white across the bar's own length drains density exactly where
 * the eye lands (the value end). Adjacent fills are separated by the 2px surface gap the mark spec
 * asks for (`gap-0.5` on the track) rather than by a border. The optional `under` rail is the
 * SLA-breached share, in `bg-danger`.
 */
export function Bar({ label, labelNode, segments, total, max, caption, under, track = TRACK.wide }) {
  // Root is a grid `<span>` (not a `<div>`) so a `<Bar>` is valid PHRASING content — the by-team
  // drill nests it inside the expand `<button>`s; list callers still lay them out in a flex column.
  return (
    <span className={`grid items-center gap-3 ${track}`}>
      {labelNode ?? (
        <span className="truncate text-xs font-medium" title={label}>
          {label}
        </span>
      )}
      <span className="flex flex-col gap-0.5">
        <span className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
          {segments.map((segment) =>
            segment.value <= 0 ? null : (
              <span
                key={segment.key}
                title={`${segment.title ?? segment.key}: ${segment.value}`}
                // Minimum 1.5% so a count of 1 is still a visible mark rather than a hairline.
                style={{ width: `${Math.max((segment.value / max) * 100, 1.5)}%` }}
                className={`block h-full first:rounded-l-full last:rounded-r-full ${segment.fill}`}
              />
            ),
          )}
        </span>
        {under && (
          <span className="flex h-1 overflow-hidden rounded-full bg-muted">
            {under.value > 0 && (
              <span
                title={`${under.title}: ${under.value}`}
                style={{ width: `${Math.max((under.value / max) * 100, 1.5)}%` }}
                className="block h-full rounded-full bg-danger"
              />
            )}
          </span>
        )}
      </span>
      <span className="text-xs font-bold tabular-nums">
        {total}
        {caption && <span className="ml-1 font-normal text-muted-foreground">{caption}</span>}
      </span>
    </span>
  );
}
