"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { BrandMark } from "@/components/ui/brand";
import { cn } from "@/lib/utils";

/**
 * Modal dialog (hand-written, no radix — ui-port.md decision 5).
 *
 * What this rebuild fixes, in order of how much it was hurting:
 *
 *  1. **Exit animation.** The old dialog animated in and then vanished on a hard unmount. Call
 *     sites mount conditionally (`{showX && <XDialog/>}`), so the dialog cannot animate itself out
 *     after the parent has dropped it — instead every close path routes through `requestClose`,
 *     which plays the out animation and *then* calls `onClose`. Exit runs faster than enter
 *     (140ms vs 200ms): entering is the system presenting itself, leaving is the system getting
 *     out of the way. Footer buttons reach it through `DialogClose` / `useDialog().close`.
 *  2. **Focus.** There was no trap and no restore — Tab walked straight out into the page behind
 *     the scrim, and closing dropped focus onto `<body>`, losing a keyboard user's place entirely.
 *  3. **Scroll.** The page scrolled behind the modal. Locking it compensates for the scrollbar
 *     width so the layout underneath doesn't jump sideways as the dialog opens.
 *  4. **The action row scrolled away.** Buttons lived inside the scrolling body, so on the export
 *     dialog you had to scroll a long preview to reach Cancel. Footer content now sits outside the
 *     scroll region via the `footer` prop and is always reachable.
 *  5. **Tone.** A 3px colour strip is a weak signal easily missed at the top edge. Tone now reads
 *     as an icon tile beside the title — the same idiom the metric cards and panels already use,
 *     so a destructive dialog looks like it belongs to this app.
 *
 * Visual language (dialog-redesign.md): restraint in the chrome, so the content carries the weight.
 * A quiet scrim, a crisp card, a semibold title, a white footer, and hairline dividers that appear
 * only once the body actually scrolls under them. The footer has two clusters — `footerStart` for
 * tertiary actions (pager, copy, remove) and `footer` for dismiss + primary, primary rightmost.
 *
 * Always PORTALLED to `document.body`, so no ancestor stacking context (sticky table cells, an
 * `overflow-hidden` hero) can trap it. The panel carries no persistent transform: the export
 * dialogs park their `fixed` offscreen print sheets inside it, and a transform would re-anchor them.
 */

const EXIT_MS = 140; // keep in lockstep with the dialog-*-out keyframes in globals.css

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

const TONES = {
  success: { icon: CheckCircle2, tile: "bg-success-soft text-success-strong ring-success/20" },
  danger: { icon: AlertTriangle, tile: "bg-danger-soft text-danger-strong ring-danger/20" },
  // A sync that succeeded but returned something suspicious (a track Jira just emptied, §14.14) is
  // neither — reporting it in the error tone would cry wolf about a run that actually worked.
  warn: { icon: AlertTriangle, tile: "bg-warn-soft text-warn-strong ring-warn/25" },
  info: { icon: Info, tile: "bg-info-soft text-info-strong ring-info/20" },
};
TONES.error = TONES.danger;

/** Neutral tile for a dialog that names its subject with an icon but carries no status. */
const ICON_TILE = "bg-accent text-accent-foreground ring-primary/15";

/**
 * Open dialogs, innermost last. A dialog can open another (the roll-up "All risks" list opens a
 * ticket's Claude analysis), and every dialog listens for keys on `document` — without this, one
 * Escape closed both. Only the top of the stack handles Escape/Tab.
 */
const openDialogs = [];

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const DialogContext = React.createContext({ close: () => {}, closable: false });

/** `{ close, closable }` for anything rendered inside a Dialog (body or footer). */
function useDialog() {
  return React.useContext(DialogContext);
}

/**
 * A footer dismiss button that plays the exit animation. Disabled while the dialog is not closable
 * (the call site passed `onClose={busy ? undefined : onClose}`).
 */
function DialogClose({ children = "Cancel", variant = "secondary", disabled, ...props }) {
  const { close, closable } = useDialog();
  return (
    <Button type="button" variant={variant} {...props} onClick={close} disabled={!closable || disabled}>
      {children}
    </Button>
  );
}

