# Modern = the artifact look — replace the blue Modern theme app-wide

## Overview

Naveen, 2026-10-21: *"I really like the artifact look and feel — can we use that as the overall
Modern theme, replacing the current modern theme? Switching to Modern would give the entire
StoryBoard, all pages, the same look and feel as the artifact styling."*

The "artifact" is the claude.ai **Programs Team Vulnerability Tracker**, whose look was ported to
`/security` in security-vulnerability-tracker.md (as-built 14–18). Its look is:
- a light lavender→peach page;
- white cards with lavender borders;
- page titles in a purple→pink→orange gradient;
- KPI cards with a blue→purple gradient stripe on top;
- LIVE / tag pills;
- a blue / purple / pink / orange / amber palette.

This feature makes that the **Modern** theme for every page, replacing today's blue Modern
(modern-theme.md).

> **Architectural shift.** Modern stops being a palette swap on top of the shared dark ("ink")
> hero. Under Modern, the page header becomes a **light** surface, so everything drawn *on* the
> hero needs colours that change with the theme: text, eyebrow, buttons, dropdowns and the
> countdown. The switching mechanism itself does not change: the `theme-modern` class on `<html>`,
> the boot script that applies it before first paint, `useLocalPref("theme")`, and the stored value
> `"modern"`.

It touches these canonical docs:
- project-overview **§10** (Styling: two themes) and **§11** (the UI/UX direction and build log);
- **§5**, where `/security`'s look toggle is folded into the theme;
- modern-theme.md decisions 1 and 7, which are superseded.

It is post-v1 and not a master-plan step. It sits on `feature/modern-artifact-theme`, branched from
`3129931` ("Adding Security tracker.") so that PR stays reviewable on its own.

## Status

**Done 2026-10-24 · verified · uncommitted** on `feature/modern-artifact-theme` (cut from
`3129931`). O1 = light, O2 = themed (Naveen). Amendments are recorded below, and deviations are in
as-built notes 1–16.

**Implemented:**
- **Tokens and theme CSS:** `src/app/globals.css`. Covers the Modern tokens, light surfaces,
  status colours, the gradient-bordered header and scoreboard, the logo fills, View Transition
  CSS, the motion tokens and `--brand-glow`.
- **Shared UI:** `ui/{hero-shell,button,select,dialog,toast,spinner,skeleton,app-sidebar,brand,
  segmented,program-chip,release-countdown,theme-toggle}.jsx`, plus three new files:
  `ui/sliding-indicator.jsx`, `ui/copy-state-icon.jsx` and `ui/theme-favicon.jsx`.
- **Favicon:** `lib/theme-favicon.js`, `public/icon-modern.svg`, and `THEME_INIT` in
  `app/layout.jsx`.
- **Page components:** the hero, KPI and chart components across `dashboard/`, `rollup/`, `bugs/`
  and `security/`.
- **`/security` look toggle retired:** `security/look.jsx` was deleted.
- **Phone top bars:** the action clusters on all five top bars wrap.
- **`/admin`:** the release-calendar rows wrap below `sm`.
- **Phase 0 switch:** removed.

**Verification (2026-10-24, /verify):**
- **Lint and schema:** `eslint src` exit 0; `prisma validate` ✓; `migrate status` → **15
  migrations, up to date**.
- **Cold env-free build:** `rm -rf .next`, with `.env` **and** `.env.production` moved aside and
  restored. Exit 0, **65 ƒ Dynamic**, and **0 warnings/errors** (grepped the log).
- **Smoke:** `/p/health` 200; unauthenticated `/api/teams` → 401 with the error envelope; an
  invalid share shows the generic page; `/icon.svg` and `/icon-modern.svg` → 200; the served CSS
  carries `shadow-brand → var(--brand-glow)`.
- **Headless matrix: 10 pages × 2 themes × 390 / 1440 / 2240 px = 60 renders.** **0 console
  errors and 0 horizontal overflow** after the `/admin` fix (it was 31px at 390px in both themes).
- **Tekion vs `tmp/mt/before/` at 1440:**
  - **pixel-identical:** board, leaderboard, admin, ask and login;
  - **roll-up and share:** the live countdown and the sliding pill;
  - **bugs:** live counts;
  - **settings:** the copy icon and last-seen time;
  - **security:** the look toggle removed.

  All are intended or live data (as-built 13).
- **Contrast at 1440:**
  - **Modern:** 35 failures, down from 107 after the review pass. The rest is decorative
    punctuation, pre-existing `/admin` counts and the `/security` artifact palette.
  - **Tekion:** no new failures except live-data cells on `/bugs`.
