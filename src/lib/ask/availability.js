/**
 * Is Ask StoryBoard switched on? (ask-storyboard.md as-built 21.)
 *
 * Ask has two engines: the asker's own Claude Connector (first) and the server AI provider
 * (second). Either one is enough, so Ask is on when `AI_PROVIDER` is set OR an admin has enabled
 * Claude analysis. With only the connector, a user whose connector is offline is told to start it
 * rather than getting an answer.
 *
 * This is separate from `isAiConfigured()`, which still alone gates the AI Digest: the Digest has
 * no connector path.
 */
import { isAiConfigured } from "@/lib/ai/provider";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { logger } from "@/lib/log";

/** @returns {Promise<boolean>} */
export async function isAskEnabled() {
  if (isAiConfigured()) return true;
  try {
    return (await getAnalysisSettings()).enabled;
  } catch (error) {
    // e.g. the settings table is missing (migration 14 not applied yet). Ask stays hidden; the page
    // itself must not fail because of it.
    logger.warn("ask.availability_unknown", { err: error });
    return false;
  }
}
