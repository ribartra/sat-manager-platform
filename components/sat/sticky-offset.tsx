"use client";

import { useEffect, useRef } from "react";

/**
 * Inside a sticky FilterBar: keeps `--list-head-top` (on <html>) equal to the bar's bottom edge, so
 * table headers (SimpleTable / DataTable) stick right under it whatever its height.
 */
export function StickyOffset() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const bar = ref.current?.closest<HTMLElement>("[data-filter-bar]");
    if (!bar) return;
    const root = document.documentElement;
    const update = () => {
      const top = Number.parseFloat(getComputedStyle(bar).top) || 0;
      // Only while the bar sticks (md and up); on mobile it scrolls away.
      root.style.setProperty("--list-head-top", getComputedStyle(bar).position === "sticky" ? `${Math.round(bar.offsetHeight + top)}px` : "0px");
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--list-head-top");
    };
  }, []);
  return <span ref={ref} hidden />;
}
