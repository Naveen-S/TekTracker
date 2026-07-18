---
name: start-feature
description: Pick a drafted feature spec as the current feature — update context/current-feature.md, append the dated History line, create the feature branch. Use when beginning implementation of a planned feature.
---

# Start a feature

1. Confirm the spec exists in `context/features/` and its Status is not already Done. If no spec
   exists, run /plan-feature first — features are never implemented spec-less.
2. Rewrite `context/current-feature.md` (keep the History section intact, everything above it is
   replaced):
   - Header: one-line summary + `@context/features/<slug>.md` full-spec pointer, naming the
     migration-plan step and why it's next (or why it's pulled forward).
   - `## Status` — "In progress since YYYY-MM-DD."
   - `## Goals` — the spec's Scope items (a), (b), … condensed to one bullet each, with file paths.
   - `## Notes` — the spec's sharpest gotchas (installed-docs warnings, env distinctions, contract
     shapes).
   - Append to `## History`:
     `- YYYY-MM-DD — Picked @context/features/<slug>.md as the current feature (<one-line what>).`
3. Branch per house rule (context/ai-interaction.md): `git checkout -b feature/<slug>`
   (or `fix/<slug>`). Never commit without permission.
4. Before writing code:
   - Read the spec's References list.
   - For ANY Next 16 / Tailwind v4 / Prisma 7 API you'll touch, read the installed docs first
     (`node_modules/next/dist/docs/`, `AGENTS.md`) — these versions differ from training data;
     the async `cookies()` shape was a real example.
5. Implement to the spec, nothing more (ai-interaction.md: no unrequested features, minimal
   changes, preserve existing patterns). If a **PROPOSED** decision proves wrong mid-build, stop
   and flag it to Naveen instead of silently diverging. If stuck after 2–3 attempts, stop and
   explain — no random fixes.
6. When done, run /finish-feature.
