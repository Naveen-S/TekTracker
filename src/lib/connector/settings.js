/**
 * Claude analysis settings (claude-connector-analysis.md decisions 13–14): the admin-owned singleton
 * row, read with code defaults when absent so an unseeded database reads as "disabled".
 */
import { prisma } from "@/lib/db";
import { ANALYSIS_SETTINGS_DEFAULTS, ANALYSIS_SETTINGS_ID } from "@/lib/connector/defaults.mjs";

/**
 * @returns {Promise<{ enabled: boolean, allowedModels: string[], defaultModel: string,
 *   effort: string, maxBudgetUsd: number, timeoutMinutes: number }>}
 */
export async function getAnalysisSettings() {
  const row = await prisma.claudeAnalysisSettings.findUnique({
    where: { id: ANALYSIS_SETTINGS_ID },
  });
  const { enabled, allowedModels, defaultModel, effort, maxBudgetUsd, timeoutMinutes } =
    row ?? ANALYSIS_SETTINGS_DEFAULTS;
  return { enabled, allowedModels: [...allowedModels], defaultModel, effort, maxBudgetUsd, timeoutMinutes };
}
