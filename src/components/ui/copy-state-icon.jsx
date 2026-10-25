import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The copy button's icon: the copy glyph shrinks away as a check grows in, and back when the
 * "Copied" state lapses — a click-toggle in the spirit of useanimations.com, done as a 150ms
 * cross-fade of two lucide icons rather than a Lottie dependency. Opacity only under reduced motion.
 */
export function CopyStateIcon({ copied }) {
  const layer =
    "col-start-1 row-start-1 size-4 transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-opacity";
  return (
    <span className="inline-grid shrink-0 place-items-center" aria-hidden="true">
      <Copy className={cn(layer, copied ? "scale-50 opacity-0" : "opacity-100")} />
      <Check className={cn(layer, "text-success", copied ? "opacity-100" : "scale-50 opacity-0")} />
    </span>
  );
}
