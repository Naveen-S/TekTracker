/**
 * /api/me/connector — the signed-in user's own StoryBoard Connector pairing
 * (claude-connector-analysis.md §Scope c). Self-scoped via `requireUser()`, like PATCH /api/me.
 *   GET    → pairing status: paired?, online?, lastSeenAt, versions
 *   POST   → generate (or regenerate) the token; the plaintext is returned ONCE and only its hash
 *            is stored. Regenerating replaces the row, so the old token stops working immediately.
 *   DELETE → revoke (delete the row)
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withRoute } from "@/lib/api/route-helpers";
import {
  generateConnectorToken,
  hashConnectorToken,
  isConnectorOnline,
} from "@/lib/connector/token";

export const dynamic = "force-dynamic";

function serialize(row) {
  return {
    paired: Boolean(row),
    online: isConnectorOnline(row),
    lastSeenAt: row?.lastSeenAt ?? null,
    connectorVersion: row?.connectorVersion ?? null,
    claudeVersion: row?.claudeVersion ?? null,
    pairedAt: row?.createdAt ?? null,
  };
}

export const GET = withRoute("me.connector", async () => {
  const user = await requireUser();
  const row = await prisma.connectorToken.findUnique({ where: { userId: user.id } });
  return Response.json(serialize(row));
});

export const POST = withRoute("me.connector", async () => {
  const user = await requireUser();
  const token = generateConnectorToken();
  const tokenHash = hashConnectorToken(token);
  const row = await prisma.connectorToken.upsert({
    where: { userId: user.id },
    update: { tokenHash, lastSeenAt: null, connectorVersion: null, claudeVersion: null, createdAt: new Date() },
    create: { userId: user.id, tokenHash },
  });
  return Response.json({ ...serialize(row), token }, { status: 201 });
});

export const DELETE = withRoute("me.connector", async () => {
  const user = await requireUser();
  await prisma.connectorToken.deleteMany({ where: { userId: user.id } });
  return Response.json(serialize(null));
});
