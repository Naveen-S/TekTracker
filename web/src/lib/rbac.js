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
