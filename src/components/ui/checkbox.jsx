import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Styled checkbox (no radix — matches Select's "native input, custom visual" approach). A native
 * `<input type="checkbox">` stays the real control (keyboard, touch, form semantics, screen
 * readers); a `peer` + sibling box render the checked/hover/focus visuals on top so it never falls
 * back to the browser's default OS widget, which was the only bare, unstyled control left in the
 * kit. Disabled dims the whole control via `has-[:disabled]` on the wrapper, since `peer-disabled`
 * on two separate sibling layers (box + check) would otherwise fight each other's opacity.
 */
function Checkbox({ className, wrapperClassName, disabled, ...props }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-4 shrink-0 items-center justify-center has-[:disabled]:opacity-50",
        wrapperClassName,
      )}
    >
      <input
        type="checkbox"
        data-slot="checkbox"
        disabled={disabled}
        className={cn(
          "peer absolute inset-0 m-0 size-4 cursor-pointer appearance-none disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[5px] border border-input bg-background shadow-xs transition-colors peer-hover:border-border-strong peer-checked:border-primary peer-checked:bg-primary peer-checked:peer-hover:border-primary peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
      />
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="pointer-events-none absolute size-2.5 scale-50 text-primary-foreground opacity-0 transition-all duration-150 peer-checked:scale-100 peer-checked:opacity-100"
      />
    </span>
  );
}

export { Checkbox };
