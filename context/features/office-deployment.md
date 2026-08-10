# Office-infra deployment (Dockerfile + service creation)

Package StoryBoard for deployment on Tekion office infrastructure as a containerized service on a
dedicated subdomain **`storyboard.stage.aecloud.io`** (stage env). Adds the container image + a
deployment runbook, and curates the RELB service-creation ticket. Not a master-plan step —
infra/ops work, done on branch `feature/office-deployment` (off `main` @ `c2a3ea6`).

## Status

**Done 2026-08-09** (branch `feature/office-deployment`, **uncommitted** — Naveen runs commits).

Implemented: `Dockerfile` (multi-stage, `node:22-alpine`, Next.js **standalone** output, JFrog npm
proxy, bakes `.env`, migrations left to a separate step, `CMD node server.js` on :3000),
`.dockerignore` (trims `legacy/`/`context/`/etc., **deliberately keeps `.env`**), `output:
"standalone"` in `next.config.mjs`, a dependency-free liveness route `src/app/p/health/route.js`
(`GET /p/health` → `200 {"status":"ok"}`), and `DEPLOY.md` (the DevOps runbook, kept in sync with
the filed ticket). RELB-28979 body curated (external — Naveen edits the live ticket).

**Verified** (Node 22): `yarn lint` clean; `prisma validate` + `prisma migrate status` → *"Database
schema is up to date!"* (**9 migrations, no schema change**); **env-free cold `rm -rf .next` build
green** (`.env` genuinely `mv`'d aside, restored after) — **45 `ƒ` Dynamic routes** (44 baseline +
the new `/p/health`); the **standalone artifact traces the generated Prisma client + `pg` driver**
into `.next/standalone/node_modules`, **boots**, and served `/p/health` → `{"status":"ok"}`,
`/login` → 200, `/` → 200 **with no `.env` present** (proving the image starts before secrets bind).
No Docker CLI locally, so the image was validated via `node .next/standalone/server.js`, not
`docker build`.

**Next:** commit on Naveen's go-ahead + push to `tekion-apps/storyboard` **`main`** (DevOps builds
that branch — the Dockerfile must be there); then DevOps executes RELB-28979 (subdomain host→LB
binding, internal Postgres, Jenkins job, cron), provisions the DB, and does the first
`yarn db:deploy` + `yarn db:seed`.

## Decisions (ratified with Naveen)

1. **Exposure = dedicated subdomain `storyboard.stage.aecloud.io`** (app serves at root → **no
   `basePath`, zero app-logic change**). Chosen over the subpath `/storyboard` **twice**, despite
   evidence that every real Tekion service (backends *and* frontends) routes by **appRoot path on a
   shared host** — no service uses a per-app subdomain. Fallback documented: if the subdomain/zone
   isn't available, `opex-stage.aecloud.io/storyboard` + a `basePath: '/storyboard'` change (small —
   all client API calls funnel through one `apiFetch` helper) + health at `/storyboard/p/health`.
2. **Database = internal Tekion Postgres** (to be provisioned), not the current Neon dev DB.
3. **Secrets = baked into the image** via `.env` at build (Jenkins materializes it from the secret
   store before `docker build`), not runtime-injected. Recommendation was runtime injection;
   Naveen chose baking (matches the pasted template). Security caveat recorded in `DEPLOY.md`.
4. **Migrations = separate pre-deploy step** (`yarn db:deploy`), never in the image build, never on
   container start (safe with >1 replica).
5. **Service name = `STORYBOARD`** (no `_SERVICE` suffix) — verified against ~12 real RELB
   service-creation tickets; most use a bare uppercase name (`DATASYNCAUTOMATION`, `COMPLIANCE`,
   `TEKDEALERPROVISIONING`), only some append `_SERVICE`/`-SERVICE`. Not a rule.
6. **`type: Backend`** — Tekion's `type` is a *deployment-pipeline* selector, not an architecture
   label. Their "Frontend" pipeline = a static micro-frontend compiled into `frontend-artifacts/…`
   and served through the shared `tekion-web` root-shell (no server, no own DB). StoryBoard is a
   **standalone Next.js SSR server** (own Node process on :3000 + own Postgres), which is the
   Backend deployment shape — the DB is orthogonal to `type`. A clarifying note rides in the ticket.
7. **Image = Next.js `output: "standalone"` on a `node:22-alpine` base.** The pasted template used
   `node:20` (the project **refuses** Node 20 — proven: `yarn` engine error `Got 20.19.4`) and would
   have shipped without the generated Prisma client. Standalone traces the client automatically.
8. **Health = shallow `/p/health`** (dependency-free liveness — a DB blip must not fail the probe);
   deep `/api/health/db` (existing) stays the readiness check.

