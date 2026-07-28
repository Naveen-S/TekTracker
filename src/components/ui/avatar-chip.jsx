/**
 * Shared initials-avatar chip (leaderboard.md) — extracted from the 3 copy-pasted inline circles
 * in `top-bar.jsx`/`bugs-top-bar.jsx`/`rollup-top-bar.jsx` since the leaderboard needs the same
 * chip in bulk, for a whole ranked list. No avatar IMAGES exist for Jira assignees (only
 * `assigneeName`) — this is always initials-only, never a photo.
 */
import { cn, initials } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-11 text-base",
};

/**
 * @param {{ name: string, title?: string, size?: "sm"|"md"|"lg", className?: string }} props
 */
export function AvatarChip({ name, title, size = "sm", className }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-ink font-bold text-white",
        SIZES[size] ?? SIZES.sm,
        className,
      )}
      title={title ?? name}
    >
      {initials(name)}
    </div>
  );
}
