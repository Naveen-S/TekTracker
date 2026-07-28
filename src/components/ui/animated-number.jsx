"use client";

/**
 * A number that counts between successive values instead of jump-cutting (leaderboard.md +
 * the 2026-07-28 "highlight story points delivered" pass). Split into its own "use client" leaf
 * so callers (StoryPointsHighlight, MyStatsCard, the leaderboards) stay server components,
 * mirroring how release-countdown.jsx is the only client part behind DaysRemainingPill.
 *
 * Decorative: the real number is always in the DOM as plain text via `value` for no-JS/
 * pre-hydration safety (see useCountTransition), and the caller supplies the accessible name
 * (e.g. an `aria-label` on the containing card) — this span is `aria-hidden` because mid-transition
 * it briefly shows a number between the two real values, which would read confusingly to
 * assistive tech.
 */
import { useCountTransition } from "@/lib/use-count-transition";

export function AnimatedNumber({ value, decimals = 0, className }) {
  const displayed = useCountTransition(value);
  return (
    <span aria-hidden="true" className={className}>
      {decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed)}
    </span>
  );
}
