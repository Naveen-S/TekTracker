"use client";

/**
 * One Support POC on a team card (support-oncall.md (f)): name + area, then the actions Support
 * reaches for — `tel:` first (the phone is the main action on a phone), `mailto:`, and a copy
 * button that puts "Name · phone · email" on the clipboard for a PagerDuty or Slack paste.
 */
import { useEffect, useRef, useState } from "react";
import { Mail, Phone, Star } from "lucide-react";
import { CopyStateIcon } from "@/components/ui/copy-state-icon";
import { cn } from "@/lib/utils";

const COPIED_MS = 1600;

/** Dial string for `tel:` — keep only digits and a leading +. */
const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, "")}`;

export function PocContact({ poc, primary = false }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        [poc.displayName, poc.phone, poc.email].filter(Boolean).join(" · "),
      );
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions) — the visible links still work.
    }
  };

  const action =
    "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg px-3 py-2.5",
        primary ? "bg-accent/60 ring-1 ring-primary/20" : "bg-subtle",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {primary && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground uppercase modern:bg-linear-to-r modern:from-grad-start modern:to-grad-end">
            <Star className="size-3 fill-current" aria-hidden="true" />
            Primary
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{poc.displayName}</span>
        {poc.area && (
          <span className="rounded-md border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
            {poc.area}
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          className={cn(action, "-my-1 -mr-2 ml-auto")}
          aria-label={`Copy ${poc.displayName}'s contact details`}
          title="Copy name, phone and email"
        >
          <CopyStateIcon copied={copied} />
          <span className="sr-only sm:not-sr-only" aria-live="polite">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      <div className="-mx-2 flex flex-wrap items-center gap-x-1">
        {poc.phone && (
          <a href={telHref(poc.phone)} className={cn(action, "text-foreground tabular-nums")}>
            <Phone className="size-3.5" aria-hidden="true" />
            {poc.phone}
          </a>
        )}
        <a href={`mailto:${poc.email}`} className={cn(action, "min-w-0")} title={poc.email}>
          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{poc.email}</span>
        </a>
      </div>
    </div>
  );
}