- **Switching:** Tekion → Modern → Tekion on `/`, `/rollup`, `/bugs` and `/security`.
  - Live: every probed computed style returns **exactly** to Tekion, with 0 page errors.
  - Reload in Modern with **all JS chunks blocked** (no hydration): the header, page, sidebar and
    favicon are already Modern, so there is **no flash**.
- **Exports (O2 themed):** the sprint (9 sheets), roll-up (5) and bug-report (44) print pages
  measure **identically in both themes**. The first sheet of each reads 7–13px over in both
  themes alike, unexplained but not theme-related.

**Pending:**
- Naveen's authed real-browser pass. Headless renders with a minted session are not that.
- Naveen's commit (gitleaks hook).

**2026-10-21 progress:** Phases 1–4 built (O1/O2-independent), then the Phase 0 switch, so the
variants could be judged on the *new* Modern rather than the blue one. Built first because nothing
in them depends on O1/O2 — **awaiting Naveen's O1/O2 call** before Phase 5. Tekion before/after at
1440 px: no unintended change (diffs are only live data — countdown clock, ageing buckets — and the
removed `/security` look toggle). Values chosen during the build (validator output) are recorded
inline in `globals.css`; they move into as-built notes at /finish-feature.

**2026-10-21 decisions + amendments (Naveen):**
- **O1 = (b) light.** Ink surfaces (scoreboard + roll-up "By team" chart, dialog header band,
  toast, loading veil) turn light under Modern. The countdown follows the light header. The light
  scoreboard palette was re-validated (`#3a86ff,#c48600,#ff006e,#a8459a` vs white: ALL PASS).
- **O2 = (b) themed.** Exports follow the theme; the print sheets already hard-code their colours,
  so only the radius differs. The Phase 0 switch and its hook classes are deleted.
- **Gradient border + tinted fill.** The header card and the scoreboard get a purple→pink→orange
  gradient border and a lavender→peach fill (`--hero-fill-1/2`) instead of white.
- **Decision 6 amended (2026-10-22): the sidebar is LIGHT under Modern.** Once the other ink
  surfaces went light, the dark sidebar was the one heavy block left. It is now white with a
  lavender divider, muted nav text (5.3:1) and the gradient active item, via an `.app-sidebar`
  scope that also covers the loading skeleton's rail. The logo gains `tone="ink"` (sidebar,
  loading veil, dialog band): under Modern its white piece takes the ink colour, which also fixes
  the piece vanishing on the light veil and dialog band after O1. Tekion is unchanged.
