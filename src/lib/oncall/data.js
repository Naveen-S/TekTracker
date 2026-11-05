/**
 * Server-only data assembly for the Support on-call directory (support-oncall.md (e)).
 *
 * ORG-WIDE by design (decision 3): every signed-in user sees every team's POCs, the `/security`
 * audience rule. What is NOT org-wide is editor data — a team's `memberEmails` roster and its
 * members' email/name suggestions are attached only to teams the viewer can edit, so a viewer's
 * HTML never carries another team's roster.
 *
 * A fixed number of batched queries regardless of team count (no N+1): sprints, teams (+POCs,
 * modules), the viewer's memberships, the SUPPORT/INTERNAL_BUG filters (+issue keys), their
 * progress rows, and — for editable teams only — memberships and roster users.
 */
import { prisma } from "@/lib/db";
import { TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { getSprintSelection, hasActiveBugReport, serializeUser } from "@/lib/dashboard-data";
import { onCallCap, resolveOnCallSprint } from "@/lib/oncall/rotation.mjs";
import { bugPulse } from "@/lib/oncall/pulse.mjs";
import { SprintState, WorkflowType } from "@/generated/prisma/client";

const PULSE_WORKFLOWS = [WorkflowType.SUPPORT, WorkflowType.INTERNAL_BUG];

/** Per-team bug pulse for one sprint: two queries, grouped in JS, progress never merged across teams. */
async function getPulseByTeam(sprintId) {
  const filters = await prisma.filter.findMany({
    where: { sprintId, workflowType: { in: PULSE_WORKFLOWS } },
    select: { teamId: true, workflowType: true, issues: { select: { jiraKey: true } } },
  });
  const keys = [...new Set(filters.flatMap((filter) => filter.issues.map((issue) => issue.jiraKey)))];
  const progress = keys.length
    ? await prisma.issueProgress.findMany({
        where: { sprintId, jiraKey: { in: keys }, teamId: { in: [...new Set(filters.map((f) => f.teamId))] } },
        select: { teamId: true, jiraKey: true, workflowType: true, stageCompletion: true, blocked: true },
      })
    : [];

  const filtersByTeam = new Map();
  for (const filter of filters) {
    if (!filtersByTeam.has(filter.teamId)) filtersByTeam.set(filter.teamId, []);
    filtersByTeam.get(filter.teamId).push(filter);
  }
  const progressByTeam = new Map();
  for (const row of progress) {
    if (!progressByTeam.has(row.teamId)) progressByTeam.set(row.teamId, {});
    progressByTeam.get(row.teamId)[row.jiraKey] = row;
  }

  const pulseByTeam = new Map();
  for (const [teamId, teamFilters] of filtersByTeam) {
    pulseByTeam.set(teamId, bugPulse(teamFilters, progressByTeam.get(teamId) ?? {}));
  }
  return pulseByTeam;
}

/**
 * People for the edit dialog's member picker (decision 10, as-built 15): everyone an admin added to
 * the team — its `memberEmails` roster ∪ its `TeamMembership` users — whether or not they have ever
 * signed in. Name and phone come from the admin-entered RosterContact; the name falls back to
 * `User.displayName`.
 */
async function getSuggestionsByTeam(editableTeams) {
  if (editableTeams.length === 0) return new Map();
  const teamIds = editableTeams.map((team) => team.id);
  const rosterEmails = [...new Set(editableTeams.flatMap((team) => team.memberEmails))];
  const [memberships, rosterUsers] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId: { in: teamIds } },
      select: { teamId: true, user: { select: { email: true, displayName: true } } },
    }),
    rosterEmails.length
      ? prisma.user.findMany({
          where: { email: { in: rosterEmails, mode: "insensitive" } },
          select: { email: true, displayName: true },
        })
      : [],
  ]);
  const nameByEmail = new Map(rosterUsers.map((user) => [user.email.toLowerCase(), user.displayName]));
  for (const { user } of memberships) nameByEmail.set(user.email.toLowerCase(), user.displayName);

  const emailsByTeam = new Map(editableTeams.map((team) => [team.id, new Set(team.memberEmails)]));
  for (const { teamId, user } of memberships) emailsByTeam.get(teamId).add(user.email.toLowerCase());

  const allEmails = [...new Set([...emailsByTeam.values()].flatMap((emails) => [...emails]))];
  const contacts = allEmails.length
    ? await prisma.rosterContact.findMany({
        where: { email: { in: allEmails } },
        select: { email: true, displayName: true, phone: true },
      })
    : [];
  const contactByEmail = new Map(contacts.map((contact) => [contact.email, contact]));

  const person = (email) => ({
    email,
    displayName: contactByEmail.get(email)?.displayName || nameByEmail.get(email) || "",
    phone: contactByEmail.get(email)?.phone ?? "",
  });
  const sortKey = (p) => (p.displayName || p.email).toLowerCase();
  return new Map(
    [...emailsByTeam].map(([teamId, emails]) => [
      teamId,
      [...emails].map(person).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    ]),
  );
}

