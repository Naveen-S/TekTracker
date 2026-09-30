/**
 * Generate an INCREMENTAL, hand-runnable SQL migration bundle for the office (DBA-managed)
 * StoryBoard database — the follow-up to the one-time bootstrap in
 * `output/storyboard-dba-bootstrap-2026-09-22/`.
 *
 * Why this exists: the office Postgres is reached only from an office machine behind the
 * jumpserver, and migrations there are applied by hand. So every release that adds a Prisma
 * migration needs its pending migrations applied with `psql` — as the role in the app's
 * DATABASE_URL, which owns every table — BEFORE the image that expects them is rolled out (that
 * image's code queries the new tables and would answer DB_MIGRATION_MISSING without them).
 *
 * No grants/runtime-access file is emitted: tables belong to the role that creates them, and the
 * office DB is always migrated as the app's own role, so the app already has full access.
 *
 * What it emits (to `output/storyboard-dba-migration-<date>-<last-migration>/` by default):
 *   00-preflight.sql       READ ONLY — target identity + asserts the history is EXACTLY the
 *                          already-applied set (names AND checksums) and the pending set is absent
 *   01-migrate.sql         ONE transaction — guard, pending migration.sql files VERBATIM, and their
 *                          `_prisma_migrations` rows (checksum = sha256 of the file bytes, which is
 *                          what `prisma migrate deploy` re-verifies at every container boot)
 *   02-verify.sql          READ ONLY — asserts the full history + the new objects exist
 *   README.md · migration-manifest.json · SHA256SUMS
 * VALIDATION.md is written by hand after the local rehearsal (see the `dba-migration-bundle`
 * skill), then `shasum -a 256` is re-run so SHA256SUMS covers it.
 *
 * Usage (from the repo root):
 *   node scripts/dba-migration-bundle.mjs --applied-through <last migration already on the DB>
 *        [--out <dir>] [--target "<host (cluster / namespace / env)>"]
 *
 * `--applied-through` is REQUIRED and is never guessed: it is the newest row in the target's
 * `_prisma_migrations`, read by `00-preflight.sql` of the previous bundle or by
 *   SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name DESC LIMIT 1;
 *
 * Dependency-free (node built-ins only) so it runs from any checkout without `yarn install`.
 */
import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations");
const DEFAULT_TARGET = "storyboard-stage.aecloud.io (AEC_GM / storyboard / stage)";

// ─────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument: ${flag}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    args[flag.slice(2)] = value;
    index += 1;
  }
  return args;
}

