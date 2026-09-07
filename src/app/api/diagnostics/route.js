/**
 * GET /api/diagnostics — admin-only deployment health, in one curl.
 *
 * Exists because production triage kept starting with a guess. When someone reports "login is
 * broken" or "the board is empty", the real cause is almost always one of five things, and this
 * route answers all five at once without shell access to the container:
 *
 *   env         → did this container actually receive its secrets?  (names + booleans, NEVER values)
 *   db          → is Postgres reachable, and has `yarn db:deploy` run here? (migrations are a
 *                 SEPARATE release step on internal infra — DEPLOY.md §5 — so "behind" is a real state)
 *   jira        → can this container reach Atlassian AT ALL? (unauthenticated probe, so it
 *                 separates a network/egress problem from a bad token)
 *   cronUser    → is the CRON_SYNC_USER_EMAIL service token still alive? (a dead one silently
 *                 freezes every team's data while the app keeps answering 200)
 *   session     → is the Secure cookie flag consistent with how requests actually arrive? A
 *                 mismatch means login "succeeds" and the user bounces back to /login forever.
 *
 * Every probe is independently guarded: one failure must not hide the other four — the whole point
 * is to see them side by side.
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";
import { getSessionCookieInfo } from "@/lib/auth";
import { getJiraAuthForUser, fetchMyself, probeJiraReachable } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

/** Presence only. Values are never returned — the NAME of an unset variable is the whole answer. */
const REPORTED_ENV = [
  "DATABASE_URL",
  "SESSION_PASSWORD",
  "TOKEN_ENCRYPTION_KEY",
  "JIRA_BASE_URL",
  "CRON_SECRET",
  "CRON_SYNC_USER_EMAIL",
  "AI_PROVIDER",
  "JIRA_SUBCOMPONENT_FIELD_ID",
  "JIRA_SPRINT_FIELD_ID",
  "DEBUG_ERRORS",
];

const STALE_AFTER_HOURS = 24;

async function checkDatabase() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - startedAt;

    // Read the migration ledger directly: "is this environment on the schema the app expects?" is
    // otherwise unanswerable from inside the running app.
    let migrations = null;
    try {
      const rows = await prisma.$queryRaw`
        SELECT migration_name, finished_at
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
      `;
      migrations = {
        applied: rows.length,
        latest: rows[0]?.migration_name ?? null,
        latestAt: rows[0]?.finished_at ?? null,
      };
    } catch (error) {
      migrations = { error: `Could not read the migration ledger: ${error.message}` };
    }

    return { ok: true, ms, migrations };
  } catch (error) {
    return { ok: false, ms: Date.now() - startedAt, error: error.message, code: error.code ?? null };
  }
}

async function checkCronUser() {
  const email = process.env.CRON_SYNC_USER_EMAIL?.trim();
  if (!email) return { configured: false, reason: "CRON_SYNC_USER_EMAIL is not set" };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return { configured: true, email, jira: "no-such-user" };

  try {
    await fetchMyself(await getJiraAuthForUser(user.id));
    return { configured: true, email, jira: "ok" };
  } catch (error) {
    // The single most valuable line here: a dead service token is invisible in normal operation.
    return { configured: true, email, jira: "failed", code: error.code ?? null, error: error.message };
  }
}

function checkSession(request) {
  const cookie = getSessionCookieInfo();
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? null;
  let proto = forwarded;
  if (!proto) {
    try {
      proto = new URL(request.url).protocol.replace(":", "");
    } catch {
      proto = null;
    }
  }
  const mismatch = cookie.secure && proto !== null && proto !== "https";
  return {
    cookieName: cookie.cookieName,
    secureCookies: cookie.secure,
    requestProto: proto,
    ...(mismatch
      ? {
          mismatch:
            "Secure cookies over a non-HTTPS request: the browser will discard the session, so login returns 200 and immediately bounces back to /login. Check TLS termination and x-forwarded-proto.",
        }
      : {}),
  };
}

async function checkFreshness() {
  const [lastSnapshot, teams] = await Promise.all([
    prisma.sprintSnapshot.findFirst({
      orderBy: { capturedOn: "desc" },
      select: { capturedOn: true },
    }),
    prisma.team.findMany({
      select: {
        key: true,
        filters: { select: { lastSyncedAt: true }, where: { sprint: { state: "ACTIVE" } } },
      },
    }),
  ]);

  const now = Date.now();
  const staleTeams = [];
  for (const team of teams) {
    if (team.filters.length === 0) continue;
    const latest = team.filters
      .map((filter) => filter.lastSyncedAt?.getTime() ?? null)
      .filter((value) => value !== null)
      .reduce((max, value) => (value > max ? value : max), 0);

    if (latest === 0) {
      staleTeams.push({ key: team.key, hoursSinceSync: null, note: "never synced" });
      continue;
    }
    const hours = Math.round((now - latest) / 3_600_000);
    if (hours >= STALE_AFTER_HOURS) staleTeams.push({ key: team.key, hoursSinceSync: hours });
  }

  return { lastSnapshotOn: lastSnapshot?.capturedOn ?? null, staleTeams };
}

async function checkRecentErrors() {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const grouped = await prisma.errorLog.groupBy({
      by: ["code"],
      where: { createdAt: { gte: since } },
      _count: { code: true },
      orderBy: { _count: { code: "desc" } },
      take: 5,
    });
    return {
      last24h: grouped.reduce((sum, row) => sum + row._count.code, 0),
      byCode: grouped.map((row) => ({ code: row.code, count: row._count.code })),
    };
  } catch (error) {
    // The ErrorLog table only exists after migration 13 is deployed here — which is exactly the
    // kind of thing this route is for, so report it rather than failing the whole response.
    return { error: `Could not read ErrorLog: ${error.message}`, code: error.code ?? null };
  }
}

export const GET = withRoute("diagnostics", async (request) => {
  await requireAdmin();

  const [db, jira, cronUser, freshness, recentErrors] = await Promise.all([
    checkDatabase(),
    probeJiraReachable(),
    checkCronUser(),
    checkFreshness(),
    checkRecentErrors(),
  ]);

  return Response.json({
    checkedAt: new Date().toISOString(),
    node: process.version,
    nodeEnv: process.env.NODE_ENV ?? null,
    env: Object.fromEntries(REPORTED_ENV.map((name) => [name, Boolean(process.env[name]?.trim())])),
    db,
    jira,
    cronUser,
    session: checkSession(request),
    ...freshness,
    recentErrors,
  });
});
