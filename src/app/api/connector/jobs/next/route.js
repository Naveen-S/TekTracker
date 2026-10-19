/**
 * /api/connector/jobs/next — POST (connector Bearer auth): heartbeat + claim the caller's next job
 * (claude-connector-analysis.md §Scope c).
 *
 * LONG-POLL: the request is held for up to HOLD_MS, re-checking every CHECK_MS, and answers the
 * moment a job is claimed (200 + the run payload) or 204 when the hold expires. That gives
 * near-instant pickup at ~4 requests/min per online connector instead of a 3 s poll's ~20 — and
 * ~4 `route.ok` log lines instead of ~20. Each call bumps `lastSeenAt` (in `requireConnector`), and
 * the online window (30 s) comfortably covers one held request.
 *
 * A connector only ever claims jobs its OWN user requested — they run on that user's subscription.
 * The claim is atomic (`updateMany … where status = QUEUED`, count must be 1), so two connector
 * processes for one user can never run the same job twice.
 */
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/api/route-helpers";
import { requireConnector } from "@/lib/connector/token";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { ASK_KINDS, buildJobPayload, failStaleJobs } from "@/lib/connector/jobs";

export const dynamic = "force-dynamic";

const HOLD_MS = 15_000;
const CHECK_MS = 1_500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function claimNext(userId) {
  // An Ask question is someone waiting on a spoken answer — it jumps any queued ticket analysis.
  const oldest = (where) =>
    prisma.analysisJob.findFirst({
      where: { requestedById: userId, status: "QUEUED", ...where },
      orderBy: { createdAt: "asc" },
    });
  const candidate = (await oldest({ kind: { in: ASK_KINDS } })) ?? (await oldest({}));
  if (!candidate) return null;
  const { count } = await prisma.analysisJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", claimedAt: new Date(), progressNote: "Starting Claude Code…" },
  });
  return count === 1 ? candidate : null;
}

export const POST = withRoute("connector.jobs.next", async (request) => {
  const { userId } = await requireConnector(request);
  const settings = await getAnalysisSettings();
  if (!settings.enabled) {
    // Hold the poll even when analysis is off. Answering at once sent connectors into a tight
    // re-poll loop (no pause between empty answers) that hammered the server and wrote `lastSeenAt`
    // on every request — seen on stage as gateway 502s, 2026-10-09.
    const until = Date.now() + HOLD_MS;
    while (Date.now() < until && !request.signal?.aborted) await sleep(CHECK_MS);
    return new Response(null, { status: 204 });
  }
  await failStaleJobs({ requestedById: userId }, settings.timeoutMinutes);

  const deadline = Date.now() + HOLD_MS;
  for (;;) {
    // Never claim for a connector that has already hung up — the job would sit RUNNING until the
    // stale sweep failed it.
    if (request.signal?.aborted) {
      return new Response(null, { status: 204 });
    }
    const job = await claimNext(userId);
    if (job) {
      return Response.json(buildJobPayload(job, settings));
    }
    if (Date.now() + CHECK_MS >= deadline) {
      return new Response(null, { status: 204 });
    }
    await sleep(CHECK_MS);
  }
});
