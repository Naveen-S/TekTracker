/**
 * Team velocity leaderboard (leaderboard.md decisions 1–3): teams ranked by
 * `completedPoints ÷ Team.developerCount`. Server-rendered, read-only. `rows` are already ranked
 * via `rankBy`; teams with no `developerCount` set are excluded from `rows` and listed in
 * `unconfigured` instead (their developers still show up on the DeveloperLeaderboard).
 *
 * Rank 1 gets a podium row (accent wash + the house sweep sheen via RankBadge, a bigger display
 * numeral) — the system's own strongest moves (accent glow, display type, hover-lift) turned up
 * for the peak of this list, not a new motif invented for it.
 */
import Link from "next/link";
import { RankBadge } from "@/components/ui/rank-badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export function TeamLeaderboard({ rows, unconfigured, viewerIsAdmin }) {
  return (
    <section
      className="flex flex-col overflow-hidden rounded-xl border bg-card p-4"
      aria-label="Team velocity leaderboard"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Team Velocity
          </p>
          <h2 className="font-display text-lg font-bold">Leaderboard</h2>
        </div>
        <p className="text-xs whitespace-nowrap text-muted-foreground">points ÷ developers</p>
      </header>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No team has both delivered points and a configured team size yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const isFirst = row.rank === 1;
            const isPodium = row.rank <= 3;
            return (
              <li
                key={row.teamId}
                className={cn(
                  "flex items-center gap-3 rounded-lg transition-all duration-200 ease-out",
                  isFirst
                    ? "border border-primary/20 bg-accent p-3 shadow-sm hover:-translate-y-px hover:shadow-brand"
                    : "px-2 py-2.5 hover:-translate-y-px hover:bg-subtle hover:shadow-xs",
                )}
              >
                <RankBadge rank={row.rank} size={isFirst ? "lg" : "md"} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", isFirst && "text-base font-bold")}>
                    <span className="text-muted-foreground">{row.team.key}</span> · {row.team.name}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(row.completedPoints)} pts ÷ {row.developerCount}{" "}
                    {row.developerCount === 1 ? "dev" : "devs"}
                  </p>
                </div>
                <span aria-label={`${row.perDeveloper.toFixed(1)} points per developer`}>
                  <AnimatedNumber
                    value={row.perDeveloper}
                    decimals={1}
                    className={cn(
                      "font-display font-extrabold tabular-nums",
                      isFirst ? "text-3xl text-accent-foreground" : isPodium ? "text-2xl" : "text-xl",
                    )}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {unconfigured.length > 0 && (
        <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
          Not ranked (no team size set): {unconfigured.map((team) => team.name).join(", ")}
          {viewerIsAdmin && (
            <>
              {" — "}
              <Link href="/admin" className="font-semibold text-accent-foreground hover:underline">
                configure in Admin →
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
