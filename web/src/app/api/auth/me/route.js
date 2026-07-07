/**
 * GET /api/auth/me — current identity from the session (ports server.js `/api/auth/me`).
 * Reads the user fresh from the DB (auth-layer.md decision 8) so `isAdmin` is never stale.
 */
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  return Response.json({
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    avatarUrl: user.avatarUrl,
  });
}
