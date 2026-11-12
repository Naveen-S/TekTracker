import { z } from "zod";
import { ITEM_STATUSES, KINDS, REFERENCE_KINDS, RISK_STATUSES, RISK_TYPES, SOW_STATUSES } from "@/lib/sow/defaults.mjs";

/**
 * SOW tracker boundary schemas (sow-tracker.md (c)). Dates cross the boundary as `YYYY-MM-DD`
 * calendar days (decision 16). The plan and the risks are each saved as one replace-all list, so
 * list-level rules live here as refinements (the support-oncall precedent).
 */

const isoDay = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "a date as YYYY-MM-DD");
const optionalDay = isoDay.nullish().or(z.literal("").transform(() => null));

// Blank optional inputs from a dialog arrive as "" — store them as null.
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

const kind = z.enum(KINDS);
const token = z.string().trim().min(1).max(60);
const jiraKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/, "a Jira key like GM-10506")
  .nullish()
  .or(z.literal("").transform(() => null));

export const kindRuleSchema = z
  .object({
    kind,
    projects: z.array(token).max(20).optional().default([]),
    issueTypes: z.array(token).max(20).optional().default([]),
    labels: z.array(token).max(20).optional().default([]),
  })
  .refine(
    (rule) => rule.projects.length + rule.issueTypes.length + rule.labels.length > 0,
    "a rule needs at least one project, issue type or label",
  );

const weight = z.number().min(0).max(100);
export const kindWeightsSchema = z
  .object({ STORY: weight, TECH: weight, RELB: weight, INTERNAL_BUG: weight, UAT_ISSUE: weight, EXTERNAL_BUG: weight, OTHER: weight })
  .partial()
  .strict();

/** One entry of a SOW's reading list. A repository may have no URL; every other kind needs https. */
export const referenceSchema = z
  .object({
    group: z.string().trim().min(1, "a reference needs a group").max(60),
    label: z.string().trim().min(1, "a reference needs a label").max(160),
    url: z
      .string()
      .trim()
      .max(600)
      .refine((value) => /^https:\/\/[^\s]+$/.test(value), "must be an https:// link")
      .nullish()
      .or(z.literal("").transform(() => null)),
    kind: z.enum(REFERENCE_KINDS).optional().default("LINK"),
    // What it is / what it does, in a line — shown under the label and given to Ask.
    note: z
      .string()
      .trim()
      .max(300)
      .transform((value) => value || null)
      .nullish(),
    // The page Ask StoryBoard's deep round reads first for this SOW.
    primary: z.boolean().optional().default(false),
  })
  .refine((reference) => reference.kind === "REPO" || Boolean(reference.url), "a link is required unless this is a repository");

const channelId = z.string().trim().toUpperCase().regex(/^[CG][A-Z0-9]{6,14}$/, "a Slack channel id like C0BQ6HUJHQE");

const sourceFields = {
  sourceType: z.enum(["JQL", "JIRA_FILTER"]),
  jql: optionalText(4000),
  jiraFilterId: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "a numeric Jira filter id")
    .nullish()
    .or(z.literal("").transform(() => null)),
};

const hasSource = (value) => (value.sourceType === "JIRA_FILTER" ? Boolean(value.jiraFilterId) : Boolean(value.jql));
const SOURCE_MESSAGE = "give a Jira filter id, or JQL, matching the source type";
const datesInOrder = (value) => !value.startDate || !value.launchDate || value.startDate <= value.launchDate;

const settingsFields = {
  name: z.string().trim().min(1, "name is required").max(80),
  description: optionalText(400),
  ownerName: optionalText(80),
  programId: z.string().trim().min(1).nullish().or(z.literal("").transform(() => null)),
  ...sourceFields,
  // No default here: under PATCH's .partial() a default would wipe the stored list.
  homeProjectKeys: z.array(token.toUpperCase()).max(20).optional(),
  startDate: isoDay,
  launchDate: isoDay,
  // The pre-QA Slack channel, by id (C…/G…); blank clears it.
  slackChannelId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[CG][A-Z0-9]{6,14}$/, "a Slack channel id like C0CE3GZ6JSD")
    .nullish()
    .or(z.literal("").transform(() => null)),
};

/** POST /api/sows — a new SOW from the standard template, or a copy of `duplicateOf`. */
export const sowCreateSchema = z
  .object({ ...settingsFields, duplicateOf: z.string().trim().min(1).nullish() })
  .refine(hasSource, SOURCE_MESSAGE)
  .refine(datesInOrder, "the launch date must be on or after the start date");

/** PATCH /api/sows/[sowId] — settings, classification rules and weights. */
export const sowPatchSchema = z
  .object({
    ...settingsFields,
    status: z.enum(SOW_STATUSES),
    kindRules: z.array(kindRuleSchema).min(1).max(40),
    kindWeights: kindWeightsSchema,
    references: z.array(referenceSchema).max(80),
    feedChannelIds: z
      .array(channelId)
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length, "each channel can be listed once"),
  })
  .partial()
  .refine((value) => value.sourceType === undefined || hasSource(value), SOURCE_MESSAGE)
  .refine(datesInOrder, "the launch date must be on or after the start date");

export const planItemSchema = z.object({
  title: z.string().trim().min(1, "a plan item needs a title").max(160),
  status: z.enum(ITEM_STATUSES).optional().default("NOT_STARTED"),
  baselineDate: optionalDay,
  currentDate: optionalDay,
  isGate: z.boolean().optional().default(false),
  jiraKey,
  comment: optionalText(400),
});

