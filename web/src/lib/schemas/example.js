import { z } from "zod";

/**
 * Placeholder schema proving the zod + validation convention is wired end to end.
 * DELETE once real domain schemas (sprint / filter / issue) land with their routes.
 */
export const exampleInputSchema = z.object({
  name: z.string().min(1, "name is required"),
});

/** @typedef {z.infer<typeof exampleInputSchema>} ExampleInput */
