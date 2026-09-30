/**
 * Claude Connector pairing tokens (claude-connector-analysis.md §Scope b).
 *
 * The token is a personal bearer credential for the `/api/connector/*` routes ONLY — the local
 * connector presents it as `Authorization: Bearer sbc_…`. Only its sha256 is stored, so a database
 * read never yields a usable token; the plaintext is shown once, at generation. sha256 (not a slow
 * KDF) is deliberate: the input is 192 random bits, not a human password, and every poll must
 * look it up by an indexed equality match.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { setLogContext } from "@/lib/log";
import { ConnectorUnauthorizedError } from "@/lib/connector/errors";

const TOKEN_PREFIX = "sbc_";

/** A connector counts as online if it polled within this window (it long-polls, holding each request ≤ 15 s). */
export const CONNECTOR_ONLINE_WINDOW_MS = 30_000;

/** `sbc_` + 24 random bytes base64url (mirrors lib/share-token.js). */
export function generateConnectorToken() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** @param {string} token */
export function hashConnectorToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * @param {{ lastSeenAt: Date | null } | null | undefined} row
 * @param {Date} [now]
 */
export function isConnectorOnline(row, now = new Date()) {
  if (!row?.lastSeenAt) return false;
  return now.getTime() - row.lastSeenAt.getTime() <= CONNECTOR_ONLINE_WINDOW_MS;
}

const VERSION_PATTERN = /^[\w.+ ()-]{1,64}$/;

/** Keep client-reported version strings short and printable before they reach the DB. */
function cleanVersion(value) {
  const trimmed = value?.trim();
  return trimmed && VERSION_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Authenticate a connector request by its Bearer token and record the heartbeat.
 *
 * @param {Request} request
 * @returns {Promise<{ tokenId: string, userId: string }>}
 * @throws {ConnectorUnauthorizedError}
 */
export async function requireConnector(request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(sbc_[\w-]{16,128})$/.exec(header.trim());
  if (!match) {
    throw new ConnectorUnauthorizedError();
  }

  const row = await prisma.connectorToken.findUnique({
    where: { tokenHash: hashConnectorToken(match[1]) },
    select: { id: true, userId: true },
  });
  if (!row) {
    throw new ConnectorUnauthorizedError();
  }

  setLogContext({ userId: row.userId, actor: "connector" });

  const connectorVersion = cleanVersion(request.headers.get("x-storyboard-connector-version"));
  const claudeVersion = cleanVersion(request.headers.get("x-claude-version"));
  await prisma.connectorToken.update({
    where: { id: row.id },
    data: {
      lastSeenAt: new Date(),
      ...(connectorVersion ? { connectorVersion } : {}),
      ...(claudeVersion ? { claudeVersion } : {}),
    },
  });

  return { tokenId: row.id, userId: row.userId };
}
