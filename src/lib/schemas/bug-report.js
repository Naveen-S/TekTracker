import { z } from "zod";
import { FilterSourceType } from "@/generated/prisma/client";

/**
 * Bug-report boundary schemas (gm-bug-report.md (e)).
 *
 * Source rule mirrors `Filter` (§9): `sourceType: JQL` requires `jql`; `JIRA_FILTER` requires
 * `jiraFilterId`. Cross-field rules that need the WHOLE config (a status in two categories, two
 * catch-all bands, an orphaned fallback) live in `validateConfig` in matrix.mjs — they are shared
 * with the admin UI's live validation, so they must not be duplicated here.
 */

const slug = z
  .string()
  .trim()
  .min(1, "slug is required")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase letters, digits and hyphens");

const reportFields = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  slug,
  description: z.string().trim().max(500).nullish(),
  ownerName: z.string().trim().max(120).nullish(),
  targetDate: z.coerce.date().nullish(),
  targetLabel: z.string().trim().max(120).nullish(),
  isActive: z.boolean().optional(),
});

export const bugReportCreateSchema = reportFields;

export const bugReportPatchSchema = reportFields
  .partial()
  .extend({ fallbackCategoryId: z.string().trim().min(1).nullish() })
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

const scopeSchema = z
  .object({
    id: z.string().trim().min(1).optional(), // absent = create
    name: z.string().trim().min(1, "scope name is required").max(60),
    sortOrder: z.number().int().min(0).optional(),
    sourceType: z.enum(Object.values(FilterSourceType)),
    jql: z.string().trim().min(1).nullish(),
    jiraFilterId: z.string().trim().min(1).nullish(),
    slaTargets: z
      .array(
        z.object({
          priorityName: z.string().trim().min(1).max(60),
          days: z.number().int().min(0).max(3650),
        }),
      )
      .default([]),
  })
  .superRefine((val, ctx) => {
    if (val.sourceType === FilterSourceType.JQL && !val.jql) {
      ctx.addIssue({ code: "custom", path: ["jql"], message: "jql is required when sourceType is JQL" });
    }
    if (val.sourceType === FilterSourceType.JIRA_FILTER && !val.jiraFilterId) {
      ctx.addIssue({
        code: "custom",
        path: ["jiraFilterId"],
        message: "jiraFilterId is required when sourceType is JIRA_FILTER",
      });
    }
    const seen = new Set();
    for (const target of val.slaTargets ?? []) {
      const key = target.priorityName.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["slaTargets"],
          message: `duplicate SLA target for priority "${target.priorityName}"`,
        });
      }
      seen.add(key);
    }
  });

const bandSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1, "band label is required").max(40),
  sortOrder: z.number().int().min(0).optional(),
  priorityNames: z.array(z.string().trim().min(1).max(60)).default([]),
  isCatchAll: z.boolean().default(false),
});

const categorySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "category name is required").max(80),
  sortOrder: z.number().int().min(0).optional(),
  statuses: z.array(z.string().trim().min(1).max(80)).default([]),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex color")
    .nullish(),
});

/**
 * The WHOLE config document, applied transactionally (decision: one document route rather than six
 * CRUD trees — config is document-shaped and its validation is cross-field).
 *
 * `fallbackCategoryName` (not id) identifies the fallback, because categories may be created in
 * the same request and have no id yet.
 */
export const bugReportConfigSchema = z
  .object({
    scopes: z.array(scopeSchema).min(1, "at least one scope is required"),
    bands: z.array(bandSchema).min(1, "at least one band is required"),
    categories: z.array(categorySchema).default([]),
    fallbackCategoryName: z.string().trim().min(1).nullish(),
  })
  .superRefine((val, ctx) => {
    const dupe = (list, pick, what, path) => {
      const seen = new Set();
      for (const item of list) {
        const key = pick(item).trim().toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({ code: "custom", path: [path], message: `duplicate ${what} "${pick(item)}"` });
        }
        seen.add(key);
      }
    };
    dupe(val.scopes, (s) => s.name, "scope name", "scopes");
    dupe(val.bands, (b) => b.label, "band label", "bands");
    dupe(val.categories, (c) => c.name, "category name", "categories");

    if (
      val.fallbackCategoryName &&
      !val.categories.some(
        (category) =>
          category.name.trim().toLowerCase() === val.fallbackCategoryName.trim().toLowerCase(),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fallbackCategoryName"],
        message: "fallbackCategoryName must match one of the categories",
      });
    }
  });

/** @typedef {z.infer<typeof bugReportConfigSchema>} BugReportConfigInput */
