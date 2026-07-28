/**
 * Org-wide developer leaderboard (leaderboard.md decisions 1–2, 5): individual developers ranked
 * by points delivered, aggregated across every scrum team. Server-rendered, read-only. `rows` are
 * already ranked via `rankBy`; a developer with issues in more than one team is a single merged
 * row (Open Risk 3) tagged with whichever team was encountered — total points are always correct.
 *
 * Rank 1 gets the same podium treatment as TeamLeaderboard's top row (accent wash + the RankBadge
 * sweep sheen + a bigger avatar/numeral) — one consistent "peak of the list" motif across both
 * boards.
 */
import { AvatarChip } from "@/components/ui/avatar-chip";
import { RankBadge } from "@/components/ui/rank-badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export function DeveloperLeaderboard({ rows }) {
  return (
    <section
      className="flex flex-col overflow-hidden rounded-xl border bg-card p-4"
      aria-label="Developer leaderboard"
    >
      <header className="mb-3">
        <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
          Org-wide
        </p>
        <h2 className="font-display text-lg font-bold">Developer Leaderboard</h2>
      </header>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No delivered points attributed to a developer yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const isFirst = row.rank === 1;
            const isPodium = row.rank <= 3;
            return (
              <li
                key={row.assigneeAccountId}
                className={cn(
                  "flex items-center gap-3 rounded-lg transition-all duration-200 ease-out",
                  isFirst
                    ? "border border-primary/20 bg-accent p-3 shadow-sm hover:-translate-y-px hover:shadow-brand"
                    : "px-2 py-2 hover:-translate-y-px hover:bg-subtle hover:shadow-xs",
                )}
              >
                <RankBadge rank={row.rank} size={isFirst ? "lg" : "sm"} />
                <AvatarChip name={row.assigneeName} size={isFirst ? "lg" : "sm"} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", isFirst && "text-base font-bold")}>
                    {row.assigneeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.team?.key ?? "—"} · {row.issueCount}{" "}
                    {row.issueCount === 1 ? "issue" : "issues"}
                  </p>
                </div>
                <span aria-label={`${Math.round(row.completedPoints)} points delivered`}>
                  <AnimatedNumber
                    value={row.completedPoints}
                    className={cn(
                      "font-display font-extrabold tabular-nums",
                      isFirst ? "text-3xl text-accent-foreground" : isPodium ? "text-xl" : "text-lg",
                    )}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