## Scope (files)

- `Dockerfile` — new. Multi-stage; builder copies `prisma/` before `yarn install` so `postinstall`'s
  `prisma generate` has the schema; runner copies `.next/standalone` + `.next/static` + `public` +
  `.env*`; `PORT=3000`/`HOSTNAME=0.0.0.0`; `CMD ["node","server.js"]`.
- `.dockerignore` — new. Excludes `.git`/`node_modules`/`.next`/`legacy`/`context`/scratch; a
  comment marks that `.env` is **deliberately not ignored**.
- `next.config.mjs` — added `output: "standalone"` (build-only; `dev`/`start` unaffected).
- `src/app/p/health/route.js` — new. `export const dynamic = "force-dynamic"` + `GET` → 200 JSON.
- `DEPLOY.md` — new. Runbook: routing, service-creation block (mirrors RELB-28979), build,
  runtime `.env` keys, migrations, one-time seed, cron, open-items checklist.
- RELB-28979 — curated (external ticket; Naveen owns the live edit).

## As-built notes (vs. the spec)

- **No pre-existing spec.** This was an unplanned infra task with no `plan-feature`; this spec was
  written at `finish-feature`.
- **Node 20 → 22 is load-bearing, not cosmetic.** With the machine's default Node 20, `yarn lint`
  and `yarn build` both hard-fail (`error … engine "node" … Expected ">=22.12". Got "20.19.4"`) —
  every verification here ran under `nvm use` (22.22.2).
- **`output: "standalone"` was the right call over the template's copy-node_modules approach.** The
  generated Prisma client lives at `src/generated/prisma` (not `node_modules`) and the template's
  `yarn install --production --ignore-scripts` would have skipped it; standalone's `nft` trace picks
  it up. Confirmed: `.next/standalone/node_modules/@prisma` + `pg` present; the traced client
  resolves at boot with no `.env`.
- **`.dockerignore` intentionally inverts the usual `.env` exclusion.** Because secrets are baked
  (decision 3), the build context must contain the real `.env`; since `.env` is gitignored, the
  Jenkins job must write it into the workspace before `docker build`. Flagged in both the Dockerfile
  header and `DEPLOY.md`.
- **Ticket format discovery.** The pasted reference (RELB-25611) uses hand-run `curl` blocks
  (loadbalancers + routes). Current RELB "Service Creation" tickets use a **structured field list**
  (`serviceName`/`platform`/`moduleName`/`team`/`language`/`type`/`serviceLevel`/`environment`/
  `podId`/`appRoot`/`healthCheck`/`gitUrl`/`branchName`/`dockerFilePath`/`cloudProvider`/`cpuRequest`/
  `memoryLimit`) + a TekForge self-service template. RELB-28979 kept the older curl-block style
  (Naveen's edit) — both are accepted by DevOps.
- **RELB-28979 is typed "Repo Creation," not "Service Creation."** Flagged (the repo
  `tekion-apps/storyboard` already exists, so the repo-creation step is effectively done) — DevOps to
  confirm the type doesn't misroute; left as-is at Naveen's discretion.
- **Route/host registration for a subdomain was deliberately NOT given as a path `curl`.** A
  path-based route with `path: "/**"` on a shared discovery could vacuum unmatched global traffic —
  so #2 in the review was a plain host→LB binding request; the path variant is only the fallback,
  scoped to `/storyboard/**`.
- **Known ticket bug left for Naveen:** the cron line's *hyperlink target* still points at the old
  `storyboard.opex-stage.aecloud.io` host (display text is correct). Flagged, not edited (Naveen owns
  the live ticket).
- **Not deployed.** These artifacts are on `feature/office-deployment`, uncommitted; nothing has been
  deployed. DevOps action + a commit/push to `tekion-apps/storyboard` `main` are the remaining gates.

## Doc-sync

- `project-overview.md` — dated note under §8 (the deployment/[PLANNED] area) that the container
  image + runbook now exist (not yet deployed); `Last reviewed` → 2026-08-09. No §5/§9 change (this
  is infra, not a product feature or schema change).
- `CLAUDE.md` — one Structure bullet pointing at `Dockerfile`/`DEPLOY.md`/this spec.
- `context/current-feature.md` — carry-forward "Repo/branch state" updated with the new branch; Done
  entry appended to `context/legacy-history.md`.
- **Do not over-claim:** the app is **packaged**, not **deployed**; keep the tags at "artifacts
  added / ticket filed," not "running in stage."

## References

- Ticket: RELB-28979 (StoryBoard service creation) · format reference: RELB-25611.
- `DEPLOY.md` (runbook) · service view: `app.tekioncloud.com/internal/approval-management/services/view/22df75a8-…`.
