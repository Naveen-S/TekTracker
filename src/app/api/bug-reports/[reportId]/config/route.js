/**
 * PUT /api/bug-reports/[reportId]/config — replace the WHOLE config document (scopes + their SLA
 * targets, bands, categories, fallback) transactionally. Global admin only.
 *
 * One document route rather than six CRUD trees (gm-bug-report.md (e)): config is document-shaped,
 * and its real validation is cross-field — a status in two categories, a priority in two bands,
 * two catch-alls, an orphaned fallback. Those run through the SAME `validateConfig` the admin UI
 * uses for live validation, so the UI and the API can never disagree.
 *
 * Rows carrying an `id` are updated in place; rows without one are created; anything omitted is
 * deleted. Updating in place matters — a category id is a snapshot `rowKey`, so recreating
 * categories on every save would fragment history.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { bugReportConfigSchema } from "@/lib/schemas/bug-report";
import { validateConfig } from "@/lib/bug-report/matrix.mjs";

export const dynamic = "force-dynamic";

const norm = (value) => value.trim().toLowerCase();

export async function PUT(request, { params }) {
  try {
    await requireAdmin();
    const { reportId } = await params;
    const input = await parseJsonBody(request, bugReportConfigSchema);

    const existing = await prisma.bugReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Bug report not found");

    // Cross-field rules, shared with the admin UI. Ids are irrelevant here, so synthesize them.
    const errors = validateConfig({
      scopes: input.scopes.map((scope, i) => ({ id: scope.id ?? `new-${i}`, ...scope })),
      bands: input.bands.map((band, i) => ({ id: band.id ?? `new-${i}`, ...band })),
      categories: input.categories.map((category, i) => ({ id: category.id ?? `new-${i}`, ...category })),
      fallbackCategoryId: null, // resolved by name below — never orphaned at this point
    });
    if (errors.length > 0) {
      throw new ValidationError(errors.join("; "));
    }

    await prisma.$transaction(async (tx) => {
      const keepId = (list) => list.map((item) => item.id).filter(Boolean);

      // ── scopes (+ SLA targets) ──
      await tx.bugReportScope.deleteMany({
        where: { reportId, id: { notIn: keepId(input.scopes) } },
      });
      for (const [index, scope] of input.scopes.entries()) {
        const data = {
          name: scope.name,
          sortOrder: scope.sortOrder ?? index,
          sourceType: scope.sourceType,
          jql: scope.jql ?? null,
          jiraFilterId: scope.jiraFilterId ?? null,
        };
        const saved = scope.id
          ? await tx.bugReportScope.update({ where: { id: scope.id }, data })
          : await tx.bugReportScope.create({ data: { ...data, reportId } });

        // SLA targets are small and fully replaced — no id churn worth preserving.
        await tx.bugSlaTarget.deleteMany({ where: { scopeId: saved.id } });
        if (scope.slaTargets.length > 0) {
          await tx.bugSlaTarget.createMany({
            data: scope.slaTargets.map((target) => ({
              scopeId: saved.id,
              priorityName: target.priorityName,
              days: target.days,
            })),
          });
        }
      }

      // ── bands ──
      await tx.bugReportBand.deleteMany({
        where: { reportId, id: { notIn: keepId(input.bands) } },
      });
      for (const [index, band] of input.bands.entries()) {
        const data = {
          label: band.label,
          sortOrder: band.sortOrder ?? index,
          priorityNames: band.priorityNames,
          isCatchAll: band.isCatchAll,
        };
        if (band.id) {
          await tx.bugReportBand.update({ where: { id: band.id }, data });
        } else {
          await tx.bugReportBand.create({ data: { ...data, reportId } });
        }
      }

      // ── categories ── (ids are snapshot rowKeys — update in place, never recreate)
      await tx.bugReportCategory.deleteMany({
        where: { reportId, id: { notIn: keepId(input.categories) } },
      });
      const savedCategories = [];
      for (const [index, category] of input.categories.entries()) {
        const data = {
          name: category.name,
          sortOrder: category.sortOrder ?? index,
          statuses: category.statuses,
          accentColor: category.accentColor ?? null,
        };
        savedCategories.push(
          category.id
            ? await tx.bugReportCategory.update({ where: { id: category.id }, data })
            : await tx.bugReportCategory.create({ data: { ...data, reportId } }),
        );
      }

      // ── fallback, resolved by name (categories may have just been created) ──
      const fallback = input.fallbackCategoryName
        ? savedCategories.find(
            (category) => norm(category.name) === norm(input.fallbackCategoryName),
          )
        : null;
      await tx.bugReport.update({
        where: { id: reportId },
        data: { fallbackCategoryId: fallback?.id ?? null },
      });
    },
    // A full config save is ~20 sequential round-trips (scopes + their SLA targets, bands,
    // categories, fallback). Against Neon that comfortably exceeds Prisma's 5s default, and it
    // grows with the number of categories — so budget for it rather than let a big config 500.
    { timeout: 30000 });

    // Read back AFTER the commit: it needs no transactional guarantee, and keeping it inside
    // only spent more of the budget.
    const result = await prisma.bugReport.findUnique({
      where: { id: reportId },
      include: {
        scopes: { orderBy: { sortOrder: "asc" }, include: { slaTargets: true } },
        bands: { orderBy: { sortOrder: "asc" } },
        categories: { orderBy: { sortOrder: "asc" } },
      },
    });

    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
