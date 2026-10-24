/**
 * Refresh the stored Confluence vocabulary (security-vulnerability-tracker.md (b) vocab-refresh.js).
 * The three pages are read SERIALLY (decision 11). Each page stands alone: a page that can't be read
 * or no longer parses keeps its previous list (live or the code snapshot) and its reason goes to
 * `vocabError`. The vocabulary is server state — never a click-time fetch — which removes the
 * artifact's "Couldn't read the Confluence label pages" failure mode.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";
import { ERROR_CODES } from "@/lib/errors";
import { fetchConfluencePage } from "@/lib/jira/confluence";
import { SECURITY_SETTINGS_ID, VOCAB_SNAPSHOT, settingsCreatePayload } from "@/lib/security/defaults.mjs";
import { parsePage, serviceMapFromTracks } from "@/lib/security/vocab.mjs";

const PAGES = [
  ["vuln", "vulnLabelsPageId", "vulnerability labels"],
  ["track", "trackLabelsPageId", "track labels"],
  ["service", "serviceTrackPageId", "service→track"],
];

/**
 * @param {{ auth: object, settings: object }} args
 * @returns {Promise<{ warnings: Array<{ code: string, message: string }>, live: object }>}
 */
export async function refreshVocabulary({ auth, settings }) {
  const previous = settings.vocab ?? {
    vuln: VOCAB_SNAPSHOT.vuln,
    track: VOCAB_SNAPSHOT.track,
    service: serviceMapFromTracks(VOCAB_SNAPSHOT.service),
    live: { vuln: false, track: false, service: false },
  };
  const next = { ...previous, live: { ...previous.live } };
  const errors = [];
  let fetched = 0;

  for (const [kind, settingKey, name] of PAGES) {
    try {
      const page = await fetchConfluencePage({ auth, pageId: settings[settingKey] });
      next[kind] = parsePage(kind, page.storage);
      next.live[kind] = true;
      fetched += 1;
    } catch (error) {
      errors.push(`${name} page (${settings[settingKey]}): ${error.message}`);
      logger.warn("security.vocab_page_failed", { kind, pageId: settings[settingKey], err: error });
    }
  }

  const data = {
    vocab: next,
    vocabError: errors.length ? errors.join(" · ").slice(0, 1000) : null,
    ...(fetched > 0 ? { vocabFetchedAt: new Date() } : {}),
  };
  await prisma.securityTrackerSettings.upsert({
    where: { id: SECURITY_SETTINGS_ID },
    update: data,
    create: { ...settingsCreatePayload(), ...data },
  });

  return {
    live: next.live,
    warnings: errors.map((message) => ({ code: ERROR_CODES.SECURITY_VOCAB_UNAVAILABLE, message: `Kept the previous vocabulary for the ${message}` })),
  };
}
