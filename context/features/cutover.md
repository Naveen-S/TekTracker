# Cutover — promote `web/` to repo root, retire the Vite app into `legacy/` (migration step 10)

## Overview

The final Production Migration Plan step and the **next in-order step** (steps 1–8 Done
2026-07-12; step 9 skipped 2026-07-18 — no localStorage data left to import): make the Next.js app
the repository, not a subfolder. Three moves, in order:

1. **Retire the legacy Vite/Express app into `legacy/`** — per Naveen (2026-07-18), the app is
   **backed up, not deleted**, so it stays available as a reference (design comparisons, behavior
   questions, the pending side-by-side eyeball). This amends the §16 decision "promote `web/` to
   root and **delete** the Vite app".
2. **Promote `web/` to the repo root** — everything under `web/` moves up; `yarn dev`/`build`/
   `lint` run from the root from now on.
3. **Bump to Node 22 (≥22.12)** — the §16 deferred follow-up ratified 2026-06-14: add
   `.nvmrc` + `engines`, delete the `web/.yarnrc` `ignore-engines` shim (Prisma 7's transitive
   Node-≥22 dep then passes the engine check natively).

This is a **file-move + config feature — zero application-code changes.** No schema change, no
migration, no new deps, no route or component edits. The risk is entirely in the mechanics: git
rename detection, gitignore path semantics, untracked files (`.env`, `node_modules`), and the many
docs/skills that say `web/`.

> **Key shift: "the app" changes meaning.** Every §-tag in project-overview.md that says
> "[BUILT in `web/`]" or "legacy app unchanged until cutover" flips its frame of reference — the
> Next app becomes the only app at root, and the Vite app becomes a frozen artifact in `legacy/`.
> §7 (the "current architecture" snapshot of the Vite app) finally stops being current. Historical
> `web/...` paths in specs and History entries are **not** rewritten — they were true when
> written; a note in project-overview.md maps them to the post-cutover root.

## Status

**Done 2026-07-18** (planned same day). Two-phase `git mv` on `feature/cutover`, committed by
Naveen (the Tekion gitleaks pre-commit hook can't fetch its config from the session shell — see
as-built): **phase 1** retired the Vite app into `legacy/` (54 renames; untracked
`.env`/`node_modules`/`dist` moved by hand; plaintext-token `.sessions/` deleted;
`legacy/README.md` added; `sprint-tracker-legacy` package rename; **backup verified usable** —
`yarn dev:all` under Node 20 answered on :3000 + :3001); **phase 2** promoted `web/*` to root
(101 renames; `web/CLAUDE.md` deleted; `web/.env` → `.env`; `web/node_modules`/`.next` deleted
for the fresh install). **Node 22 bump landed with phase 2**: `.nvmrc` (22) + `engines >=22.12`,
`.yarnrc` shim deleted, fresh `yarn install` under 22.22.2 **passed the engine check natively**
(postinstall regenerated the Prisma client). Config/docs: root `.gitignore` = web's + re-added
`.claude/*` rules (the predicted exposure fired — `.claude/settings.json` went visible — and was
caught), `turbopack.root` comment updated (pin kept), `sprint-tracker` package rename, CLAUDE.md/
README.md rewritten + AGENTS.md now root, `.claude/skills` `web/`-path sweep (**`verify-web`
renamed `verify`** — Naveen, mid-implementation), `.env.example` header fixed, `legacy/**` added
to ESLint ignores (the only config-behavior change; root lint otherwise swept the retired tree).
**Verified at root under Node 22.22.2:** lint clean; `prisma validate` + `migrate status` up to
date (3 migrations); **DB/env-free build green — 27 `ƒ Dynamic`, byte-for-byte the step-8 route
list**; dev-server smoke on :3002 — unauth `/` 307→`/login`, `/login` 200, unknown share token →
generic invalid page, cron bad-bearer 401, `health/db` `{ok,db:true}` against Neon via the moved
`.env`, minted-admin dashboard SSR 200 with full chrome (Add filter / Sync Jira / Roll-up /
Share View / Export); `git log --follow` walks `legacy/server.js` into pre-move history. ⚠️ Human
acceptance (decision 9) still pending before merge: side-by-side eyeball, real-Jira UI sync,
share-open/PDF-export, plus a day-in-the-life pass on the root app. **Deployment re-pointing is
a deploy-time task.** **Next:** post-v1 — trend/burndown UI from snapshots (the step-10 "then"
clause), then Gemini.

