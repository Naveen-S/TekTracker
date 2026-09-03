# Editable sprint filters (tracks)

## Overview

A board track (`Filter`) could be **added**, **removed** and **reordered** — never corrected. A typo
in the name, a Jira filter that got repointed, a JQL needing one more clause, or a track created
under the wrong workflow all forced delete-and-recreate, which loses the track's place in the order
and its accent colour (and, for the wrong-workflow case, is the only way out at all).

The API half already existed and had **no caller**: `PATCH /api/teams/[teamId]/sprints/[sprintId]/filters/[filterId]`
shipped with the step-4 domain APIs (`domain-apis.md`) — manager-gated, ownership-checked,
partial-update aware, with `filterPatchSchema` already validating the source pair. So this feature is
almost entirely **the missing UI**, plus the one guard that route needed once something could reach it.

A pencil on each Connected-JQL card opens the same dialog that creates a track, prefilled, and
saving re-syncs only when the edit changes what the track actually pulls.

## Decisions (confirmed with Naveen via AskUserQuestion, 2026-08-28)

1. **The affordance lives on the sidebar filter card**, beside the existing copy/remove icons —
   the surface that already owns add / remove / reorder and is already gated on `can.manage`.
   (Rejected: the matrix track header, which already carries "Sync stages"; and both at once.)
2. **Name, source (Filter ID ↔ JQL), workflow type and accent colour are all editable** — exactly
   the set `filterPatchSchema` already accepts. Accent colour becomes a visible swatch row instead
   of a colour the user can never see or change after creation.
3. **Re-sync only when the source or the workflow type changed.** A rename or a recolour is a lone
   PATCH and lands instantly; repointing the source (stale cache) or changing the workflow (stage
   arrays are the wrong length until `reshapeStageCompletion` runs) triggers the same full sync that
   "Add filter" already runs. (Rejected: always sync — makes a rename pay for a full Jira round-trip;
   never sync — leaves the board showing issues the track no longer selects.)

## Scope / implementation

- **`src/components/dashboard/filter-dialog.jsx`** — the former `add-filter-dialog.jsx`, renamed
  (`git mv`) and generalized to `FilterDialog`. `filter` prop null ⇒ create (unchanged behaviour);
  otherwise every control seeds from that row, the copy switches to *Edit Jira Source* / *Save
  changes*, and two things are added for both modes: an **accent swatch row** over `ACCENT_PALETTE`,
  and — edit-only, when the chosen workflow has FEWER stages than the current one — an inline
  `warn`-toned line naming both stage counts, because sync re-shapes every progress row to the new
  length and shrinking drops the checks past the last stage.
- **`src/lib/filters/edit.mjs`** (new, pure) — `buildFilterPayload(form)` shapes the body for BOTH
  the create and patch routes so they cannot drift, and `buildFilterPatch(before, form)` adds the
  `needsResync` / `changed` verdicts.
- **`src/components/dashboard/filter-panel.jsx`** — optional `onEditFilter` prop → a `Pencil`
  button between Copy and Remove, `stopPropagation()`'d off the card's scroll-into-view click.
- **`src/components/dashboard/dashboard.jsx`** — `editingFilter` state, `handleEditFilter` on the
  house two-transition pattern, `onEditFilter={can.manage ? setEditingFilter : null}`, and a second
  `FilterDialog` instance keyed by filter id.
- **`.../filters/[filterId]/route.js`** — PATCH now rejects the `NEEDS_ATTENTION` track in both
  directions (see below).

### The asymmetric source columns (the subtle part)

`buildFilterPayload` does **not** treat the two source columns symmetrically, and the difference is
load-bearing:

- a **JQL** track sends `jiraFilterId: null` — `buildJiraSearchUrl` prefers the id over the jql
  (`src/lib/jira/url.js`), so a leftover id would point the card's Jira link at the abandoned filter;
