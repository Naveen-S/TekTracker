---
name: finish-feature
description: Completion ritual for the current feature — run the verification suite, record as-built deviations in the spec, doc-sync project-overview.md, mark Done in current-feature.md with a dated History entry, and name the next in-order migration step. Use before declaring any feature done or committing it.
---

# Finish the current feature (completion ritual)

Nothing is marked Done until every step below has actually run. In order:

1. **Verify** — run /verify. All green is a precondition for everything else. If anything
   fails, fix it first; if stuck after 2–3 attempts, stop and explain (ai-interaction.md).

2. **Feature spec** (`context/features/<slug>.md`):
   - `## Status` → `**Done YYYY-MM-DD.**` followed by a dense verification summary in the house
     voice: what was implemented (files), what was verified (lint / DB-free build / curl statuses /
     DB state), bolding the load-bearing claims.
   - Add or extend `## As-built notes (vs. the spec)` — every deviation: exact versions pinned,
     API call shapes that differed, fallbacks that fired, workarounds (see auth-layer.md's section
     for the expected grain).

3. **Doc-sync** — run /doc-sync. The spec's own "Doc-sync (§17)" section is the checklist; execute
   it literally, including the "don't over-claim" caveats.

4. **current-feature.md**:
   - `## Status` → Done, with the condensed verification summary and a `**Next:**` pointer.
   - Append a History entry: `- YYYY-MM-DD — **Implemented <feature>.** …` — dated, past-tense,
     dense (files, verification results, as-built deviations, `**Done.**`, `**Next:**`). Match the
     voice of the existing entries exactly.

5. **Next step** — read the Production Migration Plan and report the next in-order step (and any
   ratified alternative, e.g. "importer (seed.md, step 9) or Domain APIs (step 4)").

6. **Commit — only with explicit permission** (ai-interaction.md), and only after the build passes:
   - Conventional message: `feat:` / `fix:` / `chore:` …, one feature per commit.
   - **House rule overrides defaults: NO "Generated with Claude" and NO `Co-Authored-By: Claude`
     lines in commit messages.**
   - Doc changes (spec, project-overview, current-feature) ship in the same commit/PR as the code
     (§17).
   - Merge to main and delete the `feature/*` branch only when asked.
