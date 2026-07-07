import { z } from "zod";
import { Role } from "@/generated/prisma/client";

/**
 * Team + membership boundary schemas (domain-apis.md (c)).
 *
 * `key` is the short team handle (§9, e.g. "GM") — normalized to uppercase. The Jira custom-field
 * overrides must look like real Jira field ids (per-team override of the hardcoded defaults, §14.7).
 */

const jiraCustomFieldId = z
  .string()
  .trim()
  .regex(/^customfield_\d+$/, "must look like customfield_12345");

const teamFields = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{0,9}$/, "1-10 chars: a letter, then letters/digits"),
  description: z.string().trim().max(500).nullish(),
  jiraProjectKeys: z.array(z.string().trim().min(1)).optional(),
  storyPointsFieldId: jiraCustomFieldId.nullish(),
  sprintFieldId: jiraCustomFieldId.nullish(),
});

export const teamCreateSchema = teamFields;

export const teamPatchSchema = teamFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

/** Membership add — by email per §16 (users sign in with Jira first, then get added to a team). */
export const membershipCreateSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "email is required"),
  role: z.enum(Object.values(Role)),
});

export const membershipPatchSchema = z.object({
  role: z.enum(Object.values(Role)),
});

/** @typedef {z.infer<typeof teamCreateSchema>} TeamCreateInput */
/** @typedef {z.infer<typeof membershipCreateSchema>} MembershipCreateInput */
