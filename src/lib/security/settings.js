/**
 * Security tracker configuration reads (security-vulnerability-tracker.md (a)). The settings row is
 * a singleton read with code defaults when absent (the ClaudeAnalysisSettings precedent), so an
 * unseeded database still renders an empty-but-valid /security.
 */
import { prisma } from "@/lib/db";
import { SECURITY_SETTINGS_DEFAULTS, SECURITY_SETTINGS_ID, VOCAB_SNAPSHOT } from "@/lib/security/defaults.mjs";
import { buildVocab } from "@/lib/security/vocab.mjs";

/** The settings singleton merged over the code defaults. */
export async function getSecuritySettings() {
  const row = await prisma.securityTrackerSettings.findUnique({ where: { id: SECURITY_SETTINGS_ID } });
  return { ...SECURITY_SETTINGS_DEFAULTS, ...(row ?? {}) };
}

/** Everything a read or a refresh needs: settings, programs (sortOrder), calendar, vocabulary. */
export async function loadSecurityConfig() {
  const [settings, programs, calendar] = await Promise.all([
    getSecuritySettings(),
    prisma.securityProgram.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] }),
    prisma.securityRelease.findMany({ orderBy: { month: "asc" } }),
  ]);
  return { settings, programs, calendar, vocab: buildVocab(settings.vocab, VOCAB_SNAPSHOT) };
}
