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
 * Keyboard shortcuts between the main views: `]` next view, `[` previous view (menu order, wraps
 * around), `g` then a number goes to that view. Not while typing, not with Ctrl / Alt / Meta (Alt+←
 * is the browser's Back and Alt+number switches tabs), and off in the players.
 */
export function useViewShortcuts(views: NavView[], current: number, enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || views.length < 2) return;
    let awaitingNumber = false;
    let timer: number | undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || isTyping(event.target)) return;
      if (awaitingNumber) {
        awaitingNumber = false;
        window.clearTimeout(timer);
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < views.length) {
          event.preventDefault();
          router.push(views[index].href);
        }
        return;
      }
      if (event.key === "g") {
        awaitingNumber = true;
        timer = window.setTimeout(() => (awaitingNumber = false), 1500);
        return;
      }
      const { previous, next } = neighbourViews(views, current);
      if (event.key === "]" && next) {
        event.preventDefault();
        router.push(next.href);
      } else if (event.key === "[" && previous) {
        event.preventDefault();
        router.push(previous.href);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [views, current, enabled, router]);
}
