"use client";

import { useRef, useSyncExternalStore } from "react";

const DURATION_MS = 700;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** Where the count should be right now. Raw (unrounded) so callers displaying decimals keep precision. */
function interpolate(state) {
  if (state.from === state.to) return state.to;
  const t = Math.min(1, (Date.now() - state.startedAt) / DURATION_MS);
  if (t >= 1) return state.to;
  return state.from + (state.to - state.from) * easeOutCubic(t);
}

/**
 * Advance the animation on rAF, recomputing the CACHED snapshot once per frame.
 *
 * `getSnapshot` must be pure and return a stable value between notifications — computing the
 * eased value inside it instead made two reads in one render pass disagree, which React flags as
 * "The result of getSnapshot should be cached to avoid an infinite loop". So the clock is sampled
 * here, exactly once per frame, and `getSnapshot` only ever reads back what this wrote.
 */
function startTicking(state) {
  if (state.ticking) return;
  state.ticking = true;
  const tick = () => {
    state.current = interpolate(state);
    state.notify?.();
    if (state.current !== state.to) requestAnimationFrame(tick);
    else state.ticking = false;
  };
  requestAnimationFrame(tick);
}

/**
 * Animates the transition between successive `value`s. By default it never plays on first mount,
 * so the very first paint (server render AND the first client hydration pass) shows the real
 * number with no JS required (animate.md: "keep content visible in the default state"); only a
 * value CHANGE — a sync landing, a team/sprint switch that keeps this component mounted — plays
 * the count.
 *
 * Modeled on release-countdown.jsx's `useLiveNow`: a `requestAnimationFrame`-driven
 * `useSyncExternalStore`. All mutable state lives in a ref read/written ONLY from inside the
 * `subscribe`/`getSnapshot` callbacks — never in the hook body itself — because this repo's React
 * Compiler lint rules (`react-hooks/refs`, `react-hooks/purity`) reject ref access or `Date.now()`
 * during render proper; `useSyncExternalStore`'s own callbacks are the sanctioned escape hatch.
 *
 * @param {number} value
 * @param {{ countOnMount?: boolean }} [options] `countOnMount` opts INTO a one-time count from
 *   zero at hydration (the story-points scoreboard's arrival). Deliberately not the default —
 *   every other caller keeps the first-paint-is-truth guarantee above.
 */
export function useCountTransition(value, { countOnMount = false } = {}) {
  const store = useRef({
    from: value,
    to: value,
    current: value,
    startedAt: 0,
    notify: null,
    ticking: false,
    mounted: false,
  });

  const subscribe = (onStoreChange) => {
    const state = store.current;
    state.notify = onStoreChange;
    // The reset to 0 happens here, in `subscribe`, which React runs after the first commit. The
    // server-rendered digits are therefore correct at first paint (no-JS safe, no hydration
    // mismatch), and the brief snap back to 0 is covered by the numeral's own entrance fade, so it
    // is never seen. If motion is reduced, or there is nothing to count to, we simply don't play —
    // the true number is already on screen.
    if (countOnMount && !state.mounted) {
      state.mounted = true;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced && value > 0) {
        state.from = 0;
        state.current = 0;
        state.startedAt = Date.now();
        startTicking(state);
        onStoreChange();
      }
    }
    return () => {
      state.notify = null;
    };
  };

  const getSnapshot = () => {
    const state = store.current;
    if (state.to !== value) {
      // Retarget from wherever the count currently is, so an interrupted transition continues
      // from the visible number rather than jumping back to its previous destination.
      state.from = state.current;
      state.to = value;
      state.startedAt = Date.now();
      startTicking(state);
    }
    return state.current;
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => value);
}
