/**
 * POST /api/auth/logout — clear the session cookie (ports server.js `/api/auth/logout`).
 */
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  return Response.json({ ok: true });
}
