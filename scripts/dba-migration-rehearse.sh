#!/usr/bin/env bash
# Rehearse an office DB migration bundle on a THROWAWAY local PostgreSQL, then delete it.
# Companion to scripts/dba-migration-bundle.mjs; step 4 of the `dba-migration-bundle` skill.
#
#   bash scripts/dba-migration-rehearse.sh <bundle-dir>             # rehearse, print a PASS/FAIL summary
#   bash scripts/dba-migration-rehearse.sh --finalize <bundle-dir>  # re-hash SHA256SUMS + rebuild the zip
#
# What the rehearsal does (all as one login role, `storyboard_app`, that owns the database and
# migrates it: the office model; no grants anywhere):
#   1. Rebuilds TODAY'S office state: the all-history bootstrap `00`-`03` (never its `04`), then every
#      earlier incremental bundle in output/ that chains up to this bundle's `appliedThrough`, in
#      order, including any `02b-seed.sql`. Refuses if the chain does not reach `appliedThrough`.
#   2. Happy path: `00` -> PREFLIGHT PASSED, `01` -> MIGRATED, `02` -> VERIFY PASSED (+ `02b`, run twice
#      for idempotency). New tables owned by the app role, which holds INSERT/UPDATE/DELETE on them.
#   3. Prisma as the app role: migrate status / migrate deploy / migrate diff against the repo schema.
#   4. Negative tests, each on a fresh copy of the pre-bundle state: re-run `01`, re-run `00`, an error
#      injected before COMMIT rolls back, a pre-created new table is refused, a bundle generated
#      with an earlier --applied-through is refused, `02b` before `01` is refused.
#
# NEVER point this at a real database: it creates its own cluster on 127.0.0.1 and deletes it.
# Env overrides: PGBIN (default Homebrew postgresql@15), REHEARSAL_PORT (55432),
# BOOTSTRAP_DIR (output/storyboard-dba-bootstrap-2026-09-22).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/output"

if [[ "${1:-}" == "--finalize" ]]; then
  BUNDLE="$(cd "${2:?usage: --finalize <bundle-dir>}" && pwd)"
  NAME="$(basename "$BUNDLE")"
  [[ -f "$BUNDLE/VALIDATION.md" ]] || { echo "No VALIDATION.md in $BUNDLE — write it first." >&2; exit 1; }
  (cd "$BUNDLE" && shasum -a 256 $(ls 0*.sql) README.md VALIDATION.md migration-manifest.json > SHA256SUMS \
    && shasum -a 256 -c SHA256SUMS) || exit 1
  (cd "$(dirname "$BUNDLE")" && rm -f "$NAME.zip" && zip -qr "$NAME.zip" "$NAME") || exit 1
  echo "finalized: $(dirname "$BUNDLE")/$NAME.zip"
  exit 0
fi

BUNDLE="$(cd "${1:?usage: dba-migration-rehearse.sh <bundle-dir>}" && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@15/bin}"
PORT="${REHEARSAL_PORT:-55432}"
BOOTSTRAP_DIR="${BOOTSTRAP_DIR:-$OUTPUT_DIR/storyboard-dba-bootstrap-2026-09-22}"
APP_ROLE=storyboard_app
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sb-rehearsal.XXXXXX")"

[[ -x "$PGBIN/pg_ctl" ]] || { echo "No PostgreSQL at $PGBIN (set PGBIN)." >&2; exit 1; }
if lsof -ti:"$PORT" >/dev/null 2>&1; then echo "Port $PORT is busy (set REHEARSAL_PORT)." >&2; exit 1; fi

