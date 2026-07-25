"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;
const SECOND_MS = 1000;

/**
 * A once-per-second clock as an external store (mirrors useLocalPref's approach — the project's
 * `react-hooks/set-state-in-effect` rule rejects a setInterval→setState effect). Returns 0 during
 * SSR and the first hydration pass (getServerSnapshot), so the component renders a deterministic
 * day-level fallback that matches the server HTML; it then re-renders with the live millisecond
 * clock. The snapshot is floored to the second so it stays stable between ticks (no render loop).
 */
function subscribeSecond(callback) {
  const id = setInterval(callback, SECOND_MS);
  return () => clearInterval(id);
}
const getNowSecond = () => Math.floor(Date.now() / SECOND_MS) * SECOND_MS;
const useLiveNow = () => useSyncExternalStore(subscribeSecond, getNowSecond, () => 0);

const pad = (n) => String(n).padStart(2, "0");
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function breakdown(ms) {
  const t = Math.max(0, ms);
  return {
    days: Math.floor(t / DAY_MS),
    hours: Math.floor((t % DAY_MS) / HOUR_MS),
    minutes: Math.floor((t % HOUR_MS) / MIN_MS),
    seconds: Math.floor((t % MIN_MS) / 1000),
  };
}

const TONE = {
  accent: "border-primary/25 bg-primary/12 text-on-ink-accent",
  danger: "border-danger/40 bg-danger/15 text-on-ink-danger",
  success: "border-success/40 bg-success/12 text-on-ink-success",
  muted: "border-white/15 bg-white/8 text-white/80",
};

/** A small SVG progress ring with a live-pulsing core (colour rides currentColor). */
function ProgressRing({ progress }) {
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <span className="relative grid size-8 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="size-8 -rotate-90">
        <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamp01(progress))}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute size-1.5 rounded-full bg-current" />
      <span className="absolute size-1.5 rounded-full bg-current opacity-70 motion-safe:animate-ping" />
    </span>
  );
}

/** One time segment: big tabular number + small unit letter. */
function Unit({ value, unit }) {
  return (
    <span className="inline-flex items-baseline">
      <span className="font-mono text-sm leading-none font-extrabold tabular-nums">{value}</span>
      <span className="ml-0.5 text-[9px] font-bold opacity-55">{unit}</span>
    </span>
  );
}

function Colon() {
  return <span className="mx-0.5 font-mono text-xs opacity-45 motion-safe:animate-blink">:</span>;
}

/** Static, hydration-safe shell — the `border/bg/text` tone flows currentColor into every child. */
function Shell({ tone, children }) {
  return (
    <span
      className={cn(
        "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border px-3 py-1.5 whitespace-nowrap backdrop-blur-sm",
        TONE[tone],
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/12 to-transparent motion-safe:animate-sweep"
      />
      {children}
    </span>
  );
}

/**
 * Live, animated release/dev-cycle countdown (replaces the flat text pill).
 * Server-rendered as a day-level readout (hydration-safe: `useLiveNow` returns 0 on the server and
 * the first hydration pass); a 1s ticker then upgrades it to a live d·h·m·s clock. All live callers
 * (`/`, `/rollup`, live `/share`) clock at "now" — frozen shares don't render it.
 */
export function ReleaseCountdown({ phase, devStartMs, devEndMs, releaseMs, daysToDevEnd, daysToRelease }) {
  const now = useLiveNow();
  const live = now !== 0; // 0 → SSR / first hydration pass; render the day-level fallback then.

  if (phase === "released") {
    return (
      <Shell tone="success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase opacity-70">Shipped</span>
          <span className="text-sm font-extrabold">Released</span>
        </span>
      </Shell>
    );
  }
  if (phase === "ended") {
    return (
      <Shell tone="muted">
        <Flag className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-bold">Sprint ended</span>
      </Shell>
    );
  }

  const isDev = phase === "dev";
  const target = isDev ? devEndMs : releaseMs;
  const windowStart = isDev ? devStartMs : devEndMs;
  const label = isDev ? "Dev cycle" : "QA / UAT → Release";
  const fallbackDays = isDev ? daysToDevEnd : daysToRelease;

  // Reference clock: deterministic (day-props) before hydration, live milliseconds after — so the
  // ring/tone match the server HTML on the first paint, then upgrade in place.
  const refNow = live ? now : target - fallbackDays * DAY_MS;
  const progress = target > windowStart ? clamp01((refNow - windowStart) / (target - windowStart)) : 1;

  // Under-3-days flips to the urgent (danger) tone in both the fallback and live states.
  const urgent = target - refNow < 3 * DAY_MS;
  const tone = urgent ? "danger" : "accent";

  return (
    <Shell tone={tone}>
      <ProgressRing progress={progress} />
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] font-bold tracking-[0.14em] uppercase opacity-70">{label}</span>
        {live ? (
          <LiveTimer remainingMs={target - now} />
        ) : (
          <span className="font-mono text-sm leading-none font-extrabold tabular-nums">
            {fallbackDays > 0 ? `${fallbackDays}d ${isDev ? "left" : "to release"}` : isDev ? "Last day" : "Ships today"}
          </span>
        )}
      </span>
    </Shell>
  );
}

function LiveTimer({ remainingMs }) {
  const { days, hours, minutes, seconds } = breakdown(remainingMs);
  return (
    <span className="flex items-baseline">
      <Unit value={days} unit="d" />
      <Colon />
      <Unit value={pad(hours)} unit="h" />
      <Colon />
      <Unit value={pad(minutes)} unit="m" />
      <Colon />
      <Unit value={pad(seconds)} unit="s" />
    </span>
  );
}