- a **JIRA_FILTER** track does **not send `jql` at all** — on that source the column holds the JQL
  the sync engine last resolved *from* the Jira filter (`engine.js` → `filterUpdate.jql`). It is
  derived display data, not user input (the dialog doesn't even show a JQL field in that mode), and
  nulling it would blank the card's query line until the next sync.

The first draft nulled both, and the fixtures caught it: a plain rename of a filter-ID track came
back `changed`, because the payload was silently clearing a column the user never touched.

### The `NEEDS_ATTENTION` guard

PATCH rejects (400) both editing a track that **is** `NEEDS_ATTENTION` and setting `workflowType`
**to** it. The generated hygiene track's `name`/`jql`/`sourceType` are rewritten from
`Team.memberEmails` on every sync (`ensureNeedsAttentionFilter`), so an edit to it silently reverts;
and re-typing a real track into it would hide the track from the board (`dashboard-data.js`
partitions NA out) and hand it to the generator to clobber. Neither is reachable from the UI — both
are reachable from the route now that it has a caller. Matched on the **string literal**, never the
generated enum member, per the hazard note in `ensure-filter.js`.

The guard sits **after** the RBAC check and **before** `parseJsonBody`, so it is not a permission
question: a **global admin gets the same 400** (verified 2026-09-02). That is deliberate — the track
is generated data, so there is no role for which editing it produces a lasting result.

### Deliberately not changed

- **`sortOrder` is not re-derived when the workflow type changes.** `insertFilterAtPriority` is a
  create-time concern; order is user-owned once dragged.
- **§12 metrics, the schema, and the route table are untouched** — no new route, no migration.
- The stage re-shape itself still happens where it always did, in `syncTeamSprint` step 4
  (`reshapeStageCompletion`). The dialog warns; sync does the work.

## Status

**Done 2026-09-02 — verified twice, uncommitted** (branch `feature/editable-filters`, off `main`
@ `e6fd115`). Pending Naveen's commit (gitleaks hook) and his real-browser visual acceptance.

**Re-verified 2026-09-02** on the same working tree, from scratch (the first run's scratch harnesses
were gone, so every check below was rewritten rather than replayed): `yarn lint` clean ·
**pure fixtures 25/25** · **API smoke 29/29** · **headless browser 10/10** · cold `rm -rf .next`
DB/env-free build → exit 0, **49 ƒ Dynamic (unchanged)** · `prisma validate` valid +
`prisma migrate status` **12 migrations, "Database schema is up to date!" (unchanged)** · Neon left
at **42 filters, 0 fixture rows, 0 renamed tracks**. The load-bearing claim reproduced independently:
a rename puts **exactly one `PATCH …/filters/[filterId]` and no `POST …/sync`** on the wire. Two
guards this run added over the first: **global admin is not a carve-out** on the NA guard (admin
PATCH of the NA track → 400), and `sortOrder` is asserted **unchanged after a workflow change**, not
just after a rename.

**Verified (first pass, 2026-08-28):** `yarn lint` clean · **pure fixtures 23/23** (`buildFilterPayload`/`buildFilterPatch`
verdicts, whitespace + null normalisation, and every produced body re-parsed through the real
`filterCreateSchema`/`filterPatchSchema`) · **API smoke 23/23** against dev + Neon with minted
iron-session cookies (rename preserves the resolved jql, sortOrder, accent and source; source switch
clears the id; NA guards both directions → 400; workflow change → 200; MEMBER **and** VIEWER → 403;
another team's filter id → 404; anonymous → 401; empty patch and JQL-without-jql → 400; fixtures torn
down to 0 rows) · **headless-browser 28/28** (viewer sees no pencil; lead's dialog prefills name /
filter id / workflow / source / accent; shrink warning appears with both stage counts and clears when
reverted; save renames the sidebar card *and* the matrix track header, repaints the accent dot to
`rgb(22,163,74)`, and persists to Neon; reopening reflects the saved row; Cancel discards) ·
**exactly one `PATCH` and no `POST …/sync`** on the network for a rename — the direct evidence for
decision 3 · cold `rm -rf .next` DB/env-free build with `.env` **and** `.env.production` moved aside
→ exit 0, **49 ƒ Dynamic (unchanged)** · `prisma migrate status` **12 migrations (unchanged)**.

## As-built notes (vs. the plan)

- **The plan's payload rule was wrong and the fixtures proved it.** It said the body should always
  carry both source columns with the unused one nulled. That would have wiped the sync-resolved
  `jql` off every JIRA_FILTER track on a plain rename — blanking the query line on the card until
  the next sync. See "asymmetric source columns" above.
- **`tsx` cannot import `src/lib/schemas/filter.js` with a plain named import.** The alias needs
  `--tsconfig jsconfig.json`, and even then the CJS interop drops the named exports — the working
  form is `const mod = await import(...); const { … } = mod.default ?? mod;`. Worth remembering: it
  is what let the fixtures validate against the *real* zod schemas instead of a hand-copied shape.
- **The success toast can be swallowed on a slow dev refresh.** `showToast` is called inside the
  second `startMutation`, so its state update is deferred until `router.refresh()` commits, while
  its own 3s dismiss timer starts at call time — with dev refreshes measured at 3–4s here, the
  toast never rendered (the in-flight "Updating… 4s" pill did). This is the shared two-transition
  pattern used by `handleAddFilter` / `handleSaveRiskComment`, not something this feature
  introduced, so it was **recorded, not "fixed"** — and the browser check asserts the network
  (one PATCH, no `/sync`) instead of the toast text.
- **The second verification pass (2026-09-02) rewrote the harnesses rather than replaying them**,
  and that is the useful part: the scratch scripts from the first pass were gone, so the fixtures,
  the API smoke and the browser drive were all re-derived from the source and still landed on the
  same verdicts. Two checks the rewrite added — admin is not a carve-out on the NA guard, and
  `sortOrder` survives a *workflow* change, not just a rename — are now in the record above. The one
  harness surprise: the dialog's name input is `#filter-name`, and the filter-card name renders
  `text-transform: uppercase`, so a rendered-board assertion must case-fold (the documented
  `innerText` gotcha, hit again).
- **The dev server on :3002 was found 500ing on the dependency-free `/p/health`** (the documented
  stale-`.next` hazard) and was killed + restarted before the smoke run.

## References

- `domain-apis.md` (the PATCH route + `filterPatchSchema` this finally gives a caller) ·
  `ui-port.md` decision 6 (add-then-sync, the pattern the edit flow mirrors conditionally) ·
  `needs-attention-roster.md` (why the NA track must not be editable) ·
  `sync-hybrid-seeding.md` (owning-workflow re-evaluation + `reshapeStageCompletion`) ·
  `one-click-sprint-start.md` (`accentColorForIndex`, extracted from this dialog's ancestor)
