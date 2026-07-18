/**
 * POST /api/cron/daily — the step-7 background job (background-sync-snapshots.md (c)): refresh
 * Issue caches + write the daily per-team SprintSnapshot for every ACTIVE sprint. Called by an
 * external scheduler on Tekion infra, not by the browser — no session, no RBAC (the job is
 * org-wide and userless); the gate is the CRON_SECRET bearer token (decision 2). Any request
 * body is ignored.
 *
 * Ops (deploy-time, out of repo scope):
 *   0 19 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<internal-host>/api/cron/daily
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { UnauthorizedError } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/route-helpers";
import { runDailyJob } from "@/lib/cron/daily";

export const dynamic = "force-dynamic";

const sha256 = (value) => createHash("sha256").update(value).digest();

/**
 * Gate on `Authorization: Bearer <CRON_SECRET>`. Compared as SHA-256 digests via
 * `timingSafeEqual` — it throws on length mismatch, digests are always 32 bytes. Unset/short
 * secret fails loudly (→ 500; never a silent fallback, auth-layer decision 9); a missing or
 * wrong bearer → 401.
 */
function requireCronSecret(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "CRON_SECRET is not set or is shorter than 32 chars — generate with `openssl rand -base64 32`",
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!timingSafeEqual(sha256(token), sha256(secret))) {
    throw new UnauthorizedError("Invalid or missing cron secret");
  }
}

export async function POST(request) {
  try {
    requireCronSecret(request);
    const summary = await runDailyJob({ capturedOn: new Date() });
    return Response.json(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
