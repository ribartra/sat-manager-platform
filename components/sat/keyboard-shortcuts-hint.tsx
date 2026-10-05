"use client";

import { Keyboard } from "lucide-react";
import { Hint } from "@/components/hint";
import { usePlayerShortcuts, type PlayerShortcutHandlers } from "@/hooks/use-player-shortcuts";

/** Visible, focusable summary of the player keyboard shortcuts (usePlayerShortcuts). */
export function KeyboardShortcutsHint({ choices = true }: { choices?: boolean }) {
  const label = [
    "← / → go back / next",
    choices ? "A–D or 1–4 choose an answer" : null,
    "M mark for review",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Hint label={`Keyboard shortcuts: ${label}`}>
      <button
        type="button"
        aria-label={`Keyboard shortcuts: ${label}`}
        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <Keyboard size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>
    </Hint>
  );
}

/** Render-less wrapper so players can declare shortcuts after their early returns. */
export function PlayerShortcuts(props: PlayerShortcutHandlers & { enabled?: boolean }) {
  const { enabled = true, ...handlers } = props;
  usePlayerShortcuts(handlers, enabled);
  return null;
}
