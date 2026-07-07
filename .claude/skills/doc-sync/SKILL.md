---
name: doc-sync
description: The §17 doc-sync ritual — reconcile context/project-overview.md ([BUILT]/[PARTIAL]/[PLANNED]/[GAP] tags, dated decisions, migration-plan step status, §9↔schema consistency) and the feature spec with what actually shipped, in the same change. Use whenever behavior, data model, or architecture changed.
---

# Doc-sync (§17)

project-overview.md is the **canonical** reference. When reality and the doc diverge, fix the doc
in the same change — never let it drift. If the current feature spec has its own "Doc-sync (§17)"
section, that is the authoritative checklist; the rules below are the general ritual.

## Checklist

1. **Status tags** — update `[BUILT]` / `[PARTIAL]` / `[PLANNED]` / `[GAP]` honestly, and **don't
   over-claim** (precedent: surfacing `isAdmin` + adding `requireUser()` did NOT flip
   "Admin settings / RBAC" from [GAP] — enforcement hadn't landed). New `web/` work is tagged
   `[BUILT in web/ — YYYY-MM-DD]` since both apps coexist until cutover.
2. **§7 stays the LEGACY snapshot** of the Vite/Express app until promotion — record new-world
   changes in the target sections (§8–§13), not by rewriting §7.
3. **§9 ↔ `web/prisma/schema.prisma` byte-consistency** — schema block, mermaid ER diagram, and
   the rationale bullets all move together with any model change (see /prisma-change).
4. **§5 feature table, §10 stack table, §13 hardening items** — append dated notes to the touched
   rows/items (e.g. "**[BUILT in `web/` 2026-06-29]** …").
5. **Production Migration Plan** — mark the step **[DONE YYYY-MM-DD]** with a one-line as-built
   summary and a pointer to the feature spec.
6. **Decisions carry provenance** — "(decided YYYY-MM-DD with Naveen)". Convert relative dates to
   absolute. New deviations from a spec's PROPOSED decisions get recorded where the decision lives.
7. **Feature spec** — Status updated; "As-built notes (vs. the spec)" lists every deviation.
8. **current-feature.md** — append the dated, dense, past-tense History entry ending with
   `**Next:**`.
9. Bump the `Last reviewed:` date in the project-overview.md header when the doc was materially
   revised.
