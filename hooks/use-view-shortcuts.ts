"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { neighbourViews, type NavView } from "@/components/nav-views";

/** Typing in a field (or an editable area) never triggers a view shortcut. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Keyboard shortcuts between the main views: Shift+↓ next view, Shift+↑ previous view (menu order,
 * wraps around). Not while typing, not with Ctrl / Alt / Meta, and off in the players.
 */
export function useViewShortcuts(views: NavView[], current: number, enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || views.length < 2) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || isTyping(event.target)) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const { previous, next } = neighbourViews(views, current);
      const target = event.key === "ArrowDown" ? next : previous;
      if (!target) return;
      // Shift+arrow would otherwise extend a text selection on the page.
      event.preventDefault();
      router.push(target.href);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [views, current, enabled, router]);
}
