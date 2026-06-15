# Scaffold Tailwind CSS v4 + shadcn/ui + zod in `web/`

## Overview

Feature 2 of the production migration (the migration is broken into small, independently
verifiable features). Build on the Feature 1 scaffold (@context/features/scaffold-nextjs.md) by
wiring up the **styling + validation foundation** in `web/`: a Tailwind CSS v4 theme seeded with
Tekion design tokens, **shadcn/ui** (JavaScript / `.jsx`), and **zod** with an API-boundary
validation convention — per @context/project-overview.md §10 (stack) and §16 (decisions:
"Tailwind CSS v4 + shadcn/ui", "JavaScript with zod validation at every API boundary").

**This feature is the scaffold only.** No component porting, no database, no auth, no real API
routes. The goal is that the foundation boots, builds, lints, and is ready for later features to
port screens onto — while still coexisting with the current Vite + Express app.

## Requirements

### Scope

**Tailwind CSS v4 theme (CSS-based config — no `tailwind.config.*`)**
- Keep `@import "tailwindcss"` in [src/app/globals.css](web/src/app/globals.css). Configure the
  theme entirely in CSS via `@theme` / CSS custom properties (Tailwind v4 + coding-standards rule).
  **No `tailwind.config.js`/`.ts` may be created** — if the shadcn CLI emits one, delete it and fold
  any values into `@theme`.
- Establish the shadcn CSS-variable contract for both modes: `--background`, `--foreground`,
  `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`,
  `--border`, `--input`, `--ring`, `--radius` (and `-foreground` pairs). Light values on `:root`,
  dark values under `.dark`, mapped to Tailwind utilities through `@theme inline`.
- **Default to light mode.** Light values live on `:root` so the app renders light with no class on
  `<html>`. Still define the full dark palette under `.dark` (class strategy,
  `@custom-variant dark (&:is(.dark *))`) so a later light/dark toggle can flip it — but do **not**
  add `className="dark"` to `<html>` in [src/app/layout.jsx](web/src/app/layout.jsx). A runtime
  toggle (`next-themes`) is **out of scope** here. (Note: this overrides the "dark mode first"
  line in @context/coding-standards.md — light is the chosen default for the scaffold.)
- **Seed brand tokens from the Vite app**, not a full re-skin: translate the existing palette in
  [src/styles.css](src/styles.css) so `--primary` is Tekion teal (`#00BFA5`) and the neutral base
  matches the slate scale. Hex is fine; shadcn v4 defaults to oklch — either is acceptable. Full
  component re-skin (project-overview §11) stays in a later feature.

**shadcn/ui (JavaScript)**
- Initialize with the shadcn CLI configured for Tailwind v4 + Next.js App Router + **JavaScript**:
  `components.json` with `"tsx": false`, `"rsc": true`, aliases resolving through the existing
  `@/*` (`jsconfig.json`) — components at `@/components`, ui at `@/components/ui`, utils at
  `@/lib/utils`. CLI must emit **`.jsx`, never `.tsx`**.
- Accept the CLI-installed helper deps (`class-variance-authority`, `clsx`, `tailwind-merge`,
  `lucide-react`, and the Tailwind-v4 animation package `tw-animate-css` — **not** the v3
  `tailwindcss-animate`). Confirm `cn()` lands at [src/lib/utils.js](web/src/lib/utils.js).
- **Smoke test the pipeline:** add at least the `button` primitive (`npx shadcn@latest add button`)
  and render one `<Button>` on the home page to prove the variants, tokens, and `cn()` all resolve.
  Keep the rest of the scaffold page minimal.

