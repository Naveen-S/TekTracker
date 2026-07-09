/**
 * Server-rendered per-team summary for /rollup (ed-rollup.md decisions 6–8) — no "use client":
 * the table is read-only, and staleness is computed from the request-time `asOf` so the render is
 * deterministic (no client Date.now(), no hydration drift). Rows sort worst health first
 * (danger > warn > info > success > neutral), then name — the ED reads problems top-down.
 */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const TONE_RANK = { danger: 0, warn: 1, info: 2, success: 3, neutral: 4 };

const BANDS = [
  { key: "done", icon: "✓", label: "Done", className: "text-emerald-600" },
  { key: "ahead", icon: "↗", label: "Ahead", className: "text-emerald-600" },
  { key: "onTrack", icon: "→", label: "On Track", className: "text-blue-600" },
  { key: "atRisk", icon: "⚠", label: "At Risk", className: "text-amber-600" },
  { key: "behind", icon: "↓", label: "Behind", className: "text-red-600" },
];

/** Staleness label from the max Filter.lastSyncedAt, relative to the request time. */
function formatAgo(value, asOf) {
  if (!value) return "never";
  const minutes = Math.max(0, Math.floor((new Date(asOf) - new Date(value)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function HeaderCell({ children, align = "left" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function TeamSummaryTable({ perTeam, selectedSprint, asOf, viewerIsAdmin }) {
  const rows = [...perTeam].sort((a, b) => {
    const byHealth =
      (TONE_RANK[a.metrics.sprintHealth.tone] ?? 5) - (TONE_RANK[b.metrics.sprintHealth.tone] ?? 5);
    return byHealth !== 0 ? byHealth : a.team.name.localeCompare(b.team.name);
  });

  return (
    <section className="overflow-x-auto rounded-xl border bg-card" aria-label="Per-team summary">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <HeaderCell>Team</HeaderCell>
            <HeaderCell>My role</HeaderCell>
            <HeaderCell align="right">Issues</HeaderCell>
            <HeaderCell align="right">Points done</HeaderCell>
            <HeaderCell align="right">Avg progress</HeaderCell>
            <HeaderCell>Health</HeaderCell>
            <HeaderCell>Bands</HeaderCell>
            <HeaderCell align="right">Blocked</HeaderCell>
            <HeaderCell>Last synced</HeaderCell>
            <HeaderCell> </HeaderCell>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ team, myRole, filters, metrics, lastSyncedAt }) => (
            <tr key={team.id} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="px-3 py-2.5">
                <p className="font-medium">
                  <span className="text-muted-foreground">{team.key}</span> · {team.name}
                </p>
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground">no filters yet</p>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {myRole ?? (viewerIsAdmin ? "admin" : "—")}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{metrics.totalIssues}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {Math.round(metrics.completedPoints)}/{metrics.points}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{metrics.avgProgress}%</td>
              <td className="px-3 py-2.5">
                <Badge tone={metrics.sprintHealth.tone}>
                  {metrics.sprintHealth.icon} {metrics.sprintHealth.status}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2.5 whitespace-nowrap tabular-nums">
                  {BANDS.map((band) => (
                    <span
                      key={band.key}
                      className={metrics.healthCounts[band.key] > 0 ? band.className : "text-muted-foreground/50"}
                      title={band.label}
                    >
                      {band.icon} {metrics.healthCounts[band.key]}
                    </span>
                  ))}
                </span>
              </td>
              <td
                className={`px-3 py-2.5 text-right tabular-nums ${metrics.blockedCount > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}`}
              >
                {metrics.blockedCount > 0 ? `⊗ ${metrics.blockedCount}` : "0"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{formatAgo(lastSyncedAt, asOf)}</td>
              <td className="px-3 py-2.5 text-right">
                <Link
                  href={`/?team=${team.id}&sprint=${selectedSprint.id}`}
                  className="whitespace-nowrap font-medium text-blue-700 hover:underline"
                >
                  Open board →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Teams sorted worst health first · syncs happen on each team&apos;s own board
      </p>
    </section>
  );
}
