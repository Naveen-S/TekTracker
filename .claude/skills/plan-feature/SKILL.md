---
name: plan-feature
description: Draft a new feature spec in context/features/ using the house format (Overview, Decisions, Scope, Acceptance criteria, Doc-sync, References). Use when planning the next migration step, a new feature, or a fix — before any implementation.
---

# Plan a feature (planning session — no code)

Planning sessions produce a spec file, never code. Output: `context/features/<kebab-slug>.md`.

## Before drafting

1. Read `context/project-overview.md` end-to-end — it is canonical. Note every §section the
   feature touches.
2. Read the **Production Migration Plan** (bottom of project-overview.md). State the feature's step
   number and whether it is the next **in-order** step. If pulling a step forward (as seed.md was),
   say so in the Overview and name the dependencies it jumps.
3. Read `context/current-feature.md` History — know what's already Done.
4. Skim the most recent **Done** spec in `context/features/` (auth-layer.md is the best exemplar) —
   mirror its structure and density.

## Spec structure (match auth-layer.md)

```
# <Feature name> (migration step N, if applicable)
## Overview          — what/why, §-links to project-overview, relation to the master plan,
                       key architectural shift called out as a > blockquote if there is one
## Status            — starts "Planned YYYY-MM-DD." (becomes the dense Done summary later)
## Decisions         — numbered list
## Requirements
### Scope            — lettered (a), (b), … each pinned to concrete file paths
### Mechanism / gotchas
### Acceptance criteria
### Out of scope     — explicitly park adjacent work with the step it belongs to
## Doc-sync (§17 — do in the same PR)
## References        — @-links to context docs, source files with line anchors
```

## Rules

- **Decisions**: mark each as ratified (with whom + date, e.g. "resolved with Naveen 2026-06-29")
  or **PROPOSED** with a sensible default and *alternatives considered*. Proposed decisions must not
  block implementation — flag them, pick the default, move on.
- **Acceptance criteria** always include: `yarn lint` + `yarn build` green at the repo root, build stays
  **DB/env-free**, and a concrete end-to-end verification method (curl, script) since there is no
  test suite.
- **Doc-sync section** names the exact project-overview.md sections to touch on landing, and states
  what must NOT be over-claimed (e.g. §7 stays the legacy snapshot).
- Flag any Next 16 / Tailwind v4 / Prisma 7 surface likely to differ from training data and instruct
  the implementer to read the installed docs first (`node_modules/next/dist/docs/`, `AGENTS.md`).
- Don't add features beyond the project spec (context/ai-interaction.md).
- Close the session by appending a History line to `context/current-feature.md`:
  `- YYYY-MM-DD — Planning session (no code): drafted @context/features/<slug>.md …`
