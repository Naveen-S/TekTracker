import { z } from "zod";

/**
 * "One-Click Sprint Start" request boundary schema (one-click-sprint-start.md, decision 4).
 *
 * Deliberately just `{ sprintId }` — this action never creates a Sprint (only a global admin
 * creates Sprints, via the existing /api/sprints route). It only selects an existing one to
 * generate the team's missing Roadmap/Tech Debt/Internal Bug/External Bug filters against.
 */
export const sprintStartSchema = z.object({
  sprintId: z.string().trim().min(1, "sprintId is required"),
});

/** @typedef {z.infer<typeof sprintStartSchema>} SprintStartInput */
