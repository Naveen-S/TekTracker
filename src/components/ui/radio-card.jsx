import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Selectable card, one of a group (dialog-redesign.md). The native radio stays the real control —
 * keyboard arrows, form semantics, screen readers — visually hidden behind a drawn indicator, the
 * same "native input, custom visual" approach as Checkbox and Select. Replaces the duplicated
 * radio-card markup that sat on bare browser radios in the filter and share dialogs.
 */
function RadioCardGroup({ className, columns = 2, ...props }) {
  return (
    <div
      role="radiogroup"
      className={cn("grid gap-2", columns === 2 ? "sm:grid-cols-2" : "grid-cols-1", className)}
      {...props}
    />
  );
}

function RadioCard({ name, value, checked, onChange, disabled, title, description, icon: Icon }) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-150",
        "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
        checked
          ? "border-primary bg-accent/50 shadow-[inset_0_0_0_1px_var(--primary)]"
          : "border-border hover:border-border-strong hover:bg-subtle",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border bg-background transition-colors",
          checked ? "border-primary" : "border-input group-hover:border-border-strong",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full bg-primary transition-transform duration-150",
            checked ? "scale-100" : "scale-0",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {Icon && <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export { RadioCard, RadioCardGroup };
