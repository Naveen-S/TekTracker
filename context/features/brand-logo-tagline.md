# Brand refresh — Jigsaw logo + "Every piece. One picture."

## Status

**Done 2026-09-29.** Branch `feature/brand-jigsaw` (cut from `main` @ `03602d7`). **Implemented:**
`src/components/ui/brand.jsx` (`BrandMark` per-piece groups + transparent socket masks, `Wordmark`,
`BrandTagline`, `BrandLoader`, `BRAND_TAGLINE`) · Instrument Serif → `--font-tagline` + the
`jigsaw-assemble`/`jigsaw-click`/`jigsaw-breathe` keyframes (`globals.css`, `layout.jsx`) · the mark +
two-tone wordmark in the sidebar, login card, four mobile top bars, share header and welcome hero ·
`BrandLoader` in the `PageLoader` veil (`spinner.jsx`, all 5 call sites) + the AI digest wait ·
adaptive `src/app/icon.svg` (new) + light-tone `favicon.ico`; `src/app/icon.png` **deleted**;
`public/app-icon.png` re-rendered as the tile. **Loader rework (2026-09-29, Loader note 8):** a
static ghost + optional teal halo in `BrandLoader`, calmer dissolve-in-place choreography, and a veil
that centres only the mark (the jump fix). **Final verification (2026-09-29, /finish-feature, re-run
after the loader rework):** cold env-free build in a scratch copy → exit 0, **50 ƒ Dynamic**,
**0 warnings**, all four `@keyframes jigsaw-*` present in the emitted CSS; `next start` smoke —
`/p/health` 200, `/login` 200 with the tagline, `/icon.svg` 200, `/favicon.ico` 200, `/api/auth/me`
401, no error log lines. Earlier pass, same day:
`yarn lint` exit 0 · `prisma validate` ✓ · `migrate status` **13 migrations, up to date** (none added)
· cold env-free build (`rm -rf .next`; `.env` **and** `.env.production` genuinely moved aside) → exit
0, **50 ƒ Dynamic**, **0 warnings / 0 `Node.js module` lines** (grepped the log), `○ /icon.svg`
static · `next start` smoke: `/p/health` 200, `/login` 200 carrying *"Every piece. One picture."* and
exactly two `rel="icon"` links (`favicon.ico` 32x32 + `icon.svg` sizes=any), `/icon.svg` 200
`image/svg+xml`, `/favicon.ico` 200 `image/x-icon`, `/app-icon.png` 200, `/api/auth/me` 401
`UNAUTHENTICATED` (contract intact), no server errors. **§12, schema and routes untouched.** Pending:
Naveen's commit (gitleaks hook) + authed real-browser acceptance incl. a real Jira sync under the
veil.

## Overview

StoryBoard was renamed on 2026-07-31 (display/branding only), but the brand never followed: the app
still shipped a placeholder teal **"T"** tile (`public/app-icon.png`, `src/app/icon.png`,
`src/app/favicon.ico`) and a one-colour "StoryBoard" wordmark with no tagline. The brand board
(`context/SprintTracker - Project Spec/StoryBoard Logo & Tagline.pdf`) proposed four concepts
(A Jigsaw · B Open book · C Speaking chart · D S-path) and four lockup lines.

## Decisions (Naveen, 2026-09-27 — AskUserQuestion)

1. **Logo = Concept A, the Jigsaw.** Four rounded pieces in a 2×2 grid, each joined to its neighbour
   by a knob — "each scrum team is a piece; the white piece is the one leadership never used to see,
   now clicking into place."
2. **Tagline = "Every piece. One picture."** (lockup line 2 — "the jigsaw idea, for the roll-up").
3. **Wordmark = two-tone + serif.** "Story" in the surface's foreground, "Board" in the active
   theme's `primary` (teal in Tekion, blue in Modern); the tagline in an italic serif
   (Instrument Serif, `next/font/google`), exactly as the board sets it.

## Scope

- One component module, `src/components/ui/brand.jsx`: `BrandMark` (inline SVG, `tone` dark/light,
  `tile` app-icon variant), `Wordmark`, `BrandTagline`, and the `BRAND_TAGLINE` constant.
- The mark's colours are **fixed** (it is the product mark); only the wordmark's "Board" follows the
  theme.
- Surfaces: sidebar, login card, the four mobile top bars, the share header, the welcome hero.
- Raster icons (`icon.png`, `favicon.ico`, `public/app-icon.png`) re-rendered from the SVG and
  **overwritten in place** — no new app-router files, so the route count is unchanged.
- **Out of scope:** export PDF footers/metadata, error pages, the launch video.

