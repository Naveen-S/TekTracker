/**
 * /api/me — PATCH: the signed-in user sets their own "default board view" (default-team-release.md):
 * the team + release the `/` board opens on when no ?team/?sprint param is given. Self-scoped via
 * `requireUser()` only (any authenticated user edits their OWN row) — the first User-self-mutation
 * endpoint. Pinning a team the caller can't see is rejected (403); a pinned release is any global
 * Sprint id (or null to clear — a garbage/deleted id simply falls back to ACTIVE on read). Read back
 * on `/` by getDashboardData; never a metric input.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { mePatchSchema } from "@/lib/schemas/user";

export const dynamic = "force-dynamic";

export async function PATCH(request) {
  try {
    const user = await requireUser();
    const patch = await parseJsonBody(request, mePatchSchema);

    // Only touch the halves the caller sent, so team/release can be set or cleared independently.
    const data = {};
    if (patch.defaultTeamId !== undefined) data.defaultTeamId = patch.defaultTeamId;
    if (patch.defaultSprintId !== undefined) data.defaultSprintId = patch.defaultSprintId;

    // Pin only a team the caller can actually open (global admin sees every team) — otherwise the
    // pin would silently miss the selection `find` and land them on teams[0] every visit anyway.
    if (data.defaultTeamId && !user.isAdmin) {
      const membership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId: data.defaultTeamId } },
        select: { teamId: true },
      });
      if (!membership) {
        throw new ForbiddenError("You are not a member of that team");
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { defaultTeamId: true, defaultSprintId: true },
    });
    return Response.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
