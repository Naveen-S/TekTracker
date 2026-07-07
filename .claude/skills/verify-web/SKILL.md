---
name: verify-web
description: Run the standard web/ verification suite — yarn lint, prisma validate + migrate status, the DB/env-free production build, and optional curl smokes on the :3002 dev server. Use before declaring any web/ change done, committing, or marking a feature Done.
---

# Verify web/ (standard suite)

Run everything from `web/`. Report a pass/fail line per step at the end; any failure blocks Done.

## 1. Lint

```bash
yarn lint
```

## 2. Prisma (needs `web/.env` present — talks to Neon)

```bash
yarn prisma validate
yarn prisma migrate status   # must be "up to date" before committing (coding-standards)
```

## 3. DB/env-free production build (the Feature-3 invariant)

Next.js auto-loads `web/.env`, so unsetting shell vars is not enough — move the file aside:

```bash
mv .env .env.verify-bak; yarn build; STATUS=$?; mv .env.verify-bak .env; (exit $STATUS)
```

- Must pass with `DATABASE_URL` and all secrets absent (proves no route executes at build time).
- API routes must show `ƒ (Dynamic)` in the build output — a `○ (Static)` API route means it ran
  (or will run) at build time and has probably lost its `force-dynamic` / request-time dependency.
- **Always restore `.env`**, even when the build fails.

## 4. Runtime smoke (whenever routes/pages changed)

```bash
yarn dev   # :3002 — the root Vite app owns :3000, legacy Express owns :3001
```

- **Stale-server gotcha (bit us 2026-06-29):** a previously started dev server holds :3002 with the
  OLD env loaded — after any `.env` change, `lsof -ti:3002 | xargs kill` and restart before trusting
  results.
- `curl` each affected route for every status path the spec's acceptance criteria name
  (e.g. 400 bad body / 401 no cookie / 200 happy path), not just the happy path.
- `GET /api/health/db` → `{"status":"ok","db":true,...}` confirms Neon connectivity at runtime.

## Environment notes

- Node is pinned to 20.19.4 by the legacy Vite app; `web/.yarnrc` has `ignore-engines true`. Do NOT
  "fix" engine warnings — the Node 22 bump is a deferred follow-up gated on retiring the Vite app
  (project-overview §16).
- There is no test suite (deliberate). One-off harnesses go in the scratchpad, not the repo.
  CJS gotcha for standalone unit checks: `web/` has no `"type":"module"`, so plain `node` treats
  `.js` as CommonJS — copy the module byte-identical to `.mjs` to exercise it (the crypto-test
  pattern), or run via `tsx`.
