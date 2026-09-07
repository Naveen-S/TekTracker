/**
 * POST /api/teams/[teamId]/sprint-start — "One-Click Sprint Start" (one-click-sprint-start.md).
 *
 * Generates the team's missing Roadmap/Tech Debt/Internal Bug/External Bug filters against an
 * EXISTING Sprint (never creates one — decision 4: Sprint creation stays admin-only, unchanged;
 * this route needs exactly the TEAM_MANAGER_ROLES gate that already governs manual filter
 * creation, no RBAC change). Any of the 4 tracks that already has a Filter for (teamId, sprintId)
 * is skipped, never duplicated/overwritten.
 *
 * A sync failure does not roll back the created filters — a stale-cache data point plus a visible
 * error beats losing the filters over a transient Jira hiccup (sync-hybrid-seeding.md precedent).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, TEAM_MANAGER_ROLES, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { sprintStartSchema } from "@/lib/schemas/sprint-start";
import {
  buildAllTrackJql,
  groupSubComponentsByComponent,
  TRACK_NAMES,
  SPRINT_START_TRACKS,
} from "@/lib/sprint-start/track-jql.mjs";
import { insertFilterAtPriority } from "@/lib/filters/priority-insert";
import { accentColorForIndex } from "@/lib/accent-palette.mjs";
import { syncTeamSprint } from "@/lib/sync/engine";
import { JiraAuthError, JiraApiError, JiraCredentialMissingError } from "@/lib/jira/client";
import { FilterSourceType, SprintState } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const POST = withRoute("teams.sprint-start", async (request, { params }) => {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    const { sprintId } = await parseJsonBody(request, sprintStartSchema);

    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new NotFoundError("Sprint not found");
    }
    if (sprint.state === SprintState.CLOSED) {
      throw new ValidationError("Cannot start filters into a closed sprint");
    }

    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    const subComponents = await prisma.jiraSubComponent.findMany({
      where: { teamId },
      include: { component: true },
    });
    if (subComponents.length === 0) {
      throw new ValidationError(
        "This team has no Jira sub-components configured — assign them in Admin first",
      );
    }
    const componentGroups = groupSubComponentsByComponent(subComponents);
    const jqlByTrack = buildAllTrackJql({ team, componentGroups, fixVersions: sprint.fixVersions });

    const existing = await prisma.filter.findMany({
      where: { teamId, sprintId },
      select: { workflowType: true },
    });
    const existingTypes = new Set(existing.map((f) => f.workflowType));
    const toCreate = SPRINT_START_TRACKS.filter((workflowType) => !existingTypes.has(workflowType));

    const createdFilters = await prisma.$transaction(async (tx) => {
      let runningCount = existing.length;
      const created = [];
      for (const workflowType of toCreate) {
        const filter = await insertFilterAtPriority(tx, {
          teamId,
          sprintId,
          workflowType,
          name: TRACK_NAMES[workflowType],
          sourceType: FilterSourceType.JQL,
          jql: jqlByTrack[workflowType],
          accentColor: accentColorForIndex(runningCount),
        });
        runningCount += 1;
        created.push(filter);
      }
      return created;
    });

    let syncSummary = null;
    let syncError = null;
    try {
      syncSummary = await syncTeamSprint({ teamId, sprintId, userId: user.id });
    } catch (error) {
      if (
        error instanceof JiraCredentialMissingError ||
        error instanceof JiraAuthError ||
        error instanceof JiraApiError
      ) {
        syncError = error.message;
      } else {
        throw error;
      }
    }

    return Response.json({
      sprint,
      createdFilters,
      skippedWorkflowTypes: [...existingTypes],
      syncSummary,
      syncError,
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
