/**
 * The Jira credential an ORG-LEVEL refresh runs with — shared by the bug-report refresh
 * (gm-bug-report.md decision 16) and the security tracker (security-vulnerability-tracker.md P3).
 *
 * The `CRON_SYNC_USER_EMAIL` SERVICE credential for both cron and manual refreshes, falling back to
 * the caller's only when it is unset. This deliberately departs from step 5's "you sync what YOUR
 * token can see": these dashboards are shared org artifacts, and if each viewer refreshed with their
 * own token the headline number would flip-flop between people and disagree with the nightly
 * snapshot. The identity actually used is returned so the UI can show it.
 */
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { getJiraAuthForUser } from "@/lib/jira/client";

/**
 * @param {string | null} callerUserId
 * @returns {Promise<{ auth: object, email: string }>}
 */
export async function resolveRefreshAuth(callerUserId) {
  const serviceEmail = process.env.CRON_SYNC_USER_EMAIL?.trim();
  if (serviceEmail) {
    const serviceUser = await prisma.user.findUnique({
      where: { email: serviceEmail },
      select: { id: true, email: true },
    });
    if (serviceUser) {
      return { auth: await getJiraAuthForUser(serviceUser.id), email: serviceUser.email };
    }
  }
  if (!callerUserId) {
    throw new NotFoundError(
      "No Jira credential available — set CRON_SYNC_USER_EMAIL to a user who has logged in",
    );
  }
  const caller = await prisma.user.findUnique({
    where: { id: callerUserId },
    select: { id: true, email: true },
  });
  return { auth: await getJiraAuthForUser(callerUserId), email: caller?.email ?? null };
}
