import { z } from "zod";

/**
 * LOOSE boundary schemas for Jira Cloud responses (sync-hybrid-seeding.md decision 8): validate
 * only the keys the sync engine actually reads, pass everything else through. A malformed page
 * fails the sync loudly instead of caching garbage — but a new Jira field never breaks us.
 */

/** GET /rest/api/3/filter/{id} — `id` arrives as a string or number depending on endpoint age. */
export const jiraFilterSchema = z.looseObject({
  id: z.coerce.string(),
  name: z.string(),
  jql: z.string(),
});

/** One page of POST /rest/api/3/search/jql. */
export const jiraSearchPageSchema = z.looseObject({
  issues: z
    .array(
      z.looseObject({
        key: z.string().min(1),
        fields: z.looseObject({}),
      }),
    )
    .default([]),
  isLast: z.boolean().optional(),
  nextPageToken: z.string().nullish(),
});

/** @typedef {z.infer<typeof jiraSearchPageSchema>} JiraSearchPage */
