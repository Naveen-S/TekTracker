import { cn } from "@/lib/utils";

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

/** Days-remaining pill; flips to the red urgent variant under 3 days (legacy :427-443). */
export function DaysRemainingPill({ days }) {
  const urgent = days < 3;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap",
        urgent
          ? "border-danger/30 bg-danger/20 text-on-ink-danger"
          : "border-primary/25 bg-primary/20 text-on-ink-accent",
      )}
    >
      {days > 0 ? `${days} days remaining` : days === 0 ? "Last day!" : "Sprint ended"}
    </span>
  );
}
