/**
 * DELETE-ME smoke route — proves the Prisma 7 pipeline resolves end to end:
 * the `@/lib/db` singleton imports, the generated client + @prisma/adapter-pg connect, and a
 * trivial query runs. Same spirit as the `example.js` zod placeholder — remove once real
 * data-access routes/actions land (this feature is infrastructure only; see scaffload-prisma.md).
 *
 * `force-dynamic` guarantees the handler (and its DB query) runs ONLY at request time, never at
 * build/prerender — so `yarn build` stays green without a reachable DATABASE_URL.
 */
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ ok }] = await prisma.$queryRaw`SELECT 1 as ok`;
    const users = await prisma.user.count();
    return Response.json({ status: "ok", db: ok === 1, users });
  } catch (error) {
    return Response.json(
      { status: "error", error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