/**
 * @param {import("@/generated/prisma/client").User} user
 * @param {{ sprintId?: string }} [selection] from searchParams
 */
export async function getOnCallData(user, { sprintId } = {}) {
  const [{ sprints }, hasBugReport, memberships] = await Promise.all([
    getSprintSelection(sprintId),
    hasActiveBugReport(),
    prisma.teamMembership.findMany({ where: { userId: user.id }, select: { teamId: true, role: true } }),
  ]);

  // A valid ?sprint= wins; otherwise the rotation that is on duty now (decision 6).
  const currentRotation = resolveOnCallSprint(sprints);
  const selectedSprint = sprints.find((sprint) => sprint.id === sprintId) ?? currentRotation;
  const base = {
    user: serializeUser(user),
    hasBugReport,
    sprints,
    selectedSprint,
    isCurrentRotation: Boolean(selectedSprint && selectedSprint.id === currentRotation?.id),
    teams: [],
  };
  if (!selectedSprint) return base;

  const managedTeamIds = new Set(
    memberships.filter((m) => TEAM_MANAGER_ROLES.includes(m.role)).map((m) => m.teamId),
  );
  const sprintOpen = selectedSprint.state !== SprintState.CLOSED;

  const [teams, pulseByTeam] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        key: true,
        onCallHeadcount: true,
        memberEmails: true,
        program: { select: { id: true, key: true, name: true } },
        subComponents: { select: { name: true }, orderBy: { name: "asc" } },
        supportPocs: {
          where: { sprintId: selectedSprint.id },
          orderBy: { sortOrder: "asc" },
          select: { email: true, displayName: true, phone: true, area: true, isPrimary: true },
        },
      },
    }),
    getPulseByTeam(selectedSprint.id),
  ]);

  // The program picker opens on the viewer's own program when all their teams share one; anyone
  // else (Support, admins, multi-program leaders) opens on "All programs".
  const memberTeamIds = new Set(memberships.map((m) => m.teamId));
  const memberProgramIds = new Set(
    teams.filter((team) => memberTeamIds.has(team.id) && team.program).map((team) => team.program.id),
  );
  const defaultProgramId = memberProgramIds.size === 1 ? [...memberProgramIds][0] : null;

  const canManage = (team) => user.isAdmin || managedTeamIds.has(team.id);
  const suggestionsByTeam = sprintOpen ? await getSuggestionsByTeam(teams.filter(canManage)) : new Map();

  return {
    ...base,
    sprintOpen,
    defaultProgramId,
    teams: teams.map((team) => {
      const canEdit = sprintOpen && canManage(team);
      return {
        id: team.id,
        name: team.name,
        key: team.key,
        program: team.program,
        modules: team.subComponents.map((subComponent) => subComponent.name),
        cap: onCallCap(team),
        pocs: team.supportPocs,
        pulse: pulseByTeam.get(team.id) ?? null,
        canEdit,
        // Editor-only: never sent for a team the viewer can't edit (the roster stays private).
        suggestions: canEdit ? (suggestionsByTeam.get(team.id) ?? []) : null,
      };
    }),
  };
}
