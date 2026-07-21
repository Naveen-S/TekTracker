import { z } from "zod";

/**
 * IssueProgress write body (domain-apis.md decision 5): an idempotent PUT of **target state**, not
 * a toggle RPC — retries/double-clicks are harmless. At least one of `stage` / `blocked` /
 * `riskComment` must be present. `stage.index` upper bound depends on the row's owning workflow,
 * so it is checked in the handler against `stageCountFor()`, not here. `blockedReason` only
 * travels with `blocked: true` (the handler clears it whenever the issue is unblocked).
 * `riskComment` (risk-comments-rollup-digest.md decision 2) is a known/agreed-risk note —
 * independent of `blocked`, never auto-cleared; an empty/whitespace string removes it (→ null).
 */
export const progressWriteSchema = z
  .object({
    stage: z
      .object({
        index: z.number().int().min(0),
        completed: z.boolean(),
      })
      .optional(),
    blocked: z.boolean().optional(),
    blockedReason: z.string().trim().max(500).nullish(),
    riskComment: z.string().trim().max(500).nullish(),
  })
  .superRefine((val, ctx) => {
    if (val.stage === undefined && val.blocked === undefined && val.riskComment === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "at least one of stage, blocked, or riskComment is required",
      });
    }
    if (val.blockedReason != null && val.blocked !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["blockedReason"],
        message: "blockedReason is only allowed with blocked: true",
      });
    }
  });

/** @typedef {z.infer<typeof progressWriteSchema>} ProgressWriteInput */
