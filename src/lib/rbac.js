/**
 * RBAC guards for the domain APIs (migration step 4) — the first feature to enforce roles
 * server-side (§13.3 / §17 "any mutation checks role server-side, not just UI").
 *
 * Model (domain-apis.md decision 3): global app admin is the team-independent `User.isAdmin` flag
 * and BYPASSES team-role checks (the seeded admin must provision teams before any membership
 * exists). Team-scoped permissions come from `TeamMembership.role`. Both are read fresh from the DB
 * per request (auth-layer.md decision 8 — no role data lives in the cookie).
 *
 * Error convention: `NotFoundError` for a nonexistent team (existence isn't secret in an internal
 * tool — favor debuggability), `ForbiddenError` for existing-but-no-role. Routes map them to
 * 404/403 via `handleRouteError` (lib/api/route-helpers.js).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

/** Thrown when the caller is authenticated but lacks the required role. Maps to HTTP 403. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when a scoped resource does not exist (or belongs to another scope). Maps to HTTP 404. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Roles that manage a team's tracks (filter templates, filters, reorder). */
export const TEAM_MANAGER_ROLES = [Role.ADMIN, Role.ED, Role.TPM, Role.EM, Role.LEAD];

/** Roles that may write stage/blocked progress — everyone except read-only viewers. */
export const TEAM_WRITER_ROLES = [...TEAM_MANAGER_ROLES, Role.MEMBER];

/** Any membership at all — read access to the team's data. */
export const TEAM_ALL_ROLES = [...TEAM_WRITER_ROLES, Role.VIEWER];

/**
 * Roles that unlock the org-wide Velocity/Leaderboard page (leaderboard.md decision 5) — a
 * deliberately NEW, narrower group. NOT reused from TEAM_MANAGER_ROLES/TEAM_ALL_ROLES: TPM sits
 * inside TEAM_MANAGER_ROLES everywhere else in the app but is intentionally excluded here, and
 * LEAD/MEMBER get the personal "my stats" card instead of the full board (decision 6).
 */
export const LEADERBOARD_ROLES = [Role.EM, Role.ED, Role.VIEWER];

/**
 * Roles that unlock viewing a **Program** roll-up on /rollup (program-rollup.md decision 3) — a
 * leadership audience. Includes TPM (unlike LEADERBOARD_ROLES, which excludes it): TPMs run
 * programs, so program-level visibility is squarely their job. LEAD/MEMBER are excluded — they get
 * the membership-derived "my teams" roll-up (the /rollup default), just not the program picker.
 * Global admin bypasses via `hasProgramAccess`.
 */
export const PROGRAM_ROLES = [Role.ED, Role.TPM, Role.EM, Role.VIEWER];

/**
 * Require an authenticated **global admin** (`User.isAdmin`).
 * @returns {Promise<import("@/generated/prisma/client").User>}
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) {
    throw new ForbiddenError("Admin access required");
  }
  return user;
}

/**
 * Require the caller to hold one of `allowedRoles` on `teamId` (global admins always pass).
 *
 * @param {string} teamId
 * @param {Role[]} allowedRoles
 * @returns {Promise<{ user: import("@/generated/prisma/client").User,
 *   membership: import("@/generated/prisma/client").TeamMembership | null }>}
 *   `membership` is null for a global admin without one (writes attribute to `user.id`).
 */
export async function requireTeamRole(teamId, allowedRoles) {
  const user = await requireUser();

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    throw new NotFoundError("Team not found");
  }

  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  });

  if (user.isAdmin) {
    return { user, membership };
  }
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new ForbiddenError();
  }
  return { user, membership };
}

/**
 * Whether `user` may view the org-wide Velocity/Leaderboard: global admin, OR holds one of
 * LEADERBOARD_ROLES on ANY team — NOT scoped to the viewer's own teams (decision 5; mirrors the
 * existing `teams.length >= 2 || isAdmin` looseness of the "Roll-up" nav link). Page-level, not
 * team-scoped — unlike `requireTeamRole` this takes no `teamId` and never throws.
 *
 * @param {import("@/generated/prisma/client").User} user
 * @returns {Promise<boolean>}
 */
export async function hasLeaderboardAccess(user) {
  if (user.isAdmin) return true;
  const membership = await prisma.teamMembership.findFirst({
    where: { userId: user.id, role: { in: LEADERBOARD_ROLES } },
    select: { id: true },
  });
  return membership !== null;
}

/**
 * Whether `user` may view a Program roll-up: global admin, OR holds one of PROGRAM_ROLES on ANY
 * team — NOT scoped to the viewer's own teams (a program roll-up is inherently cross-membership).
 * Page-level, not team-scoped (like `hasLeaderboardAccess`) — takes no `teamId` and never throws.
 * Gates the /rollup program picker (client) AND the server-side program scoping in getRollupData,
 * so a non-leadership user hitting `?program=` directly is silently ignored, not 403'd off the page.
 *
 * @param {import("@/generated/prisma/client").User} user
 * @returns {Promise<boolean>}
 */
export async function hasProgramAccess(user) {
  if (user.isAdmin) return true;
  const membership = await prisma.teamMembership.findFirst({
    where: { userId: user.id, role: { in: PROGRAM_ROLES } },
    select: { id: true },
  });
  return membership !== null;
}
