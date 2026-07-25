import { getSprintPhase } from "@/lib/metrics.mjs";
import { cn } from "@/lib/utils";
import { ReleaseCountdown } from "@/components/ui/release-countdown";

/**
 * The signature ink hero surface (legacy .hero-panel, src/styles.css :381-443) shared by the
 * dashboard Hero and /rollup — one place for the dual-teal-glow panel, eyebrow, title, and
 * days-remaining pill. Server-safe on purpose (no "use client": /rollup renders it on the server).
 */
export function HeroShell({ className, children }) {
  return (
    <section className={cn("hero-panel relative overflow-hidden rounded-2xl text-white", className)}>
      {children}
    </section>
  );
}

export function HeroEyebrow({ className, children }) {
  return (
    <p className={cn("text-[11px] font-bold tracking-widest uppercase text-on-ink-accent", className)}>
      {children}
    </p>
  );
}

export function HeroTitle({ className, children }) {
  return (
    <h1 className={cn("mt-1.5 font-display text-3xl font-extrabold tracking-tight text-white", className)}>
      {children}
    </h1>
  );
}

export function HeroCopy({ className, children }) {
  return <p className={cn("text-[13px] leading-relaxed text-white/65", className)}>{children}</p>;
}

/**
 * Phase-aware timeline pill (sprint-phases-delivery-lens.md): the sprint runs dev cycle → QA/UAT →
 * release, so it does NOT read "Sprint ended" at dev end — it reports the current phase. During the
 * dev cycle it counts down to dev end; once past dev end (with a release date) it counts down to
 * release under a "QA / UAT → Release" label; only after the release date is it truly done. The
 * visual is a live animated countdown (ReleaseCountdown, a client leaf) — a progress ring + a
 * ticking d·h·m·s clock — flipping to the urgent danger tone under 3 days from the milestone.
 * Server-safe: this computes the phase and hands serializable props (timestamps + day counts) to
 * the client leaf, so it still renders on the server pages (`/rollup`, `/share`).
 */
export function DaysRemainingPill({ sprint, asOf }) {
  const { phase, daysToDevEnd, daysToRelease } = getSprintPhase(sprint, asOf);

  return (
    <ReleaseCountdown
      phase={phase}
      devStartMs={new Date(sprint.developmentStart).getTime()}
      devEndMs={new Date(sprint.developmentEnd).getTime()}
      releaseMs={sprint.releaseDate ? new Date(sprint.releaseDate).getTime() : null}
      daysToDevEnd={daysToDevEnd}
      daysToRelease={daysToRelease}
    />
  );
}
