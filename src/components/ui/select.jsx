"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cva } from "class-variance-authority";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's themed select (themed-select.md; supersedes ui-port.md decision 5's native select).
 * A drop-in for the old native one: same props, `<option>` children, and `onChange` receives an
 * event-shaped `{ target: { value, id } }`, so no call site changed. An `<option hint="…">` adds a
 * muted second line (the on-call POC picker shows each person's email there).
 *
 * The list is portaled to `document.body` with `position: fixed`, measured from the trigger and
 * flipped above it when there is no room below. A portal because a fixed list inside a blurred hero
 * or top bar would be positioned against that ancestor, and a dialog body would clip an in-place
 * one. It sits above dialogs (z-60 vs z-50); dialogs only close on a mousedown on their own scrim.
 * Escape and Tab are caught in a window capture listener while open, ahead of the dialog's
 * document listener, so Escape closes only the list. More than FILTER_THRESHOLD options adds a
 * filter box (focused on fine pointers only, so a phone keyboard doesn't pop up on every open).
 */
const FILTER_THRESHOLD = 8;
const LIST_MAX_PX = 288;
const GAP_PX = 4;
const EDGE_PX = 8;
const TYPEAHEAD_MS = 500;

const selectVariants = cva(
  // Match Input's control box (h-9, rounded-md, px-3, py-1, text-sm) so a bare Select lines up with
  // Inputs/Buttons in the same row; call sites still override height with h-7/h-8 via className.
  "flex w-full items-center rounded-md border bg-background py-1 text-left shadow-xs outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        default: "h-9 pl-3 pr-9 text-sm",
        sm: "h-8 pl-2.5 pr-8 text-[13px]",
      },
      variant: {
        default:
          "border-input text-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:border-ring aria-expanded:ring-[3px] aria-expanded:ring-ring/50",
        // Glass select for the ink hero (mirrors Button's onDark, src/styles.css .btn-on-dark).
        // Under Modern the hero is a light card, so the trigger matches the default variant.
        onDark:
          "border-white/15 bg-white/10 text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/15 focus-visible:border-white/40 focus-visible:ring-[3px] focus-visible:ring-white/25 aria-expanded:border-white/40 aria-expanded:ring-[3px] aria-expanded:ring-white/25 modern:border-input modern:bg-card modern:text-foreground modern:backdrop-blur-none modern:hover:border-border-strong modern:hover:bg-card modern:focus-visible:border-ring modern:focus-visible:ring-ring/50 modern:aria-expanded:border-ring modern:aria-expanded:ring-ring/50",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const chevronVariants = cva(
  "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 transition-[color,rotate] duration-150",
  {
    variants: {
      variant: {
        default: "text-muted-foreground",
        onDark: "text-white/60 modern:text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** Plain text of an option's children (strings, numbers, nested fragments). */
function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf(node.props.children);
  return "";
}

/** `<option>` children (through fragments and arrays) → `{ value, label, hint, disabled }`. */
function parseOptions(children) {
  const items = [];
  const walk = (nodes) =>
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) return walk(child.props.children);
      if (child.type !== "option") return;
      const label = textOf(child.props.children);
      items.push({
        value: String(child.props.value ?? label),
        label,
        hint: child.props.hint ?? null,
        disabled: Boolean(child.props.disabled),
      });
    });
  walk(children);
  return items;
}

const isPrintable = (event) => event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

function Select({
  className,
  variant,
  size,
  disabled,
  children,
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  ...props
}) {
  const items = React.useMemo(() => parseOptions(children), [children]);
  // A native select shows its first option when the value matches none; keep that behavior.
  const selected = items.find((item) => item.value === String(value ?? "")) ?? items[0] ?? null;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeValue, setActiveValue] = React.useState(null);
  // Disabling the trigger while the list is open closes it.
  const expanded = open && !disabled;
  const triggerRef = React.useRef(null);
  const listRef = React.useRef(null);
  const searchRef = React.useRef(null);
  const typeahead = React.useRef({ text: "", at: 0 });
  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const optionId = (index) => `${baseId}-option-${index}`;

  const filterable = items.length > FILTER_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => `${item.label}\n${item.hint ?? ""}`.toLowerCase().includes(needle))
    : items;
  const enabled = visible.filter((item) => !item.disabled);
  const activeIndex = items.findIndex((item) => item.value === activeValue);

  const close = React.useCallback((focusTrigger) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const openList = () => {
    if (disabled || items.length === 0) return;
    setQuery("");
    setActiveValue(selected && !selected.disabled ? selected.value : (items.find((item) => !item.disabled)?.value ?? null));
    setOpen(true);
  };

  const commit = (item) => {
    if (!item || item.disabled) return;
    if (item.value !== String(value ?? "")) {
      const target = { value: item.value, id };
      onChange?.({ target, currentTarget: target });
    }
    close(true);
  };

  const move = (step) => {
    if (enabled.length === 0) return;
    const at = enabled.findIndex((item) => item.value === activeValue);
    const next = at < 0 ? (step > 0 ? 0 : enabled.length - 1) : Math.min(Math.max(at + step, 0), enabled.length - 1);
    setActiveValue(enabled[next].value);
  };

  const jumpTo = (char) => {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > TYPEAHEAD_MS ? char : state.text + char;
    state.at = now;
    const text = state.text.toLowerCase();
    const at = enabled.findIndex((item) => item.value === activeValue);
    const ordered = [...enabled.slice(at + 1), ...enabled.slice(0, at + 1)];
    const match = ordered.find((item) => item.label.toLowerCase().startsWith(text));
    if (match) setActiveValue(match.value);
  };

  // Keys for an expanded list, from the trigger (no filter, or a touch device) or the filter box.
  const onListKeyDown = (event, fromSearch) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        return move(1);
      case "ArrowUp":
        event.preventDefault();
        return move(-1);
      case "Home":
      case "End":
        if (fromSearch) return undefined;
        event.preventDefault();
        return setActiveValue((event.key === "Home" ? enabled[0] : enabled.at(-1))?.value ?? null);
      case "Enter":
        event.preventDefault();
        return commit(items.find((item) => item.value === activeValue));
      case " ":
        if (fromSearch) return undefined;
        event.preventDefault();
        return commit(items.find((item) => item.value === activeValue));
      default:
        if (fromSearch || !isPrintable(event)) return undefined;
        event.preventDefault();
        if (filterable) {
          setQuery((current) => current + event.key);
          searchRef.current?.focus({ preventScroll: true });
          return undefined;
        }
        return jumpTo(event.key);
    }
  };

  const onTriggerKeyDown = (event) => {
    if (expanded) return onListKeyDown(event, false);
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
    return undefined;
  };

  // Position the fixed list against the trigger; written straight to the element's style because
  // the numbers change on every scroll frame (and the house rule keeps style props out of JSX).
  const position = React.useCallback(() => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    list.style.minWidth = `${rect.width}px`;
    const natural = Math.min(list.scrollHeight, LIST_MAX_PX);
    const below = viewportHeight - rect.bottom - GAP_PX - EDGE_PX;
    const above = rect.top - GAP_PX - EDGE_PX;
    const upward = below < natural && above > below;
    list.dataset.side = upward ? "top" : "bottom";
    list.style.maxHeight = `${Math.max(Math.min(LIST_MAX_PX, upward ? above : below), 96)}px`;
    list.style.top = upward ? "" : `${rect.bottom + GAP_PX}px`;
    list.style.bottom = upward ? `${viewportHeight - rect.top + GAP_PX}px` : "";
    const left = Math.min(rect.left, viewportWidth - list.offsetWidth - EDGE_PX);
    list.style.left = `${Math.max(left, EDGE_PX)}px`;
  }, []);

  React.useLayoutEffect(() => {
    if (expanded) position();
  }, [expanded, position, visible.length]);

  React.useEffect(() => {
    if (!expanded) return undefined;
    const onScrollOrResize = (event) => {
      if (event.type === "scroll" && listRef.current?.contains(event.target)) return;
      position();
    };
    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      close(false);
    };
    // Capture on window runs before any document listener — notably the Dialog's Escape/Tab trap.
    const onKeyDownCapture = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === "Tab") {
        const inSearch = searchRef.current && searchRef.current === document.activeElement;
        if (inSearch) {
          event.preventDefault();
          event.stopPropagation();
        }
        close(inSearch);
      }
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDownCapture, true);
    if (filterable && window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDownCapture, true);
    };
  }, [expanded, filterable, position, close]);

  React.useEffect(() => {
    if (expanded && activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // optionId is derived from the stable baseId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, activeIndex]);

  const activeDescendant = expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  return (
    <div className="group relative">
      <button
        {...props}
        ref={triggerRef}
        type="button"
        id={id}
        data-slot="select"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={activeDescendant}
        disabled={disabled}
        onClick={() => (expanded ? close(true) : openList())}
        onKeyDown={onTriggerKeyDown}
        className={cn(selectVariants({ variant, size, className }))}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ""}</span>
      </button>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          chevronVariants({ variant }),
          size === "sm" && "right-2 size-3.5",
          expanded && "rotate-180",
          !disabled && "group-hover:text-foreground group-focus-within:text-foreground",
          variant === "onDark" &&
            !disabled &&
            "group-hover:text-white group-focus-within:text-white modern:group-hover:text-foreground modern:group-focus-within:text-foreground",
          disabled && "opacity-50",
        )}
      />
      {expanded &&
        createPortal(
          <div
            ref={listRef}
            data-slot="select-list"
            className="select-pop fixed z-60 flex max-w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
          >
            {filterable && (
              <div className="flex shrink-0 items-center gap-2 border-b px-2.5">
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    const needleNext = event.target.value.trim().toLowerCase();
                    const first = items.find(
                      (item) =>
                        !item.disabled && `${item.label}\n${item.hint ?? ""}`.toLowerCase().includes(needleNext),
                    );
                    setActiveValue(first?.value ?? null);
                  }}
                  onKeyDown={(event) => onListKeyDown(event, true)}
                  placeholder="Filter…"
                  aria-label={ariaLabel ? `Filter ${ariaLabel}` : "Filter options"}
                  aria-controls={listId}
                  aria-activedescendant={activeDescendant}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}
            <ul
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
            >
              {visible.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">No matches</li>}
              {visible.map((item) => {
                const index = items.indexOf(item);
                const isSelected = item === selected;
                return (
                  <li
                    key={`${index}-${item.value}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={item.disabled || undefined}
                    onPointerMove={() => !item.disabled && setActiveValue(item.value)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commit(item)}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm pointer-coarse:py-2.5",
                      item.value === activeValue && !item.disabled && "bg-accent text-accent-foreground",
                      item.disabled && "cursor-not-allowed opacity-45",
                    )}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn("mt-0.5 size-3.5 shrink-0 text-primary", !isSelected && "invisible")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", isSelected && "font-medium")}>{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

export { Select };
