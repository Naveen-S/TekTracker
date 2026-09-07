/**
 * /api/users — GET: minimal user directory (global admin only), for the provisioning UI to pick
 * members from (§16: users sign in with Jira first, then get added to teams). Changing `isAdmin`
 * via API is deliberately out of scope (seed/DB-managed).
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, handleRouteError } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withRoute("users", async () => {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: { id: true, email: true, displayName: true, avatarUrl: true, isAdmin: true },
      orderBy: { displayName: "asc" },
    });
    return Response.json(users);
  } catch (error) {
    return handleRouteError(error);
  }
});
