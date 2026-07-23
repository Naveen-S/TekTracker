/**
 * /api/bug-reports/[reportId] — GET the report + its full config (any authenticated user),
 * PATCH report-level fields, DELETE the report (both global admin only).
 *
 * Deleting cascades to scopes/bands/categories/cache/snapshots (schema `onDelete: Cascade`) —
 * including its history, which is intentional: a deleted report has no dashboard to render it.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { bugReportPatchSchema } from "@/lib/schemas/bug-report";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await requireUser();
    const { reportId } = await params;
    const report = await prisma.bugReport.findUnique({
      where: { id: reportId },
      include: {
        scopes: { orderBy: { sortOrder: "asc" }, include: { slaTargets: true } },
        bands: { orderBy: { sortOrder: "asc" } },
        categories: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!report) throw new NotFoundError("Bug report not found");
    return Response.json(report);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    await requireAdmin();
    const { reportId } = await params;
    const patch = await parseJsonBody(request, bugReportPatchSchema);

    // A fallback category must belong to THIS report — otherwise rows would silently vanish into
    // a category that never renders here (decision 9).
    if (patch.fallbackCategoryId) {
      const category = await prisma.bugReportCategory.findFirst({
        where: { id: patch.fallbackCategoryId, reportId },
        select: { id: true },
      });
      if (!category) throw new NotFoundError("Fallback category not found in this report");
    }

    const report = await prisma.bugReport.update({ where: { id: reportId }, data: patch });
    return Response.json(report);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin();
    const { reportId } = await params;
    await prisma.bugReport.delete({ where: { id: reportId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
