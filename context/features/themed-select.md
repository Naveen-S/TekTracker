# Themed select (app-wide)

**Status:** **Done 2026-10-25** · built on `feature/support-oncall` (uncommitted) · Owner: Naveen.
Supersedes ui-port.md decision 5 ("styled native select; the open list stays OS-native").

## Overview

Every dropdown in StoryBoard was a styled native `<select>`: the trigger matched the app, but the
open list was the browser's own grey menu, out of place in both themes and unable to show a second
line. The on-call member picker (support-oncall.md as-built 15) needed names with emails under them,
and Naveen asked for a dropdown "to match the theme of our app", **everywhere**.

## Decisions

1. **Rewrite `src/components/ui/select.jsx` in place as a drop-in.** A survey found 30 `<Select>`s in
   19 files, all controlled (`value` + `onChange(e => e.target.value)`, `<option>` children), using
   only `disabled`, `aria-label`, `id`, `className`, `size`, `variant` and `title`: no `optgroup`,
   `multiple`, `name`, forms or `selectedOptions`. Same export and props, so no call site changed
   (three gained a missing `aria-label`, below).
2. **`onChange` receives `{ target: { value, id }, currentTarget }`**, the only event fields read.
3. **`<option hint="…">`** adds a muted second line (the on-call picker's emails).
4. **The list is portaled to `document.body`, `position: fixed`, z-60.** A fixed list inside a
   blurred hero or top bar would be positioned against that ancestor (backdrop-filter makes a
   containing block), and a dialog body would clip an in-place list. Dialogs (z-50) only close on a
   mousedown on their own scrim, so clicks in the list are safe.
5. **Escape and Tab are caught in a window capture listener while open**, ahead of the Dialog's
   document-level Escape/Tab trap, so Escape closes only the list.
6. **A filter box above more than 8 options**, focused on fine pointers only (no phone keyboard on
   every open).
7. **A native select's quirks kept:** a value matching no option shows the first option; a disabled
   placeholder option is allowed.

## As-built

- **Trigger:** `<button role="combobox" aria-haspopup="listbox" aria-expanded aria-controls
  aria-activedescendant>` with the old size and variant classes (default + `onDark`, Modern
  overrides) plus an open ring; the chevron turns over when open. `id` stays on the button, so
  `<Label htmlFor>` still names it.
- **List:** `bg-popover`, border, `rounded-lg`, `shadow-lg`; active option `bg-accent`, a check on
  the selected one, disabled options at 45% opacity; taller rows on coarse pointers
  (`pointer-coarse:py-2.5`). It flips above the trigger when there's no room below, is capped at
  288 px, clamps to the viewport edges, and repositions on scroll and resize (positions written to
  the element's style in a layout effect, not JSX style props).
- **Motion:** `@keyframes select-pop-down` / `-up` in `globals.css`, 120 ms on `--ease-out` from the
  trigger edge; reduced motion gets a 100 ms fade.
- **Keyboard:** ↑/↓/Enter/Space open on the selected option; ↑/↓, Home/End and type-ahead move;
  Enter/Space pick (Space types in the filter box); Esc closes; Tab closes and moves on. Disabled
  options are skipped.
- **Disabling the trigger while open closes the list** (derived `expanded = open && !disabled`, no
  effect).
- **Accessibility fixes found by the sweep:** the per-member role select and the add-member role
  select on `/admin`, and the bug-report scope's Source select had no accessible name (also true of
  the native versions); each gained an `aria-label`.

## Verification

- Lint clean on `src/`; cold env-free Node 22 build: exit 0, 67 ƒ, 0 warnings.
- Headless sweep of `/`, `/rollup`, `/leaderboard`, `/bugs`, `/security`, `/oncall`, `/admin`, `/ask`
  at 1440 and 390 in both themes: every select opens on click and on ↓, its list stays fully on
  screen, Esc closes it, no page overflows.
- Inside dialogs (Sprint Start, Configure Sprint, Share View, roll-up export, bug export, team
  config, on-call edit) at 1440 Tekion and 390 Modern: the list opens above the dialog, stays on
  screen, and Esc closes only the list.
- Real changes fire: the board team pick navigates, the roll-up program pick navigates, the admin
  role select PATCHes (200), the on-call program picker filters (23/23 checks).
- 0 console errors. Naveen's authed real-browser pass is pending.
