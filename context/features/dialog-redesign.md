# Dialog redesign — "Refined enterprise"

## Overview

Naveen did not like how the app's dialogs looked and asked for them to look professional. A survey of
all ~19 dialogs found the shared primitive (`src/components/ui/dialog.jsx`) sound in behaviour
(focus trap, open-dialog stack, scroll lock, exit animation) but heavy in its chrome, and found that
the dialog **bodies** had drifted because the kit had no small primitives:

- **Chrome:** a `bg-ink/60` + `backdrop-blur-md` scrim, a 17px **extrabold** title, and a grey
  `bg-muted/40` footer band.
- **Notice boxes:** five hand-copied variants with different padding, border and text size.
- **Section labels:** three different styles.
- **Radios:** duplicated radio-card markup sitting on bare browser radios.
- **Colours:** inline `color-mix(… white)` chips and a `#e9eef3` hex preview canvas, neither
  following the theme.
- **Footers:** four dismiss labels (Cancel / Close / Done / OK); the primary button sometimes left of
  Close; export dialogs with no Cancel at all; hand-styled destructive-ghost buttons.

It also found three real bugs:
1. Footer Cancel/Close buttons skipped the exit animation, because `requestClose` was private.
2. Under reduced motion, the exit played a fade-**in** (`veil-in` was forced on both states).
3. Only one dialog was portalled.

Presentation only: no schema change, no route change, §12 untouched. Invariants stay at **57 ƒ
Dynamic** and **14 migrations**.

## Decisions (confirmed with Naveen via AskUserQuestion, 2026-10-01)

1. **Direction: "Refined enterprise"** — Linear/Stripe-style restraint: a quiet scrim, a crisp
   card, a semibold title, a white footer, a consistent rhythm, and the boldness saved for content.
   Rejected: a branded tinted header band (heavier); a right-hand side sheet for heavy dialogs (a
   bigger structural change, and the exports still need a wide modal).
2. **Scope: primitive + shared kit + a sweep of every dialog.** Rejected: primitive and kit with
   only the busiest dialogs migrated; primitive only.

3. **Round 2 (2026-10-01): a StoryBoard-flavoured "moment" hero.** Naveen shared a playful
   rating-dialog reference (a wave band, a mascot medallion, pill buttons) and asked which style fits
   the app. Claude advised against a literal copy: a mascot, yellow waves and pill buttons clash with
   an ink-surface leadership tool. Naveen picked the recommended hybrid:
   - **Moment dialogs** get a hero: the app's own `hero-panel` ink band with a tone glow, a faint
     Jigsaw mark, a soft wave into the card, and a medallion overlapping the seam (tone-coloured
     glossy tile, sparkles, spring pop-in), with centred title and copy. These are the confirms, the
     alert, sprint start, share and the AI digest.
   - **Work dialogs** (forms, exports, analysis, team config, risks list) kept the refined header.
     *(Superseded the same day by as-built note 7: every dialog now uses the hero.)*
   - Buttons keep the app's shape everywhere.
   Rejected: a hero on every dialog; the literal reference style.

## Scope / implementation

### Primitive — `src/components/ui/dialog.jsx`

The existing API is unchanged; these props and exports are added.

