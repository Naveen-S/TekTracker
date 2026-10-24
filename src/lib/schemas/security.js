import { z } from "zod";

/**
 * Security tracker boundary schemas (security-vulnerability-tracker.md (c); lean admin forms, C4).
 * `slaDays` and `riskThresholds` arrive as parsed JSON from text areas and are validated here, so a
 * typo in /admin is a 400 with a field path rather than a broken dashboard.
 */

const jql = z.string().trim().min(1, "JQL is required").max(4000);
const pageId = z.string().trim().regex(/^\d{4,20}$/, "a numeric Confluence page id");
const fieldId = z.string().trim().regex(/^customfield_\d+$/, "a custom field id like customfield_14539");
const nonNegInt = z.number().int().min(0).max(100000);

export const slaDaysSchema = z
  .object({ P0: nonNegInt, P1: nonNegInt, P2: nonNegInt, P3: nonNegInt, P4: nonNegInt })
  .partial()
  .strict();

export const riskThresholdsSchema = z
  .object({
    pastSla: z.object({ highP0: nonNegInt, highP1: nonNegInt }).partial().strict(),
    overdue: z.object({ high: nonNegInt }).partial().strict(),
    noFixVersion: z.object({ highPctOfOpen: z.number().min(0).max(100) }).partial().strict(),
    stale: z.object({ days: z.number().int().min(1).max(3650) }).partial().strict(),
  })
  .partial()
  .strict();

export const securitySettingsSchema = z.object({
  openPipelineJql: jql,
  priorityJql: jql,
  vulnLabelsPageId: pageId,
  trackLabelsPageId: pageId,
  serviceTrackPageId: pageId,
  monthLabelPrefix: z.string().trim().regex(/^[A-Z0-9_]{1,40}$/, "UPPER_SNAKE prefix, e.g. DRP_SECURITY_"),
  slaDays: slaDaysSchema,
  dueSoonDays: z.number().int().min(0).max(365),
  placeholderEstimateDays: z.array(z.number().positive().max(10000)).max(20),
  storyPointsField: fieldId,
  sprintField: fieldId,
  subComponentField: fieldId,
  workbenchUrl: z
    .string()
    .trim()
    .url("a full https:// URL")
    .refine((url) => url.startsWith("https://"), "must be https://")
    .nullish()
    .or(z.literal("").transform(() => null)),
  riskThresholds: riskThresholdsSchema,
});

export const securityReleaseSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM"),
  shipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  note: z.string().trim().max(200).nullish(),
});

/** PUT /api/security/settings — the settings singleton + the WHOLE release calendar (replaced as a set). */
export const securitySettingsPutSchema = z
  .object({
    settings: securitySettingsSchema,
    releases: z.array(securityReleaseSchema).max(120),
  })
  .superRefine((body, ctx) => {
    const seen = new Set();
    body.releases.forEach((release, index) => {
      if (seen.has(release.month)) ctx.addIssue({ code: "custom", path: ["releases", index, "month"], message: "duplicate month" });
      seen.add(release.month);
      if (!release.shipDate.startsWith(release.month)) {
        ctx.addIssue({ code: "custom", path: ["releases", index, "shipDate"], message: "ship date must fall in its month" });
      }
    });
  });

const programFields = z.object({
  key: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/, "letters, digits and _ (e.g. DR_GM)"),
  name: z.string().trim().min(1, "name is required").max(80),
  component: z.string().trim().min(1, "component is required").max(80),
  sortOrder: z.number().int().min(0).max(1000),
  isActive: z.boolean(),
  progressJql: jql,
  excludeLabel: z.string().trim().max(80).nullish().transform((value) => value || null),
  trackBreached: z.boolean(),
  usesTrackLabels: z.boolean(),
  legacyLabel: z.string().trim().max(80).nullish().transform((value) => value || null),
  note: z.string().trim().max(500).nullish().transform((value) => value || null),
  programId: z.string().trim().min(1).nullish().transform((value) => value || null),
});

export const securityProgramCreateSchema = programFields.partial({
  sortOrder: true,
  isActive: true,
  trackBreached: true,
  usesTrackLabels: true,
  excludeLabel: true,
  legacyLabel: true,
  note: true,
  programId: true,
});

export const securityProgramPatchSchema = programFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");