export const planPhaseSchema = z
  .object({
    name: z.string().trim().min(1, "a phase needs a name").max(60),
    startDate: isoDay,
    endDate: isoDay,
    kinds: z.array(kind).max(KINDS.length).optional().default([]),
    items: z.array(planItemSchema).max(60).optional().default([]),
  })
  .refine((phase) => phase.startDate <= phase.endDate, "a phase must end on or after its start");

/** PUT /api/sows/[sowId]/plan — the WHOLE plan (phases with their items), replaced as a set. */
export const sowPlanSchema = z.object({
  phases: z
    .array(planPhaseSchema)
    .min(1, "a SOW needs at least one phase")
    .max(20)
    .refine(
      (phases) => new Set(phases.map((phase) => phase.name.toLowerCase())).size === phases.length,
      "phase names must be unique",
    ),
});

export const sowRiskSchema = z.object({
  type: z.enum(RISK_TYPES).optional().default("RISK"),
  title: z.string().trim().min(1, "a risk needs a title").max(200),
  ownerName: optionalText(80),
  status: z.enum(RISK_STATUSES).optional().default("OPEN"),
  note: optionalText(600),
  dueDate: optionalDay,
});

/** PUT /api/sows/[sowId]/risks — the WHOLE list, replaced as a set. */
export const sowRisksSchema = z.object({ risks: z.array(sowRiskSchema).max(60) });

/** POST /api/sows/[sowId]/shares — null = never expires. */
export const sowShareCreateSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).nullish(),
});

const slackText = (max) => z.string().transform((value) => value.trim().slice(0, max));
const slackList = (max) =>
  z
    .array(z.string())
    .optional()
    .default([])
    .transform((list) => list.map((entry) => entry.trim().slice(0, 80)).filter(Boolean).slice(0, max));

/** One post as an admin's connector read it from Slack — clamped, never trusted. */
export const slackPostSchema = z.object({
  ts: z.string().regex(/^\d{9,11}\.\d{1,9}$/, "a Slack message ts"),
  authorName: slackText(80),
  postedAt: z.string().max(40),
  title: slackText(160),
  text: slackText(1200),
  reactions: slackList(20),
  replyCount: z.number().int().min(0).max(5000).catch(0),
  lastReplyAt: z.string().max(40).nullish(),
  mentions: slackList(20),
  jiraKeys: slackList(10).transform((keys) => keys.map((key) => key.toUpperCase()).filter((key) => /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/.test(key))),
  sessionId: z.string().max(80).nullish(),
  hasMedia: z.boolean().catch(false),
  suggestedIssue: z.boolean().catch(false),
  authorId: z
    .string()
    .regex(/^[UW][A-Z0-9]{6,14}$/)
    .nullish()
    .catch(null),
  files: z
    .array(
      z.object({
        id: z.string().regex(/^F[A-Z0-9]{6,14}$/, "a Slack file id"),
        name: slackText(160),
        kind: z.enum(["IMAGE", "VIDEO", "OTHER"]).catch("OTHER"),
        description: z
          .string()
          .transform((value) => value.trim().slice(0, 300) || null)
          .nullish(),
      }),
    )
    .max(20)
    .optional()
    .default([])
    .catch([]),
});

/** The connector's SLACK_SYNC result. */
export const slackSyncResultSchema = z.object({
  channelName: z.string().max(120).nullish(),
  posts: z.array(slackPostSchema).max(2000),
});

/** One decision or shared document as the connector read it — clamped, never trusted. */
export const feedItemSchema = z
  .object({
    kind: z.enum(["DECISION", "DOC"]),
    ts: z.string().regex(/^\d{9,11}\.\d{1,9}$/, "a Slack message ts"),
    postedAt: z.string().max(40),
    authorName: slackText(80),
    title: slackText(160),
    summary: z
      .string()
      .transform((value) => value.trim().slice(0, 400) || null)
      .nullish(),
    url: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((value) => (value && /^https:\/\/[^\s<>]+$/.test(value) ? value : null)),
  })
  // A document without a usable link is not worth keeping.
  .refine((item) => item.kind !== "DOC" || Boolean(item.url), "a document needs an https link");

/** The connector's result for one docs-and-decisions channel. Bad items are dropped, not fatal. */
export const feedSyncResultSchema = z.object({
  channelName: z.string().max(120).nullish(),
  messagesRead: z.number().int().min(0).catch(0),
  items: z
    .array(z.unknown())
    .max(1000)
    .transform((items) => items.map((item) => feedItemSchema.safeParse(item)).filter((parsed) => parsed.success).map((parsed) => parsed.data)),
});

/** PATCH /api/sows/[sowId]/feed-items/[itemId] — hide or restore one decision / document. */
export const feedItemPatchSchema = z.object({ hidden: z.boolean() });

/** PATCH /api/sows/[sowId]/slack-issues/[issueId] — the admin override; null clears a field. */
export const slackIssuePatchSchema = z
  .object({
    overrideStatus: z.enum(["ISSUE", "NOT_ISSUE", "FIXED"]).nullable(),
    linkedJiraKey: jiraKey,
    note: optionalText(400),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "nothing to change");

/** @typedef {z.infer<typeof sowCreateSchema>} SowCreateInput */
/** @typedef {z.infer<typeof sowPlanSchema>} SowPlanInput */
/** @typedef {z.infer<typeof sowRisksSchema>} SowRisksInput */
