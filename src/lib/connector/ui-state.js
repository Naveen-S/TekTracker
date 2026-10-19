/**
 * Server-side props for `AnalysisProvider` (claude-connector-analysis.md §Scope e): the admin
 * `enabled` flag + which of the page's tickets already have a saved analysis. One indexed read;
 * skipped entirely while the feature is off. UI affordance only — every route re-checks.
 */
import { prisma } from "@/lib/db";
import { getAnalysisSettings } from "@/lib/connector/settings";

/**
 * @param {string[]} jiraKeys every ticket key the page renders
 * @returns {Promise<{ enabled: boolean, analyzedKeys: string[] }>}
 */
export async function getAnalysisUiState(jiraKeys) {
  const { enabled } = await getAnalysisSettings();
  const unique = [...new Set(jiraKeys)];
  if (!enabled || unique.length === 0) {
    return { enabled, analyzedKeys: [] };
  }
  const rows = await prisma.issueAnalysis.findMany({
    where: { jiraKey: { in: unique } },
    select: { jiraKey: true },
  });
  return { enabled, analyzedKeys: rows.map((row) => row.jiraKey) };
}
