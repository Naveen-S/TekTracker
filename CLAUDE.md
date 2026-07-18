# TekTracker (Sprint Tracker)

One fast, comprehensive view of an entire sprint — from roadmap to backlog — in one place,
without hunting through multiple Jira filters. Sprint Tracker sits *on top of* Jira and adds the
**software-development lifecycle (SDLC) granularity** that raw Jira status cannot express, plus
roll-ups that leadership can actually read.

## Context Files

Read the following to get the full context of the project:
- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Non-standard versions

This project uses **Next.js 16**, **Tailwind CSS v4**, and **Prisma 7** — all have breaking
changes from versions in your training data. Before writing any code that touches routing,
rendering, styling, or data-layer APIs, read the relevant guide in `node_modules/next/dist/docs/`
(see @AGENTS.md). Heed deprecation notices. Known examples: async `cookies()`/`params`, no
`tailwind.config.*` (CSS `@theme`), no `url` in the Prisma datasource block.

## Commands

```bash
nvm use          # Node 22 (.nvmrc; engines >=22.12)
yarn dev         # dev server on :3002
yarn build       # production build — must pass with .env absent (DB/env-free invariant)
yarn lint        # ESLint (eslint.config.mjs, Next.js ruleset)
yarn db:migrate  # Prisma migrate dev against Neon (never `db push`)
yarn db:seed     # bootstrap seed (admin + StatusStageMapping), idempotent
```

There is no test suite yet (deliberate) — run /verify for the house verification suite.

## Stack

- **Next.js 16** (App Router) · **React 19** · **JavaScript** (zod validation at every boundary)
- **Tailwind CSS v4** via `@tailwindcss/postcss` — configured in `postcss.config.mjs`, themed via
  `@theme` in `src/app/globals.css`; no `tailwind.config.*` file
- **Prisma 7** → Postgres (**Neon**); generated client in `src/generated/prisma` (gitignored,
  recreated by `postinstall`); CLI connection in `prisma.config.mjs`, runtime via
  `@prisma/adapter-pg` in `src/lib/db.js`
- **iron-session** cookie auth; Jira API tokens AES-256-GCM-encrypted at rest

## Structure

- `src/app/` — App Router pages (`/`, `/login`, `/admin`, `/rollup`, `/share/[token]`) and API
  route handlers under `src/app/api/`
- `src/components/` — `auth/`, `dashboard/`, `rollup/`, `admin/`, `ui/`
- `src/lib/` — domain logic: pure `metrics.mjs`, `dashboard-data.js`, `workflows.mjs`, `rbac.js`,
  `jira/` (all Jira specifics isolated), `sync/`, `cron/`, `schemas/` (zod)
- `prisma/` — schema (byte-consistent with project-overview §9), migrations, `seed.mjs`
- `legacy/` — the **retired** Vite/Express prototype, backed up at the 2026-07-18 cutover for
  reference only (Node 20; see `legacy/README.md`). Historical docs referring to `web/` mean
  today's repo root.