## Decisions

Decision 1 is ratified (Naveen, 2026-07-18); decision 3 was ratified 2026-06-14 (§16).
**2, 4–9 are PROPOSED** (sensible defaults; flag if you disagree). None block implementation.

1. **Back up, don't delete (ratified with Naveen 2026-07-18).** The Vite app (root `src/`,
   `public/`, `index.html`, `vite.config.js`, `server.js`, `setup-auth.js`, `package.json`,
   both root lockfiles, `docs/` — the legacy-era AI docs) moves to **`legacy/`** and must remain
   **startable** there (`cd legacy && yarn dev:all` → Vite :3000 + Express :3001), pinned to
   Node 20 (a `legacy/README.md` records this). This supersedes the delete-at-parity plan; the
   permanent deletion of `legacy/` is a future call of Naveen's, not this feature.
2. **Two commits, `git mv` only, on one branch (PROPOSED).** Commit A: Vite app → `legacy/`.
   Commit B: `web/*` → root. Tracked files move with `git mv` so rename detection and
   `git log --follow` keep history; splitting the phases avoids the pathological case where
   `src/` is vacated and refilled in the same commit and similarity matching cross-wires legacy
   and Next files. *Alternative considered:* one commit — rejected for exactly that rename-
   inference risk.
3. **Node 22 bump lands in this feature, after the promotion (ratified 2026-06-14, §16).**
   `.nvmrc` = latest Node 22 LTS (≥22.12, Prisma 7's floor), `"engines": { "node": ">=22.12" }`
   in the promoted `package.json`, **delete `.yarnrc`**, then a **fresh `yarn install`** at root
   (no engine overrides; `postinstall` regenerates the Prisma client under the new Node). The
   §16 clause "re-verify the Vite app on 22 before switching" is void — the legacy app is
   retired-in-place on Node 20 and is not required to run on 22.
4. **Dev port stays `:3002` (PROPOSED).** The scaffold pinned 3002 only because Vite owned 3000 —
   but legacy stays *runnable* for the still-pending side-by-side eyeball, so keeping the ports
   disjoint (and Naveen's bookmarks/tabs valid) beats reclaiming 3000. Revisit after the human
   acceptance passes. *Alternative:* drop `-p 3002` for the Next default 3000 — deferred.
5. **The `turbopack.root` pin stays.** It exists because the repo has two lockfiles — still true
   after cutover (`legacy/yarn.lock` + root `yarn.lock`). `root: import.meta.dirname` moves with
   the config file and stays correct verbatim; only the comment needs updating (it names "the
   root Vite app").
6. **Untracked files move by hand; root `node_modules` is reinstalled, not moved (PROPOSED).**
   `git mv` only handles tracked files. Plain-`mv`: root `.env`, `node_modules/`, `dist/` →
   `legacy/`; `web/.env` → `.env` (it carries the real `DATABASE_URL`/secrets/`CRON_*` — the dev
   server is dead without it). `web/node_modules` and `web/.next` are **deleted**, not moved —
   the Node-22 fresh install (decision 3) rebuilds them, which also revalidates native deps and
   regenerates the Prisma client under the new runtime.
7. **`.sessions/` is deleted, not backed up (PROPOSED).** It is the legacy Express session file
   store holding **plaintext Jira tokens** (§13) — runtime data, not code; backing it up would
   preserve a secret-leak surface. If legacy is ever run again, logging in recreates it.
8. **Docs consolidation (PROPOSED):** `web/AGENTS.md` → root `AGENTS.md` (the "read the installed
   Next 16 docs first" rule now governs the whole repo); `web/CLAUDE.md` (whose sole content is
   `@AGENTS.md`) is deleted; root `CLAUDE.md` is rewritten for the single-app reality (commands
   become root `yarn dev`/`build`/`lint` + `db:*`; the "migration phase" note goes; the Next 16 /
   Tailwind v4 warnings stay); `web/README.md` (create-next-app boilerplate) becomes a short real
   README at root. Package `name`s: promoted root → `sprint-tracker`, legacy's →
   `sprint-tracker-legacy` (two private packages must not share a name confusingly).
9. **Sequencing vs the pending human acceptance (PROPOSED — Naveen decides at merge time).** The
   master plan says "promote at parity"; the open acceptance items (ui-polish side-by-side
   eyeball, 6a real-Jira UI sync run, step-8 share-open/PDF-export check) were the reason to
   wait. Because legacy stays runnable from `legacy/`, cutover no longer destroys the comparison —
   the branch can be prepared now, but the recommendation stands to run those checks **before
   merging**, while the familiar layout exists.
10. **Deployment re-pointing is a deploy-time task, out of repo scope.** Tekion infra builds from
    the repo root after this lands (previously `web/`); the cron schedule and all route paths are
    unchanged. Same status as step 7's "scheduling on Tekion infra".

## Requirements

### Scope

**(a) Phase 1 — retire the Vite app into `legacy/`**
- `git mv` to `legacy/`: `src/`, `public/`, `index.html`, `vite.config.js`, `server.js`,
  `setup-auth.js`, `package.json`, `package-lock.json`, `yarn.lock`, `.env.example`, `docs/`,
  and the current root `.gitignore` → `legacy/.gitignore` **minus** the `.claude/*` /
  `!.claude/skills/` rules (those stay at root — see (b)).
- Plain `mv` (untracked): `.env`, `node_modules/`, `dist/` → `legacy/`.
- `rm -rf .sessions/` (decision 7).
- New `legacy/README.md`: what this is, retired 2026-07-18 in favor of the Next app at root,
  **requires Node 20** (`nvm use 20`), how to run (`yarn dev:all` → :3000/:3001), pointer to
  project-overview §7 for its architecture.
- Stays at root untouched: `.git/`, `.claude/`, `.agents/`, `.codex/`, `.fallow/`, `context/`,
  `CLAUDE.md` (rewritten in (d)), `skills-lock.json`.

**(b) Phase 2 — promote `web/` to root**
- `git mv` everything in `web/` (including dotfiles: `.gitignore`, `.env.example`,
  `eslint.config.mjs`, `jsconfig.json`, `next.config.mjs`, `postcss.config.mjs`,
  `prisma.config.mjs`, `components.json`, `AGENTS.md`, `prisma/`, `public/`, `scripts/`, `src/`,
  `package.json`, `yarn.lock`, `README.md`) to the root; delete `web/CLAUDE.md` (decision 8);
  delete the now-empty `web/`.
- Root `.gitignore` = the promoted `web/.gitignore` **plus** re-added `.claude/*`,
  `!.claude/skills/`, and `.DS_Store` rules. Leading-`/` entries (`/node_modules`, `/.next/`,
  `/src/generated/prisma`) are relative to the file's directory, so they keep working verbatim
  at root.
- Plain `mv`: `web/.env` → `.env`. Delete `web/node_modules` + `web/.next` (decision 6).

**(c) Node 22 (after (b))**
- Add `.nvmrc` (latest 22.x, ≥22.12) and `engines.node ">=22.12"`; **delete `.yarnrc`**; under
  `nvm use 22`: fresh `yarn install` (must pass with no engine overrides), which runs
  `postinstall` → `prisma generate`.
- `tsx` stays as the seed/scripts runner — Node 22's native type-stripping is not adopted here
  (no behavior changes in this feature; note as a possible later simplification).

**(d) Config & doc touch-ups (no app code)**
- `next.config.mjs`: comment only (the pin's rationale now cites `legacy/yarn.lock`, decision 5).
- Promoted `package.json`: `name: "sprint-tracker"`, `engines`; `legacy/package.json`:
  `name: "sprint-tracker-legacy"` (decision 8).
- Root `CLAUDE.md` rewrite + root `AGENTS.md` + real `README.md` (decision 8).
- `.claude/skills/` path updates: `verify-web`, `api-route`, `prisma-change`, `finish-feature`,
  `start-feature`, `doc-sync`, `plan-feature` — every instruction that says `web/` or
  `cd web` now means the repo root (sweep with a grep). **Amended during implementation (Naveen,
  2026-07-18): `verify-web` is renamed to `verify`** — "web" lost its meaning at cutover, and the
  name matches the harness convention (its built-in `verify` defers to a project verify skill).
- `.env.example`: if the `CRON_*` crontab example embeds a `web/` path, fix it.

**(e) Explicitly: no schema change, no migration, no new dependency, no application-code edit.**
The DB/env-free build invariant must survive the move unchanged.

### Mechanism / gotchas

- **gitignore semantics are the sneaky part.** Rules anchored with a leading `/` are relative to
  the `.gitignore`'s own directory — the promoted file works at root, and the old root file works
  in `legacy/`, but the `.claude/*` allowlist rules must be **re-added to the root file by hand**
  (they'd otherwise move into `legacy/.gitignore` and stop protecting `.claude/`). Verify with
  `git check-ignore -v` after each phase.
- **`git mv` won't touch untracked files** and won't warn — `.env`, `node_modules`, `dist`,
  `.next` need explicit handling (decision 6). After the move, confirm root `.env` actually has
  `DATABASE_URL`/`SESSION_PASSWORD`/`TOKEN_ENCRYPTION_KEY`/`CRON_*` (the dev server fails loudly
  without them — by design).
- **Do not "fix" the missing `"type": "module"`.** The legacy root `package.json` had it; the
  promoted one doesn't — that CJS-default is why `workflows.mjs`/`seeding.mjs`/`seed.mjs` carry
  `.mjs` extensions. Adding it "for cleanliness" would silently change module resolution for
  every `.js` file. Leave it.
- **Rename verification, not assumption:** after each commit run `git show --stat -M` and expect
  `R` (rename) lines, and spot-check `git log --follow` on one file per phase
  (e.g. `legacy/server.js`, `src/lib/metrics.mjs`).
- **Prisma 7 paths all survive:** `prisma.config.mjs` (`schema`, `migrations.path`, seed command)
  and `src/lib/db.js` are relative to the app dir, which moves as a unit. Re-run
  `prisma validate` + `migrate status` post-install to prove it — expect zero drift (3
  migrations, up to date).
- **Next 16 surface:** none is expected to change — but if anything in `next.config.mjs` beyond
  the comment needs touching, read `node_modules/next/dist/docs/` first (AGENTS.md rule; this
  Next differs from training data).
- **Naveen's running dev server / open tabs die mid-move.** The `web/` dev server must be stopped
  before phase 2 (its cwd disappears); afterwards start from root. Given the export-saga stale-tab
  lesson (History 2026-07-18), close old app tabs and reopen after the cutover dev server is up.
- **Grep-sweep for load-bearing `web/` references** in living files (configs, scripts, skills,
  CLAUDE/AGENTS/README): must end at zero. `context/` History entries and Done feature specs are
  **exempt** — historical truth, per the Overview blockquote.

### Acceptance criteria

- **Root is the app, on Node 22:** `node -v` ≥ 22.12 via `.nvmrc`; plain `yarn install` succeeds
  with `.yarnrc` deleted; then at repo root: `yarn lint` clean, `prisma validate` +
  `prisma migrate status` up to date (3 migrations, no drift), and the **DB/env-free `yarn build`
  green (27 `ƒ Dynamic`)** — same counts as step 8, proving the move changed nothing.
- **Runtime smoke from root** (dev server on :3002 with the moved `.env`, against Neon):
  unauthenticated `/` → 307 `/login`; `/login` → 200; a minted-cookie dashboard SSR render shows
  real data; `/share/<unknown-token>` → the generic invalid page (200); `POST /api/cron/daily`
  with a bad bearer → 401 (proves secrets moved). Mirrors the step-6/8 smoke shape — no new
  fixtures needed.
- **The backup is usable, not just archived:** under Node 20, `cd legacy && yarn dev:all` boots —
  Vite answers on :3000 and the Express proxy on :3001 (`/api/auth/me` → 401 is fine; it proves
  the server runs).
- **History preserved:** `git log --follow` shows pre-cutover commits for at least one moved file
  per phase; both commits show `R`-status renames for tracked files.
- **Hygiene:** `.sessions/` gone and no plaintext token anywhere under root or `legacy/` except
  inside `legacy/.env` (Naveen's own dev file, gitignored — verify it IS ignored via
  `git check-ignore`); `git status` clean after both commits; the `web/` directory no longer
  exists; grep for load-bearing `web/` references → zero (exemptions above).
- **Human acceptance:** Naveen runs the pending pre-cutover checks (decision 9 — side-by-side
  eyeball, real-Jira UI sync, share/export) against the new layout, or before merging; and does
  one ordinary day-in-the-life pass on the root app (login → dashboard → sync → export) to bless
  the cutover.

### Out of scope

- **Post-v1 features the master plan sequences after cutover:** burndown/trend UI from
  `SprintSnapshot` (the §5 [PARTIAL] trend row), snapshot-based velocity (§12), Gemini risk
  call-outs + narrative (§16), Redis, dark-mode toggle, loading skeletons.
- **Deployment/infra re-pointing** (build root, cron scheduling) — deploy-time (decision 10).
- **Deleting `legacy/` for good** — future decision of Naveen's.
- **Any code refactor during the move** — no drive-by cleanups, no port-to-3000, no tsx→native
  type-stripping swap, no OAuth. File moves and the enumerated config/doc edits only.
- **Rewriting historical `web/` paths** in `context/` specs and History entries.

## Doc-sync (§17 — do in the same PR)

- **Production Migration Plan step 10** → **DONE** with the as-built summary, explicitly noting
  the ratified deviation: *moved to `legacy/`, not deleted* (Naveen 2026-07-18).
- **§16 decisions**: the migration bullet ("both apps runnable until parity, then promote `web/`
  to root and delete the Vite app") → annotate promoted + *backed up to `legacy/` instead of
  deleted*; the nested **Node 22 deferred follow-up** → done (`.nvmrc`/`engines` added, `.yarnrc`
  shim deleted).
- **§7 "Current architecture"** → retitle/annotate as the **retired legacy architecture, now in
  `legacy/`** (kept as the honest description of what `legacy/` contains — do **not** delete the
  section; it is the map to the backup).
- **§3/§5/§13/§14**: the "[GAP — legacy app only]" and "legacy app unchanged until cutover"
  qualifiers → annotate "legacy app retired to `legacy/` (2026-07-XX)". Do **not** flip any
  feature's [BUILT]/[PARTIAL]/[GAP] state — cutover builds nothing (trend UI stays [PARTIAL],
  Gemini stays [GAP]).
- **§10 Framework row**: migration complete — Next.js 16 at repo root; drop "scaffold in a `web/`
  subfolder" framing.
- Add a short note near the top of project-overview.md: historical `web/...` paths in dated
  entries refer to the pre-cutover layout (today's repo root).
- **Root `CLAUDE.md` / `AGENTS.md` / `README.md`** rewritten per decision 8; `.claude/skills/`
  path references updated per scope (d).
- **This file**: as-built deviations + Status → the dense Done summary.
  **`context/current-feature.md`**: Status + dated History line; next up is post-v1 (trend UI
  from snapshots is the named step-10 "then" item).
- **Must NOT over-claim:** deployment re-pointing still pending; any human-acceptance item still
  open at landing stays ⚠️-flagged; post-v1 rows unchanged.

## As-built deviations from the spec

- **Commits are Naveen's, not the assistant's.** The Tekion `alcatrazprehook` gitleaks
  pre-commit hook clones its config (`/tmp/gitleaks_false_positives`) from GitLab/Bitbucket and
  fails auth from the Claude Code session shell (sandboxed and unsandboxed) — commits succeed
  only from Naveen's own terminal. The "two commits, decision 2" structure held; the docs-prep
  commit (`d954be0`) landed first as a third, earlier commit.
- **`verify-web` → `verify` skill rename** (Naveen, mid-implementation) — supersedes the spec's
  "keep skill names" line (amended in scope (d)); matches the harness convention where the
  built-in `verify` defers to a project verify skill. References in finish-feature /
  prisma-change / api-route updated.
- **`legacy/**` added to `eslint.config.mjs` ignores** — not in the spec's edit list. Root
  `eslint` (flat config, no path argument) swept the retired tree (23 errors incl. its `dist/`
  bundle). Same treatment as `src/generated/**`.
- **`web/scripts/` was dropped, not moved** — empty and untracked (git never tracked it; its
  only planned content was the skipped step-9 importer's seed-data).
- **Root `.gitignore` is a modify, not a rename, in commit B** — it was `git mv -f`'d from
  `web/.gitignore` over the phase-1 interim file, then edited (re-added `.claude/*` rules);
  git records modify+delete. No history value lost (a 7-line file).
- **Phase 1 created an interim root `.gitignore`** (`.DS_Store`/`node_modules`/`.claude` rules)
  so commit A wouldn't expose `.claude/` internals — replaced in phase 2 as specced.
- **yarn had to be installed under Node 22** (`npm i -g yarn@1.22.22` in the nvm 22.22.2
  prefix; only corepack shipped with it). `.nvmrc` says `22` (floating major — nvm resolves to
  the installed 22.x; `engines >=22.12` pins the floor) rather than a hard-pinned patch version.
- **Smoke additions:** `GET /api/health/db` (the Feature-3 smoke route, still in the tree)
  doubled as the Neon-connectivity probe; the minted-cookie flow reused the established
  `sealData` harness pattern via a temp script at repo root (scratchpad scripts can't resolve
  the repo's `node_modules`), deleted after.
- **Legacy boot check ran in phase 1** (before commit A) rather than at the end — freshest
  moment to catch a broken move; `concurrently` leaves orphan listeners on :3000/:3001 when
  killed, cleaned up with `lsof`/`kill`.
- Commit A's message lost its closing paren (`…phase 1` instead of `…phase 1)`) — cosmetic.

## References

- @context/project-overview.md — §3 (legacy-only GAP note), §5 (feature-table cutover
  qualifiers), §7 (the legacy architecture this feature retires into `legacy/`), §10 (stack),
  §13/§14 (legacy-until-cutover flags), §16 (migration + Node 22 decisions), §17, Production
  Migration Plan step 10
- @context/current-feature.md — 2026-07-18 History (step 9 skipped; pending human-acceptance
  items), 2026-06-14 History (frozen deps, `.yarnrc` rationale)
- @context/features/ui-polish.md + @context/features/share-view-export.md — the pending
  side-by-side / real-Jira / export human acceptance (decision 9)
- Files that encode the move: [web/.yarnrc](../../web/.yarnrc) (the shim to delete),
  [web/next.config.mjs](../../web/next.config.mjs) (`turbopack.root` pin),
  [web/prisma.config.mjs](../../web/prisma.config.mjs) (relative paths that must survive),
  root [package.json](../../package.json) (legacy scripts incl. `dev:all`),
  root [.gitignore](../../.gitignore) (the `.claude/*` rules that must stay at root),
  [web/.gitignore](../../web/.gitignore) (becomes the root file)
