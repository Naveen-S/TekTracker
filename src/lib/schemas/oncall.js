import { z } from "zod";

/**
 * Support on-call boundary schemas (support-oncall.md (c)).
 *
 * The PUT replaces a team's whole POC list for one sprint, so the list-level rules — at most one
 * Primary, emails unique case-insensitively — are refinements over one array (decision 13). The
 * per-team headcount cap needs the DB and is checked in the route; 50 here is only a hard ceiling.
 */

// Blank optional inputs from the dialog arrive as "" — store them as null.
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

/** Optional phone: digits, spaces and + - ( ) . only. Shared with the roster contacts (team.js). */
export const phoneField = optionalText(40).refine(
  (value) => !value || /^[+0-9 ()\-.]{5,40}$/.test(value),
  "phone may contain only digits, spaces, + - ( ) .",
);

export const supportPocSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s"@]+@[^\s"@]+\.[^\s"@]+$/, "must be a valid email address"),
  displayName: z.string().trim().min(1, "name is required").max(120),
  phone: phoneField,
  area: optionalText(40),
  isPrimary: z.boolean().optional().default(false),
});

export const supportPocListSchema = z.object({
  pocs: z
    .array(supportPocSchema)
    .max(50)
    .refine((pocs) => pocs.filter((poc) => poc.isPrimary).length <= 1, "only one POC can be Primary")
    .refine(
      (pocs) => new Set(pocs.map((poc) => poc.email)).size === pocs.length,
      "each email can appear only once",
    ),
});

/** @typedef {z.infer<typeof supportPocSchema>} SupportPocInput */
/** @typedef {z.infer<typeof supportPocListSchema>} SupportPocListInput */
