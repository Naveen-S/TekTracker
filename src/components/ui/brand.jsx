/**
 * StoryBoard brand (brand-logo-tagline.md): the Concept-A "Jigsaw" mark, the two-tone wordmark and
 * the tagline. Each scrum team is a piece; the white piece is the one leadership never used to see.
 *
 * The mark's colours are FIXED — it is the product mark, not a themed accent. Only the wordmark's
 * "Board" follows the active theme (`primary`, or `on-ink-accent` on the ink surfaces).
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

export const BRAND_TAGLINE = "Every piece. One picture.";

const PIECE = 46.5;
const FAR = 100 - PIECE;
const MID = PIECE / 2;

// Piece order: top-left, top-right, bottom-left, bottom-right.
const PIECES = [
  [0, 0],
  [FAR, 0],
  [0, FAR],
  [FAR, FAR],
];

// Each knob leaves its own piece across the gap and bites into the neighbour:
// [piece, neighbour it bites into, cx, cy].
const KNOBS = [
  [0, 1, FAR + 2.5, MID], // top-left → right into top-right
  [1, 3, FAR + MID, FAR + 2.5], // top-right → down into bottom-right
  [2, 0, MID, PIECE - 2.5], // bottom-left → up into top-left
  [3, 2, PIECE - 2.5, FAR + MID], // bottom-right → left into bottom-left
];

// Loader choreography (brand-logo-tagline.md, "Loader"): each piece flies in from its own corner,
// top-left → bottom-left → bottom-right, and the white top-right piece — the one leadership never
// used to see — clicks into place last.
const FLY_FROM = [
  [-12, -12],
  [12, -12],
  [-12, 12],
  [12, 12],
];
const ARRIVAL_ORDER = [0, 3, 1, 2];

const PALETTES = {
  dark: ["#00bfa5", "#f4f7fa", "#5ee6d3", "#0f8a7a"],
  light: ["#00bfa5", "#0b1620", "#5ee6d3", "#0f8a7a"],
  tile: ["#ffffff", "#0b1620", "#e6fbf7", "#c8f2ec"],
};
const TILE_FILL = "#00a896";

/**
 * The four-piece mark as an inline SVG. `tone` picks the palette for the surface it sits on
 * ("dark" = ink, "light" = card); `tile` draws the rounded teal app-icon tile around it.
 *
 * Each piece is ONE group — its rect, its outgoing neck + knob — and its rect is masked by its own
 * incoming socket (a transparent ring cut, never a painted circle, so the mark sits on any
 * background). Because the socket travels with its piece, the pieces can move independently:
 * `animated` hands each group its fly-in vector and arrival slot for the `.jigsaw-piece` keyframes.
 */
export function BrandMark({ tone = "dark", tile = false, animated = false, className, title }) {
  const fills = PALETTES[tile ? "tile" : tone];
  const cutId = `sb-cut-${useId().replace(/[^\w-]/g, "")}`;

  const pieces = PIECES.map(([x, y], index) => {
    const [, , socketX, socketY] = KNOBS.find(([, into]) => into === index);
    const [, , cx, cy] = KNOBS[index];
    const horizontal = cy === y + MID;
    const maskId = `${cutId}-${index}`;
    const motion = animated
      ? {
          className: "jigsaw-piece",
          style: {
            "--dx": `${FLY_FROM[index][0]}px`,
            "--dy": `${FLY_FROM[index][1]}px`,
            "--i": ARRIVAL_ORDER[index],
          },
        }
      : {};
    return (
      <g key={index} fill={fills[index]} {...motion}>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={100} height={100}>
          <rect width={100} height={100} fill="#fff" />
          <circle cx={socketX} cy={socketY} r={9.5} fill="#000" />
        </mask>
        <rect x={x} y={y} width={PIECE} height={PIECE} rx={8} mask={`url(#${maskId})`} />
        {horizontal ? (
          <rect x={Math.min(cx, x + MID)} y={cy - 3} width={Math.abs(cx - (x + MID))} height={6} />
        ) : (
          <rect x={cx - 3} y={Math.min(cy, y + MID)} width={6} height={Math.abs(cy - (y + MID))} />
        )}
        <circle cx={cx} cy={cy} r={6} />
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {tile ? (
        <>
          <rect width={100} height={100} rx={22} fill={TILE_FILL} />
          <g transform="translate(20 20) scale(0.6)">{pieces}</g>
        </>
      ) : (
        pieces
      )}
    </svg>
  );
}

/**
 * The brand loader: the mark assembling itself on a loop. Reserved for the long-wait tier (the
 * PageLoader veil, the AI digest) — button waits keep the ring `Spinner`, where the knobs would be
 * sub-pixel. Decorative: callers carry the `role="status"` and the label.
 *
 * Three layers, so no frame is ever empty: a faint GHOST of the finished picture that never moves,
 * the animated pieces snapping into it, and (`glow`) a teal halo that blooms behind the mark as the
 * white piece lands — the one picture, lit.
 */
export function BrandLoader({ tone = "dark", glow = false, className }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} aria-hidden="true">
      {glow && <span className="jigsaw-halo absolute -inset-1/2 rounded-full" />}
      <BrandMark tone={tone} className="absolute inset-0 size-full opacity-15" />
      <BrandMark
        animated
        tone={tone}
        className={cn("jigsaw-loader absolute inset-0 size-full", glow && "jigsaw-lift")}
      />
    </span>
  );
}

/** "Story" + accent "Board". `onInk` switches the accent to the ink-surface tint. */
export function Wordmark({ onInk = false, className }) {
  return (
    <span className={cn("font-display font-bold tracking-tight", className)}>
      Story<span className={onInk ? "text-on-ink-accent" : "text-primary"}>Board</span>
    </span>
  );
}

export function BrandTagline({ className }) {
  return <span className={cn("font-tagline italic", className)}>{BRAND_TAGLINE}</span>;
}
