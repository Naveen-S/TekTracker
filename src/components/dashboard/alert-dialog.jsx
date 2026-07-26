"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** App-level alert modal (port of AppAlertModal) — sync summaries render multiline. */
export function AlertDialog({ alert, onClose }) {
  if (!alert) return null;
  return (
    <Dialog
      open
      title={alert.title}
      tone={alert.tone === "error" ? "error" : "success"}
      onClose={onClose}
      size="sm"
      footer={<Button onClick={onClose}>OK</Button>}
    >
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed",
          alert.tone === "error" ? "text-danger-strong" : "text-foreground",
        )}
      >
        {alert.body}
      </p>
    </Dialog>
  );
}