/**
 * Width to reserve when the page's vertical scrollbar is taken away by the scroll lock.
 *
 * NOT `window.innerWidth - documentElement.clientWidth`, the usual recipe: on any page that can
 * scroll horizontally — the Delivery Matrix and the bug matrix both can — those two disagree by
 * the horizontal overflow, and under mobile emulation they disagreed by 195px. That produced a
 * huge phantom padding and caused exactly the sideways jump the compensation exists to prevent.
 *
 * Measuring a throwaway scrolling element asks the only question that matters — how wide is a
 * scrollbar here — and is unaffected by the page's own layout. Overlay scrollbars correctly
 * return 0, so nothing is reserved on macOS's default setting.
 */
function verticalScrollbarWidth() {
  const { body, documentElement } = document;
  if (documentElement.scrollHeight <= documentElement.clientHeight) return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden";
  body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

const subscribeNothing = () => () => {};

/** False during SSR and hydration, true after — so the portal never renders on the server. */
function useIsClient() {
  return React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/**
 * Which edges of the scrolling body have content hidden past them. Drives the header/footer
 * hairlines: a divider is only drawn where something is actually scrolling under it.
 */
function useScrollEdges(scrollRef, contentRef, active) {
  const [edges, setEdges] = React.useState({ top: false, bottom: false });

  const measure = React.useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const top = element.scrollTop > 0;
    const bottom = element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    setEdges((previous) =>
      previous.top === top && previous.bottom === bottom ? previous : { top, bottom },
    );
  }, [scrollRef]);

  React.useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!active || !element) return undefined;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [active, scrollRef, contentRef, measure]);

  return [edges, measure];
}

/** Four-point sparkle, drawn in the tone colour beside the medallion. */
function Sparkle({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("dialog-sparkle absolute", className)}>
      <path
        fill="currentColor"
        d="M12 0c.9 7.2 4.8 11.1 12 12-7.2.9-11.1 4.8-12 12-.9-7.2-4.8-11.1-12-12C7.2 11.1 11.1 7.2 12 0Z"
      />
    </svg>
  );
}

/** The round badge over the band's seam: a tone-coloured glossy tile, sparkles around it. */
function Medallion({ icon: Icon, compact = false }) {
  return (
    <div
      className={cn(
        "dialog-medallion relative grid shrink-0 place-items-center rounded-full bg-card",
        compact ? "size-[60px]" : "size-[84px] sm:size-[92px]",
      )}
    >
      <span className="dialog-medallion-disc absolute inset-[4px] rounded-full" aria-hidden="true" />
      <span
        className={cn(
          "dialog-medallion-tile relative grid place-items-center text-white",
          compact ? "size-9 rounded-[11px]" : "size-12 rounded-[14px] sm:size-[52px]",
        )}
      >
        <span className="dialog-medallion-gloss absolute" aria-hidden="true" />
        <Icon
          className={cn("relative", compact ? "size-[18px]" : "size-6")}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </span>
      <Sparkle className={cn("dialog-sparkle-1 -top-0.5 right-0.5", compact ? "size-2.5" : "size-3.5")} />
      <Sparkle className={cn("dialog-sparkle-2 bottom-2 -left-1.5", compact ? "size-2" : "size-2.5")} />
      {!compact && <Sparkle className="dialog-sparkle-3 top-3 -left-2.5 size-2" />}
    </div>
  );
}

/**
 * The "moment" header (dialog-redesign.md, round 2): the app's own ink hero surface as a band, a
 * faint Jigsaw mark in its corner, a soft wave into the card, and a medallion that overlaps the
 * seam — so a confirm, an alert or a success reads as an event, in StoryBoard's visual language
 * rather than a generic one. The medallion's colour follows the dialog's tone (brand by default).
 * `border-0!` drops the hero-panel utility's 1px border, which showed under the wave as a hairline.
 * The panel is lifted off the page by `shadow-dialog` (depth + a faint brand halo) and a 1px light
 * rim (`ring-white/12`): without them the ink band merged into the ink hero panels behind the scrim.
 */
