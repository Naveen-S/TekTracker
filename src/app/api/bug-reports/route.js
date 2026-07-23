/**
 * /api/bug-reports — GET: list reports (any authenticated user; the dashboards are org-level, not
 * team-scoped, gm-bug-report.md decision 18); POST: create a report (global admin only).
 *
 * A newly created report has no scopes/bands/categories yet — it is configured through
 * `PUT …/[reportId]/config`. The app ships with NO report at all, so `/bugs` renders a
 * "no report configured yet" state until an admin creates one.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { bugReportCreateSchema } from "@/lib/schemas/bug-report";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const reports = await prisma.bugReport.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        ownerName: true,
        isActive: true,
        lastRefreshedAt: true,
        lastRefreshError: true,
      },
    });
    return Response.json(reports);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const data = await parseJsonBody(request, bugReportCreateSchema);
    const report = await prisma.bugReport.create({ data });
    return Response.json(report);
  } catch (error) {
    return handleRouteError(error);
  }
}
