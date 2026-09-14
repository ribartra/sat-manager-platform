"use client";

import { useRef, useState, type ReactNode } from "react";
import { MathContent } from "@/components/math-content";
import { TextFormatToolbar } from "@/components/text-format-toolbar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FormattedTextFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  className?: string;
  textareaClassName?: string;
  /** Live MathContent preview under the textarea. Default true. */
  showPreview?: boolean;
  previewClassName?: string;
  /** Transform value before rendering preview (e.g. strip image placeholders). */
  formatPreview?: (value: string) => string;
  /** Extra toolbar controls (e.g. Formula button). */
  toolbarExtra?: ReactNode;
  /** When empty, hide the field behind a CTA until the user opens it. */
  collapsible?: boolean;
  collapseLabel?: string;
  /** Called when the textarea mounts/unmounts (for external ref maps). */
  onInputRef?: (node: HTMLTextAreaElement | null) => void;
  id?: string;
};

/**
 * Text field with Bold/Underline toolbar and live rendered preview.
 * Storage stays lightweight markers (** / ++ / LaTeX); users see rendered output.
 */
export function FormattedTextField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
  className,
  textareaClassName,
  showPreview = true,
  previewClassName,
  formatPreview,
  toolbarExtra,
  collapsible = false,
  collapseLabel = "Add content",
  onInputRef,
  id,
}: FormattedTextFieldProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(() => Boolean(value.trim()));
  const isCollapsed = collapsible && !open && !value.trim();

  function resolveInput() {
    return internalRef.current;
  }

  function bindRef(node: HTMLTextAreaElement | null) {
    internalRef.current = node;
    onInputRef?.(node);
  }

  if (isCollapsed) {
    return (
      <div className={cn("grid gap-1", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit text-sm font-medium text-blue-700 hover:underline"
        >
          {collapseLabel}
        </button>
      </div>
    );
  }

  const previewSource = formatPreview ? formatPreview(value) : value;

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        <TextFormatToolbar getInput={resolveInput} value={value} onChange={onChange}>
          {toolbarExtra}
        </TextFormatToolbar>
      </div>
      {hint ? <p className="text-xs text-gray-400">{hint}</p> : null}
      <Textarea
        id={id}
        ref={bindRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={textareaClassName}
      />
      {showPreview ? (
        <div className={cn("rounded-md border border-gray-200 bg-gray-50 p-3", previewClassName)}>
          <p className="mb-1 text-xs font-medium uppercase text-gray-400">Preview</p>
          {previewSource.trim() ? (
            <MathContent content={previewSource} className="text-sm leading-6 text-gray-800" />
          ) : (
            <p className="text-xs text-gray-400">Nothing to preview yet.</p>
          )}
        </div>
      ) : null}
      {collapsible && !value.trim() ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-fit text-xs text-gray-500 hover:underline"
        >
          Hide
        </button>
      ) : null}
    </div>
  );
}