function HeroHeader({
  icon: Icon,
  compact,
  title,
  description,
  titleId,
  descriptionId,
  onClose,
  requestClose,
}) {
  return (
    <header className="relative shrink-0">
      <div
        className={cn(
          "hero-panel relative overflow-hidden rounded-t-xl border-0! shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]",
          compact ? "h-14" : "h-20 sm:h-24",
        )}
      >
        <span className="dialog-hero-glow absolute inset-0" aria-hidden="true" />
        <BrandMark
          tone="dark"
          className="pointer-events-none absolute -top-10 -right-8 size-44 rotate-12 opacity-[0.08]"
        />
        <span
          aria-hidden="true"
          className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-white/35 sm:hidden"
        />
        <svg
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
          aria-hidden="true"
          className={cn("absolute inset-x-0 -bottom-px w-full", compact ? "h-5" : "h-7 sm:h-9")}
        >
          <path
            className="dialog-wave-back"
            d="M0 20C70 4 130 34 210 20S340 2 400 16V40H0Z"
          />
          <path
            className="dialog-wave-front"
            d="M0 30C80 16 150 40 230 28S350 14 400 26V40H0Z"
          />
        </svg>
      </div>
      <button
        type="button"
        onClick={requestClose}
        disabled={!onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-md text-white/75 transition-colors duration-150 hover:bg-white/15 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
      >
        <X className="size-4" />
      </button>

      {compact ? (
        // Work dialogs with a big body (the exports' report preview): a short band, the medallion
        // on the left and the title beside it, so the header costs about half the full hero's height.
        <div className="relative -mt-8 flex items-start gap-4 px-6 pb-4">
          <Medallion icon={Icon} compact />
          <div className="min-w-0 flex-1 pt-9">
            <h2
              id={titleId}
              className="font-display text-base leading-snug font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative -mt-11 flex flex-col items-center px-6 pb-4 text-center sm:-mt-12">
          <Medallion icon={Icon} />
          <h2
            id={titleId}
            className="mt-3.5 font-display text-lg leading-snug font-semibold tracking-tight text-balance text-foreground"
          >
            {title}
          </h2>
          {description && (
            <p
              id={descriptionId}
              className="mt-1.5 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground"
            >
              {description}
            </p>
          )}
        </div>
      )}
    </header>
  );
}

/**
 * Shared inline error block. This exact markup was hand-copied into five dialogs, which is how it
 * drifted; one component keeps a failed save looking the same wherever it happens.
 */
function DialogError({ children, className }) {
  if (!children) return null;
  return (
    <Callout tone="danger" role="alert" className={cn("font-medium", className)}>
      {children}
    </Callout>
  );
}

function Dialog({
  open,
  onClose,
  title,
  description,
  tone,
  icon: Icon,
  hero = false,
  size = "md",
  footer,
  footerStart,
  children,
  className,
}) {
  const isClient = useIsClient();
  const panelRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const exitTimer = React.useRef(null);
  const [leaving, setLeaving] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [edges, measureEdges] = useScrollEdges(scrollRef, contentRef, open && isClient);

  /** Play the out animation, then hand control back to the parent, which unmounts us. */
  const requestClose = React.useCallback(() => {
    if (!onClose || exitTimer.current) return;
    setLeaving(true);
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null;
      onClose();
    }, EXIT_MS);
  }, [onClose]);

  React.useEffect(() => () => exitTimer.current && clearTimeout(exitTimer.current), []);

  // Stack membership lives in its own [open] effect with a stable token, so the key effect below
  // re-running (a new `onClose` identity on every parent render) can't reorder the stack.
  const stackToken = React.useRef({});
  React.useEffect(() => {
    if (!open) return undefined;
    const token = stackToken.current;
    openDialogs.push(token);
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
    };
  }, [open]);

  // Escape + Tab containment. Keeping both on one listener means the trap can never disagree with
  // the close handler about which dialog is on top — only the top of `openDialogs` handles either.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (openDialogs[openDialogs.length - 1] !== stackToken.current) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  // Initial focus + restore on close. Fields marked `autoFocus` have already claimed focus by the
  // time this runs, so we only step in when nothing inside the panel has it — then we focus the
  // panel itself rather than the first control, so screen readers announce the title first.
  // Keyed on `isClient` too: the panel only exists once the portal has mounted.
  React.useEffect(() => {
    if (!open || !isClient) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, isClient]);

  // Scroll lock, with scrollbar-width compensation so the page behind doesn't shift sideways.
  React.useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    const scrollbar = verticalScrollbarWidth();
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  const context = React.useMemo(
    () => ({ close: requestClose, closable: Boolean(onClose) }),
    [requestClose, onClose],
  );

  if (!open || !isClient) return null;

  const toneConfig = tone ? TONES[tone] : null;
  const toneKey = tone === "error" ? "danger" : tone;
  // A hero names its subject: an explicit icon wins over the tone's generic glyph.
  const HeroIcon = Icon ?? toneConfig?.icon ?? Info;
  const TileIcon = toneConfig?.icon ?? Icon;
  const tileClass = toneConfig?.tile ?? ICON_TILE;
  const state = leaving ? "closed" : "open";
  const hasFooter = Boolean(footer || footerStart);
  // A confirm that says everything in its title + description has no body; skip the empty band.
  const hasBody = React.Children.toArray(children).length > 0;

  return createPortal(
    <DialogContext.Provider value={context}>
      <div
        data-state={state}
        className="dialog-overlay fixed inset-0 z-50 flex items-end justify-center bg-ink/55 backdrop-blur-[6px] backdrop-saturate-[.8] sm:items-center sm:p-6"
        onMouseDown={(event) => {
          // mousedown, not click: a text selection that starts inside the panel and ends on the
          // backdrop fires a click on the overlay and used to close the dialog mid-edit.
          if (event.target === event.currentTarget) requestClose();
        }}
        role="presentation"
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          data-state={state}
          data-tone={toneKey}
          className={cn(
            "dialog-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-card text-card-foreground shadow-dialog outline-none ring-1 ring-white/12 sm:max-h-[85vh] sm:rounded-xl",
            SIZES[size] ?? SIZES.md,
            className,
          )}
        >
          {hero ? (
            <HeroHeader
              icon={HeroIcon}
              compact={hero === "compact"}
              title={title}
              description={description}
              titleId={titleId}
              descriptionId={descriptionId}
              onClose={onClose}
              requestClose={requestClose}
            />
          ) : (
            <>
            <span
              aria-hidden="true"
              className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden"
            />
            <header
              className={cn(
                "flex shrink-0 items-start gap-3.5 border-b px-6 pt-3 pb-4 transition-colors duration-150 sm:pt-5",
                edges.top ? "border-border-subtle" : "border-transparent",
              )}
            >
              {TileIcon && (
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                    tileClass,
                  )}
                  aria-hidden="true"
                >
                  <TileIcon className="size-[18px]" />
                </span>
              )}
              <div className={cn("min-w-0 flex-1", TileIcon && !description && "self-center")}>
                <h2
                  id={titleId}
                  className="font-display text-base leading-snug font-semibold tracking-tight text-foreground"
                >
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={!onClose}
                aria-label="Close"
                className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </header>
            </>
          )}

          {hasBody && (
          <div
            ref={scrollRef}
            onScroll={measureEdges}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-1",
              hasFooter ? "pb-5" : "pb-6",
            )}
          >
            <div ref={contentRef}>{children}</div>
          </div>
          )}

          {hasFooter && (
            <footer
              className={cn(
                "flex shrink-0 flex-col-reverse gap-2 border-t px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-colors duration-150 sm:flex-row sm:items-center sm:pb-4",
                edges.bottom ? "border-border-subtle" : "border-transparent sm:pt-1",
                hero === true && "sm:justify-center sm:pb-6",
              )}
            >
              {footerStart && (
                <div className="flex flex-wrap items-center gap-2">{footerStart}</div>
              )}
              <div
                className={cn(
                  "flex flex-col-reverse gap-2 sm:flex-row sm:items-center",
                  hero === true ? "sm:[&>[data-slot=button]]:min-w-32" : "sm:ml-auto",
                )}
              >
                {footer}
              </div>
            </footer>
          )}
        </div>
      </div>
    </DialogContext.Provider>,
    document.body,
  );
}

export { Dialog, DialogClose, DialogError, useDialog };
