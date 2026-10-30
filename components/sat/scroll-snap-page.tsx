"use client";

import { useEffect } from "react";

/**
 * Turns on vertical scroll snapping for the whole page while it is shown: a firm scroll (or the
 * arrow keys) settles on the next `snap-start` section (Home: Overview, then Students).
 */
export function ScrollSnapPage() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollSnapType;
    root.style.scrollSnapType = "y proximity";
    return () => {
      root.style.scrollSnapType = previous;
    };
  }, []);
  return null;
}
