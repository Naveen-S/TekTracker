/**
 * Deterministic filter accent-color assignment by creation order (ui-polish.md decision 7;
 * previously inlined in `add-filter-dialog.jsx`). Extracted so the one-click-sprint-start server
 * route assigns colors identically to the manual "Add filter" client dialog.
 *
 * Legacy accent palette (src/jiraService.js :236-244, red dropped).
 */
export const ACCENT_PALETTE = ["#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#f59e0b"];

/** @param {number} existingCount current filter count for the (team, sprint) BEFORE this one */
export function accentColorForIndex(existingCount) {
  return ACCENT_PALETTE[existingCount % ACCENT_PALETTE.length];
}
