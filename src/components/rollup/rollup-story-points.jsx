"use client";

/**
 * The roll-up's delivery scoreboard, with a condensed/relaxed view toggle (Naveen, 2026-07-29:
 * "In the Rollup screen keep this view, but give an option to have condense/relax view").
 *
 * The toggle lives ONLY here. On `/` the scoreboard is one band above a Delivery Matrix that is
 * the real subject of the page, so it is condensed with no choice to make; on `/rollup` the
 * portfolio breakdown IS the subject, nothing below it competes for the fold, and the fuller
 * per-type columns are worth their height — so this is the one screen where the trade-off is a
 * genuine preference rather than a default.
 *
 * The preference rides `useLocalPref` (§17: ephemeral UI state only, never domain data) — the same
 * mechanism the matrix collapse pref uses, SSR-safe via `useSyncExternalStore` with `relaxed` as
 * the server snapshot so the roll-up's first paint is the view this screen is meant to have.
 *
 * A client leaf purely to own that one string; `StoryPointsHighlight` itself stays free of hooks.
 */
import { Rows2, Rows3 } from "lucide-react";
import { StoryPointsHighlight } from "@/components/dashboard/story-points-highlight";
import { useLocalPref } from "@/lib/use-local-pref";
import { cn } from "@/lib/utils";

const PREF_KEY = "rollupStoryPointsView";

const OPTIONS = [
  { id: "condensed", label: "Condensed", icon: Rows2 },
  { id: "relaxed", label: "Relaxed", icon: Rows3 },
];

export function RollupStoryPoints(props) {
  const [view, setView] = useLocalPref(PREF_KEY, "relaxed");
  const variant = view === "condensed" ? "condensed" : "relaxed";

  return (
    <StoryPointsHighlight
      {...props}
      variant={variant}
      action={
        <span
          role="group"
          aria-label="Story points view density"
          className="flex items-center gap-0.5 rounded-full border border-white/12 bg-white/6 p-0.5"
        >
          {OPTIONS.map((option) => {
            const active = variant === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={active}
                title={`${option.label} view`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors",
                  active
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
      }
    />
  );
}
