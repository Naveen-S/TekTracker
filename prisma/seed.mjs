/**
 * Bootstrap seed — completes Production Migration Plan step 2 (project-overview.md).
 *
 * Writes the rows a fresh DB needs before any team data exists:
 *   1. a bootstrap ADMIN `User` (`isAdmin: true`), identified by `SEED_ADMIN_EMAIL`;
 *   2. the global default `StatusStageMapping` rows (`teamId = null`) — the hybrid model's
 *      Jira-status → stage seeding (§6).
 * The "three workflows' metadata" lives in code (`src/lib/workflows.js`), not the DB.
 *
 * Idempotent: re-running produces no duplicates. The admin is upserted by email; the global mappings
 * are replaced as a set (delete `teamId = null` rows, then re-create) — see the NULL-unique note
 * below. Per-team overrides (`teamId != null`) are never touched.
 *
 * Run via `yarn db:seed` (→ `prisma db seed` → `migrations.seed` in prisma.config.mjs) or
 * automatically by `prisma migrate reset`. Executed with `tsx` (the generated Prisma client is
 * TypeScript-only and this Node can't strip types) — see this feature's as-built deviations.
 */
import "dotenv/config";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { SEEDABLE_WORKFLOW_TYPES, stageCountFor } from "../src/lib/workflows.mjs";

// ── Global StatusStageMapping defaults (teamId = null) ───────────────────────────────────────────
// Map each raw Jira status to the HIGHEST lifecycle stage it implies (seeding auto-checks 0..n per
// the checklist rule). Statuses meaning "not started" get NO row (issue seeds to all-false).
// Matched case-insensitively at read time, so store canonical-cased names.
// PROPOSED defaults (project-overview §6 / bootstrap-seed.md): Code Review→E2E testing (5) and
// Testing/In QA→QA/PM demo (6) are confirmed; the rest are best-effort pending validation against
// real Tekion statuses. Keep in sync with bootstrap-seed.md (§17 doc-sync).
const FOUR_STAGE_STATUS_MAP = [
  ["Triaged", 0],
  ["In Progress", 1],
  ["Code Review", 2],
  ["In Review", 2],
  ["In QA", 3],
  ["Testing", 3],
  ["Done", 3],
  ["Closed", 3],
];

const STATUS_STAGE_SEED = {
  FEATURE: [
    ["Groomed", 0],
    ["Ready for Dev", 0],
    ["In Progress", 3],
    ["In Development", 3],
    ["Code Review", 5],
    ["In Review", 5],
    ["Testing", 6],
    ["In QA", 6],
    ["Done", 9],
    ["Released", 9],
    ["Closed", 9],
  ],
  TECH_DEBT: FOUR_STAGE_STATUS_MAP,
  SUPPORT: FOUR_STAGE_STATUS_MAP,
  INTERNAL_BUG: FOUR_STAGE_STATUS_MAP,
};

/** zod row shape; `stageIndex` bounds are checked against the workflow's stage count below. */
const mappingRowSchema = z.object({
  workflowType: z.enum(SEEDABLE_WORKFLOW_TYPES),
  jiraStatus: z.string().min(1),
  stageIndex: z.number().int().nonnegative(),
});

/** Flatten + validate the seed tables into `StatusStageMapping` create rows (global: teamId null). */
function buildStatusStageRows() {
  const rows = [];
  for (const workflowType of SEEDABLE_WORKFLOW_TYPES) {
    const count = stageCountFor(workflowType);
    for (const [jiraStatus, stageIndex] of STATUS_STAGE_SEED[workflowType]) {
      const row = mappingRowSchema.parse({ workflowType, jiraStatus, stageIndex });
      if (row.stageIndex >= count) {
        throw new Error(
          `StatusStageMapping out of range: ${workflowType} "${jiraStatus}" → stageIndex ` +
            `${row.stageIndex}, but ${workflowType} has only ${count} stages (0..${count - 1}).`,
        );
      }
      rows.push({ ...row, teamId: null });
    }
  }
  return rows;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    throw new Error(
      "SEED_ADMIN_EMAIL is required to seed the bootstrap admin (set it in web/.env). " +
        "See web/.env.example.",
    );
  }

  // Build + validate BEFORE opening the DB connection so a bad mapping fails fast with no writes.
  const statusStageRows = buildStatusStageRows();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // 1. Bootstrap ADMIN. Upsert by email; only force isAdmin on update so a login-reconciled
    //    identity (real jiraAccountId/displayName/avatarUrl) is preserved.
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { isAdmin: true },
      create: {
        email: adminEmail,
        displayName: adminEmail.split("@")[0],
        jiraAccountId: `seed-pending:${adminEmail}`, // reconciled to the real id on first Jira login
        isAdmin: true,
      },
    });

    // 2. Global StatusStageMapping (teamId = null). Replace-as-a-set rather than per-row upsert:
    //    Postgres treats NULLs as distinct in a unique index, so `@@unique([workflowType, jiraStatus,
    //    teamId])` does NOT dedupe when teamId is NULL — a per-row upsert would create duplicates.
    //    Deleting the global rows then re-creating is idempotent and leaves per-team overrides intact.
    const written = await prisma.$transaction(async (tx) => {
      await tx.statusStageMapping.deleteMany({ where: { teamId: null } });
      const { count } = await tx.statusStageMapping.createMany({ data: statusStageRows });
      return count;
    });

    console.log(
      `Bootstrap seed complete:\n` +
        `  • admin user: ${admin.email} (isAdmin=${admin.isAdmin})\n` +
        `  • global StatusStageMapping rows: ${written} ` +
        `(${SEEDABLE_WORKFLOW_TYPES.join(", ")}; CUSTOM skipped)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Bootstrap seed failed:", error.message);
  process.exit(1);
});
