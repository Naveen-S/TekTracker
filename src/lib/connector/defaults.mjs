/**
 * Claude analysis defaults (claude-connector-analysis.md, PROPOSED P3). Pure + relative-import-free
 * so both the bootstrap seed (plain Node) and the app read the same values.
 *
 * Used twice: the seed creates the singleton `ClaudeAnalysisSettings` row from these, and
 * `getAnalysisSettings()` falls back to them when that row is absent, so an unseeded database
 * reads as "disabled" rather than failing.
 */

export const ANALYSIS_SETTINGS_ID = "default";

export const ANALYSIS_SETTINGS_DEFAULTS = Object.freeze({
  enabled: false,
  allowedModels: ["opus", "sonnet"],
  defaultModel: "opus",
  effort: "medium",
  // $3, not $2: the spike measured ~$0.24 of notional cost for a single trivial DeepContext call.
  maxBudgetUsd: 3,
  timeoutMinutes: 10,
});

export const ANALYSIS_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
