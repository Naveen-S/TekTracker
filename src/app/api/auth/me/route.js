/**
 * GET /api/auth/me — current identity from the session (ports server.js `/api/auth/me`).
 * Reads the user fresh from the DB (auth-layer.md decision 8) so `isAdmin` is never stale.
 */
import { getCurrentUser, UnauthorizedError } from "@/lib/auth";
import { withRoute } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withRoute("auth.me", async () => {
  const user = await getCurrentUser();
  if (!user) {
    // Throw rather than hand-roll the 401: the shared helper is what attaches code + requestId.
    throw new UnauthorizedError();
  }
  return Response.json({
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    avatarUrl: user.avatarUrl,
  });
});
