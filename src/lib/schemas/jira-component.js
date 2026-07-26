import { z } from "zod";

/**
 * JiraComponent / JiraSubComponent catalog boundary schemas (one-click-sprint-start.md).
 * Admin-only, one-at-a-time entry — no bulk import, no live Jira lookup.
 */

const componentFields = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  projectKey: z.string().trim().toUpperCase().min(1, "projectKey is required").max(20),
});

export const jiraComponentCreateSchema = componentFields;

export const jiraComponentPatchSchema = componentFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

export const jiraSubComponentCreateSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
});

export const jiraSubComponentPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    // Admin-level manual reassign/unassign; null clears the claim.
    teamId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

/** Full-replacement claim set for a team — mirrors filterReorderSchema's "full id list" idiom. */
export const subComponentClaimSchema = z.object({
  subComponentIds: z.array(z.string().trim().min(1)),
});

/** @typedef {z.infer<typeof jiraComponentCreateSchema>} JiraComponentCreateInput */
