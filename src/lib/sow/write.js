/**
 * SOW writes (sow-tracker.md (d)): create (from the template or as a copy), settings patch, and
 * the two replace-all saves (plan, risks). Server-only; callers have already checked admin.
 * Dates arrive as `YYYY-MM-DD` and are stored as UTC midnights (decision 16).
 */
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { DEFAULT_KIND_RULES, DEFAULT_KIND_WEIGHTS } from "@/lib/sow/defaults.mjs";
import { duplicatePlan, layoutTemplate, slugify } from "@/lib/sow/template.mjs";
import { fromIsoDay, toIsoDay } from "@/lib/sow/timeline.mjs";

const PLAN_TX = { timeout: 30_000, maxWait: 10_000 };

export async function requireSow(sowId) {
  const sow = await prisma.sow.findUnique({ where: { id: sowId } });
  if (!sow) throw new NotFoundError("SOW not found");
  return sow;
}

async function assertProgram(programId) {
  if (!programId) return;
  const program = await prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
  if (!program) throw new ValidationError("That program no longer exists");
}

/** A slug nobody uses yet: "configurator-ai", then "configurator-ai-2", … */
async function freeSlug(name) {
  const base = slugify(name) || "sow";
  const taken = new Set(
    (await prisma.sow.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  throw new ConflictError("Could not find a free URL name for this SOW — pick a different name");
}

/** Plan shape (phases with nested items, ISO days) → nested Prisma create input. */
function phaseCreates(sowId, phases) {
  return phases.map((phase, phaseIndex) => ({
    name: phase.name,
    sortOrder: phaseIndex,
    startDate: fromIsoDay(phase.startDate),
    endDate: fromIsoDay(phase.endDate),
    kinds: phase.kinds ?? [],
    items: {
      create: (phase.items ?? []).map((item, itemIndex) => ({
        sowId,
        title: item.title,
        status: item.status ?? "NOT_STARTED",
        baselineDate: fromIsoDay(item.baselineDate ?? item.currentDate),
        currentDate: fromIsoDay(item.currentDate ?? item.baselineDate),
        isGate: Boolean(item.isGate),
        jiraKey: item.jiraKey ?? null,
        comment: item.comment ?? null,
        sortOrder: itemIndex,
      })),
    },
  }));
}

async function writePlan(tx, sowId, phases) {
  await tx.sowPhase.deleteMany({ where: { sowId } });
  for (const data of phaseCreates(sowId, phases)) {
    await tx.sowPhase.create({ data: { sowId, ...data } });
  }
}

/** The source SOW's plan in the pure-module shape, for `duplicatePlan`. */
async function loadPlanSource(sowId) {
  const source = await prisma.sow.findUnique({
    where: { id: sowId },
    include: { phases: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!source) throw new NotFoundError("The SOW to copy was not found");
  return {
    record: source,
    plan: {
      startDate: toIsoDay(source.startDate),
      launchDate: toIsoDay(source.launchDate),
      phases: source.phases.map((phase) => ({
        name: phase.name,
        startDate: toIsoDay(phase.startDate),
        endDate: toIsoDay(phase.endDate),
        kinds: phase.kinds,
        items: phase.items.map((item) => ({
          title: item.title,
          isGate: item.isGate,
          baselineDate: toIsoDay(item.baselineDate),
          currentDate: toIsoDay(item.currentDate),
        })),
      })),
    },
  };
}

/**
 * Create a SOW with its plan laid out — from the standard template, or as a copy of
 * `input.duplicateOf` (which also carries over that SOW's rules and weights).
 * `plan` / `risks` let the seed supply an explicit plan instead.
 */
export async function createSow(input, { plan = null, risks = [] } = {}) {
  await assertProgram(input.programId);
  const window = { startDate: input.startDate, launchDate: input.launchDate };
  const source = input.duplicateOf ? await loadPlanSource(input.duplicateOf) : null;
  const phases = plan ?? (source ? duplicatePlan(source.plan, window) : layoutTemplate(window));
  const slug = input.slug ?? (await freeSlug(input.name));

  return prisma.$transaction(async (tx) => {
    const sow = await tx.sow.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        ownerName: input.ownerName ?? null,
        programId: input.programId ?? null,
        sourceType: input.sourceType,
        jql: input.sourceType === "JQL" ? input.jql : null,
        jiraFilterId: input.sourceType === "JIRA_FILTER" ? input.jiraFilterId : null,
        homeProjectKeys: input.homeProjectKeys ?? [],
        slackChannelId: input.slackChannelId ?? null,
        references: source?.record.references ?? [],
        kindRules: source?.record.kindRules ?? DEFAULT_KIND_RULES,
        kindWeights: source?.record.kindWeights ?? DEFAULT_KIND_WEIGHTS,
        startDate: fromIsoDay(input.startDate),
        launchDate: fromIsoDay(input.launchDate),
      },
    });
    await writePlan(tx, sow.id, phases);
    if (risks.length > 0) {
      await tx.sowRisk.createMany({ data: risks.map((risk, index) => ({ ...risk, sowId: sow.id, sortOrder: index })) });
    }
    return sow;
  }, PLAN_TX);
}

/** Settings patch. A source change clears the resolved JQL so the next refresh re-resolves it. */
export async function updateSow(sowId, patch) {
  const sow = await requireSow(sowId);
  if (patch.programId) await assertProgram(patch.programId);
  const start = patch.startDate ?? toIsoDay(sow.startDate);
  const launch = patch.launchDate ?? toIsoDay(sow.launchDate);
  if (start > launch) throw new ValidationError("The launch date must be on or after the start date");

  const { startDate, launchDate, sourceType, jql, jiraFilterId, feedChannelIds, ...rest } = patch;
  const data = { ...rest };
  if (feedChannelIds) {
    // Keep what is known about a channel that stays (its name and last read); drop the rest.
    const known = new Map((Array.isArray(sow.feedChannels) ? sow.feedChannels : []).map((entry) => [entry.id, entry]));
    data.feedChannels = feedChannelIds.map((id) => known.get(id) ?? { id });
  }
  if (startDate) data.startDate = fromIsoDay(startDate);
  if (launchDate) data.launchDate = fromIsoDay(launchDate);
  if (sourceType) {
    data.sourceType = sourceType;
    data.jql = sourceType === "JQL" ? jql : null;
    data.jiraFilterId = sourceType === "JIRA_FILTER" ? jiraFilterId : null;
    data.resolvedJql = null;
  }
  // A different channel is a different history: forget the old channel's name and sync stamp.
  if (patch.slackChannelId !== undefined && patch.slackChannelId !== sow.slackChannelId) {
    data.slackChannelName = null;
    data.slackLastSyncedAt = null;
    data.slackSyncError = null;
  }
  return prisma.sow.update({ where: { id: sowId }, data });
}

/** Replace the whole plan (phases + items) in one transaction. */
export async function replacePlan(sowId, phases) {
  await requireSow(sowId);
  await prisma.$transaction((tx) => writePlan(tx, sowId, phases), PLAN_TX);
}

/** Replace the whole risk list in one transaction. */
export async function replaceRisks(sowId, risks) {
  await requireSow(sowId);
  await prisma.$transaction([
    prisma.sowRisk.deleteMany({ where: { sowId } }),
    prisma.sowRisk.createMany({
      data: risks.map((risk, index) => ({
        sowId,
        type: risk.type,
        title: risk.title,
        ownerName: risk.ownerName ?? null,
        status: risk.status,
        note: risk.note ?? null,
        dueDate: fromIsoDay(risk.dueDate),
        sortOrder: index,
      })),
    }),
  ]);
}
