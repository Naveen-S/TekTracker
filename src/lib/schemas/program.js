import { z } from "zod";

/**
 * Program boundary schemas (program-rollup.md). A Program groups several scrum Teams (e.g. "GM").
 * Mirrors team.js: `key` is a short handle normalized to uppercase; `name`/`description` bounded.
 * Admin-only CRUD (routes guard with requireAdmin); team association rides the team PATCH instead
 * (teamFields gained `programId`), so this file only covers the Program entity itself.
 */

const programFields = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{0,9}$/, "1-10 chars: a letter, then letters/digits"),
  description: z.string().trim().max(500).nullish(),
});

export const programCreateSchema = programFields;

export const programPatchSchema = programFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

/** @typedef {z.infer<typeof programCreateSchema>} ProgramCreateInput */