Presentation-only: no schema change, no route change, §12 untouched.

## Acceptance

- Lint clean; env-free cold build green at **50 ƒ Dynamic**, **13 migrations**, 0 warnings.
- Login, sidebar (expanded/collapsed), a mobile top bar render the new mark + wordmark in both
  themes (headless Chrome); `/icon.png` + `/favicon.ico` serve the jigsaw. *(As shipped: `/icon.svg`
  + `/favicon.ico` — see As-built note 8.)*
- The 16 px favicon still reads as four pieces.

## As-built

1. **The mark is drawn, not traced.** No vector source existed (only the PDF board and the launch-video
   renders), so `BrandMark` rebuilds the 2×2 geometry in a 100-unit viewBox: 46.5-unit pieces, rx 8,
   a 7-unit gap; each knob = a ring cut (r 9.5) + a 6-wide neck + the knob (r 6). The ring cut
   reproduces the board's outline around each knob. **[Amended 2026-09-27, Naveen]** it was first a
   circle painted in the surface colour; it is now a real transparent cut (an SVG `<mask>`, id from
   `useId`), so the bare mark works on any background — the sidebar logo link's `hover:bg-white/8`
   tint showed painted rings as dark discs.
7. **Sidebar uses the bare mark, not the tile (Naveen, 2026-09-27).** The sidebar is ink in both
   themes, so the teal tile was redundant — `<BrandMark className="size-8" />` (tone dark). The
   tile stays for the favicon / app icon, where the background (browser tab, OS) is often light
   and the white piece would vanish. *(Favicon superseded by note 8.)* Re-verified: lint clean, env-free build exit 0 at **50 ƒ
   Dynamic**, 0 warnings; headless sidebar shots in both themes, at rest and hovered.
2. **Deviation — the 16 px favicon is a simplified mark.** At 16 px the knobs are sub-pixel and the
   full mark reads as mush; the 16 px ICO frame is four enlarged pieces on the teal tile, no knobs.
   32 px and 256 px use the real `BrandMark tile` render. (The plan anticipated this.)
3. **Deviation — only the dashboard top bar swaps its sub-line for the tagline.** The bugs,
   leaderboard and roll-up top bars' sub-lines are page names ("Bug report", "Leaderboard",
   "Multi-team roll-up") — real context, so they keep them and only gain the two-tone wordmark.
4. **On ink, "Board" uses `on-ink-accent`, not `primary`** (sidebar, welcome hero): Modern's
   `#2f6bff` on its `#17181b` ink is too dim for a 14 px wordmark; `on-ink-accent` is the existing
   theme-aware tint for exactly this surface.
5. **`public/app-icon.png` is now unreferenced by `src/`** (the sidebar draws the SVG inline). It was
   overwritten with the new 256 px icon rather than deleted, in case anything external links it.
6. Rasters were rendered from the real component (`renderToStaticMarkup` → headless Chrome) and the
   ICO packed by hand (PNG payloads) — no new dependency.

