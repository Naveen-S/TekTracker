# StoryBoard — Deployment Runbook (office infra, stage)

StoryBoard is a **Next.js 16 (App Router) server-side app** — it runs a Node HTTP server
(not a static SPA), so it deploys as a **long-running container/service**, not a static bundle.

- **Repo:** `git@github.com:tekion-apps/storyboard.git` · branch to deploy: **`main`**
- **Runtime:** Node **22** (`.nvmrc` = 22, `engines >=22.12`) · container listens on **:3000**
- **Image:** built from `Dockerfile` at repo root (Next.js `standalone` output; Node 22 base)
- **Database:** internal Tekion Postgres (to be provisioned) — Prisma 7 over `@prisma/adapter-pg`

---

## 1. Routing — dedicated subdomain (decided)

StoryBoard serves from the **root of its own host** so no in-app path rewriting is needed:

- **Public URL:** `https://storyboard.stage.aecloud.io` (or the host DevOps assigns)
- The app serves at `/` — **do NOT strip a path prefix** and no `basePath` is configured.
- **Liveness probe:** `GET /p/health` → `200 {"status":"ok"}` (dependency-free; safe to poll)
- **Deep/readiness check (optional):** `GET /api/health/db` → verifies the DB connection

> ⚠️ Confirm the `stage.aecloud.io` zone exists and the platform can route the subdomain
> `storyboard.stage.aecloud.io` → this service. If only **path-based** routing on the existing
> host (`opex-stage.aecloud.io/storyboard`) is possible, tell the app team — that variant needs
> a small code change (`basePath: '/storyboard'`) and the route registered **without** `stripPrefix`.

---

## 2. Service-creation details (filed as RELB-28979)

```
Cluster:   AEC_GM
Namespace: storyboard
Env:       stage
```

```
Name of Service:        STORYBOARD
Service name (Route):   STORYBOARD
service type:           Backend  (standalone Next.js SSR — own Node server on :3000 + own
                        Postgres, not a static micro-frontend for the tekion-web shell)
SERVICE LEVEL:          GLOBAL LEVEL
Host (app route):       storyboard.stage.aecloud.io   (subdomain; app serves at "/")
health check api:       /p/health   (200 {"status":"ok"}, dependency-free)
Container port:         3000
gitlab/github url:      https://github.com/tekion-apps/storyboard.git
Branch To Deploy:       main
Node version:           22   (build & runtime — Node 20 will fail)
```

LoadBalancer:
```
curl --request POST \
  --url 'http://localhost:8080/discovery/v3/restricted/loadbalancers?authToken=ved' \
  --header 'authtoken: ved' \
  --header 'content-type: application/json' \
  --data '{
    "id": "STORYBOARD_LOADBALANCER",
    "url": "http://storyboard",
    "clusterId": <<clusterId>>,
    "type": "LOAD_BALANCER"
}'
```

Route / host binding — host-based; app serves at `/`, do NOT strip any prefix:
```
storyboard.stage.aecloud.io  ->  STORYBOARD_LOADBALANCER
```

> Backends here normally route by appRoot path on a shared host. If a per-app subdomain isn't
> available and an appRoot path must be used instead, register a path route with appRoot
> `/storyboard`, path `/storyboard/**`, `stripPrefix: false` — the app then needs a matching
> Next.js `basePath: '/storyboard'` and the health check becomes `/storyboard/p/health`.

---

## 3. Build (Jenkins)

`docker build` from the repo root produces the runtime image. The build is **env-free**
(no `NEXT_PUBLIC_*` vars; `DATABASE_URL` is not read at build time) — **no secrets needed to
build**. Two hard requirements:

1. **Node 22** base image (already set in the `Dockerfile`). Node 20 will fail install/build.
2. **Materialize the real `.env` into the build workspace before `docker build`.** Secrets are
   **baked into the image** (deployment decision), and `.env` is gitignored, so the Jenkins job
   must write it from Jenkins credentials/secret store into the checkout first. See §4 for the
   required keys.

The npm registry is already pointed at the Tekion JFrog proxy inside the Dockerfile.

---

