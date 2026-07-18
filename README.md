# TekTracker (Sprint Tracker)

One fast, comprehensive view of an entire sprint — from roadmap to backlog — in one place,
without hunting through multiple Jira filters. Sprint Tracker sits on top of Jira and adds the
SDLC granularity that raw Jira status cannot express, plus roll-ups that leadership can read.

**Internal engineering tool @ Tekion Corp.**

## Stack

Next.js 16 (App Router) · React 19 · JavaScript · Tailwind CSS v4 · Prisma 7 → Postgres (Neon) ·
iron-session auth with AES-256-GCM-encrypted Jira API tokens.

## Getting started

```bash
nvm use                    # Node 22 (.nvmrc)
yarn install               # postinstall generates the Prisma client
cp .env.example .env       # then fill in real values (Neon URL, secrets, Jira base URL)
yarn dev                   # http://localhost:3002
```

Database workflows run through the `db:*` scripts (`db:migrate`, `db:seed`, `db:studio`, …) —
Prisma 7 with the connection configured in `prisma.config.mjs`.

## Documentation

- [`context/project-overview.md`](context/project-overview.md) — the **canonical** project spec
  (vision, data model, metrics, decisions, migration history).
- [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) — working conventions for AI-assisted
  development.
- [`legacy/`](legacy/README.md) — the retired single-user Vite prototype, kept as a reference
  backup (runs on Node 20 only).