**zod + validation convention**
- Add **`zod`** as a direct dependency.
- Create a small boundary-validation helper at [src/lib/validation.js](web/src/lib/validation.js)
  that wraps `safeParse` into the project's `{ success, data, error }` result shape
  (coding-standards: "Return `{ success, data, error }` from actions", "Validate all inputs with
  Zod"). Document the convention: every API route / Server Action validates input with a zod schema
  at the boundary; domain shapes also get a JSDoc `@typedef`.
- Add **one placeholder schema** (e.g. `src/lib/schemas/example.js`) used by a trivial call site so
  the import resolves and lint passes — clearly marked as a delete-me sample, since no real
  routes/actions exist yet.

### Acceptance criteria

- `cd web && yarn build` succeeds; `cd web && yarn lint` passes (no unused imports/vars).
- `cd web && yarn dev` still serves on `http://localhost:3002`; root `yarn dev:all`
  (Vite :3000 + Express :3001) still runs unchanged — all three dev servers coexist, no port clash.
- The home page renders a shadcn `<Button>` styled by the theme tokens; the app defaults to **light**
  mode (no `.dark` class on `<html>`), with dark tokens defined under `.dark` for later use.
- `components.json` has `"tsx": false`; **no `.ts`/`.tsx` source files** were generated; `cn()`
  exists at `@/lib/utils`.
- **No `tailwind.config.js`/`.ts` anywhere in `web/`** — theme lives in `globals.css`.
- `zod` resolves and the validation helper + placeholder schema import cleanly.
- Nothing in the root Vite app was modified.

### Out of scope (later features)

- Porting auth / routes / components / screens from the Vite app, and the full Tekion re-skin (§11).
- Runtime theme switching (`next-themes`) and a theme-toggle control.
- Prisma 7 + Neon (`DATABASE_URL`, schema, first migration).
- Real zod schemas for actual API routes / Server Actions (only the convention + a placeholder here).

## Notes

- **Read the docs first** (CLAUDE.md): before touching styling, skim the relevant guide in
  `web/node_modules/next/dist/docs/` and shadcn's Tailwind v4 page — Tailwind v4 and shadcn-on-v4
  both diverge from older conventions in training data.
- **shadcn + Tailwind v4 gotcha:** older shadcn versions scaffold a `tailwind.config.*` and use
  `tailwindcss-animate`; the v4 flow uses CSS-only config + `tw-animate-css` + `@theme`. Verify the
  CLI took the v4 path; remove any `tailwind.config.*` it leaves behind.
- **React 19 peer deps:** Radix UI primitives may emit React 19 peer-dependency warnings. Under
  yarn 1 these are warnings, not errors (same tradeoff noted in the Feature 1 as-built deviations);
  the build should still pass.
- **JS enforcement:** if the CLI tries to default to TypeScript, force JS — `jsconfig.json` is
  already present and `components.json` `"tsx": false` is the switch. The project stays JavaScript
  per the 2026-06-10 decision; the `typescript` devDep added in Feature 1 is tooling-only.

## As-built deviations (2026-06-13)

- **shadcn set up manually, not via the CLI registry.** `ui.shadcn.com` does not resolve from this
  environment (`getaddrinfo ENOTFOUND ui.shadcn.com`, even with the sandbox disabled), so
  `shadcn init` / `shadcn add` could not fetch the registry. The npm registry *is* reachable, so the
  outcome is identical to the CLI: deps installed via `yarn add`
  (`@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
  `zod`; dev: `tw-animate-css`), and `components.json`, `src/lib/utils.js` (`cn()`),
  `src/components/ui/button.jsx`, and the token CSS were written by hand to match the canonical
  shadcn v4 output. If the host becomes reachable later, `npx shadcn@latest add <component>` works
  off the committed `components.json`.
- **CLI flags changed in the current shadcn.** `init` no longer takes a base-color flag; `-b/--base`
  now selects the component library (`radix` | `base`) and theme comes from `-p/--preset`
  (`nova`, `vega`, …). Chose `base = radix` (classic Radix primitives; matches the React 19 peer-dep
  note below). Recorded in `components.json` as `"base": "radix"`, `"style": "new-york"`.
- **Theme = full shadcn token contract, Tekion-seeded.** Beyond the core variables, the standard
  `--chart-1..5` and `--sidebar-*` tokens are included so future `shadcn add` components work without
  re-theming. `--primary` is Tekion teal-600 (`#00a892`, light) / teal-500 (`#00bfa5`, dark);
  neutrals come from the slate scale; accents/rings are teal-tinted. Exact contrast tuning is part of
  the later §11 re-skin.
- **`lucide-react` resolved to `1.18.0`** from the registry (installed for future icon use; the
  `Button` itself imports no icons, so nothing depends on the version).
- No new TypeScript was added; the `typescript` devDep remains the tooling-only one from Feature 1.

## References

- @context/project-overview.md (§8 target architecture, §10 stack, §11 UI/UX, §16 decisions)
- @context/coding-standards.md (Next.js, Tailwind v4 CSS-config rule, Zod-at-boundaries, error pattern)
- @context/features/scaffold-nextjs.md (Feature 1 — the scaffold this builds on; port note, deviations)
- CLAUDE.md (structure + non-standard versions warning)
- [src/styles.css](src/styles.css) (Tekion design tokens to seed the theme from)

## History

- 2026-06-13 — Drafted feature plan (Feature 2 of the migration: Tailwind theme + shadcn/ui + zod).
- 2026-06-13 — Changed default theme to **light** (dark tokens still defined under `.dark`); this
  overrides the "dark mode first" line in coding-standards for the scaffold.
- 2026-06-13 — Implemented and verified (lint + build + dev on :3002). shadcn set up manually
  (`ui.shadcn.com` unreachable); see As-built deviations.
