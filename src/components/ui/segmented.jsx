"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control — a pill track of mutually exclusive options (dialog-redesign.md). For a short
 * either/or choice where radio cards would be too heavy (Filter ID vs JQL, report variant).
 * `role="radiogroup"` with roving tabindex and arrow-key navigation, like native radios.
 *
 * @param {{ options: { value: string, label: React.ReactNode, disabled?: boolean, title?: string }[],
 *   value: string, onChange: (value: string) => void, disabled?: boolean, size?: "sm" | "default",
 *   className?: string, "aria-label"?: string }} props
 */
function Segmented({ options, value, onChange, disabled, size = "default", className, ...props }) {
  const refs = React.useRef([]);
  const enabled = options.filter((option) => !option.disabled);

  const move = (step) => {
    const index = enabled.findIndex((option) => option.value === value);
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-lg bg-muted p-0.5",
        disabled && "opacity-60",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
      {...props}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={option.title}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-ink/[0.06]"
                : "text-muted-foreground hover:text-foreground",
              option.disabled && "opacity-45",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { Segmented };
