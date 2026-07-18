import { z } from "zod";
import { WorkflowType, FilterSourceType } from "@/generated/prisma/client";

/**
 * FilterTemplate + Filter boundary schemas (domain-apis.md (c)).
 *
 * Source rule (§9): `sourceType: JQL` requires `jql`; `JIRA_FILTER` requires `jiraFilterId`.
 * Enforced on create always; on PATCH only when `sourceType` itself is being changed (a PATCH that
 * changes the source kind must carry the matching source value).
 */

const filterFields = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  workflowType: z.enum(Object.values(WorkflowType)),
  sourceType: z.enum(Object.values(FilterSourceType)),
  jql: z.string().trim().min(1).nullish(),
  jiraFilterId: z.string().trim().min(1).nullish(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex color")
    .nullish(),
});

const requireSourceValue = (val, ctx) => {
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
};

export const filterTemplateCreateSchema = filterFields.superRefine(requireSourceValue);

export const filterTemplatePatchSchema = filterFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required")
  .superRefine((val, ctx) => {
    if (val.sourceType !== undefined) requireSourceValue(val, ctx);
  });

/**
 * Filter create: either full fields, or `{ fromTemplateId }` instantiating a team template
 * (decision: single object + superRefine instead of a union, for readable 400 messages). With
 * `fromTemplateId`, every other field acts as an optional override.
 */
export const filterCreateSchema = filterFields
  .partial()
  .extend({ fromTemplateId: z.string().trim().min(1).optional() })
  .superRefine((val, ctx) => {
    if (val.fromTemplateId) return;
    if (!val.name) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "name is required (or pass fromTemplateId)" });
    }
    if (!val.sourceType) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceType"],
        message: "sourceType is required (or pass fromTemplateId)",
      });
      return;
    }
    requireSourceValue(val, ctx);
  });

export const filterPatchSchema = filterTemplatePatchSchema;

/** Full ordered id list for PUT …/filters/order — must be exactly the sprint's filter set. */
export const filterReorderSchema = z.object({
  filterIds: z
    .array(z.string().trim().min(1))
    .min(1, "filterIds is required")
    .refine((ids) => new Set(ids).size === ids.length, "filterIds must not contain duplicates"),
});

/** @typedef {z.infer<typeof filterCreateSchema>} FilterCreateInput */
