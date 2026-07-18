"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 3000;

/**
 * Non-blocking success feedback (ui-polish.md decision 5) — port of the legacy .share-toast
 * (src/styles.css :169-177): ink pill bottom-right, rises in, fades out on its own (~3s, the
 * `animate-toast` chain in globals.css). Errors stay in the AlertDialog; this never blocks.
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message) => {
    if (timer.current) clearTimeout(timer.current);
    // New key per message so a re-trigger restarts the CSS animation.
    setToast({ key: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  return [toast, showToast];
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      key={toast.key}
      role="status"
      className="pointer-events-none fixed right-6 bottom-6 z-60 animate-toast rounded-lg bg-ink px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg"
    >
      {toast.message}
    </div>
  );
}
