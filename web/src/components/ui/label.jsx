import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }) {
  return (
    <label
      data-slot="label"
      className={cn("text-sm font-medium leading-none text-foreground", className)}
      {...props}
    />
  );
}

export { Label };