cleanup() {
  "$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

json() { node -e "const m=require(process.argv[1]); const v=($2); console.log(Array.isArray(v)?v.join('\n'):v ?? '')" "$1"; }
MANIFEST="$BUNDLE/migration-manifest.json"
APPLIED_THROUGH="$(json "$MANIFEST" 'm.appliedThrough')"
APPLIED_COUNT="$(json "$MANIFEST" 'm.applied.length')"
PENDING_COUNT="$(json "$MANIFEST" 'm.pending.length')"
PENDING_LAST="$(json "$MANIFEST" 'm.pending.at(-1).name')"
# Space-separated (table names are Prisma model names, never contain spaces); bash 3.2-safe.
NEW_TABLES="$(json "$MANIFEST" 'm.newObjects.tables.join(" ")')"
LAST_NEW_TABLE="$(json "$MANIFEST" 'm.newObjects.tables.at(-1)')"
PREVIOUS_HEAD="$(json "$MANIFEST" '(m.applied.at(-2)||{}).name')"
FINAL_COUNT=$((APPLIED_COUNT + PENDING_COUNT))

export PGHOST=127.0.0.1 PGPORT="$PORT"
P() { "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 "$@"; }
Q() { P -tA "$@"; }

FAILS=0
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAILS=$((FAILS + 1)); }
# result line of a run: the last PASSED / MIGRATED / SEEDED / ERROR line
run() { # <file> <db> -> sets RC, OUT
  OUT="$(P -U "$APP_ROLE" -d "$2" -f "$1" 2>&1)"; RC=$?
  OUT="$(printf '%s\n' "$OUT" | grep -E 'PASSED|MIGRATED|SEEDED|ERROR' | tail -1 | sed -E 's/^ *//; s/^psql:[^ ]*: //')"
}
expect_ok() { # <label> <file> <db> <pattern>
  run "$2" "$3"
  if [[ $RC -eq 0 && "$OUT" == *"$4"* ]]; then pass "$1 → $OUT"; else fail "$1 (rc=$RC) → $OUT"; fi
}
expect_refused() { # <label> <file> <db> <pattern>
  run "$2" "$3"
  if [[ $RC -ne 0 && "$OUT" == *"$4"* ]]; then pass "$1 → refused: ${OUT:0:160}"; else fail "$1 was not refused as expected (rc=$RC) → $OUT"; fi
}
history_count() { Q -U "$APP_ROLE" -d "$1" -c 'select count(*) from "_prisma_migrations"'; }
new_table_count() {
  [[ -z "$NEW_TABLES" ]] && { echo 0; return; }
  local list; list="$(printf "'%s'," $NEW_TABLES)"; list="${list%,}"
  Q -U "$APP_ROLE" -d "$1" -c "select count(*) from pg_tables where schemaname='public' and tablename in ($list)"
}
fresh() { P -U postgres -d postgres -c "drop database if exists sb_neg" -c "create database sb_neg template sb_template owner $APP_ROLE" >/dev/null 2>&1; }

echo "Bundle:  $(basename "$BUNDLE")"
echo "Applies: $PENDING_COUNT migration(s) on top of $APPLIED_COUNT (through $APPLIED_THROUGH) → $FINAL_COUNT"
echo "Tables:  ${NEW_TABLES:-(none)}"
echo

# ── cluster ──────────────────────────────────────────────────────
"$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null || exit 1
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-c unix_socket_directories='' -c listen_addresses=127.0.0.1 -p $PORT" \
  -l "$WORK/pg.log" -w start >/dev/null || { cat "$WORK/pg.log"; exit 1; }
P -U postgres -d postgres -c "create role $APP_ROLE login password 'app'" -c "create database storyboard owner $APP_ROLE" >/dev/null
echo "PostgreSQL: $("$PGBIN/postgres" --version) · Node $(node -v) · on 127.0.0.1:$PORT (deleted on exit)"
echo

# ── 1. today's office state ──────────────────────────────────────
echo "== Office state"
for f in 00-preflight 01-schema-bootstrap 02-bootstrap-seed 03-verify; do
  OUT="$(P -U "$APP_ROLE" -d storyboard -f "$BOOTSTRAP_DIR/$f.sql" 2>&1)" || { echo "bootstrap $f failed:"; echo "$OUT" | tail -5; exit 1; }
done
HEAD="$(json "$BOOTSTRAP_DIR/migration-manifest.json" 'm.migrations.at(-1).name')"
echo "  bootstrap 00–03 (not 04) → head $HEAD"
for dir in $(ls -d "$OUTPUT_DIR"/storyboard-dba-migration-*/ | sort); do
  dir="${dir%/}"; [[ "$dir" == "$BUNDLE" ]] && continue
  [[ -f "$dir/migration-manifest.json" ]] || continue
  from="$(json "$dir/migration-manifest.json" 'm.appliedThrough')"
  to="$(json "$dir/migration-manifest.json" 'm.pending.at(-1).name')"
  [[ "$from" == "$HEAD" && ! "$to" > "$APPLIED_THROUGH" ]] || continue
  for f in 00-preflight 01-migrate 02-verify 02b-seed; do
    [[ -f "$dir/$f.sql" ]] || continue
    run "$dir/$f.sql" storyboard
    [[ $RC -eq 0 ]] || { echo "  $(basename "$dir") $f failed → $OUT"; exit 1; }
  done
  HEAD="$to"; echo "  $(basename "$dir") → head $HEAD"
done
if [[ "$HEAD" != "$APPLIED_THROUGH" ]]; then
  echo "Cannot reproduce the office state: the bundles in output/ reach $HEAD, not $APPLIED_THROUGH." >&2; exit 1
fi
[[ "$(history_count storyboard)" == "$APPLIED_COUNT" ]] || { echo "History is not $APPLIED_COUNT rows after rebuilding." >&2; exit 1; }
P -U postgres -d postgres -c "create database sb_template template storyboard owner $APP_ROLE" >/dev/null
echo "  history rows: $APPLIED_COUNT"
echo

# ── 2. happy path ────────────────────────────────────────────────
echo "== Happy path"
expect_ok "00-preflight" "$BUNDLE/00-preflight.sql" storyboard "PREFLIGHT PASSED"
expect_ok "01-migrate" "$BUNDLE/01-migrate.sql" storyboard "MIGRATED"
expect_ok "02-verify" "$BUNDLE/02-verify.sql" storyboard "VERIFY PASSED"
if [[ -f "$BUNDLE/02b-seed.sql" ]]; then
  expect_ok "02b-seed" "$BUNDLE/02b-seed.sql" storyboard "SEEDED"
  expect_ok "02b-seed re-run (idempotent)" "$BUNDLE/02b-seed.sql" storyboard "SEEDED"
fi
[[ "$(history_count storyboard)" == "$FINAL_COUNT" ]] && pass "history has $FINAL_COUNT rows" || fail "history is not $FINAL_COUNT rows"
for t in $NEW_TABLES; do
  row="$(Q -U "$APP_ROLE" -d storyboard -c "select tableowner || ' ' || has_table_privilege('$APP_ROLE','public.\"$t\"','INSERT,UPDATE,DELETE') from pg_tables where schemaname='public' and tablename='$t'")"
  [[ "$row" == "$APP_ROLE true" ]] && pass "$t owned by $APP_ROLE, INSERT/UPDATE/DELETE with no grants" || fail "$t ownership/privileges → '$row'"
done
echo

# ── 3. Prisma, as the app role ───────────────────────────────────
echo "== Prisma ($(cd "$REPO_ROOT" && npx --no-install prisma --version 2>/dev/null | awk '/^prisma /{print $3}'))"
REPO_LAST="$(ls -d "$REPO_ROOT"/prisma/migrations/*/ | sort | tail -1 | xargs basename)"
if [[ "$REPO_LAST" != "$PENDING_LAST" ]]; then
  # The checkout has newer migrations than this bundle: status/deploy would (rightly) see them as
  # pending, and deploy would APPLY them to the rehearsal DB, spoiling the refusal tests below.
  fail "Prisma checks skipped: the repo's newest migration is $REPO_LAST, the bundle ends at $PENDING_LAST. Rehearse from a checkout whose newest migration is the bundle's last."
else
export DATABASE_URL="postgresql://$APP_ROLE:app@127.0.0.1:$PORT/storyboard"
PRISMA() { (cd "$REPO_ROOT" && npx --no-install prisma "$@" 2>&1); }
out="$(PRISMA migrate status)"; rc=$?
[[ $rc -eq 0 && "$out" == *"127.0.0.1:$PORT"* && "$out" == *"up to date"* ]] \
  && pass "migrate status → $(grep -o '[0-9]* migrations found' <<<"$out") · up to date (datasource 127.0.0.1:$PORT)" \
  || fail "migrate status (rc=$rc) → $(tail -3 <<<"$out")"
out="$(PRISMA migrate deploy)"; rc=$?
[[ $rc -eq 0 && "$out" == *"No pending migrations"* ]] && pass "migrate deploy → No pending migrations to apply" || fail "migrate deploy (rc=$rc) → $(tail -3 <<<"$out")"
out="$(PRISMA migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code)"; rc=$?
[[ $rc -eq 0 && "$out" == *"No difference detected"* ]] && pass "migrate diff → No difference detected" || fail "migrate diff (rc=$rc) → $(tail -5 <<<"$out")"
unset DATABASE_URL
fi
echo

# ── 4. refusals and safety ───────────────────────────────────────
echo "== Refusals (each on a fresh copy of the $APPLIED_COUNT-migration state)"
expect_refused "re-run 01 on the migrated DB" "$BUNDLE/01-migrate.sql" storyboard "Migration history is not exactly"
[[ "$(history_count storyboard)" == "$FINAL_COUNT" ]] || fail "history changed after the refused re-run"
expect_refused "re-run 00 on the migrated DB" "$BUNDLE/00-preflight.sql" storyboard "Migration history is not exactly"

fresh
awk '{ if ($0 == "COMMIT;" && !done) { print "SELECT 1/0;"; done = 1 } print }' "$BUNDLE/01-migrate.sql" > "$WORK/01-inject.sql"
expect_refused "error injected before COMMIT" "$WORK/01-inject.sql" sb_neg "division by zero"
h="$(history_count sb_neg)"; n="$(new_table_count sb_neg)"
[[ "$h" == "$APPLIED_COUNT" && "$n" == 0 ]] && pass "  → full rollback: history $h, new tables $n" || fail "  → NOT rolled back: history $h, new tables $n"

if [[ -n "$LAST_NEW_TABLE" ]]; then
  victim="$LAST_NEW_TABLE"
  fresh; P -U "$APP_ROLE" -d sb_neg -c "create table public.\"$victim\"(id text primary key)" >/dev/null
  expect_refused "00 with $victim pre-created (partial state)" "$BUNDLE/00-preflight.sql" sb_neg "already exists"
  expect_refused "01 with $victim pre-created (partial state)" "$BUNDLE/01-migrate.sql" sb_neg "already exists"
  [[ "$(history_count sb_neg)" == "$APPLIED_COUNT" ]] && pass "  → history unchanged" || fail "  → history changed"
else
  echo "SKIP: partial-state test (no new tables in this bundle)"
fi

if [[ -n "$PREVIOUS_HEAD" ]]; then
  (cd "$REPO_ROOT" && node scripts/dba-migration-bundle.mjs --applied-through "$PREVIOUS_HEAD" --out "$WORK/older" >/dev/null 2>&1)
  fresh
  expect_refused "00 from a bundle generated with --applied-through $PREVIOUS_HEAD" "$WORK/older/00-preflight.sql" sb_neg "Migration history is not exactly"
  expect_refused "01 from that bundle" "$WORK/older/01-migrate.sql" sb_neg "Migration history is not exactly"
  [[ "$(history_count sb_neg)" == "$APPLIED_COUNT" ]] && pass "  → history unchanged" || fail "  → history changed"
fi

if [[ -f "$BUNDLE/02b-seed.sql" ]]; then
  fresh
  expect_refused "02b-seed before 01" "$BUNDLE/02b-seed.sql" sb_neg "run 01-migrate.sql first"
fi
P -U postgres -d postgres -c "drop database if exists sb_neg" >/dev/null 2>&1
echo

if [[ $FAILS -eq 0 ]]; then
  echo "REHEARSAL PASSED — write VALIDATION.md from the lines above, then: bash scripts/dba-migration-rehearse.sh --finalize $BUNDLE"
else
  echo "REHEARSAL FAILED — $FAILS check(s). Do not hand this bundle over."
fi
exit $(( FAILS > 0 ))
