import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "{name} program" pill shown on an ink hero when a scrum-team board (`/`) or the roll-up
 * (`/rollup`) is scoped to a Program (program-rollup.md). One shared treatment so the board hero and
 * the roll-up hero read identically — a quiet white-on-ink chip whose tinted Layers icon is the only
 * accent, sitting deliberately below the accent-colored HeroEyebrow so the two don't blur together.
 * Presentational (no hooks) → usable from the server roll-up page and the client board hero alike.
 */
export function ProgramChip({ name, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15",
        className,
      )}
    >
      <Layers className="size-3 text-on-ink-accent" aria-hidden="true" />
      {name} program
    </span>
  );
}