- **The logo follows the theme (2026-10-22, option B of eight mocked).** Under Modern the jigsaw
  pieces are purple `#8338ec`, ink, light purple `#b794f6` and deep purple `#5b21b6`. That is the
  teal logo's structure (one hue family plus the odd piece out), re-hued. `BrandMark` pieces carry
  `brand-piece-N` / `brand-ink-piece` hooks, and globals.css repaints them under `.theme-modern`.
  This amends brand-logo-tagline.md's "the mark's colours are FIXED". Tekion, the favicon, the app
  icon and the Tekion corporate wordmark on the login card stay teal (static files, or not
  StoryBoard's mark).
  **[Amended the same day, Naveen: "favicon should change based on the theme"]** The tab icon now
  follows the theme too:
  - **The Modern icon** is `public/icon-modern.svg`: `app/icon.svg` with the option-B colours and
    the same light/dark flip of the ink piece.
  - **On load,** the `THEME_INIT` boot script re-points the SVG icon link before first paint.
  - **After that,** `ui/theme-favicon.jsx` (mounted in the root layout) keeps it in sync. It
    watches the `<html>` class (the toggle) and icon links added to `<head>`. On a Modern load,
    React's hydration adds a fresh `icon.svg` link, because it matches hoisted links by `href`.
  - **The path constant** lives in `lib/theme-favicon.js`. The server-side boot string can't read a
    value exported from a `"use client"` module.
  - **Still teal:** Safari, which uses `favicon.ico` and ignores SVG favicons, and the installed app
    icon.

  Verified in headless Chromium: load, toggle and client navigation in both themes.
- **Smooth theme switch (2026-10-22, Naveen: "theme transition is not smooth").** The
  modern-theme.md `.theme-transition` per-element colour fade is replaced by a View Transition
  cross-fade of the whole page (380ms, `theme-toggle.jsx` + `::view-transition-*(root)`). The old
  fade could not move `background-image`, so under Modern every gradient snapped mid-fade (the
  page, the header border and fill, the title, the buttons, the nav pill), and it put a transition
  on every element. Browsers without the API, and reduced motion, switch instantly.
- **Micro-animations folded into this branch** (both themes), after a restraint pass
  (`find-animation-opportunities`). Built:
  - the `/bugs` drill-downs reveal with a 180ms `disclose`;
  - a sliding selected pill on `Segmented`, the roll-up view toggle and the `/bugs` scope toggle
    (`ui/sliding-indicator.jsx`);
  - a copy → check cross-fade (`ui/copy-state-icon.jsx`);
  - a staggered empty-state entrance;
  - useanimations.com-inspired CSS hover replays on the download, refresh and sparkles icons,
    keyed on lucide's `lucide-<name>` class.

  All of it is reduced-motion aware. Rejected: page-load card stagger, delivery-matrix stage
  cells, the ⌘K panel, native selects, chart line drawing, and the `/security` register (not picked).
- **Design-review contrast pass (2026-10-22, Naveen: "fix the obvious issues").** Modern-specific
  review items 1–8 fixed:
  - **Status colours are global under Modern**, no longer re-scoped on the health chips only.
    Teal `#0a7268/#08665c`, amber `#946200/#7a5200`, pink `#c8005a/#a30049`, blue
    `#1d5fcc/#1a52b0` on the artifact tints. Both steps are ≥ 4.5:1 on the tint, because Badge
    prints `-strong` and the matrix health pill prints the base. So done cells, warn badges and
    chips now agree. Amber fills read darker (mustard) as a result.
  - **Muted text darkened** to `#655e7d` (it was 4.41:1 on the accent row).
  - **On-hero shades darkened:** faint, accent `#6d28d9`, danger, success, done-text and
    active-text, measured against the countdown pill's own tint.
  - **Countdown labels and unit letters are solid under Modern** (`modern:opacity-100`).
  - **New `--color-on-ink-accent-text` token**, falling back to `--on-ink-accent`, so Tekion is
    unchanged. The light scoreboard sets it to `#1f62d6`, so the 11px Committed figure is
    4.9:1 while the bar keeps the validated blue.
  - **Roll-up toggle labels muted** with `modern:text-muted-foreground`.
  - **`/bugs` "(n)" counts on the heat cells** use `modern:text-danger-strong` (≥ 5:1).
  - **`/bugs` sprint-ownership labels are solid.**
  - **`--color-sec-gold-text`** is now `#8a6400`.

  Headless sweep (1440, 10 pages): Modern failures went from 107 to 35. What's left is decorative
  punctuation, pre-existing `/admin` counts, and the `/security` artifact palette (follow-up 12).
  Tekion's failure set is identical before and after (150).
- **Lighter page and card tints (2026-10-22, Naveen: "gradient background … too dark").** About
  half the original artifact tint:
  - page `#fbfaff → #fff6f0` becomes `#fdfcff → #fffaf7`;
  - header and scoreboard fills `#f4efff / #fff1e9` become `#f9f6ff / #fff7f2`;
  - the corner washes go from 0.07 / 0.05 to 0.045 / 0.03.

  The gradient border still sets the cards apart from the page. All text was measured on the
  darker fill, so contrast only went up.
- **Polish pass (2026-10-22, `/impeccable polish`).**
  - **The brand glow was teal under Modern.** Tailwind v4 inlines a shadow token's literal value
    into the utility (`.shadow-brand { --tw-shadow: 0 6px 18px …#00bfa54d }`). So Modern's
    `--shadow-brand` override never reached any of the 9 `shadow-brand` users: primary buttons, the
    Ask mic, the nav pill and others. The colour now goes through `--brand-glow`, which `:root`
    sets to teal and `.theme-modern` to purple. Tekion's value is unchanged.
  - **The phone top bars no longer scroll sideways.** The action cluster on all five top bars (board,
    roll-up, bugs, leaderboard, settings) gained `flex-wrap justify-end`, so it wraps onto a second
    row under 390px instead of pushing the page 22–225px wide. It still fits on one row on desktop,
    so both themes are unchanged there. Pre-existing in both themes (review item 9).
  - Detector: only the known ratified gradient title and the pre-existing bounce easings.

## Decisions

**Ratified with Naveen, 2026-10-21 (four question rounds):**

1. **Replace, don't add.** The blue Modern is removed, and today's Modern users move to the new
   look automatically: the stored value stays `"modern"`, and there are two themes (Tekion, Modern).
2. **The name stays "Modern".** No new label, key or value.
3. **Light artifact headers on every page.** Under Modern, the hero becomes a white card with the
   purple→pink→orange gradient title. The Tekion hero is unchanged.
4. **Theme-level depth.** The styling comes from tokens and shared components:
   - palette, accent, page gradient, lavender borders and tints, rounder cards;
   - gradient KPI stripes and pills;
   - the artifact chart palette.

   Page markup is not reworked. **No emoji titles anywhere, `/security` included:** it uses icon
   tiles like every other page.
5. **The theme replaces `/security`'s StoryBoard | Artifact toggle.** Tekion shows the StoryBoard
   look and Modern the artifact look; `look.jsx` and its localStorage key are retired.
6. **Accent.** Purple `#8338EC` for links, focus rings and the selection colour. Primary buttons,
   the active nav item and highlight bars use the blue→purple gradient (`#3A86FF → #8338EC`).
7. **Sidebar.** It stays dark, in the artifact's ink `#241E33`, with the gradient active item.
8. **Status / health chips are artifact-coloured,** superseding modern-theme.md decision 7
   (monochrome):

   | Status | Pill |
   |---|---|
   | Behind, Blocked | pink |
   | At Risk | amber |
   | On Track | blue |
   | Ahead, Done | teal |

   Meaning is kept in text as well as colour.
9. **Charts use the artifact palette under Modern:** blue, purple, pink, orange and amber.
   **Validate it with the dataviz validator** (`validate_palette.js`, light mode, against the
   white card surface), for normal and colour-blind vision. Adjust any shade that fails before it
   ships; never eyeball it.
10. **The page background is the lavender→peach gradient** (`#FBFAFF → #FFF6F0`).
11. **Login and `/share/[token]` follow the viewer's theme,** as today.
12. **Fonts stay StoryBoard's.** Modern only borrows the artifact's heavier title weight (800) and
    the gradient page title. The wordmark and the Instrument Serif tagline are unchanged.
13. **Tekion stays the default** for new browsers.
14. **Small Tekion tweaks are allowed** when they make a shared component better, such as
    theme-aware hero tokens. Each one is listed in as-built notes, and the Tekion before/after
    screenshots must show no *unintended* change.

**OPEN — decided by Naveen from real pages in Phase 0 (see "Phase 0"):**

- **O1. Ink surfaces under Modern.** These are the delivery scoreboard card on `/`, dialog
  headers, toasts, the loading veil (`PageLoader`/`BrandLoader`) and the release-countdown ring.
  - **(a) Stay dark, re-tinted to artifact ink:** `#241E33` with purple / pink / orange glows. The
    scoreboard's colour-blind-checked on-ink palette stays valid.
  - **(b) Turn light:** white or lavender, like the header. Each surface needs a light variant, and
    the scoreboard palette must be re-validated for light.
- **O2. Exports** (sprint PDF/PNG, roll-up PDF, bug-report PDF). They render from the live DOM and
  read theme tokens (the sprint export dialog has ~10 references).
  - **(a) Fixed:** always the current print design system, whatever the exporter's theme.
  - **(b) Follow the theme:** someone on Modern exports artifact-styled reports.

## Requirements

### Scope

**Phase 0 — the visual decision (temporary code, removed in Phase 5)**

(a) A **dev-only switch**, `?mt=dark|light` and `?mx=fixed|themed`, stored in
`sessionStorage`. It lets the real board, a dialog, a toast, the loader, the countdown, and one
sprint export page each render in both O1 and both O2 variants under Modern.
- Hand Naveen URLs on his running dev server, plus labelled headless screenshots at 1440 px.
- **Stop for his decision** before building anything that depends on O1 or O2.
- The switch never ships. Phase 5 deletes it and grep confirms `mt=` / `mx=` are gone.

**Phase 1 — tokens and frame** (`src/app/globals.css`, `src/components/ui/*`)

(b) Rewrite the `:root.theme-modern` block (globals.css:671) with the artifact values:
- background, foreground, card, muted and border in lavender tints;
- `--primary` purple `#8338ec`, with `--accent` / `--accent-foreground` as lavender / purple;
- `--ring` purple;
- `--chart-cat-*` per decision 9; `--radius` 0.875–1rem;
- `--ink: #241e33` and the `--sidebar-*` values;
- `--on-ink-accent` re-tinted.

Add `--bg-app` as the page gradient (decision 10), applied by the base layer only under Modern.

(c) **Gradient primary.** Under Modern, the `Button` default variant
(`src/components/ui/button.jsx`) and the sidebar active item (`app-sidebar.jsx`) use the
blue→purple gradient through the existing `modern:` variant. `::selection` (globals.css:739) turns
lavender.

(d) **Status chips.** Replace the monochrome override at globals.css:747 with artifact-tinted tones
per status (decision 8). It covers every `.health-chip` / `.health-pill` user:
`risk-callouts-panel.jsx`, `issue-row.jsx`, `team-summary-table.jsx`.

**Phase 2 — light headers** (`src/components/ui/hero-shell.jsx` + the hero users)

(e) **Hero tokens.** Introduce on-hero colour tokens: `--on-hero`, `--on-hero-muted`,
`--on-hero-faint`, `--on-hero-accent`. They are white tints under Tekion (byte-identical output)
and ink / muted / purple under Modern.
- `HeroShell`, `HeroEyebrow`, `HeroTitle` and `HeroCopy` use them.
- `.hero-panel` under Modern becomes the white header card with a lavender border.
- `HeroTitle` gets the gradient-clip title under Modern.

(f) **Theme-aware `onDark` controls.** The `onDark` variants of `Button` (`button.jsx`) and
`Select` (`select.jsx`) get `modern:` light-surface styles, so every hero's controls work without
per-page edits.

(g) **Hero content sweep.** Replace `text-white` / `text-white/NN` *inside hero subtrees only* with
the on-hero tokens. The hero users are:
- `dashboard/hero.jsx`, `ui/release-countdown.jsx` (subject to O1), `dashboard/sprint-phase-bar.jsx`;
- `app/rollup/page.jsx`, `bugs/bugs-page.jsx`, `bugs/bug-pressure-bar.jsx`, `bugs/bug-scope-view.jsx`;
- `app/leaderboard/page.jsx`, `app/settings/page.jsx`, `app/share/[token]/page.jsx`;
- `admin/admin-panel.jsx`, `security/security-page.jsx`.

Ink surfaces *outside* the hero wait for O1.

**Phase 3 — shared components**

(h) **Cards.** Under Modern, the shared panel shells take the lavender border and the rounder radius
through tokens: `bugs/panel.jsx`, `admin-panel.jsx`'s `SectionCard`, `security/kit.jsx`'s
`SecPanel`, `ui/skeleton.jsx`'s panels.

(i) **Gradient KPI stripes.** Under Modern, the stripe on the shared KPI cards becomes the artifact
gradient for its tone:

| Tone | Gradient |
|---|---|
| brand | blue→purple |
| danger | pink→orange |
| warn | orange→amber |
| info | blue |

The KPI cards are `dashboard/metric-grid.jsx`, `bugs/bug-kpi-cards.jsx` and
`security/overview-panels.jsx`'s `Kpi`.

(j) **Charts.** Point the chart components' categorical fills at the Modern `--chart-cat-*` set.
Run the validator and record its output in as-built notes. The status colours (danger / warn) stay
reserved for status. The chart components are:
- `dashboard/trend-panel.jsx`, `bugs/bug-charts.jsx`, `bugs/bug-bar.jsx`;
- `rollup/rollup-composition-chart.jsx`;
- the leaderboard bars;
- `security/progress-chart.jsx`.

**Phase 4 — fold `/security` into the theme**

(k) Remove the look toggle:
- delete `src/components/security/look.jsx` and its call sites, and the `sprintTracker_securityLook`
  key's only writer;
- re-key the `sec-*` per-look overrides (globals.css:619–633) from `[data-sec-look]` to the theme.
  `:root:not(.theme-modern)` takes the StoryBoard neutrals, and `sec-artifact:` becomes `modern:`.

Then make the Security page follow the rest of Modern:
- **Drop the emoji spans** (decision 4); icon tiles in both themes.
- Render **one header** instead of two, since the hero is now theme-aware.
- Keep the `/security` data colours unchanged.

**Phase 5 — O1 / O2 build-out and clean-up**

(l) Build the variant Naveen chose for O1 (ink surfaces) and for O2 (exports):
- If O2 is **(a) fixed**, pin the print subtree to Tekion tokens: a wrapper class re-declaring the
  `:root` values.
- If O2 is **(b) themed**, check that the A4 page budgets in `lib/export/page-packer.mjs` still
  fit at the new radius and padding.

Then delete the Phase 0 switch.

### Mechanism / gotchas

- **Read the installed docs first:** Tailwind **v4** (`@theme`, `@custom-variant`, `@utility` in
  `globals.css`; there is no config file) and Next **16**. Theme values are CSS variables. Never
  hard-code a hex in a component; add a token instead.
- **No FOUC.** `THEME_INIT` in `src/app/layout.jsx:49` already adds `theme-modern` before paint;
  keep that the only mechanism. The retired `/security` toggle had a flash (as-built 18), and the
  theme does not.
- **`modern:` is `&:is(.theme-modern *)`** (globals.css:17): it matches descendants of `<html>`,
  never `<html>` itself.
- **Gradient text** (`bg-clip-text text-transparent`) must keep emoji and icons *outside* the clip
  (the polish-pass lesson). Give it a solid-colour fallback for forced-colours mode.
- **The ink is not deleted.** The sidebar stays dark (decision 7), and so does whatever O1 keeps
  dark. `--ink` changes value; it does not disappear.
- **On-ink palette.** If O1 = (b) light, re-validate the scoreboard's categorical channels for a
  light surface. Purple is now the brand hue, so the existing *"purple collapses against Modern's
  blue brand"* note no longer applies. Re-run the ΔE check: CIEDE2000 + Machado colour-blindness
  simulation, the method `current-feature.md` already records.
- **Exports render from the live DOM.** The theme class on `<html>` reaches the offscreen print
  pages, so O2 (a) needs an explicit token reset scoped to the print subtree.
- **Stale dev server.** After any `globals.css` change, restart the dev server before screenshots.
  As-built 18 lost a whole render round to one holding :3002.
- **Invariants:** no schema change and no new route. **65 ƒ Dynamic / 15 migrations stay
  unchanged.**

### Acceptance criteria

- **Verification suite:**
  - `yarn lint` 0 (ignoring `.claude/worktrees`);
  - `prisma validate`; `migrate status` at 15, up to date;
  - a cold env-free build, exit 0, 65 ƒ Dynamic, **0 warnings** (grep the log);
  - `/verify`.
- **Every page, both themes, three widths:**
  - pages: `/`, `/rollup`, `/bugs`, `/leaderboard`, `/admin`, `/settings`, `/security`, `/ask`,
    `/login`, `/share/[token]`;
  - widths: 390 / 1440 / 2240 px;
  - checks: 0 horizontal overflow and 0 console errors (headless Chrome, minted session cookie);
    labelled screenshots handed to Naveen.
- **Tekion regression:** before/after Tekion screenshots of every page above at 1440 px. Every
  visible difference is listed in as-built notes as an intended tweak (decision 14), or fixed.
- **Contrast:** under Modern, body text ≥ 4.5:1 and large text ≥ 3:1 on the white card and on the
  gradient page. Checked for the on-hero tokens, the KPI captions and the status pills.
- **Chart palette:** `validate_palette.js` passes for the Modern categorical set (light mode,
  against the card surface). Its output is pasted into as-built notes.
- **Switching:**
  - Tekion → Modern → Tekion with the theme button re-themes every page live, with no reload and
    no leftover Modern styling;
  - a reload in Modern shows no flash of the Tekion header.
- **`/security`:** no look toggle, no emoji, and one header. In Modern it matches the artifact
  frame (light header, gradient title, lavender page); in Tekion it matches the StoryBoard frame.
  Its data colours are identical in both.
- **O1 / O2:** Naveen's recorded choices are implemented, and the Phase 0 switch is gone (grep).

### Out of scope

- **Dark mode.** Still dormant (`.dark`); post-v1.
- **Emoji section titles** anywhere (decision 4).
- **A new theme picker.** The top-bar button keeps cycling Tekion ↔ Modern.
- **Restyling page content** beyond shared components: no per-page layout changes and no new
  panels. Anything a page needs beyond tokens and shared components is a follow-up.
- **Exports' own redesign.** O2 only decides whether exports follow the theme; it is not a new
  print design.
- **Keeping the blue Modern** as a third theme (decision 1).

## Doc-sync (on landing, same PR)

- **project-overview.md:**
  - §10 Styling row: Tekion + Modern, where Modern is now the artifact look;
  - §11 build-log row;
  - §16 the ratified decisions (1–14 plus the O1/O2 outcomes);
  - §5 `/security` row: the look toggle is replaced by the theme;
  - "Last reviewed".
- **modern-theme.md:** an amendment note at the top. Decisions 1 (blue) and 7 (monochrome chips)
  are superseded by this spec, and the mechanism decisions stand.
- **security-vulnerability-tracker.md:** an as-built note that the look toggle (as-built 18) was
  folded into the theme, and that the emoji were dropped.
- **current-feature.md:** point to this spec while it is in progress. Carry forward that the
  invariants are unchanged (65 ƒ / 15).
- **Don't over-claim:** headless screenshots are not Naveen's authed real-browser pass. Mark that
  pending, as modern-theme.md did.

## As-built notes (vs. the spec)

1. **Phase order changed.** Phases 1–4 were built *before* the Phase 0 switch. Nothing in them
   depended on O1/O2, and judging O1/O2 on the new Modern rather than the blue one was the point.
   The switch (`components/dev/phase0-preview.{jsx,css}` plus two `layout.jsx` lines) was then
   deleted in Phase 5. `grep -rn "mt=\|mx=\|phase0" src` is empty.
2. **O1 = (b) light, O2 = (b) themed** (Naveen, 2026-10-21, from `?mt=light&mx=themed`).
   - The ink surfaces keep their ink markup. Under Modern, each surface re-points the white-on-ink
     utilities: `--color-white` becomes the foreground and `--ink` becomes the card (or the hero
     fill). So `text-white/NN`, `bg-white/NN` and `bg-ink` read as ink on white with no
     per-component theme forks.
   - The surfaces are hooked by classes: `.sp-board`, `.dialog-band` / `.dialog-band-close`,
     `.app-toast`, `.app-veil` and `.app-sidebar` (the last also on the sidebar skeleton).
   - Faint labels that fell under 4.5:1 carry `modern:text-muted-foreground` in the component.
3. **Decision 7 reversed: the sidebar is light** (Naveen, 2026-10-22, "Let's go light"). Once the
   other ink surfaces went light, the dark sidebar was the one heavy block left.
   - The sidebar is white with a lavender divider, keeping the gradient active item.
   - The logo's light piece takes ink there (`tone="ink"`).
4. **Decision 9 is capped at two categorical slots.** The artifact's five
   (blue/purple/pink/orange/amber) **fail** as one set: amber falls out of the lightness band at
   1.66:1, and orange↔pink normal ΔE is 13.6.
   - The artifact pair `#8338ec,#3a86ff` only WARNs (deutan CVD ΔE 7.5).
   - Shipped: `--chart-cat-1 #8338ec`, `--chart-cat-2 #0a96e8`. `validate_palette.js --mode light
     --surface #ffffff` → **ALL PASS**: CVD ΔE 10.8, normal 22.0, both ≥ 3:1.
5. **The light scoreboard was re-validated** (O1 = light).
   - `validate_palette.js "#3a86ff,#c48600,#ff006e,#a8459a" --mode light --surface "#ffffff"
     --pairs all` → **ALL PASS**:
     - worst CVD ΔE 8.2 (`#ff006e`↔`#c48600`, deutan — the pink is also hatched);
     - worst normal ΔE 17.7;
     - all ≥ 3:1.
   - The 11px Committed figure takes a separate text step, `--on-ink-accent-text #1f62d6` (4.9:1).
     It is exposed through `--color-on-ink-accent-text`, which falls back to `--on-ink-accent`, so
     Tekion is unchanged.
   - The dark-surface value `--on-ink-accent #7fb2ff` (chosen before O1) stays in the Modern root
     for any remaining dark context. It passed the dark validator at CVD ΔE 10.7 / normal ≥ 16.9.
6. **The header and scoreboard are tinted, not white**, with a gradient border (Naveen:
   "a lot of white space"). The border is a transparent border over a `border-box`
   purple→pink→orange gradient, with the other layers clipped to `padding-box`.
   - First fill: `#f4efff → #fff1e9`.
   - Lightened 2026-10-22 ("too dark"): `#f9f6ff → #fff7f2` on a `#fdfcff → #fffaf7` page.
7. **Status colours are global under Modern**, not re-scoped on `.health-chip` / `.health-pill`
   (design review). The base and `-strong` steps are both text on the `-soft` tint: Badge prints
   `-strong` and the matrix pill prints the base. So both clear 4.5:1 there.
   - teal `#0a7268/#08665c`;
   - amber `#946200/#7a5200` (amber fills therefore read mustard);
   - pink `#c8005a/#a30049`;
   - blue `#1d5fcc/#1a52b0`.
8. **Darker shades than the artifact's,** for contrast:
   - `--muted-foreground #655e7d`;
   - on-hero faint `#6a6384`, accent `#6d28d9`, danger `#a30049`, success `#0a6b61`, done-text
     `#08665c`, active-text `#a84000`;
   - `--color-sec-gold-text #8a6400`.

   Each was measured against the darkest surface it sits on, such as the countdown pill's tint
   over the header fill.
9. **The logo and favicon follow the theme** (option B of eight; amends brand-logo-tagline.md,
   note 12 there).
   - The pieces carry `brand-piece-N` / `brand-ink-piece` classes, recoloured with a CSS `fill`.
   - Favicon: `public/icon-modern.svg`. The `THEME_INIT` boot script re-points it before paint,
     and `ui/theme-favicon.jsx` keeps it in sync on toggle, navigation and React's hydration
     re-insert of the link.
   - The path constant lives in `lib/theme-favicon.js`, because a `"use client"` export reaches a
     server component as a client reference, not a string.
   - Safari's `favicon.ico` and the app icon stay teal.
10. **The theme switch uses a View Transition** (`theme-toggle.jsx`): a 380ms root cross-fade, with
    `flushSync` so the button's label is in the "after" snapshot. It replaces modern-theme.md's
    `.theme-transition`, which couldn't animate `background-image`, so every gradient snapped.
    Browsers without the API, and reduced motion, switch instantly.
11. **Micro-animations folded in** (both themes; see the amendment list above):
    - `ui/sliding-indicator.jsx`, positioned imperatively in a layout effect (no state);
    - `ui/copy-state-icon.jsx`;
    - `animate-disclose` / `animate-enter`;
    - icon hover replays keyed on lucide's `lucide-<name>` class.

    `animate-enter` uses fill-mode `backwards`, not `both`, so it doesn't pin a transform that
    would block the buttons' hover lift. All of it is reduced-motion aware.
12. **Tailwind v4 inlines shadow tokens.** `.shadow-brand` compiles to the literal colour, so
    Modern's `--shadow-brand` override never applied; all 9 users glowed teal. The colour now goes
    through `--brand-glow`. Any future theme override of a `--shadow-*` token needs the same
    indirection.
13. **Tekion tweaks** (decision 14). All are intended:
    - **On-hero tokens:** hero text and buttons read `--on-hero*`, byte-identical in value under
      Tekion.
    - **Toggle pills:** the three segmented toggles render their active pill as a sliding indicator
      (same look, now animated).
    - **Copy buttons:** the copy icon is a two-icon stack (about 1px shift on `/settings`).
    - **`/security`:** the look toggle is gone (security-vulnerability-tracker.md note 19).
    - **Phone top bars:** the top-bar action clusters wrap at narrow widths (`flex-wrap
      justify-end`), fixing 22–225px of horizontal overflow at 390px — a pre-existing defect in
      both themes.

    Every other Tekion pixel difference against `tmp/mt/before/` is live data (countdown clock,
    ageing buckets, counts).
14. **Dev-server hazards hit repeatedly:**
    - **Stale CSS:** Turbopack served stale `globals.css` about five times. Each time the fix was
      stop the server, `rm -rf .next`, restart, then grep the served CSS for the new rule before
      any screenshot.
    - **Disk full:** the final verification filled the disk (production build plus Turbopack
      cache). Full-page 2240px shots were replaced by viewport-only shots at that width.
15. **Contrast:** a headless sweep of 10 pages at 1440px.
    - **Modern:** failures went from 107 to 35 after the design-review pass. The rest is decorative
      punctuation (`·`, `:`, `—`), pre-existing `/admin` counts, and the `/security` artifact data
      palette (follow-up).
    - **Tekion:** the failure set is identical before and after (150).
16. **Left for follow-ups:** design-review items 9–16, which are pre-existing and affect both
    themes:
    - admin "Remove" buttons overflowing at 390px;
    - the admin role select truncating;
    - delivery-matrix header truncation;
    - `/security` artifact-palette contrast;
    - roll-up toggle wrapping at 390px;
    - stretched leaderboard and burndown cards;
    - the floating button overlapping content;
    - tiny burndown axis text.

## References

- **Source look:**
  - `/security` as built: `src/components/security/*`;
  - the `sec-*` tokens: `src/app/globals.css:574–633`;
  - the artifact's own CSS: `vuln-tracker.html` in the Cowork outputs, lines 8–120 (`--grad-structure`,
    `.kpi::before`, `.tag.live`, `.progressfill`).
- **Theme mechanism:**
  - `src/app/globals.css:17` (`modern` variant), `:671` (`:root.theme-modern`), `:731` (hero
    glows), `:739` (selection), `:747` (monochrome chips);
  - `src/app/layout.jsx:49` (`THEME_INIT`);
  - `src/components/ui/theme-toggle.jsx:11` (`THEMES`).
- **Hero:** `src/components/ui/hero-shell.jsx:10` (`HeroShell`), `:18` / `:26` / `:34` (eyebrow,
  title, copy).
- **Specs:**
  - context/features/modern-theme.md (the original Modern decisions and as-built);
  - security-vulnerability-tracker.md as-built 14–18 (the artifact port, the look toggle and its
    flash trade-off);
  - dialog-redesign.md (dialog hero), brand-logo-tagline.md (loader), committed-unplanned-work.md
    (scoreboard on-ink palette), export-visual-consistency.md and rollup-export.md (print kit).
- **Skills:**
  - dataviz (`validate_palette.js`), for the chart palette;
  - the `impeccable` polish / audit pass, for the final quality round.
