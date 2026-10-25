"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MODERN_FAVICON } from "@/lib/theme-favicon";

/**
 * Points every SVG favicon link at the active theme's icon. The Tekion href is whatever Next's
 * `app/icon.svg` convention emitted (with its cache-busting query), remembered on the element the
 * first time so switching back restores it exactly. Safari ignores SVG favicons and keeps the teal
 * `favicon.ico` in both themes.
 */
function syncFavicon() {
  const modern = document.documentElement.classList.contains("theme-modern");
  for (const link of document.querySelectorAll('link[rel~="icon"][type="image/svg+xml"]')) {
    link.dataset.tekionHref ??= link.getAttribute("href");
    const href = modern ? MODERN_FAVICON : link.dataset.tekionHref;
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }
}

/**
 * Keeps the tab icon in step with the theme. The boot script in layout.jsx swaps it before first
 * paint when the link is already in <head>; this covers the rest. It watches two things:
 *  - the `theme-modern` class on <html>, so the theme toggle needs no wiring;
 *  - icon links ADDED to <head>. Metadata can stream in after the boot script, and on a Modern load
 *    React's hydration inserts a fresh `icon.svg` link because the boot script already re-pointed
 *    the one it expected (React matches hoisted links by href).
 */
export function ThemeFavicon() {
  const pathname = usePathname();

  useEffect(() => {
    syncFavicon();
  }, [pathname]);

  useEffect(() => {
    const observer = new MutationObserver(syncFavicon);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