/** @returns {{ name: string, sql: string, checksum: string }[]} every migration, in apply order. */
function readMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
    .sort() // timestamp-prefixed: lexical order IS apply order
    .map((name) => {
      const bytes = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"));
      return {
        name,
        sql: bytes.toString("utf8").replace(/\s+$/, ""),
        // Plain sha256 of the file bytes — Prisma's own `_prisma_migrations.checksum`.
        checksum: createHash("sha256").update(bytes).digest("hex"),
      };
    });
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/** New tables / enum types a pending migration creates — asserted absent before and present after. */
function createdObjects(migrations) {
  const tables = new Set();
  const types = new Set();
  for (const { sql } of migrations) {
    for (const [, name] of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(?:public"\.")?([^"]+)"/g)) {
      tables.add(name);
    }
    for (const [, name] of sql.matchAll(/CREATE TYPE "(?:public"\.")?([^"]+)"\s+AS ENUM/g)) types.add(name);
  }
  return { tables: [...tables], types: [...types] };
}

// ─────────────────────────────────────────────────────────────
// SQL builders
// ─────────────────────────────────────────────────────────────

const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;

function header(title, ctx) {
  return [
    `-- StoryBoard office DB | ${title}`,
    `-- Prepared ${ctx.today} for ${ctx.target}.`,
    `-- Applies ${ctx.pending.length} pending migration(s) on top of ${ctx.applied.length} applied (through ${ctx.appliedThrough}).`,
    `-- Source: ${ctx.commitLabel}`,
    "-- Plain PostgreSQL SQL: run the WHOLE file with psql -X -v ON_ERROR_STOP=1 -f <file>. See README.md.",
    "",
  ];
}

/** `(name, checksum)` VALUES rows for an expected-history CTE. */
function valuesRows(migrations) {
  return migrations.map(({ name, checksum }) => `      (${lit(name)}, ${lit(checksum)})`).join(",\n");
}

/**
 * A DO block that raises unless `_prisma_migrations` holds EXACTLY `expected` (by name + checksum,
 * finished, not rolled back, one step each) — no more, no fewer.
 */
function historyGuard(tag, expected, message) {
  return [
    `DO $${tag}$`,
    "BEGIN",
    "  IF to_regclass('public._prisma_migrations') IS NULL THEN",
    "    RAISE EXCEPTION 'No _prisma_migrations table: this database was never bootstrapped. Stop — this is an incremental bundle.';",
    "  END IF;",
    `  IF (SELECT count(*) FROM public."_prisma_migrations") <> ${expected.length}`,
    "     OR EXISTS (",
    "       WITH expected(name, checksum) AS (VALUES",
    valuesRows(expected),
    "       )",
    "       SELECT 1 FROM expected e LEFT JOIN public.\"_prisma_migrations\" m",
    "         ON m.migration_name = e.name AND m.checksum = e.checksum",
    "         AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL",
    "         AND m.applied_steps_count = 1",
    "       WHERE m.id IS NULL",
    "     ) THEN",
    `    RAISE EXCEPTION ${lit(message)};`,
    "  END IF;",
    "END",
    `$${tag}$;`,
  ].join("\n");
}

function objectsAbsentGuard(objects) {
  const checks = [
    ...objects.tables.map(
      (table) =>
        `  IF to_regclass(${lit(`public."${table}"`)}) IS NOT NULL THEN\n    RAISE EXCEPTION ${lit(`Table public."${table}" already exists but its migration is not recorded. Partial state — stop and report.`)};\n  END IF;`,
    ),
    ...objects.types.map(
      (type) =>
        `  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = ${lit(type)}) THEN\n    RAISE EXCEPTION ${lit(`Type public."${type}" already exists but its migration is not recorded. Partial state — stop and report.`)};\n  END IF;`,
    ),
  ];
  if (checks.length === 0) return null;
  return ["DO $absent$", "BEGIN", ...checks, "END", "$absent$;"].join("\n");
}

function objectsPresentGuard(objects) {
  const checks = [
    ...objects.tables.map(
      (table) =>
        `  IF to_regclass(${lit(`public."${table}"`)}) IS NULL THEN\n    RAISE EXCEPTION ${lit(`Expected table public."${table}" is missing.`)};\n  END IF;`,
    ),
    ...objects.types.map(
      (type) =>
        `  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = ${lit(type)}) THEN\n    RAISE EXCEPTION ${lit(`Expected type public."${type}" is missing.`)};\n  END IF;`,
    ),
  ];
  if (checks.length === 0) return null;
  return ["DO $present$", "BEGIN", ...checks, "END", "$present$;"].join("\n");
}

function buildPreflight(ctx) {
  const pendingNames = ctx.pending.map(({ name }) => lit(name)).join(", ");
  return [
    ...header("READ ONLY preflight", ctx),
    "BEGIN READ ONLY;",
    "SET LOCAL search_path = public;",
    "SET LOCAL statement_timeout = '1min';",
    "",
    "SELECT current_database() AS database_name, current_user AS execution_role,",
    "       inet_server_addr() AS server_address, inet_server_port() AS server_port,",
    "       current_setting('server_version') AS postgres_version, current_schema() AS schema;",
    "",
    "-- STOP-GATE (unchanged from the bootstrap): objects go into `public`. If the app's DATABASE_URL",
    "-- carries `?schema=<something else>`, STOP — no SQL check can see that.",
    "",
    "-- What is recorded today (expect exactly the applied set in the manifest):",
    'SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count',
    '  FROM public."_prisma_migrations" ORDER BY migration_name;',
    "",
    "-- Pending migrations already recorded? (expect ZERO rows)",
    `SELECT migration_name FROM public."_prisma_migrations" WHERE migration_name IN (${pendingNames});`,
    "",
    historyGuard(
      "history",
      ctx.applied,
      `Migration history is not exactly the ${ctx.applied.length} migrations this bundle expects (through ${ctx.appliedThrough}). Do NOT run 01 — regenerate the bundle with the right --applied-through.`,
    ),
    "",
    objectsAbsentGuard(ctx.objects) ?? "-- (no new tables/types to check)",
    "",
    "SELECT 'PREFLIGHT PASSED — safe to run 01-migrate.sql' AS result;",
    "COMMIT;",
    "",
  ].join("\n");
}

function buildMigrate(ctx) {
  const out = [
    ...header("pending migrations (one transaction)", ctx),
    "-- Contains the pending migration.sql files UNCHANGED plus their _prisma_migrations rows.",
    "-- All-or-nothing: any error rolls back every statement below, bookkeeping included.",
    "-- Refuses to run twice (the history guard fails once these rows exist).",
    "BEGIN;",
    "SET LOCAL search_path = public;",
    "SET LOCAL lock_timeout = '10s';",
    "SET LOCAL statement_timeout = '5min';",
    "",
    "DO $version$",
    "BEGIN",
    "  IF current_setting('server_version_num')::integer < 120000 THEN",
    "    RAISE EXCEPTION 'This transactional bundle requires PostgreSQL 12 or newer.';",
    "  END IF;",
    "END",
    "$version$;",
    "",
    historyGuard(
      "before",
      ctx.applied,
      `Migration history is not exactly the ${ctx.applied.length} expected migrations (through ${ctx.appliedThrough}) — already applied, or a different starting point. Nothing was changed.`,
    ),
    "",
    objectsAbsentGuard(ctx.objects) ?? "",
    "",
  ];
  ctx.pending.forEach(({ name, sql, checksum }, index) => {
    out.push(`-- Migration ${index + 1}/${ctx.pending.length}: ${name}`);
    out.push(`-- SHA-256: ${checksum}`);
    out.push(sql);
    out.push("");
  });
  out.push("-- Record the migrations above exactly as `prisma migrate deploy` would. Do not edit.");
  out.push('INSERT INTO public."_prisma_migrations"');
  out.push("  (id, checksum, migration_name, started_at, finished_at, applied_steps_count)");
  out.push("VALUES");
  out.push(
    ctx.pending
      .map(({ name, checksum }) => `  (${lit(randomUUID())}, ${lit(checksum)}, ${lit(name)}, clock_timestamp(), clock_timestamp(), 1)`)
      .join(",\n") + ";",
  );
  out.push("");
  out.push(
    historyGuard(
      "after",
      [...ctx.applied, ...ctx.pending],
      "Post-apply history check failed — the transaction will roll back. Report the error text.",
    ),
  );
  out.push("");
  const present = objectsPresentGuard(ctx.objects);
  if (present) out.push(present, "");
  out.push("COMMIT;");
  out.push("");
  out.push(`SELECT 'MIGRATED — ${ctx.applied.length + ctx.pending.length} migrations recorded; now run 02-verify.sql' AS result;`);
  out.push("");
  return out.join("\n");
}

function buildVerify(ctx) {
  const all = [...ctx.applied, ...ctx.pending];
  return [
    ...header("READ ONLY post-migration verification", ctx),
    "BEGIN READ ONLY;",
    "SET LOCAL search_path = public;",
    "SET LOCAL statement_timeout = '1min';",
    "",
    historyGuard(
      "history",
      all,
      `History is not the expected ${all.length} migrations. 01-migrate.sql has not run (or something else changed the database).`,
    ),
    "",
    objectsPresentGuard(ctx.objects) ?? "-- (no new tables/types to check)",
    "",
    'SELECT migration_name, finished_at, rolled_back_at FROM public."_prisma_migrations"',
    `  ORDER BY migration_name DESC LIMIT ${Math.max(ctx.pending.length + 2, 3)}; -- newest first; the pending ones must be finished`,
    `SELECT count(*) AS migrations_recorded FROM public."_prisma_migrations"; -- expect ${all.length}`,
    ...(ctx.objects.tables.length
      ? [
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
          `  AND tablename IN (${ctx.objects.tables.map(lit).join(", ")}) ORDER BY tablename; -- expect ${ctx.objects.tables.length} row(s)`,
        ]
      : []),
    "",
    "SELECT 'VERIFY PASSED' AS result;",
    "COMMIT;",
    "",
  ].join("\n");
}

function buildReadme(ctx, files) {
  const { tables, types } = ctx.objects;
  const pendingList = ctx.pending.map(({ name, checksum }) => `| \`${name}\` | \`${checksum.slice(0, 16)}…\` |`).join("\n");
  return `# StoryBoard: office DB migration — ${ctx.pending.map(({ name }) => name).join(", ")}

Prepared ${ctx.today} for **${ctx.target}**. Incremental bundle: applies **${ctx.pending.length}** pending
migration(s) on top of the **${ctx.applied.length}** already applied (through \`${ctx.appliedThrough}\`).
Source: ${ctx.commitLabel}.

| Pending migration | SHA-256 (file bytes) |
| --- | --- |
${pendingList}

New objects: ${tables.length ? `tables ${tables.map((table) => `\`${table}\``).join(", ")}` : "no tables"}${types.length ? `; enum types ${types.map((type) => `\`${type}\``).join(", ")}` : ""}.
Nothing is dropped and no existing row is modified.

## Order of operations (the rule that matters)

**Apply this bundle BEFORE rolling out the image that contains these migrations.** That image's
code queries the new objects; started first, those requests fail with \`DB_MIGRATION_MISSING\`
(Prisma \`P2021\`). \`01\` also records the migrations in \`_prisma_migrations\`, so any
\`prisma migrate deploy\` the container runs at boot finds nothing pending. The previous image keeps
working after \`01\`: these migrations only add objects.

## Run it (office machine via the jumpserver)

1. **Get the files onto the office machine.** Copy the folder (or its zip) through the jumpserver,
   e.g. \`scp -J <you>@<jumpserver> -r ${ctx.folderName} <you>@<office-host>:~/\`. If file transfer
   is blocked, paste each file with \`cat > 01-migrate.sql <<'SQL'\` … \`SQL\` (quoted heredoc, so the
   shell expands nothing). Then check integrity: \`shasum -a 256 -c SHA256SUMS\` (or
   \`sha256sum -c SHA256SUMS\`) — every line must say OK.
2. **Connect as the app's own database user** — the user in \`DATABASE_URL\`, the same one that ran the
   2026-09-22 bootstrap. It owns every StoryBoard table, so the tables \`01\` creates are owned by it
   too and the app needs no grants. (Running \`01\` as a *different* user — a DBA or \`postgres\` —
   would leave the new tables unreadable by the app.) Put connection details in the environment,
   never in a file:
   \`\`\`sh
   export PGHOST=<db-host> PGPORT=5432 PGDATABASE=<storyboard-db> PGUSER=<app-db-user>
   export PGSSLMODE=require   # match the cluster's TLS setting
   read -rs PGPASSWORD && export PGPASSWORD   # typed, not echoed, not in shell history
   \`\`\`
3. **Run each file separately, reading the output before the next:**
   \`\`\`sh
   psql -X -v ON_ERROR_STOP=1 -f 00-preflight.sql     # must end with PREFLIGHT PASSED
   psql -X -v ON_ERROR_STOP=1 -f 01-migrate.sql       # must end with MIGRATED — ${ctx.applied.length + ctx.pending.length} migrations recorded
   psql -X -v ON_ERROR_STOP=1 -f 02-verify.sql        # must end with VERIFY PASSED
   \`\`\`
4. \`unset PGPASSWORD\`, then roll out the new image (DevOps / the usual deploy).

## After the rollout

- \`GET https://storyboard-stage.aecloud.io/api/health/db\` → 200 with \`db: true\`.
- If the image runs \`prisma migrate deploy\` at boot, its log shows \`No pending migrations to apply\`.
- Open the feature that needed the migration and exercise it once.

## If something fails

| Where | What it means | Do |
| --- | --- | --- |
| \`00\` history guard | The DB is not at \`${ctx.appliedThrough}\` — ahead, behind, or edited | Stop. Send the first result set (the recorded history); regenerate with the right \`--applied-through\`. |
| \`00\`/\`01\` "already exists" guard | A table/type exists without its history row — partial manual change | Stop and report; never drop objects to get past a guard. |
| \`01\` any error | The whole transaction rolled back — nothing changed | Fix the cause (usually privileges or a lock timeout: retry off-peak) and re-run \`01\`. |
| Disconnect during \`01\`'s COMMIT | Unknown outcome | Run \`02-verify.sql\`: PASSED ⇒ committed; history guard fails ⇒ run \`00\` again, then \`01\`. |

Rolling back a committed migration is a reviewed change or the team's restore process — this bundle
contains no DROP/down script by design.
`;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const all = readMigrations();
if (!args["applied-through"]) {
  console.error("Missing --applied-through <migration_name> (the newest migration already on the target DB).");
  console.error(`Known migrations:\n  ${all.map(({ name }) => name).join("\n  ")}`);
  process.exit(1);
}
const cut = all.findIndex(({ name }) => name === args["applied-through"]);
if (cut === -1) {
  console.error(`--applied-through ${args["applied-through"]} is not a migration in prisma/migrations.`);
  process.exit(1);
}
const applied = all.slice(0, cut + 1);
const pending = all.slice(cut + 1);
if (pending.length === 0) {
  console.error(`Nothing pending after ${args["applied-through"]} — the office DB is already current.`);
  process.exit(1);
}

const commit = git("rev-parse HEAD");
const dirtyMigrations = git("status --porcelain -- prisma/migrations");
const today = new Date().toISOString().slice(0, 10);
const folderName = `storyboard-dba-migration-${today}-${pending.at(-1).name.replace(/^\d+_/, "")}`;
const outDir = resolve(REPO_ROOT, args.out ?? join("output", folderName));
const ctx = {
  today,
  target: args.target ?? DEFAULT_TARGET,
  applied,
  pending,
  appliedThrough: args["applied-through"],
  objects: createdObjects(pending),
  folderName: outDir.split("/").at(-1),
  commitLabel: commit
    ? `commit ${commit}${dirtyMigrations ? " + UNCOMMITTED migration files (commit before handing over)" : ""}`
    : "no git commit available",
};

const files = {
  "00-preflight.sql": buildPreflight(ctx),
  "01-migrate.sql": buildMigrate(ctx),
  "02-verify.sql": buildVerify(ctx),
};
files["README.md"] = buildReadme(ctx, files);
files["migration-manifest.json"] = `${JSON.stringify(
  {
    prepared: today,
    target: ctx.target,
    sourceCommit: commit,
    uncommittedMigrationFiles: Boolean(dirtyMigrations),
    appliedThrough: ctx.appliedThrough,
    applied: applied.map(({ name, checksum }) => ({ name, checksum })),
    pending: pending.map(({ name, checksum }) => ({ name, checksum })),
    newObjects: ctx.objects,
  },
  null,
  2,
)}\n`;

mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content);
const sums = Object.keys(files)
  .sort()
  .map((name) => `${createHash("sha256").update(readFileSync(join(outDir, name))).digest("hex")}  ${name}`)
  .join("\n");
writeFileSync(join(outDir, "SHA256SUMS"), `${sums}\n`);

console.error(
  `${pending.length} pending migration(s) after ${ctx.appliedThrough}: ${pending.map(({ name }) => name).join(", ")}\n` +
    `new tables: ${ctx.objects.tables.join(", ") || "none"} · new enums: ${ctx.objects.types.join(", ") || "none"}\n` +
    `→ ${relative(REPO_ROOT, outDir)}/` +
    (dirtyMigrations ? "\n⚠ migration files are uncommitted — commit them before handing this bundle over." : ""),
);
