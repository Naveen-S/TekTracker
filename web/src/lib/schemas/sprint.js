import { z } from "zod";
import { SprintState } from "@/generated/prisma/client";

/**
 * Sprint (Gate) boundary schemas (domain-apis.md (c)). Sprints are global and admin-managed
 * (§13.3, §16); dates arrive as ISO strings and are coerced to `Date`.
 *
 * The start-before-end rule is refined here for CREATE; for PATCH (partial — either date may be
 * absent) the handler re-checks it against the merged existing+patch values, so a PATCH of one
 * date can't silently invert the window.
 */

const sprintFields = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  developmentStart: z.coerce.date(),
  developmentEnd: z.coerce.date(),
  releaseDate: z.coerce.date().nullish(),
  state: z.enum(Object.values(SprintState)).optional(),
  isGate: z.boolean().optional(),
});

export const sprintCreateSchema = sprintFields.refine(
  (sprint) => sprint.developmentStart < sprint.developmentEnd,
  { message: "developmentStart must be before developmentEnd", path: ["developmentStart"] },
);

export const sprintPatchSchema = sprintFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "at least one field to update is required");

/** Optional `?state=` filter for GET /api/sprints. */
export const sprintStateSchema = z.enum(Object.values(SprintState));

/** @typedef {z.infer<typeof sprintCreateSchema>} SprintCreateInput */
