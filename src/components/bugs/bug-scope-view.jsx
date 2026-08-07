"use client";

/**
 * The External / Internal / All scope lens (enhancing-bug-board.md decision 2).
 *
 * The toggle governs the WHOLE page (matrix, KPIs, every chart, and the by-team section), yet must
 * persist across switches — so it cannot live inside the switched region, and the static hero holds
 * the report switcher + Refresh whose state must survive a scope change. The clean RSC shape:
 *   - `BugScopeProvider` (this client boundary) owns the one `scope` string and wraps the whole page.
 *   - `BugScopeToggle` sets it from inside the ink hero.
 *   - `BugScopeSlot` reads it and mounts the matching PRE-RENDERED server subtree (passed as a prop
 *     map). Only the selected subtree mounts, so switching is instant with no network round-trip and
 *     the panels stay server components. The pressure bar (in the hero) and the body (below it) are
 *     two slots reading the same context, so both react to one control.
 *
 * External is highlighted (decision 1): it leads the segments and carries a persistent accent dot,
 * on ink, even when another scope is active.
 */
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const ScopeContext = createContext(null);

export function BugScopeProvider({ scopeOptions, externalScopeId, defaultScope = "all", children }) {
  const [scope, setScope] = useState(defaultScope);
  return (
    <ScopeContext.Provider value={{ scope, setScope, scopeOptions, externalScopeId }}>
      {children}
    </ScopeContext.Provider>
  );
}

/** Read the active scope + options from context (used by the toggle, slots, and the PDF export). */
export function useBugScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("BugScope components must be used within BugScopeProvider");
  return ctx;
}

/** The segmented control, styled for the ink hero (the rollup-story-points glass-pill grammar). */
export function BugScopeToggle({ className }) {
  const { scope, setScope, scopeOptions, externalScopeId } = useBugScope();

  const segments = [
    ...scopeOptions.map((option) => ({
      id: option.id,
      label: option.name,
      emphasized: option.id === externalScopeId,
    })),
    ...(scopeOptions.length > 1 ? [{ id: "all", label: "All", emphasized: false }] : []),
  ];
  // Nothing to toggle with a single scope — the one view already IS the whole page.
  if (segments.length <= 1) return null;

  return (
    <span
      role="group"
      aria-label="Bug scope"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-white/12 bg-white/6 p-0.5",
        className,
      )}
    >
      {segments.map((segment) => {
        const active = scope === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            onClick={() => setScope(segment.id)}
            aria-pressed={active}
            title={segment.emphasized ? `${segment.label} bugs (highlighted)` : `${segment.label} bugs`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
              active ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/8 hover:text-white/80",
            )}
          >
            {segment.emphasized && (
              <span className="size-1.5 rounded-full bg-on-ink-accent" aria-hidden="true" />
            )}
            {segment.label}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Mounts the pre-rendered subtree for the active scope. `views` is a map keyed by scope id plus
 * `"all"`; each value is a server-rendered node created in `BugsPage`. Falls back to `all` so a
 * single-scope report (no `all` distinction) still renders.
 */
export function BugScopeSlot({ views }) {
  const { scope } = useBugScope();
  return views[scope] ?? views.all ?? null;
}
