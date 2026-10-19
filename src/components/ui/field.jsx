import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Form row + section eyebrow (dialog-redesign.md). Dialogs had three different eyebrow styles and
 * re-typed the label → control → hint stack by hand in every form; these are the one version.
 */

/** Small uppercase label that heads a group of controls. Renders a `<legend>` inside a fieldset. */
function SectionLabel({ as: Component = "p", className, ...props }) {
  return (
    <Component
      className={cn(
        "text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Label, control, then an optional hint or error. With `htmlFor` the label is a real `<label>`;
 * for a group of controls (radio cards, chips) omit it and the label becomes a `<legend>` of a
 * fieldset, so the group is still named for assistive tech.
 */
function Field({ label, htmlFor, hint, error, eyebrow = false, className, children }) {
  const labelClass = eyebrow
    ? "text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
    : "text-sm font-medium text-foreground";
  const footnote = error ? (
    <p className="text-xs font-medium text-danger-strong">{error}</p>
  ) : hint ? (
    <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
  ) : null;

  if (htmlFor || !label) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label htmlFor={htmlFor} className={cn("leading-none", labelClass)}>
            {label}
          </label>
        )}
        {children}
        {footnote}
      </div>
    );
  }
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <legend className={cn("mb-1.5 leading-none", labelClass)}>{label}</legend>
      {children}
      {footnote}
    </fieldset>
  );
}

export { Field, SectionLabel };
