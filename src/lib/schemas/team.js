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

const issueTypeArray = z.array(z.string().trim().min(1)).optional();

// A roster member email (needs-attention-roster.md). Validated to an email shape that is also
// JQL-safe — no whitespace and no double-quote — because these strings are interpolated into the
// Needs-attention track's JQL as `assignee in ("a@x.com", ...)`.
const memberEmail = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s"@]+@[^\s"@]+\.[^\s"@]+$/, "must be a valid email address");

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
  // Per-track Jira Issue Type overrides (one-click-sprint-start.md); empty ⇒ use the
  // DEFAULT_*_ISSUE_TYPES constants in lib/jira/issue-type-defaults.mjs.
  featureIssueTypes: issueTypeArray,
  techDebtIssueTypes: issueTypeArray,
  internalBugIssueTypes: issueTypeArray,
  supportIssueTypes: issueTypeArray,
  // Leaderboard.md decision 3: the team velocity leaderboard's points ÷ developers divisor.
  // null/unset ⇒ excluded from the team leaderboard's ranking.
  developerCount: z.coerce.number().int().min(1).max(200).nullish(),
  // Scrum-team roster of Jira assignee emails (needs-attention-roster.md) — DISTINCT from
  // TeamMembership; scopes the "Needs attention" hygiene track. Capped to bound generated JQL size,
  // and de-duplicated server-side (each element is lowercased by `memberEmail`) so a direct API call
  // can't persist case-variant duplicates.
  memberEmails: z
    .array(memberEmail)
    .max(200)
    .transform((emails) => [...new Set(emails)])
    .optional(),
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
