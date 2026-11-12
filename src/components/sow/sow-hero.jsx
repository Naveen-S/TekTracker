/**
 * The SOW header strip (sow-tracker.md round 2): the one-line answer leadership asks first —
 * what it is, is it healthy, how far along against the plan, and how long to launch — then the
 * actions. Kept to a single band so the visuals below fit the first screen. Server-safe; draws in
 * the theme-aware `on-hero` tokens.
 */
import { CalendarDays, Clock, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { ProgramChip } from "@/components/ui/program-chip";
import { SOW_STATUS_LABELS } from "@/lib/sow/defaults.mjs";
import { formatDay } from "@/lib/sow/timeline.mjs";
import { HealthChip, relativeTime } from "./sow-kit";

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

/** Weighted % as a ring, with a tick where the schedule expects the scope to be. */
export function ProgressRing({ pct, expectedPct = null }) {
  const value = Math.min(100, Math.max(0, pct ?? 0));
  const tick = expectedPct === null ? null : (Math.min(100, Math.max(0, expectedPct)) / 100) * 360;
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={RING_R} fill="none" strokeWidth="10" className="stroke-on-hero-tint/15" />
        <circle cx="50" cy="50" r={RING_R} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - value / 100)} className="stroke-on-hero-accent transition-[stroke-dashoffset] duration-1000 ease-out" />
        {tick !== null && <line x1="50" y1="1" x2="50" y2="15" strokeWidth="3" strokeLinecap="round" className="stroke-on-hero" transform={`rotate(${tick + 90} 50 50)`} />}
      </svg>
      <p className="absolute inset-0 grid place-items-center font-display text-xl leading-none font-extrabold text-on-hero tabular-nums">
        <span>
          {pct === null ? "—" : Math.round(value)}
          {pct !== null && <span className="text-xs">%</span>}
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, unit, sub, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-bold tracking-wider text-on-hero-muted uppercase">{label}</p>
      <p className={cn("mt-0.5 font-display text-2xl leading-tight font-extrabold tabular-nums", tone ?? "text-on-hero")}>
        {value} {unit && <span className="text-xs font-bold text-on-hero-muted">{unit}</span>}
      </p>
      {sub && <p className="truncate text-[11px] text-on-hero-muted" title={sub}>{sub}</p>}
    </div>
  );
}

export function SowHero({ view, eyebrow = "SOW tracker", children }) {
  const { sow, progress, health, launch, meta, chart } = view;
  const gap = chart.gap === null ? null : Math.round(chart.gap);
  const delta = progress.delta;
  return (
    <HeroShell className="flex flex-col gap-5 px-5 py-5 md:px-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <HeroEyebrow>{eyebrow}</HeroEyebrow>
            {sow.program && <ProgramChip name={sow.program.name} />}
            {sow.status !== "ACTIVE" && <span className="rounded-full bg-on-hero-tint/10 px-2.5 py-1 text-[11px] font-semibold text-on-hero/80">{SOW_STATUS_LABELS[sow.status]}</span>}
            <HealthChip health={health} />
          </div>
          <HeroTitle className="mt-1 text-[26px]">{sow.name}</HeroTitle>
          <p className="mt-1 max-w-2xl truncate text-[13px] text-on-hero-muted" title={health.reasons.join(" · ") || undefined}>
            {health.reasons.length > 0 ? health.reasons.join(" · ") : (sow.description ?? "No flags raised.")}
          </p>
          <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-hero-muted">
            {sow.ownerName && <li className="flex items-center gap-1.5"><UserRound className="size-3.5 opacity-70" aria-hidden="true" />{sow.ownerName}</li>}
            <li className="flex items-center gap-1.5"><CalendarDays className="size-3.5 opacity-70" aria-hidden="true" />{formatDay(sow.startDate)} – {formatDay(launch.date, { year: true })}</li>
            <li className="flex items-center gap-1.5"><Clock className="size-3.5 opacity-70" aria-hidden="true" />Jira read {relativeTime(meta.lastRefreshedAt, new Date(view.asOf).getTime())}</li>
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-4">
          <div className="flex items-center gap-3">
            <ProgressRing pct={progress.overall.pct} expectedPct={chart.expected} />
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold tracking-wider text-on-hero-muted uppercase">Weighted progress</p>
              <p className="text-sm text-on-hero tabular-nums">
                {gap === null ? `${progress.overall.done} of ${progress.overall.total} tickets done` : gap >= 0 ? `${gap} pts ahead of plan` : `${Math.abs(gap)} pts behind plan`}
              </p>
              <p className="text-[11px] text-on-hero-muted tabular-nums">
                {chart.expected !== null && `Plan expects ${Math.round(chart.expected)}%`}
                {delta !== null && delta !== 0 && ` · ${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)} pts in a week`}
              </p>
            </div>
          </div>
          <Stat
            label={launch.daysLeft >= 0 ? `To ${launch.title}` : launch.title}
            value={launch.daysLeft === 0 ? "Today" : Math.abs(launch.daysLeft)}
            unit={launch.daysLeft > 0 ? "days" : launch.daysLeft < 0 ? "days ago" : null}
            sub={formatDay(launch.date, { year: true })}
          />
          <Stat
            label="Launch slip"
            value={launch.slip > 0 ? `+${launch.slip}` : launch.slip}
            unit="days"
            sub={launch.worstSlip ? `${launch.worstSlip.title} +${launch.worstSlip.days} d` : "All dates on baseline"}
          />
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </HeroShell>
  );
}
