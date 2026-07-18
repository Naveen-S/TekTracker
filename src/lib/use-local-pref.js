"use client";

/**
 * Ephemeral UI pref backed by localStorage (§17: density/collapse only — never domain data).
 * useSyncExternalStore gives an SSR-safe default (server snapshot) and re-reads the stored value
 * on the client without a setState-in-effect (react-hooks/set-state-in-effect) or a hydration
 * mismatch. Same-tab writes notify via the local emitter.
 */
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set();
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * @param {string} key localStorage key
 * @param {string} defaultValue value used on the server and when unset
 * @returns {[string, (next: string) => void]}
 */
export function useLocalPref(key, defaultValue) {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? defaultValue,
    () => defaultValue,
  );
  const setValue = useCallback(
    (next) => {
      window.localStorage.setItem(key, next);
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value, setValue];
}
