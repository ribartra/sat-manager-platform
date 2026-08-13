"use client";

import type { RefObject } from "react";
import { Bold, Underline } from "lucide-react";
import { wrapTextFormat } from "@/lib/math-text";
import { cn } from "@/lib/utils";

type TextAreaLike = HTMLTextAreaElement | HTMLInputElement;

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
 * Bold / Underline wraps for question text fields.
 * Prose → **…** / ++…++; inside math tokens → \textbf{…} / \underline{…}.
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

  function apply(format: "bold" | "underline") {
    const el = resolveInput();
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const result = wrapTextFormat(value, start, end, format);
    onChange(result.next);
    // Restore selection after React re-render.
    requestAnimationFrame(() => {
      const target = resolveInput();
      if (!target) return;
      target.focus();
      target.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  const btn =
    size === "sm"
      ? "inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      : "inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <button type="button" className={btn} onClick={() => apply("bold")} title="Bold (**text** or \\textbf{})">
        <Bold size={13} />
        Bold
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => apply("underline")}
        title="Underline (++text++ or \\underline{})"
      >
        <Underline size={13} />
        Underline
      </button>
      {children}
    </div>
  );
}
