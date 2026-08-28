/**
 * Shared print/PDF design tokens for every leadership export in the app.
 *
 * Deliberately decoupled from the app's theme CSS variables: these are captured light-mode
 * surfaces (html2canvas -> jsPDF) that must render identically regardless of the viewer's active
 * theme (Tekion / Modern / dark). The palette is the /bugs "Executive Bug Report" system — Inter
 * typography, navy/slate neutrals, and a blue -> purple -> magenta accent family with cyan/orange/
 * green supporting hues — lifted here so the sprint export and any future export share one look.
 */

export const INK = "#0f172a"; // slate-900, primary text
export const BLUE = "#2563eb"; // blue-600, info
export const PURPLE = "#7c3aed"; // violet-600, brand eyebrow / section accent
export const RED = "#e11d48"; // rose-600, danger / past-SLA
export const CYAN = "#06b6d4"; // cyan-500, "open" series
export const ORANGE = "#f97316"; // orange-500, warn
export const GREEN = "#16a34a"; // green-600, positive
export const SOFT = "#f5f7fb"; // panel / soft fill

export const ACCENT_GRADIENT = "linear-gradient(90deg, #2563eb 0%, #7c3aed 52%, #e11d48 100%)";

/** KpiBox tone: colored top border + soft tint + numeral color. */
export const KPI_TONES = {
  ink: { borderColor: INK, backgroundColor: SOFT, color: INK },
  danger: { borderColor: RED, backgroundColor: "#fff1f2", color: RED },
  warn: { borderColor: ORANGE, backgroundColor: "#fff7ed", color: "#c2410c" },
  info: { borderColor: BLUE, backgroundColor: "#eff6ff", color: BLUE },
  positive: { borderColor: GREEN, backgroundColor: "#f0fdf4", color: GREEN },
};

/** ExecutiveReadout tone: left-border accent + tint. */
export const READOUT_TONES = {
  neutral: { borderColor: PURPLE, backgroundColor: "#f5f3ff" },
  warn: { borderColor: ORANGE, backgroundColor: "#fff7ed" },
  danger: { borderColor: RED, backgroundColor: "#fff1f2" },
  info: { borderColor: BLUE, backgroundColor: "#eff6ff" },
  positive: { borderColor: GREEN, backgroundColor: "#f0fdf4" },
};

/**
 * A4 page geometry. Both orientations share the same px->mm ratio (~0.264 mm/px at 96dpi), so the
 * same type scale renders at the same physical size in portrait and landscape.
 */
export const LANDSCAPE = { widthPx: 1123, heightPx: 794, widthMm: 297, heightMm: 210 };
export const PORTRAIT = { widthPx: 794, heightPx: 1123, widthMm: 210, heightMm: 297 };

/** 3x capture -> ~288 DPI lossless PNG pages. */
export const PDF_CAPTURE_SCALE = 3;

/**
 * The four work-type composition colours for print (rollup-export.md).
 *
 * Reuses the exact mapping the sprint export's "Work composition" panel already ships (info / warn /
 * danger / neutral tones), so the roll-up and sprint PDFs agree by construction. Deliberately NOT
 * the on-ink `--on-ink-cat-*` palette: that one is tuned for a dark surface and flips with the
 * active theme, while a print sheet is white and must render identically for every viewer. The
 * app's "solid = planned, hatch = reactive bug" texture grammar is likewise not carried over — the
 * hatch utilities colour-mix against `--ink` and are simply wrong on white, and these four hues are
 * far enough apart on paper that texture is not load-bearing for colour-vision deficiency here.
 */
export const WORK_TYPE_PRINT = [
  { key: "committed", label: "Roadmap", color: BLUE, soft: "#eff6ff" },
  { key: "techDebt", label: "Tech Debt", color: ORANGE, soft: "#fff7ed" },
  { key: "external", label: "External Bugs", color: RED, soft: "#fff1f2" },
  { key: "internal", label: "Internal Bugs", color: PURPLE, soft: "#f5f3ff" },
];
