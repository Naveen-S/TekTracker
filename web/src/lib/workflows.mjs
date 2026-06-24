/**
 * Workflow definitions (stages, weights, priority, name) keyed by Prisma `WorkflowType`.
 *
 * Ported from the Vite app's `src/workflows.js` — the "three workflows' metadata" (project-overview
 * §6). There is intentionally **no `Workflow` DB table** (decided 2026-06-15): these values are
 * static, so they live as code and are unit-testable as constants. Pure data — no storage reads (§17).
 *
 * - `FEATURE` — 10-stage roadmap lifecycle.
 * - `TECH_DEBT` / `SUPPORT` / `INTERNAL_BUG` — the shared 4-stage set (§16: internal bugs reuse the
 *   support/techdebt stages); weights differ per type.
 * - `CUSTOM` — no fixed stages; excluded from status→stage seeding.
 *
 * The bootstrap seed (`prisma/seed.mjs`) imports this as the single source for each workflow's stage
 * **count**, to bounds-check `StatusStageMapping.stageIndex`.
 */

const FOUR_STAGE = ["Triaged", "In Progress", "Code Review", "In QA"];

export const WORKFLOWS = {
  FEATURE: {
    name: "Feature Development",
    priority: 1,
    stages: [
      "PM clarification",
      "HLD/LLD",
      "API contracts",
      "Working APIs",
      "FE integration",
      "E2E testing",
      "QA/PM demo",
      "PR approved",
      "Release ready",
      "1st Stage Env deployment",
    ],
    weights: [15, 20, 15, 15, 15, 8, 5, 3, 2, 2],
  },
  TECH_DEBT: {
    name: "Tech Debt",
    priority: 2,
    stages: [...FOUR_STAGE],
    weights: [15, 65, 15, 5],
  },
  SUPPORT: {
    name: "Support Bugs",
    priority: 3,
    stages: [...FOUR_STAGE],
    weights: [20, 60, 15, 5],
  },
  INTERNAL_BUG: {
    // Reuses the 4-stage set (§16). Weights mirror Support (most bug-like); revisit if Internal
    // Bugs ever needs its own stages/weights (then add a dedicated workflow).
    name: "Internal Bugs",
    priority: 4,
    stages: [...FOUR_STAGE],
    weights: [20, 60, 15, 5],
  },
  CUSTOM: {
    name: "Custom",
    priority: 99,
    stages: [],
    weights: [],
  },
};

/** Workflow types that have a fixed stage set (everything except CUSTOM) — the seedable ones. */
export const SEEDABLE_WORKFLOW_TYPES = ["FEATURE", "TECH_DEBT", "SUPPORT", "INTERNAL_BUG"];

/**
 * Number of ordered stages for a workflow type.
 * @param {keyof typeof WORKFLOWS} workflowType
 * @returns {number}
 */
export function stageCountFor(workflowType) {
  const workflow = WORKFLOWS[workflowType];
  if (!workflow) throw new Error(`Unknown workflow type: ${workflowType}`);
  return workflow.stages.length;
}
