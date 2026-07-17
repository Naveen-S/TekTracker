import { z } from "zod";

/**
 * SharedView boundary schema (share-view-export.md (b)). A share is one team's board in one
 * sprint (decision 3): the route validates that every `filterIds` entry belongs to the
 * team+sprint in the URL. `expiresAt` is optional (null/absent = never expires — checked at read
 * time, no cleanup job); `viewDensity` snapshots the creator's density pref for the recipient.
 */
export const shareCreateSchema = z.object({
  filterIds: z
    .array(z.string().trim().min(1))
    .min(1, "filterIds is required")
    .refine((ids) => new Set(ids).size === ids.length, "filterIds must not contain duplicates"),
  isLive: z.boolean().default(true),
  expiresAt: z.coerce.date().nullish(),
  viewDensity: z.enum(["dense", "relaxed"]).default("dense"),
});

/** @typedef {z.infer<typeof shareCreateSchema>} ShareCreateInput */
