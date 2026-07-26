"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Async-feedback vocabulary, tiered by how long the work actually takes. One indicator for every
 * duration is what made this feel poor: a full-screen veil is right for a 40-second Jira sync and
 * absurd for a 120ms checkbox toggle, and both used to get the same treatment.
 *
 *   0–260ms   inline disabled state only. Nothing is drawn — a veil that flashes for one frame is
 *             worse than no veil, because the eye registers the flicker but not the message.
 *   260ms–2s  `ProgressBar` — a 3px indeterminate sweep pinned to the top edge. Non-blocking.
 *   > 2s      `PageLoader` — the bar PLUS a blocking scrim that names the operation and starts
 *             reporting elapsed time, so a long Jira round-trip explains itself instead of
 *             looking hung.
 *
 * The 260ms threshold is expressed in CSS (`--animate-veil`, delayed + `both` fill), not a React
 * timer: the element mounts and blocks input immediately — correctness — while its paint is
 * deferred. No extra state, no timer to leak, and interaction is never unguarded.
 */

const SECOND_MS = 1000;

function subscribeSecond(callback) {
  const id = setInterval(callback, SECOND_MS);
  return () => clearInterval(id);
}
const getNowSecond = () => Math.floor(Date.now() / SECOND_MS) * SECOND_MS;

/** Live second-resolution clock as an external store (the house pattern — see ReleaseCountdown). */
const useLiveNow = () => useSyncExternalStore(subscribeSecond, getNowSecond, () => 0);

/**
 * Inline spinner for buttons and small in-place waits.
 *
 * Deliberately quick (0.6s vs the 1s Tailwind default): a faster spinner makes the same wait feel
 * shorter. The track stays visible behind the arc so it reads as a rotating indicator rather than
 * a flickering fragment.
 */
function Spinner({ className }) {
  return (
    <span
      data-slot="spinner"
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current animation-duration-[0.6s]",
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Indeterminate top progress bar — the app's default "something is happening" signal.
 *
 * Fixed to the top edge above all chrome. Indeterminate on purpose: we never know how long a Jira
 * call will take, and a fake percentage that stalls at 90% is a lie users learn to distrust. The
 * track carries a faint brand tint so the bar has presence even between sweeps.
 */
function ProgressBar({ show, className }) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-70 h-[3px] overflow-hidden bg-primary/15",
        className,
      )}
      role="progressbar"
      aria-label="Loading"
    >
      <span className="progress-sweep block h-full w-1/5 animate-progress rounded-full bg-primary shadow-brand" />
    </div>
  );
}

/**
 * The veil itself. Split out so it mounts fresh on each activation — that lets it stamp its own
 * start time in a `useState` initialiser (no effect, no timer to thread through call sites) and
 * keeps `PageLoader`'s early return clear of any hook.
 */
function Veil({ label }) {
  const startedAt = useState(() => Date.now())[0];
  const now = useLiveNow();
  // `now` is 0 during SSR and the first hydration pass (getServerSnapshot), so the elapsed hint
  // renders nothing rather than a wrong "0s".
  const seconds = now ? Math.floor((now - startedAt) / SECOND_MS) : 0;

  return (
    <>
      <ProgressBar show />
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-60 flex animate-veil items-center justify-center bg-ink/45 backdrop-blur-[3px] backdrop-saturate-125"
      >
        <div className="flex animate-veil-panel items-center gap-3 rounded-xl bg-ink px-5 py-3.5 shadow-xl ring-1 ring-white/10">
          <Spinner className="size-4 text-on-ink-accent" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white">{label}</span>
            {/* Speaks only once the wait is long enough to feel uncertain — before that,
                a counter would just draw attention to a wait nobody had noticed. */}
            {seconds >= 3 && (
              <span className="text-[11px] font-medium tabular-nums text-white/55">
                {seconds}s{seconds >= 15 ? " · large syncs can take a minute" : ""}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * Blocking work-in-flight overlay — covers the window between a mutation and the
 * `router.refresh()` re-render landing, so no one acts on stale numbers.
 *
 * `show` defaults to true so the guarded form `{busy && <PageLoader label="…" />}` works. That is
 * not cosmetic: /bugs used exactly that form, and with the old required-prop signature `show`
 * arrived as `undefined` and the component returned null — a 20–40 second Jira refresh rendered
 * no loader at all.
 */
function PageLoader({ show = true, label }) {
  if (!show) return null;
  return <Veil label={label} />;
}

export { Spinner, ProgressBar, PageLoader };
