/**
 * Rank badge for the Velocity/Leaderboard (leaderboard.md) — Crown/Medal/Award for the podium,
 * a plain `#N` chip otherwise. Uses only existing tone tiles (metric-grid.jsx's `toneTile`
 * convention) — no new hex (coding-standards: no inline styles). Rank 1 gets the app's own accent
 * color (teal under Tekion, blue under Modern) rather than a contrived gold/silver/bronze palette
 * the token system doesn't have, PLUS the house "sweep" sheen already used on the hero countdown
 * ring (`release-countdown.jsx`) — reused here, not reinvented, as the podium's spotlight.
 */
import { Award, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const PODIUM = {
  1: { Icon: Crown, tile: "bg-accent text-accent-foreground shadow-brand", sweep: true },
  2: { Icon: Medal, tile: "bg-muted text-secondary-foreground", sweep: false },
  3: { Icon: Award, tile: "bg-muted text-secondary-foreground", sweep: false },
};

const DIMENSIONS = { sm: "size-7", md: "size-9", lg: "size-12" };
const ICON_SIZES = { sm: "size-3.5", md: "size-4.5", lg: "size-6" };

/**
 * @param {{ rank: number, size?: "sm"|"md"|"lg", className?: string }} props
 */
export function RankBadge({ rank, size = "md", className }) {
  const podium = PODIUM[rank];
  const dimension = DIMENSIONS[size] ?? DIMENSIONS.md;

  if (!podium) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center font-display text-sm font-bold text-muted-foreground tabular-nums",
          dimension,
          className,
        )}
      >
        #{rank}
      </span>
    );
  }

  const { Icon, tile, sweep } = podium;
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        dimension,
        tile,
        className,
      )}
      aria-label={`Rank ${rank}`}
      title={`Rank ${rank}`}
    >
      {sweep && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent motion-safe:animate-sweep"
        />
      )}
      <Icon className={ICON_SIZES[size] ?? ICON_SIZES.md} aria-hidden="true" />
    </span>
  );
}
