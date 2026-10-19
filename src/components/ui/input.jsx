import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  default: "h-9 px-3 text-sm",
  sm: "h-8 px-2.5 text-[13px]",
};

function Input({ className, type = "text", size = "default", ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex w-full rounded-md border border-input bg-background py-1 shadow-xs transition-colors",
        SIZES[size] ?? SIZES.default,
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
