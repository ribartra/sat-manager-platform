"use client";

import { useEffect, useRef } from "react";

export interface PlayerShortcutHandlers {
  /** ← previous question. */
  onPrevious?: () => void;
  /** → next question. */
  onNext?: () => void;
  /** A–D (or 1–4) picks that choice in multiple-choice questions. */
  onChoose?: (label: string) => void;
  /** M toggles "Mark for review". */
  onMark?: () => void;
  /** Labels the current question offers (only those keys act). */
  choiceLabels?: string[];
}

const CHOICE_BY_DIGIT: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" };

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Keyboard shortcuts for the Practice and Exam players (RNF-25): ←/→ navigate, A–D or 1–4 choose,
 * M marks for review. Ignored while typing (answers, notes), with modifier keys, or while a
 * dialog (navigator, confirmations, calculator) is open, so they never fight native keyboard use.
 */
export function usePlayerShortcuts(handlers: PlayerShortcutHandlers, enabled = true) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const h = ref.current;
      const key = event.key;

      if (key === "ArrowLeft" && h.onPrevious) {
        event.preventDefault();
        h.onPrevious();
        return;
      }
      if (key === "ArrowRight" && h.onNext) {
        event.preventDefault();
        h.onNext();
        return;
      }
      if ((key === "m" || key === "M") && h.onMark) {
        event.preventDefault();
        h.onMark();
        return;
      }
      if (h.onChoose && h.choiceLabels?.length) {
        const label = CHOICE_BY_DIGIT[key] ?? (key.length === 1 ? key.toUpperCase() : "");
        if (label && h.choiceLabels.includes(label)) {
          event.preventDefault();
          h.onChoose(label);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
