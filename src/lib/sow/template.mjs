/**
 * Laying out a new SOW's plan (sow-tracker.md decision 9): from the standard template, or as a
 * copy of an existing SOW. Pure; dates are `YYYY-MM-DD` calendar days.
 */
import { STANDARD_TEMPLATE, TEMPLATE_SPAN } from "./defaults.mjs";
import { addDays, diffDays } from "./timeline.mjs";

/** "Configurator AI" → "configurator-ai". */
export function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Map a day on one start → end window onto another, proportionally. */
function rescale(offset, sourceSpan, targetSpan) {
  return sourceSpan <= 0 ? 0 : Math.round((offset / sourceSpan) * targetSpan);
}

/**
 * The standard phases and plan items spaced across start → launch. Every item starts
 * Not started, with baseline = current.
 */
export function layoutTemplate({ startDate, launchDate }) {
  const span = Math.max(diffDays(startDate, launchDate), 1);
  const at = (offset) => addDays(startDate, rescale(offset, TEMPLATE_SPAN, span));
  return STANDARD_TEMPLATE.map((phase) => ({
    name: phase.name,
    startDate: at(phase.from),
    endDate: at(phase.to),
    kinds: [...phase.kinds],
    items: phase.items.map((item) => ({
      title: item.title,
      status: "NOT_STARTED",
      baselineDate: at(item.at),
      currentDate: at(item.at),
      isGate: Boolean(item.isGate),
      jiraKey: null,
      comment: null,
    })),
  }));
}

/**
 * A copy of another SOW's plan, rescaled onto the new window. Statuses reset, the new dates
 * become the baseline, and ticket links and comments (which belong to the source) are dropped.
 */
export function duplicatePlan(source, { startDate, launchDate }) {
  const sourceSpan = Math.max(diffDays(source.startDate, source.launchDate), 1);
  const span = Math.max(diffDays(startDate, launchDate), 1);
  const move = (iso) => (iso ? addDays(startDate, rescale(diffDays(source.startDate, iso), sourceSpan, span)) : null);
  return source.phases.map((phase) => ({
    name: phase.name,
    startDate: move(phase.startDate),
    endDate: move(phase.endDate),
    kinds: [...phase.kinds],
    items: phase.items.map((item) => ({
      title: item.title,
      status: "NOT_STARTED",
      baselineDate: move(item.currentDate ?? item.baselineDate),
      currentDate: move(item.currentDate ?? item.baselineDate),
      isGate: item.isGate,
      jiraKey: null,
      comment: null,
    })),
  }));
}

/** The seed's compact phase list → the same plan shape (`date` is both baseline and current). */
export function seedPlan(seed) {
  return seed.phases.map((phase) => ({
    name: phase.name,
    startDate: phase.startDate,
    endDate: phase.endDate,
    kinds: [...phase.kinds],
    items: phase.items.map((item) => ({
      title: item.title,
      status: item.status ?? "NOT_STARTED",
      baselineDate: item.date,
      currentDate: item.date,
      isGate: Boolean(item.isGate),
      jiraKey: item.jiraKey ?? null,
      comment: item.comment ?? null,
    })),
  }));
}
