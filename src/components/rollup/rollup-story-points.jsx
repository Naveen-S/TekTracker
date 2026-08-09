"use client";

/**
 * The roll-up's delivery scoreboard with a view toggle (Naveen, 2026-07-29: "give an option to have
 * condense/relax view", extended 2026-08-09 with a per-team breakdown).
 *
 * Three views: **Condensed** / **Relaxed** are the aggregate scoreboard at two densities;
 * **By team** swaps to `RollupCompositionChart` — a per-team stacked bar of committed/tech-debt/bug
 * load, the one lens the portfolio totals can't show. (The donut that first shipped here on
 * 2026-08-09 was dropped — it only re-drew the same composition the rail already shows.)
 *
 * A thin client leaf: it owns the ephemeral view preference (§17 `useLocalPref`) and hands the same
 * segmented toggle to whichever view renders, so both stay hook-free.
 */
import { BarChart3, Rows2, Rows3 } from "lucide-react";
import { StoryPointsHighlight } from "@/components/dashboard/story-points-highlight";
import { RollupCompositionChart } from "@/components/rollup/rollup-composition-chart";
import { useLocalPref } from "@/lib/use-local-pref";
import { cn } from "@/lib/utils";

const PREF_KEY = "rollupStoryPointsView";

const OPTIONS = [
  { id: "condensed", label: "Condensed", icon: Rows2 },
  { id: "relaxed", label: "Relaxed", icon: Rows3 },
  { id: "byTeam", label: "By team", icon: BarChart3 },
];

export function RollupStoryPoints({ teams, ...props }) {
  const [view, setView] = useLocalPref(PREF_KEY, "relaxed");
  const active = OPTIONS.some((option) => option.id === view) ? view : "relaxed";

  const toggle = (
    <span
      role="group"
      aria-label="Story points view"
      className="flex items-center gap-0.5 rounded-full border border-white/12 bg-white/6 p-0.5"
    >
      {OPTIONS.map((option) => {
        const isActive = active === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setView(option.id)}
            aria-pressed={isActive}
            title={`${option.label} view`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors",
              isActive
                ? "bg-white/15 text-white"
                : "text-white/55 hover:bg-white/8 hover:text-white/80",
            )}
          >
            <option.icon className="size-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </span>
  );

  if (active === "byTeam") {
    return <RollupCompositionChart teams={teams} scope={props.scope} action={toggle} />;
  }

  return <StoryPointsHighlight {...props} variant={active} action={toggle} />;
}
