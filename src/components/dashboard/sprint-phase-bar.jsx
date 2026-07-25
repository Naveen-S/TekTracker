import { Check } from "lucide-react";
import { getSprintPhase } from "@/lib/metrics.mjs";
import { cn } from "@/lib/utils";
import { DaysRemainingPill } from "@/components/ui/hero-shell";

/**
 * Sprint timeline for the hero (sprint-phases-delivery-lens.md) — the leadership "where is the
 * sprint on the dev → QA/UAT → release path" band. Two labelled macro-cycles carry the headline
 * (DEV CYCLE ✅ Completed · QA / UAT ● In progress); underneath, seven fixed SDLC phases
 * (Scope · Design · Develop · Review │ QA · UAT · Release) show fine-grained progress, and the live
 * release countdown anchors the right end as the timeline's destination.
 *
 * HYBRID (decision, 2026-07-24): during the dev cycle the delivery completion %
 * (`metrics.deliveryAvgProgress` — roadmap + tech debt only) drives the four dev phases; once the
 * calendar passes dev end the dev phases are all Done and the QA/UAT/Release phases light up by
 * DATE (position through the QA/UAT window). Server-safe; the countdown is a client leaf beneath a
 * server-safe wrapper, so this renders on the dark ink hero in both themes.
 */
const DEV_PHASES = ["Scope", "Design", "Develop", "Review"];
const QA_PHASES = ["QA", "UAT", "Release"];
const PHASES = [...DEV_PHASES, ...QA_PHASES];

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** Per-phase { state: "done"|"active"|"todo", fill: 0..1 } across the seven phases. */
function computePhases(completion, phase, qaProgress) {
  const phases = PHASES.map(() => ({ state: "todo", fill: 0 }));
  if (phase === "released") return phases.map(() => ({ state: "done", fill: 1 }));

  // Advance the frontier across `count` phases starting at `offset`, driven by `frac` (0..1):
  // filled phases are Done, the phase straddling the frontier is Active with a partial fill.
  const fillFrontier = (offset, count, frac) => {
    for (let i = 0; i < count; i++) {
      const lower = i / count;
      const upper = (i + 1) / count;
      if (frac >= upper) phases[offset + i] = { state: "done", fill: 1 };
      else if (frac > lower)
        phases[offset + i] = { state: "active", fill: clamp01((frac - lower) / (upper - lower)) };
      else phases[offset + i] = { state: "todo", fill: 0 };
    }
  };

  if (phase === "dev") {
    fillFrontier(0, DEV_PHASES.length, clamp01((completion ?? 0) / 100));
    return phases;
  }

  // Past dev end (qa or ended): dev work is behind us.
  for (let i = 0; i < DEV_PHASES.length; i++) phases[i] = { state: "done", fill: 1 };
  if (phase === "qa") {
    // QA/UAT window: calendar position drives QA → UAT; Release lights only at the release date.
    fillFrontier(DEV_PHASES.length, 2, clamp01(qaProgress ?? 0));
  }
  return phases;
}

const CYCLE_TONE = {
  done: "border-[#35c07a]/35 bg-[#35c07a]/12 text-[#7ee0a6]",
  active: "border-[#f0883e]/40 bg-[#f0883e]/14 text-[#f5b07a]",
  todo: "border-white/12 bg-white/5 text-white/50",
};
const CYCLE_WORD = { done: "Completed", active: "In progress", todo: "Upcoming" };

/** A macro-cycle status chip: check + "Completed" when done, pulsing dot + "In progress" when active. */
function CycleChip({ label, status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
        CYCLE_TONE[status],
      )}
    >
      {status === "done" ? (
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-current",
            status === "active" && "motion-safe:animate-pulse",
          )}
        />
      )}
      <span className="tracking-wide uppercase">{label}</span>
      <span className="font-semibold opacity-70">· {CYCLE_WORD[status]}</span>
    </span>
  );
}

/** One phase: a track with a partial-fill inner bar (green done / pulsing orange active) + label. */
function Segment({ label, state, fill }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="relative h-2 w-full overflow-hidden rounded-full bg-white/12">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
            state === "done" && "bg-[#35c07a]",
            state === "active" &&
              "bg-[#f0883e] shadow-[0_0_10px_rgba(240,136,62,0.65)] motion-safe:animate-pulse",
          )}
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </span>
      <span
        className={cn(
          "truncate text-[11px] transition-colors duration-500",
          state === "todo" ? "text-white/45" : "text-white/70",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function SprintPhaseBar({ completion, sprint, asOf }) {
  const { phase, qaProgress } = getSprintPhase(sprint, asOf);
  const phases = computePhases(completion, phase, qaProgress);

  const devStatus = phase === "dev" ? "active" : "done";
  const qaStatus =
    phase === "qa" ? "active" : phase === "released" ? "done" : "todo";

  const currentLabel =
    phases.findIndex((p) => p.state === "active") >= 0
      ? PHASES[phases.findIndex((p) => p.state === "active")]
      : phase === "released"
        ? "Released"
        : (PHASES[phases.map((p) => p.state).lastIndexOf("done") + 1] ?? PHASES[0]);

  return (
    <div
      role="img"
      aria-label={`Sprint timeline — dev cycle ${devStatus}, QA/UAT ${qaStatus}, currently in ${currentLabel}`}
      className="flex flex-col gap-3.5"
    >
      {/* Headline: macro-cycle status chips (left) + the live countdown destination (right). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <CycleChip label="Dev cycle" status={devStatus} />
          <span aria-hidden="true" className="text-white/25">
            →
          </span>
          <CycleChip label="QA / UAT" status={qaStatus} />
        </div>
        <DaysRemainingPill sprint={sprint} asOf={asOf} />
      </div>

      {/* Fine-grained phases, grouped into the two cycles with a divider. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex flex-[4] gap-2.5">
          {DEV_PHASES.map((label, i) => (
            <Segment key={label} label={label} state={phases[i].state} fill={phases[i].fill} />
          ))}
        </div>
        <span aria-hidden="true" className="hidden w-px self-stretch bg-white/12 sm:block" />
        <div className="flex flex-[3] gap-2.5">
          {QA_PHASES.map((label, i) => (
            <Segment
              key={label}
              label={label}
              state={phases[DEV_PHASES.length + i].state}
              fill={phases[DEV_PHASES.length + i].fill}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
