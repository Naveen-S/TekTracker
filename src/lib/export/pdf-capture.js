/**
 * Shared html2canvas-pro -> jsPDF capture helpers for the app's leadership PDF exports.
 *
 * Every export renders fixed A4 sheets offscreen, rasterizes each to a lossless PNG at
 * PDF_CAPTURE_SCALE, and (for the PDF path) re-projects every real `<a href>` on the sheet to a
 * transparent `pdf.link()` annotation via getBoundingClientRect px->mm, so the flattened image
 * keeps clickable links. Geometry (px + mm) comes from print-theme.mjs (LANDSCAPE / PORTRAIT).
 * html2canvas-pro and jsPDF are dynamic-imported by the callers so they stay out of the initial
 * client bundle.
 */
import { PDF_CAPTURE_SCALE } from "@/lib/export/print-theme.mjs";

/** Slugify a value for a filename segment, falling back when it reduces to nothing. */
export function safeFilePart(value, fallback) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

/** `YYYY-MM-DD_HHMM` stamp so same-day exports don't collide as "(1)", "(2)", … */
export function fileStamp(date = new Date()) {
  return `${date.toISOString().split("T")[0]}_${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * html2canvas-pro options for a fixed A4 sheet. `onclone` waits on webfonts so text metrics in the
 * cloned iframe come from the real (static-weight) faces, not the fallback — baselines/line breaks
 * would otherwise drift in the capture.
 */
export function captureOptions(geometry) {
  return {
    scale: PDF_CAPTURE_SCALE,
    logging: false,
    backgroundColor: "#ffffff",
    width: geometry.widthPx,
    height: geometry.heightPx,
    windowWidth: geometry.widthPx,
    windowHeight: geometry.heightPx,
    onclone: (clonedDoc) => clonedDoc.fonts.ready,
  };
}

/** Encode a captured canvas as raw PNG bytes for jsPDF.addImage. */
export function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("The high-resolution PDF page could not be encoded."));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

/** Overlay transparent jsPDF link annotations over every `<a href>` on the just-added page image. */
export function overlayLinks(pdf, pageEl, geometry) {
  const pageRect = pageEl.getBoundingClientRect();
  const xToMm = geometry.widthMm / pageRect.width;
  const yToMm = geometry.heightMm / pageRect.height;

  for (const anchor of pageEl.querySelectorAll("a[href]")) {
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(0, rect.left - pageRect.left);
    const top = Math.max(0, rect.top - pageRect.top);
    const right = Math.min(pageRect.width, rect.right - pageRect.left);
    const bottom = Math.min(pageRect.height, rect.bottom - pageRect.top);
    if (right <= left || bottom <= top) continue;
    pdf.link(left * xToMm, top * yToMm, (right - left) * xToMm, (bottom - top) * yToMm, {
      url: anchor.href,
    });
  }
}