## 4. Runtime environment (`.env`, baked into the image)

Generate the two app secrets with `openssl rand -base64 32`.

**Required:**
```
# sslmode must MATCH the in-house cluster's TLS config (ask DevOps): `require` if TLS is
# enforced/available (encrypts; an internal/self-signed cert is NOT CA-verified — fine),
# `verify-full` if they mandate CA verification (mount their CA), or `disable` if the cluster
# has no TLS (with `require` against a non-TLS server the connection fails).
DATABASE_URL=postgresql://USER:PASSWORD@INTERNAL_PG_HOST/storyboard?sslmode=require
SESSION_PASSWORD=<32+ char random>            # seals the iron-session cookie
TOKEN_ENCRYPTION_KEY=<base64 of 32 bytes>     # AES-256-GCM for stored Jira tokens
JIRA_BASE_URL=https://tekion.atlassian.net
SEED_ADMIN_EMAIL=<admin@tekion.com>           # one-time bootstrap (see §6)
CRON_SECRET=<32+ char random>                 # Bearer for the daily cron route
CRON_SYNC_USER_EMAIL=<a-user@tekion.com>      # whose Jira token the daily refresh uses;
                                              # must have logged in once + see all teams' projects
```

**Optional (Tekion-instance Jira field ids — recommended, avoids discovery ambiguity):**
```
JIRA_SUBCOMPONENT_FIELD_ID=customfield_13108
JIRA_SPRINT_FIELD_ID=customfield_10020
```

**Optional (AI Digest — only if enabled; leave unset to disable the feature):**
```
AI_PROVIDER=gemini            # or "anthropic"
GEMINI_API_KEY=...            # (or ANTHROPIC_API_KEY=...)
AI_MODEL=gemini-3.5-flash     # optional cost lever
```

> Only if the in-house DB is fronted by a transaction-pooler (e.g. PgBouncer) that can't run DDL:
> also set `DIRECT_URL` to the non-pooled host and wire it into `prisma.config.mjs` for migrations
> only. A direct instance endpoint needs no `DIRECT_URL`.

---

## 5. Database migrations (separate release step — decided)

Migrations do **not** run in the app image. Run against the internal Postgres **before**
starting/rolling the app, from an environment that has the dev deps + Prisma CLI + `prisma/`
(e.g. the Dockerfile **builder** stage, or a checkout under Node 22):

```
yarn install --frozen-lockfile
yarn db:deploy          # = prisma migrate deploy
```

Run as a Jenkins pre-deploy step (or an init job). With multiple replicas, run migrate as a
**single** step, not per-pod.

---

## 6. One-time bootstrap (first deploy only)

After the first successful `migrate deploy`, seed the admin + global status→stage mappings:

```
yarn db:seed            # idempotent; creates SEED_ADMIN_EMAIL as isAdmin + global mappings
```

Then the admin logs in at the app with their Jira email + API token, and provisions teams/members.

---

## 7. Daily background job (cron)

A platform scheduler must POST the cron route once daily (refreshes the Jira issue cache and
writes the daily trend snapshots):

```
curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://storyboard.stage.aecloud.io/api/cron/daily
```

Without it, the app still works but trend/burndown charts stop accruing new data points.

---

## 8. Open items to confirm with DevOps

- [ ] Subdomain `storyboard.stage.aecloud.io` reachable (zone `stage.aecloud.io` + host→LB route)? (else fall back to `opex-stage.aecloud.io/storyboard` + basePath)
- [x] Cluster / Namespace / Env — **AEC_GM / storyboard / stage** (per RELB-28979)
- [ ] `<<clusterId>>` value for the LoadBalancer registration
- [ ] Internal Postgres provisioned → connection string (+ DIRECT_URL if pooled)
- [ ] Secret store / Jenkins credentials wired so `.env` is materialized at build time
- [ ] Jenkins job created (Node 22, docker build, migrate step) + job name shared back
- [ ] Daily cron scheduled against `/api/cron/daily`
- [ ] Resource requests/limits (SSR Node app; suggest ~0.5 vCPU / 512Mi–1Gi to start)