**Verified 2026-09-27:** `yarn lint` clean · **13 migrations** (none added) · cold env-free build in
a scratch copy of the tree (no `.env*` present; Naveen's dev server on :3002 left untouched) → exit
0, **50 ƒ Dynamic**, **0 warnings**, no `Environments:` line · headless Chrome against `next start`:
`/login` (Tekion + Modern), `/` at desktop (sidebar tile + wordmark, both themes) and mobile width
(top bar wordmark + tagline), `/rollup` mobile · `/icon.png` 200 `image/png`, `/favicon.ico` 200
`image/x-icon`. Authed real-browser acceptance is Naveen's.

8. **[Amended 2026-09-27, Naveen — supersedes note 2 and the favicon half of note 7] The favicon is
   the bare, ADAPTIVE mark.** Mocked on real tab colours at 16 px: the tile read everywhere but its
   pieces were tiny; the bare dark-tone mark lost its white piece on light tabs (Chrome/Safari
   default) and read as three pieces. Shipped instead: **`src/app/icon.svg`**, the light-tone
   `BrandMark` rendered to static SVG with the ink piece + its knob on a `.flip` class that turns
   `#f4f7fa` under `prefers-color-scheme: dark` — four pieces on either tab, larger than the tiled
   version (no tile padding), and the full mark with knobs even at 16 px. **`src/app/icon.png` was
   deleted** (Naveen approved) so Next doesn't advertise two competing `rel="icon"` images;
   **`favicon.ico`** (16 + 32 PNG frames) now carries the fixed light-tone bare mark as the fallback
   for Safari, which ignores SVG favicons (on a dark Safari tab its ink piece is dim but present).
   `public/app-icon.png` keeps the tile (the unreferenced 256 px app icon). Emitted links verified
   against `next start`: `favicon.ico` (`32x32`, `image/x-icon`) + `icon.svg` (`sizes="any"`,
   `image/svg+xml`); `/icon.png` → 404. Build: exit 0, **50 ƒ Dynamic**, 0 warnings, `○ /icon.svg`
   static (the ƒ invariant is unmoved).

## Loader (added 2026-09-27)

Naveen: *"a loader similar to our logo, the jigsaw pieces joining, used through our app"* — the
board's own line for Concept A was *"four pieces fly in, and the story is complete."*

**Decisions (AskUserQuestion):** (1) **scope = the long-wait tier only** — the `PageLoader` veil
(all five call sites: board sync/updates, `/bugs` refresh, admin, leaderboard + roll-up switches)
and the AI digest's in-panel "Writing digest…" wait. The ~15 button `Spinner`s, the top
`ProgressBar` and the route skeletons are **unchanged**: at 14 px the knobs are sub-pixel, and an
assembly loop inside a button reads as noise; the tiered vocabulary in `spinner.jsx` stays intact.
(2) **Same branch** — it builds on the uncommitted `BrandMark`.

**As-built:**
1. **`BrandMark` restructured into per-piece groups.** The shared socket mask (all four cuts over
   all four rects) would have left the holes hanging in place while the pieces flew. Each piece is
   now one `<g>` — rect masked by its **own incoming socket** + its outgoing neck + knob — so a
   moving piece carries its notch like a real jigsaw piece. The static render is unchanged (checked
   frame-for-frame against the reduced-motion capture); `icon.svg` was not regenerated.
2. **`BrandLoader`** = `<BrandMark animated>`; pieces get `--dx/--dy` (±16 units, out from their own
   corner) and an arrival slot `--i`: **top-left → bottom-left → bottom-right → the white
   top-right piece last** — the piece leadership never used to see clicks in last.
3. **`jigsaw-assemble`** (2.4 s, the veil's `cubic-bezier(0.22,1,0.36,1)`): fly in + 5 % snap
   overshoot by 26 %, hold 32–80 %, drift apart by 96 %; 0.14 s stagger. Transform + opacity only.
   Two corrections from the filmstrip: `backwards` fill (without it the first frame showed three
   pieces already assembled, waiting out their delay), and a longer hold (the all-four-joined window
   was ~0.5 s; now ~1.1 s).
4. **Reduced motion:** pieces stop, the complete mark breathes (`jigsaw-breathe`, own keyframe — not
   `@theme`'s `blink`, which Tailwind v4 tree-shakes when no utility uses it).
5. AI digest: `size-7` light tone. Veil: first shipped as `size-10` inside the ink panel card.
6. **[Amended 2026-09-27, Naveen — "jigsaw without black background, in loader"] The veil has no
   card.** The `size-16` jigsaw and its label + elapsed timer float, centred and stacked, directly
   on the scrim. To hold the white label's contrast without a panel behind it the scrim went
   `bg-ink/45` → `bg-ink/60` (blur 3 → 4 px) and the text gained `text-shadow-sm
   text-shadow-black/40` (Tailwind 4.3 utilities). The knob cut-outs are transparent, so the scrim
   shows through them. Re-verified: lint clean, env-free build exit 0 at **50 ƒ Dynamic**, 0
   warnings; the real `/leaderboard` "Updating…" veil captured in both themes with the ≥3 s timer
   line showing.
7. **[Polish pass 2026-09-27, `/impeccable polish`] — supersedes the timings in note 3.** Four motion
   defects found in the filmstrip, fixed in the keyframes only (design unchanged):
   - **Loop seam** — the first piece re-entered while the white one was still fading out. Now a
     2.8 s cycle with a rest (82–100 %): the last piece is gone at ~2.66 s, the first returns at
     2.8 s, so every loop opens on an empty frame.
   - **Wrong departure curve** — one ease-out drove every segment, so pieces *left* at full speed.
     Per-keyframe `animation-timing-function`: ease-out fly-in (0–20 %), ease-in-out settle out of
     a 3 % overshoot (20–27 %), hold (27–66 %, all four joined ~0.7 s), **ease-in** exit (66–82 %).
     A 2 px motion blur sheds on arrival and returns on exit (ignored where CSS `filter` on SVG
     children isn't supported — degrades to the same motion without blur).
   - **Started while invisible** — the veil paints only after 260 ms, so the first piece was already
     half-way home when it appeared. The first cycle now waits out that delay (`0.26s + --i × 0.12s`).
   - **No payoff for the brand line** — as the white piece lands (~33 % of the cycle), the whole
     mark gives one 3.5 % settle (`jigsaw-click` on `.jigsaw-loader`, same period and start, so it
     stays locked to that landing). Reduced motion still replaces everything with the breathe.
   Verified: 14-frame filmstrip at 64 px (on a scrim grey) and 28 px (on white) — empty open, arrival
   order, click at 1.25–1.4 s, hold to ~2.2 s, clean empty seam at 2.95 s; reduced motion runs only
   `jigsaw-breathe`; lint clean; Impeccable detector `[]`; env-free build exit 0, **50 ƒ Dynamic**,
   0 warnings; the real veil at 1280 and 390 px wide, no console errors.

8. **[Amended 2026-09-29, Naveen — "not very attractive; it jumps when the refreshing-from-Jira and
   seconds text appear"] — supersedes the choreography of notes 3/7 and the layout of note 6.**
   - **The jump, root-caused:** the veil centred ONE column (mark + label + elapsed line), so the
     elapsed line mounting at 3 s, the hint lengthening it at 15 s, or a mid-wait label change
     re-centred the column and the mark hopped ~10 px. Now **only the mark takes part in
     centring**; the words hang below it (`absolute top-full`), and the elapsed line's height is
     always reserved (`h-4`) and fades in (`opacity`, 500 ms) instead of popping. Measured: the
     mark's box is identical (`414,241,72×72`) with no timer, `4s`, and the long hint.
   - **Never-empty frame:** `BrandLoader` is now three layers — a static **ghost** of the finished
     picture at 15 % opacity, the animated pieces snapping into it, and (`glow`, veil only) a teal
     **halo** that blooms as the white piece lands. The old loop opened on an empty frame every
     2.8 s, which read as flicker.
   - **Calmer choreography (2.6 s, stagger 0.15 s):** spring in from ±12 units (was ±16) with a
     `cubic-bezier(0.34,1.45,0.64,1)` overshoot, no motion blur; hold ~0.8 s all-four-joined;
     **dissolve in place back into the ghost in arrival order** (scale 0.94 + fade) instead of
     drifting apart. `jigsaw-click` re-timed to the new landing (≈37 %); new `jigsaw-halo`
     keyframe on the same period/start. Veil mark `size-16` → `size-18` with a soft
     `drop-shadow` (`.jigsaw-lift`). Reduced motion: pieces + halo off, the mark breathes.
   - Verified: lint clean; cold env-free build in a scratch copy (APFS-cloned `node_modules` — a
     symlinked one panics Turbopack, "points out of the filesystem root") → exit 0, **50 ƒ
     Dynamic**, 0 warnings; headless filmstrip (12 frames 0.3–2.8 s) of the real `BrandLoader`
     markup on the compiled CSS, Tekion + Modern, 390 px mobile, the AI-digest light tone, and a
     reduced-motion run (only `veil-in`, `veil-panel-in`, `jigsaw-breathe` running).

**Verified 2026-09-27:** lint clean · env-free build exit 0, **50 ƒ Dynamic**, 0 warnings, both
keyframes present in the emitted CSS · headless filmstrip of the loop (10 frames, animations paused
at exact times: empty start, arrival order, complete hold 0.8–1.9 s, drift) · reduced-motion capture
(only `jigsaw-breathe` running) · the **real** "Updating…" veil on `/leaderboard` (RSC refetch held
open 4 s) in both themes, 4 animated pieces in the panel. A real Jira sync is Naveen's acceptance.

## As-built notes — final (2026-09-29)

9. **The favicon is a new app-router file after all.** Scope said "no new app-router files"; note 8's
   `src/app/icon.svg` is one. It is `○` static, so the **50 ƒ Dynamic** invariant did not move —
   the scope line's intent (route count unchanged) holds, its letter doesn't.
10. **Numbering of the notes above is out of order (7 before 2)** — left as written per the
    append-don't-rewrite convention; note 8 supersedes note 2 and the favicon half of note 7, and
    Loader note 7 supersedes Loader note 3's timings.
11. **Not in this feature's commit:** the untracked `launch-video/`, `Claude outputs/`, `scripts/`,
    `docker-entrypoint.sh` and `context/features/migrate-on-start.md` in the working tree belong to
    other work (the migrate-on-start branch/stash and the launch video) and must be left out of the
    `feature/brand-jigsaw` commit. The brand-board PDF under `context/SprintTracker - Project Spec/`
    *is* this feature's source reference and ships with it.
