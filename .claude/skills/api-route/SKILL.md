---
name: api-route
description: Scaffold a new web/ endpoint (Route Handler or Server Action) following the established auth-layer patterns — zod validate() at the boundary, requireUser()/isAdmin guards, the right response contract, force-dynamic, Jira specifics isolated. Use when adding any API route, server action, or domain mutation (migration step 4+).
---

# New endpoint (web/) — Route Handler or Server Action

## Choose the mechanism first (coding-standards + auth-layer decision 7)

- **Route Handler** (`web/src/app/api/<path>/route.js`): third-party integrations (Jira), webhooks,
  specific HTTP statuses/headers, contracts ported from the legacy `server.js`, endpoints for
  future CLI/mobile clients. Response contract: HTTP status + prototype-style **`{ error }`** JSON
  bodies (400 invalid input, 401 unauthenticated, 500 unexpected).
- **Server Action** (`web/src/actions/<feature>.js`): in-app form submissions and simple mutations
  (e.g. stage toggle / blocked flag writes). Contract: **`{ success, data, error }`** with
  try/catch, surfaced via toast.
- Server components fetch **directly with Prisma** — don't build an endpoint for the app's own
  reads.

## Route Handler pattern (exemplar: `web/src/app/api/auth/login/route.js`)

1. **Boundary validation**: zod schema in `web/src/lib/schemas/<feature>.js` (+ JSDoc `@typedef`
   for the domain shape); parse with `validate(schema, body)` from `@/lib/validation` → on failure
   return 400 `{ error }` with the combined zod message.
2. **Auth**: `const user = await requireUser()` from `@/lib/auth`; catch `UnauthorizedError` →
   401 `{ error: "Not authenticated" }`. Admin-gated mutations (sprint config, team management)
   check `user.isAdmin` **server-side** — UI-only gating violates §17. `getCurrentUser()` reads the
   DB fresh each request by design (RBAC freshness, auth-layer decision 8) — don't cache identity
   in the cookie.
3. **DB**: `import { prisma } from "@/lib/db"` — never instantiate `PrismaClient` and never import
   `@/generated/prisma/client` outside `db.js`.
4. **`export const dynamic = "force-dynamic"`** on any route touching cookies/DB — house
   belt-and-suspenders so `yarn build` never executes it and stays DB/env-free.
5. **Jira isolation (§17)**: anything Jira — base URL, Basic-auth construction, endpoints, custom
   field IDs (`customfield_10008`/`_10020`), pagination — lives in `web/src/lib/jira/client.js`
   only. Grow that module; never inline a Jira fetch in a route.
6. **Errors & env**: try/catch → 500 with a user-safe `{ error }`; missing secrets/env **fail
   loudly** at request time (the `dev-secret` fallback is retired — never reintroduce silent
   fallbacks).
7. **Language**: authored source stays `.js`/`.jsx` (no new `.ts`); JSDoc typedefs carry the
   shapes.
8. **Next 16**: `cookies()`/`headers()` are **async** — and route APIs may differ from training
   data. Read `node_modules/next/dist/docs/` before using anything you haven't used in this repo.

## Verify

`curl` every status path from the acceptance criteria (bad body → 400, no cookie → 401, happy →
200) against `yarn dev` on :3002, then run /verify-web (build must stay DB-free and the route must
list as `ƒ (Dynamic)`).
