/**
 * The team's "total story points delivered" this sprint — promoted to its own headline card per
 * Naveen (2026-07-28): this number was previously only ever a small detail line under the
 * Completion %'s card, which buried the figure he called "extremely important". Server-safe
 * (only DeliveredCounter's digits are a client leaf, mirroring release-countdown.jsx behind
 * DaysRemainingPill) so it costs nothing beyond the tiny counter's hydration.
 *
 * Reuses the app's own strongest existing moves rather than inventing new ones (bolder.md):
 * the `bg-accent`/`text-accent-foreground`/`shadow-brand` podium treatment already proven on the
 * leaderboard's rank-1 card, and the house "sweep" sheen from release-countdown.jsx/rank-badge.jsx.
 * Both themes re-hue it automatically (teal under Tekion, blue under Modern) — no new tokens.
 *
 * Naveen also asked that PLANNED points be highlighted, not just delivered — so both numbers get
 * real, peer-sized display numerals; only Delivered gets the extra count-up + glow, keeping one
 * legible focal move (bolder.md: "if every element got louder, the section got flatter").
 */
import { Sparkles } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function StoryPointsHighlight({ completedPoints, totalPoints, scope = "this sprint" }) {
  const delivered = Math.round(completedPoints);
  const planned = Math.round(totalPoints);
  const pct = planned > 0 ? Math.min(100, Math.round((delivered / planned) * 100)) : 0;

  return (
    <section
      aria-label={`Story points delivered: ${delivered} of ${planned} planned ${scope}`}
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-primary/20 bg-accent p-5 shadow-brand sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-sweep"
      />

      <div className="relative flex items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-foreground/10 text-accent-foreground"
          aria-hidden="true"
        >
          <Sparkles className="size-4.5" />
        </span>
        <div>
          <p className="text-[11px] font-bold tracking-wider uppercase text-accent-foreground/80">
            Story points delivered
          </p>
          <p className="text-xs text-accent-foreground/60">{scope}</p>
        </div>
      </div>

      <div className="relative flex items-end justify-center gap-5">
        <div className="text-center">
          <AnimatedNumber
            value={delivered}
            className="font-display text-5xl leading-none font-extrabold tabular-nums text-accent-foreground"
          />
          <p className="mt-1 text-[11px] font-bold tracking-wide uppercase text-accent-foreground/70">
            Delivered
          </p>
        </div>
        <span aria-hidden="true" className="pb-2.5 font-display text-3xl font-bold text-accent-foreground/25">
          /
        </span>
        <div className="text-center">
          <p className="font-display text-5xl leading-none font-extrabold tabular-nums text-accent-foreground/70">
            {planned}
          </p>
          <p className="mt-1 text-[11px] font-bold tracking-wide uppercase text-accent-foreground/50">
            Planned
          </p>
        </div>
      </div>

      <div className="relative w-full sm:w-52 sm:shrink-0">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-foreground/15">
          <span
            className="block h-full rounded-full bg-accent-foreground transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[11px] font-semibold text-accent-foreground/60">
          {pct}% of planned scope
        </p>
      </div>
    </section>
  );
}