| Part | Before | After |
|---|---|---|
| Scrim | `bg-ink/60 backdrop-blur-md backdrop-saturate-125` | `bg-ink/40 backdrop-blur-[2px]` |
| Panel | `rounded-2xl`, `ring-ink/10` | `rounded-xl` (follows `--radius`, so Modern's 0.75rem flows through), `ring-ink/[0.08]`. Mobile keeps the bottom sheet and gains a grab handle. |
| Header | always `border-b` | the divider appears only once the body scrolls under it (`useScrollEdges`) |
| Icon tile | tone only | `icon` prop = a neutral brand-tinted tile; tones `success` / `danger` (`error` is an alias) / `warn` / `info` |
| Title | `text-[17px] font-extrabold` | `font-display text-base font-semibold` |
| Footer | grey band, one right-aligned cluster | white; divider only when content overflows below; a `footerStart` slot for tertiary actions; full-width stacked buttons on mobile, with safe-area padding |
| Motion | tw-animate zoom/slide | `data-state` + `dialog-*` keyframes in `globals.css`: enter 200ms on `--ease-out`, exit 140ms; a slide-up sheet below `sm` |

Also new:
- **`DialogClose` + `useDialog()`** (context), so footer buttons play the exit animation.
- **Always portalled to `document.body`**, behind a `useSyncExternalStore` client guard. The ad-hoc
  portal in `analysis/analyse-button.jsx` was removed.
- **An empty body is skipped**, so a confirm that says everything in its title and description shows
  no blank band.

### Shared kit (new, `src/components/ui/`)

- `callout.jsx` — `Callout tone="info|success|warn|danger|neutral" title? icon?`. `DialogError` is
  now a thin wrapper over it, and stays exported for `settings/claude-connector-card.jsx`.
- `field.jsx` — `Field` (label → control → hint/error; a `<legend>` in a fieldset when it has no
  `htmlFor`; an `eyebrow` style) and `SectionLabel`.
- `radio-card.jsx` — `RadioCardGroup` / `RadioCard`. The native radio is kept `sr-only`.
- `segmented.jsx` — `Segmented`: `role="radiogroup"`, roving tabindex, arrow keys.
- ~~`toggle-chip.jsx`~~ — built, then **removed at Naveen's request** (see as-built note 4). The
  export dialogs keep their original include pills.
- `confirm-dialog.jsx` — `ConfirmDialog`. Confirming starts the exit and runs `onConfirm`; callers
  clear their state in `onClose`, and a second click is ignored.
- `button.jsx` gets a `ghostDestructive` variant; `input.jsx` and `select.jsx` get `size="sm"`.
- `globals.css` gets a `--preview-canvas` token (plus a Modern override), the `dialog-*`
  keyframes, and the reduced-motion fix.
- `components/export/export-dialog-kit.jsx` — `PreviewPager` and `PreviewCanvas`, shared by the
  three export dialogs.

### Sweep

Footer rule: **tertiary actions on the left (`footerStart`) · dismiss · primary on the right.** Use
`Cancel` while an action is pending, `Close` for read-only views or once the work is done, and `Done`
only after a success result. Neutral alerts get the `info` tone (was a green check).

| Dialog | Change |
|---|---|
| `filter-dialog` | radio cards, segmented source toggle, `Field`, warn callout |
| `sprint-config-dialog` | `Field`, neutral callout |
| `sprint-start-dialog` | JQL preview as a divided list, callouts |
| `risk-comment-dialog` | "Remove comment" moves to `footerStart` as `ghostDestructive` |
| `share-dialog` | radio cards; "Create link" moves to the footer as the primary; success callout; divided list |
| `ai-digest-dialog` | Copy on the left, then Close, then Generate/Regenerate on the right |
| `issue-analysis-dialog` | Copy and the model `Select` on the left; Close then Analyse on the right; `SectionLabel`; connector callout |
| `export-dialog`, `rollup-export`, `bug-export-dialog` | pager in `footerStart`; a Cancel added; `Segmented`; `--preview-canvas`. The include pills are unchanged. |
| `rollup-risk-section`, `alert-dialog` | `DialogClose`; Copy diagnostics on the left |
| `team-config-dialog` | consistent grouped sections; an accessible Advanced disclosure |
| Six confirms (team, program, component, sub-component, capacity overwrite, sync stages) | → `ConfirmDialog` |

### Round 2 — hero header

- `Dialog` gets a `hero` prop, which renders `HeroHeader` in place of the standard header, and the
  panel carries `data-tone`.
- `globals.css` gets the `--hero-base`/`--hero-deep` tone palette (brand = `--primary`, so Tekion
  reads teal and Modern reads blue), plus the glow, wave, medallion, sparkle and pop/twinkle
  keyframes. Reduced motion disables the medallion and sparkle animation.
- Hero footers centre their buttons.
- Short body copy is centred: the `ConfirmDialog` body, a one-line alert, and the AI digest intro.
  Multi-line sync summaries stay left-aligned.
- `border-0!` on the band removes the `hero-panel` utility's 1px border, which drew a dark hairline
  under the wave's clip edge.

## Acceptance criteria

- Every dialog uses the new chrome; no footer dismiss unmounts without the exit animation.
- Reduced motion cross-fades in **and** out.
- Tab stays trapped, and Escape closes only the top dialog of a nested pair.
- The exports still produce PDF/PNG after portalling.
- Lint 0; the env-free build is unchanged at 57 ƒ Dynamic with 0 warnings.

## As-built notes

1. **The offscreen print sheets still capture.** A persistent panel transform would re-anchor their
   `fixed` positioning, so only the exit animation uses `forwards`; the enter animation ends at
   `transform: none`. Verified by real downloads: sprint PDF, sprint PNG, roll-up PDF, and the bug
   executive PDF (22 MB, about 2 minutes in headless Chrome).
2. **`useScrollEdges` activates on `open && isClient`.** The panel does not exist during the
   hydration render, so an effect keyed only on refs would never have attached its observer.
3. **The Sync-stages confirm no longer clears its own state** inside `confirmSyncTrackStages`.
   `ConfirmDialog`'s `onClose` clears it after the exit animation.

4. **The include pills are kept as they were** (Naveen, 2026-10-01: "keep pills like this only,
   don't change"). The sprint export's filter pills are accent-bordered, accent-tinted, and carry the
   track's colour dot. The roll-up's team pills use `accent` tokens. So `ToggleChip` was reverted
   at both call sites and its file deleted, since nothing else used it.

5. **The roll-up "All risks" list gets the hero too**, in the `warn` tone (Naveen, 2026-10-01:
   "this dialog is not updated"). It had been grouped with the work dialogs, but it reads as a
   leadership moment, so the amber shield medallion fits it.

6. **Configure sprint gets the hero too** (Naveen, "one more"). Its "Optional" hint went back into
   the label ("Release date (optional)"), because a hint under one cell of the two-column row left
   Release date and State misaligned.

7. **Every dialog now uses the hero** (Naveen: "yes go ahead"). He had flagged the plain headers one
   dialog at a time, so the rest moved in one pass. The Jira source, risk comment, team config and
   Claude analysis dialogs take the full hero. The three exports take the new `hero="compact"`: a
   56px band, a 60px medallion on the left, and the title beside it. That keeps the report preview's
   height, and the footer keeps its pager-left row. The centred footer applies only to the full hero
   (`hero === true`). Nothing in `src/components` renders a `Dialog` without `hero` now.
   Verified: lint 0; env-free build at 57 ƒ Dynamic, 0 warnings; the seven dialogs screenshotted in
   Tekion at 1440px and Modern at 390px, 0 page errors.

8. **The dialog is lifted off the page** (Naveen: "the dialog and background seems odd"). The ink
   hero band merged into the ink hero panels and sidebar behind a light scrim. Three changes:
   - the scrim went from `bg-ink/40 backdrop-blur-[2px]` to `bg-ink/55 backdrop-blur-[6px]
     backdrop-saturate-[.8]`
   - the panel gets a 1px light rim (`ring-white/12`) and a new `--shadow-dialog` `@theme` token: a
     deep layered drop plus a faint halo in the theme primary
   - the band gets a 1px inset top highlight
   Verified on a `next start` production build: the Claude analysis and Share dialogs in Tekion and
   Modern, 0 page errors.

## Verification (2026-10-01)

- `yarn lint` exits 0.
- The cold env-free build (scratch copy, zero `.env*`) exits 0 with **57 ƒ Dynamic** and 0 warnings.
- Headless Chrome (`next start` + dev Neon, minted admin cookie, read-only) opened all **14 dialog
  surfaces** in Tekion and Modern at 1440px and at 390px, with 0 page errors. The screenshots were
  reviewed.
- **15/15 behaviour checks** pass:
  - enter/exit keyframes, normal and reduced motion
  - the footer Close plays the exit, then unmounts
  - focus is restored to the trigger
  - Tab trap
  - `Segmented` arrow keys
  - the scroll lock is released
  - nested Escape closes only the top dialog
  - the dialog is portalled to `body`
- Naveen's acceptance: an authed real-browser pass.

## Doc-sync

- `project-overview.md` §11 build-log row.
- `current-feature.md` status and carry-forward.
- A `legacy-history.md` Done entry.
