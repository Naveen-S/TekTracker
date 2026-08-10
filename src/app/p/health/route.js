// Shallow liveness probe for the deployment platform / load balancer.
// Intentionally dependency-free — no DB, no session — so a probe never fails on a
// transient DB blip (that would let the platform kill a healthy pod). For a deep
// readiness check that verifies the database, use `/api/health/db` instead.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
