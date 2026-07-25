/**
 * Smooth SVG paths for the hand-rolled charts (no charting dependency — trend-panel + bug-charts).
 * Monotone cubic interpolation (Fritsch–Carlson): a smooth curve through the points that NEVER
 * overshoots beyond the data, so a burndown can't dip below a measured value or invent a bump — the
 * honest way to smooth a time series. Pure + deterministic (SSR-safe); inputs are screen points.
 */
const r = (value) => Math.round(value * 100) / 100;

/** @param {{x:number,y:number}[]} pts @returns {string} an SVG path `d` (M … C …). */
export function smoothLinePath(pts) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  if (n === 2) return `M ${r(pts[0].x)} ${r(pts[0].y)} L ${r(pts[1].x)} ${r(pts[1].y)}`;

  // Secant slopes between consecutive points.
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = dx[i] !== 0 ? (pts[i + 1].y - pts[i].y) / dx[i] : 0;
  }

  // Tangents: endpoints take the adjacent secant; interior points average, or flatten at extrema.
  const m = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  // Fritsch–Carlson: clamp tangents into the circle of radius 3 to guarantee monotonicity.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const cp1x = pts[i].x + h;
    const cp1y = pts[i].y + m[i] * h;
    const cp2x = pts[i + 1].x - h;
    const cp2y = pts[i + 1].y - m[i + 1] * h;
    d += ` C ${r(cp1x)} ${r(cp1y)} ${r(cp2x)} ${r(cp2y)} ${r(pts[i + 1].x)} ${r(pts[i + 1].y)}`;
  }
  return d;
}

/** Same curve, closed down to `baselineY` for a gradient area fill. */
export function smoothAreaPath(pts, baselineY) {
  if (pts.length < 2) return "";
  return `${smoothLinePath(pts)} L ${r(pts[pts.length - 1].x)} ${r(baselineY)} L ${r(pts[0].x)} ${r(baselineY)} Z`;
}
