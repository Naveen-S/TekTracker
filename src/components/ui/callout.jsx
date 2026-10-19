import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline notice box (dialog-redesign.md). Replaces five hand-copied variants that had drifted apart
 * in padding, border strength and text size. One size, four tones, an icon that says the tone
 * without relying on colour alone, and an optional bold `title` line.
 */
const TONES = {
  info: { icon: Info, box: "border-info/20 bg-info-soft text-info-strong" },
  success: { icon: CheckCircle2, box: "border-success/25 bg-success-soft text-success-strong" },
  warn: { icon: AlertTriangle, box: "border-warn/30 bg-warn-soft text-warn-strong" },
  danger: { icon: AlertTriangle, box: "border-danger/25 bg-danger-soft text-danger-strong" },
  neutral: { icon: Info, box: "border-border-subtle bg-subtle text-muted-foreground" },
};

function Callout({ tone = "info", title, icon, className, children, ...props }) {
  const config = TONES[tone] ?? TONES.info;
  const Icon = icon ?? config.icon;
  return (
    <div
      data-slot="callout"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
        config.box,
        className,
      )}
      {...props}
    >
      <Icon className="mt-[3px] size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export { Callout };
