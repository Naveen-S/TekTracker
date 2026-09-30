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
import { buildJobPayload, failStaleJobs } from "@/lib/connector/jobs";

export const dynamic = "force-dynamic";

const HOLD_MS = 15_000;
const CHECK_MS = 1_500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function claimNext(userId) {
  const candidate = await prisma.analysisJob.findFirst({
    where: { requestedById: userId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
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
