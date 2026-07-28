"use client";

import { useRef, useSyncExternalStore } from "react";

const DURATION_MS = 700;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Animates the transition between successive `value`s — never on first mount, so the very first
 * paint (server render AND the first client hydration pass) always shows the real number with no
 * JS required (animate.md: "keep content visible in the default state"). Only a value CHANGE
 * (a sync landing, a team/sprint switch that keeps this component mounted) plays the count.
 *
 * Modeled on release-countdown.jsx's `useLiveNow`: a `requestAnimationFrame`-driven
 * `useSyncExternalStore`. All mutable state lives in a ref read/written ONLY from inside the
 * `subscribe`/`getSnapshot` callbacks — never in the hook body itself — because this repo's React
 * Compiler lint rules (`react-hooks/refs`, `react-hooks/purity`) reject ref access or `Date.now()`
 * during render proper; `useSyncExternalStore`'s own callbacks are the sanctioned escape hatch for
 * exactly this kind of external, time-driven value (mirrors `useLiveNow`'s `Date.now()` call inside
 * its `getSnapshot`).
 */
export function useCountTransition(value) {
  const store = useRef({ from: value, to: value, startedAt: 0, notify: null, ticking: false });

  const subscribe = (onStoreChange) => {
    store.current.notify = onStoreChange;
    return () => {
      store.current.notify = null;
    };
  };

  const getSnapshot = () => {
    const state = store.current;
    if (state.to !== value) {
      state.from = state.to;
      state.to = value;
      state.startedAt = Date.now();
      if (!state.ticking) {
        state.ticking = true;
        const tick = () => {
          state.notify?.();
          if (Date.now() - state.startedAt < DURATION_MS) requestAnimationFrame(tick);
          else state.ticking = false;
        };
        requestAnimationFrame(tick);
      }
    }
    if (state.from === state.to) return state.to;
    const t = Math.min(1, (Date.now() - state.startedAt) / DURATION_MS);
    if (t >= 1) return state.to;
    // Raw interpolated value — NOT rounded here, so callers displaying decimals (e.g. the
    // leaderboard's points-per-developer ratio) don't lose precision mid-transition.
    return state.from + (state.to - state.from) * easeOutCubic(t);
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => value);
}
