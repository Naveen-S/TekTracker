"use client";

/**
 * Page-level Claude analysis state (claude-connector-analysis.md §Scope e): whether the feature is
 * on, and which tickets already have a saved analysis (the filled-sparkle marker). Provided once
 * at each page root (`/`, `/bugs`, `/rollup`) so the per-row `AnalyseButton` needs no prop
 * drilling through four different row components. Without a provider, buttons render nothing.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AnalysisContext = createContext({
  enabled: false,
  isAnalyzed: () => false,
  markAnalyzed: () => {},
});

export function AnalysisProvider({ enabled, analyzedKeys = [], children }) {
  // Keys analysed during this visit, so the marker fills immediately without a page refresh.
  const [added, setAdded] = useState(() => new Set());
  const keys = useMemo(() => new Set([...analyzedKeys, ...added]), [analyzedKeys, added]);
  const markAnalyzed = useCallback(
    (jiraKey) => setAdded((current) => (current.has(jiraKey) ? current : new Set(current).add(jiraKey))),
    [],
  );
  const value = useMemo(
    () => ({ enabled, isAnalyzed: (jiraKey) => keys.has(jiraKey), markAnalyzed }),
    [enabled, keys, markAnalyzed],
  );
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}
