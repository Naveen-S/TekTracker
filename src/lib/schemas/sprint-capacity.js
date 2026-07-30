import { z } from "zod";

/**
 * Per-(team, sprint) "committed capacity" boundary schemas (committed-unplanned-work.md).
 *
 * A `null` `committedPoints` CLEARS a team's row for that sprint (decision 3: unconfigured is a
 * real state, not zero) — `z.null()` is checked before `z.coerce.number()` in the union so a
 * literal `null` isn't coerced to `0`.
 */

const committedPointsField = z.union([z.null(), z.coerce.number().min(0).max(100000)]).nullish();

export const sprintCapacityMatrixSchema = z.object({
  rows: z.array(
    z.object({
      teamId: z.string().trim().min(1),
      committedPoints: committedPointsField,
    }),
  ),
});

export const sprintCapacityDuplicateSchema = z.object({
  sourceSprintId: z.string().trim().min(1),
});

/** @typedef {z.infer<typeof sprintCapacityMatrixSchema>} SprintCapacityMatrixInput */
/** @typedef {z.infer<typeof sprintCapacityDuplicateSchema>} SprintCapacityDuplicateInput */
