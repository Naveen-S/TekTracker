# Scaffold Next.js App in `web/`

## Overview

Feature 1 of the production migration (step 1 broken into small features). Create a fresh,
runnable **Next.js 16 (App Router, JavaScript)** app in a `web/` subfolder of this repo, per the
ratified decision in @context/project-overview.md §16: both apps run side-by-side until parity,
then `web/` is promoted to the repo root and the Vite app is deleted.

**This feature is the scaffold only.** No component porting, no database, no auth — just a clean
app that boots, builds, and coexists with the current Vite + Express app.

## Requirements

### Scope

- Scaffold with `create-next-app` (Next.js 16) into `web/`, non-interactive flags:
  - **JavaScript** (no TypeScript — decided 2026-06-10), `.jsx` components, `jsconfig.json`
  - **App Router** with **`src/` directory** → structure matches CLAUDE.md: `src/app/layout.jsx`,
    `src/app/page.jsx`, `src/app/globals.css`
  - **ESLint** (Next.js ruleset)
  - Import alias `@/*`
  - **Tailwind CSS v4** — included because it is part of the default `create-next-app` template
    (CSS-based config via `@tailwindcss/postcss`; `@import "tailwindcss"` in `globals.css`;
    **no `tailwind.config.*` file**). Theme/shadcn work is NOT this feature.
- Package name: `sprint-tracker-web`. `web/` owns its own `package.json`, lockfile, and
  `.gitignore` (with `node_modules`, `.next` ignored). Use **yarn** to match the root app.
- Set page metadata title to "Sprint Tracker"; otherwise leave the scaffold output untouched.
- Do not modify anything in the root Vite app.

### Acceptance criteria

- `cd web && yarn dev` serves the default page on `http://localhost:3002` (see port note below).
- `cd web && yarn build` succeeds.
- Root `yarn dev:all` (Vite :3000 + Express :3001) still works unchanged — no port clashes,
  all three dev servers can run simultaneously.
- No `tailwind.config.js`/`.ts` anywhere in `web/`; no `.ts`/`.tsx` source files.

> **Port correction (discovered 2026-06-12):** this doc originally said Vite runs on :5173 and
> `web/` should serve on :3000. In reality `vite.config.js` pins the root app to **:3000** (Vite 2
> default), and the root app must not be modified — so Next on :3000 would silently shadow the Vite
> app on `localhost:3000` (verified: each binds a different address family, both "start" fine).
> Resolution: `web/` dev script is pinned to **`next dev -p 3002`** for the coexistence period.
> When `web/` is promoted to the repo root and the Vite app is deleted, drop `-p 3002` to reclaim
> the :3000 default.

### Out of scope (next features in this breakdown)

- Tailwind theme (`@theme` in `globals.css`) + shadcn/ui setup
- Prisma 7 + Neon (`DATABASE_URL`, schema, first migration)
- zod + API-boundary validation conventions
- Porting auth/routes/components from the Vite app

## Notes

- **Before writing any routing/rendering/styling code** in `web/`, read the relevant guide in
  `web/node_modules/next/dist/docs/` — Next.js 16 and Tailwind v4 have breaking changes vs. older
  conventions (per CLAUDE.md).
- Verify the local Node version satisfies Next.js 16's `engines` requirement before scaffolding.

## As-built deviations from the scaffold output (2026-06-12)

Beyond the spec'd changes (package name, metadata title, `.jsx` renames), two fixes were required:

- **`turbopack.root` pinned in `next.config.mjs`** — with two lockfiles in the repo (root +
  `web/`), Next.js inferred the *repo root* (the Vite app) as its workspace root. Pinned to the
  `web/` directory.
- **`typescript` added as a devDependency** — `eslint-config-next@16` unconditionally requires the
  `typescript` module even in JS projects; npm auto-installs peers but yarn 1 does not, so
  `yarn lint` crashed out of the box. Tooling-only: no `tsconfig.json`, no `.ts`/`.tsx` sources;
  the project remains JavaScript per the 2026-06-10 decision.

## References

- @context/project-overview.md (§8 target architecture, §10 stack, §16 decisions)
- @context/coding-standards.md (Next.js + Tailwind v4 rules)
- CLAUDE.md (structure + non-standard versions warning)
