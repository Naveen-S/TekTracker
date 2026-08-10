import { z } from "zod";

/**
 * Self-service user-preference boundary schema (default-team-release.md).
 *
 * PATCH /api/me lets a signed-in user set their personal "default board view". Each id is a bare
 * cuid or `null` (null clears that half of the pref); an omitted key leaves that half untouched, so
 * the two can be set/cleared independently. `.refine` rejects an empty body — a PATCH must change
 * something. The route additionally checks the caller may see `defaultTeamId` before persisting.
 */
const optionalId = z.string().trim().min(1).nullable().optional();

export const mePatchSchema = z
  .object({
    defaultTeamId: optionalId,
    defaultSprintId: optionalId,
  })
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

/** @typedef {z.infer<typeof mePatchSchema>} MePatchInput */
