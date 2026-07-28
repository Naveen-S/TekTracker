/**
 * Personal, non-competitive stats for LEAD/MEMBER (leaderboard.md decision 6) — their own points
 * delivered this sprint + all-time, with explicitly NO rank and NO comparison to others. Rendered
 * on `/` only; LEAD/MEMBER never see the full org-wide `/leaderboard` board. Plain presentational
 * (no client hooks) — `myStats` is `null` for anyone else, in which case this renders nothing.
 */
import { Sparkles } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function MyStatsCard({ myStats }) {
  if (!myStats) return null;

  return (
    <section
      className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-lg border bg-card p-4"
      aria-label="Your delivered points"
    >
      <span className="absolute inset-x-0 top-0 h-0.75 bg-primary" aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
        </span>
        <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
          Your delivered points
        </p>
      </div>
      <div className="ml-auto flex items-center gap-6">
        <div
          className="text-right"
          aria-label={`${Math.round(myStats.thisSprint.completedPoints)} points delivered this sprint`}
        >
          <AnimatedNumber
            value={myStats.thisSprint.completedPoints}
            className="font-display text-xl leading-none font-extrabold tabular-nums"
          />
          <p className="text-xs text-muted-foreground">this sprint</p>
        </div>
        <div
          className="text-right"
          aria-label={`${Math.round(myStats.allTime.completedPoints)} points delivered all-time`}
        >
          <AnimatedNumber
            value={myStats.allTime.completedPoints}
            className="font-display text-xl leading-none font-extrabold tabular-nums"
          />
          <p className="text-xs text-muted-foreground">all-time</p>
        </div>
      </div>
    </section>
  );
}
