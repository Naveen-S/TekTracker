/**
 * POST /api/ask — answer one Ask StoryBoard question (ask-storyboard.md (d)), grounded only in
 * StoryBoard data the caller can see. Flat route: a question may span teams, programs, bug
 * reports and sprints, so there is no `[teamId]` to nest under — the page's context ids travel in
 * the body and every data pack re-checks access itself (lib/ask/packs.js).
 *
 * Access: any signed-in user (VIEWER included — ai-insights decision 5). What they can learn is
 * bounded per pack by the gate its page already applies.
 *
 * Routing: the asker's own Claude Connector answers first (200 `{ pending }`, then the client
 * re-POSTs with `resume`); the server AI provider answers when the connector can't.
 *
 * Errors (all typed, mapped by withRoute): 400 bad body · 401 unauthenticated · 429 over the
 * per-user limit · 503 neither engine set up · 409 CONNECTOR_OFFLINE no provider and the asker's
 * connector can't answer · 502 provider failure/timeout/invalid reply.
 */
import { requireUser } from "@/lib/auth";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { askBodySchema } from "@/lib/schemas/ask";
import { consumeAskQuota } from "@/lib/ask/rate-limit";
import { answerQuestion } from "@/lib/ask/orchestrate";
import { AiNotConfiguredError } from "@/lib/ai/errors";
import { isAskEnabled } from "@/lib/ask/availability";

export const dynamic = "force-dynamic";

export const POST = withRoute("ask", async (request) => {
  const user = await requireUser();
  // Fail fast (503) before parsing, counting quota, or reading any data when neither engine is set
  // up: no AI provider AND Claude analysis off (as-built 21; either one is enough).
  if (!(await isAskEnabled())) {
    throw new AiNotConfiguredError("Ask StoryBoard is not set up — set AI_PROVIDER or enable Claude analysis");
  }
  const body = await parseJsonBody(request, askBodySchema);
  // A resume is the same question still being answered, not a new one.
  if (!body.resume) consumeAskQuota(user.id);
  return Response.json(await answerQuestion(user, body));
});
