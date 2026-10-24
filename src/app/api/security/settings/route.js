/**
 * /api/security/settings (security-vulnerability-tracker.md (c)) — GET: the tracker settings + the
 * release calendar, any signed-in user (`workbenchUrl` only for global admins — the artifact is
 * private, P6); PUT: global admin only, saves the settings singleton and replaces the calendar AS A
 * SET. Classification is read-time, so a save re-renders /security with no Jira refresh.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { securitySettingsPutSchema } from "@/lib/schemas/security";
import { SECURITY_SETTINGS_ID, settingsCreatePayload } from "@/lib/security/defaults.mjs";
import { getSecuritySettings } from "@/lib/security/settings";

export const dynamic = "force-dynamic";

async function readSettings(isAdmin) {
  const [settings, releases] = await Promise.all([
    getSecuritySettings(),
    prisma.securityRelease.findMany({ orderBy: { month: "asc" } }),
  ]);
  const { vocab, workbenchUrl, ...rest } = settings;
  return {
    settings: {
      ...rest,
      workbenchUrl: isAdmin ? workbenchUrl : null,
      vocabCounts: vocab
        ? { vuln: vocab.vuln?.length ?? 0, track: vocab.track?.length ?? 0, service: Object.keys(vocab.service ?? {}).length }
        : null,
    },
    releases: releases.map((release) => ({
      month: release.month,
      shipDate: release.shipDate.toISOString().slice(0, 10),
      note: release.note,
    })),
  };
}

export const GET = withRoute("security.settings", async () => {
  const user = await requireUser();
  return Response.json(await readSettings(user.isAdmin));
});

export const PUT = withRoute("security.settings", async (request) => {
  await requireAdmin();
  const { settings, releases } = await parseJsonBody(request, securitySettingsPutSchema);
  const data = { ...settings, workbenchUrl: settings.workbenchUrl ?? null };
  const months = releases.map((release) => release.month);
  await prisma.$transaction([
    prisma.securityTrackerSettings.upsert({
      where: { id: SECURITY_SETTINGS_ID },
      update: data,
      create: { ...settingsCreatePayload(), ...data },
    }),
    prisma.securityRelease.deleteMany({ where: { month: { notIn: months } } }),
    ...releases.map((release) => {
      const row = { shipDate: new Date(`${release.shipDate}T00:00:00Z`), note: release.note ?? null };
      return prisma.securityRelease.upsert({
        where: { month: release.month },
        update: row,
        create: { month: release.month, ...row },
      });
    }),
  ]);
  return Response.json(await readSettings(true));
});
