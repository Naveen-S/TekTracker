/**
 * POST /api/auth/logout — clear the session cookie (ports server.js `/api/auth/logout`).
 */
import { destroySession } from "@/lib/auth";
import { withRoute } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export const POST = withRoute("auth.logout", async () => {
  await destroySession();
  return Response.json({ ok: true });
});
