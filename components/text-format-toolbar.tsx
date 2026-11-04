"use client";

import { useEffect, useState, type RefObject } from "react";
import { Bold, Underline } from "lucide-react";
import { textFormatState, wrapTextFormat } from "@/lib/math-text";
import { cn } from "@/lib/utils";

type TextAreaLike = HTMLTextAreaElement | HTMLInputElement;

const PRESSED = "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100";

interface TextFormatToolbarProps {
  /** Ref to the textarea/input that holds the editable value. */
  inputRef?: RefObject<TextAreaLike | null>;
  /** Alternate resolver when refs are stored in a map. */
  getInput?: () => TextAreaLike | null;
  value: string;
  onChange: (next: string) => void;
  /** Optional extra controls rendered after Bold/Underline (e.g. Formula). */
  children?: React.ReactNode;
  className?: string;
  /** Compact icon-only buttons. */
  size?: "sm" | "md";
}

/**
 * Bold / Underline for question text fields, like a word processor: each button toggles (pressing it
 * again removes the format), it shows as pressed where the caret / selection is formatted, and
 * Ctrl/⌘+B / Ctrl/⌘+U do the same. Prose → **…** / ++…++; inside math tokens → \textbf{…} / \underline{…}.
 */
export function TextFormatToolbar({
  inputRef,
  getInput,
  value,
  onChange,
  children,
  className,
  size = "sm",
}: TextFormatToolbarProps) {
  function resolveInput() {
    return getInput?.() ?? inputRef?.current ?? null;
  }

  const [active, setActive] = useState({ bold: false, underline: false });

  function apply(format: "bold" | "underline") {
    const el = resolveInput();
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const result = wrapTextFormat(value, start, end, format);
    onChange(result.next);
    setActive(textFormatState(result.next, result.selectionStart, result.selectionEnd));
    // Restore selection after React re-render.
    requestAnimationFrame(() => {
      const target = resolveInput();
      if (!target) return;
      target.focus();
      target.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  // Pressed state follows the caret / selection of this field; Ctrl/⌘+B and +U while it has focus.
  useEffect(() => {
    const focused = () => {
      const el = getInput?.() ?? inputRef?.current ?? null;
      return el && document.activeElement === el ? el : null;
    };
    const onSelection = () => {
      const el = focused();
      if (el) setActive(textFormatState(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0));
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || !focused()) return;
      const key = event.key.toLowerCase();
      if (key !== "b" && key !== "u") return;
      event.preventDefault();
      apply(key === "b" ? "bold" : "underline");
    };
    document.addEventListener("selectionchange", onSelection);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("selectionchange", onSelection);
      document.removeEventListener("keydown", onKey);
    };
  });

  const btn =
    size === "sm"
      ? "inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      : "inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <button
        type="button"
        className={cn(btn, active.bold && PRESSED)}
        aria-pressed={active.bold}
        // Keeps the field's selection (a click would move focus away first).
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => apply("bold")}
        title="Bold (Ctrl/⌘+B). Press again to remove it."
      >
        <Bold size={13} />
        Bold
      </button>
      <button
        type="button"
        className={cn(btn, active.underline && PRESSED)}
        aria-pressed={active.underline}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => apply("underline")}
        title="Underline (Ctrl/⌘+U). Press again to remove it."
      >
        <Underline size={13} />
        Underline
      </button>
      {children}
    </div>
  );
}
