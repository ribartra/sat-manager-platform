"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/lib/notify-ui";
import { cn } from "@/lib/utils";

/**
 * Player tools from the mockup (`mejorada/assets/take.js`): top-bar tool buttons (icon above a small
 * label), the "Eliminate" strike circle per choice, the SAT reference sheet, and text highlights.
 */

export function ToolButton({
  icon,
  label,
  active = false,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={title ?? label}
      title={title ?? label}
      className={cn(
        "flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium",
        active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100",
      )}
    >
      {icon}
      <span className="max-[859px]:hidden">{label}</span>
    </button>
  );
}

/** "ABC" struck through: the Eliminate tool icon. */
export function EliminateIcon() {
  return <span className="text-[13px] font-bold leading-[18px] line-through">ABC</span>;
}

/** Strike circle shown on each choice while Eliminate is on. */
export function StrikeButton({ label, struck, onClick, disabled }: { label: string; struck: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={struck}
      aria-label={struck ? `Undo eliminate choice ${label}` : `Eliminate choice ${label}`}
      title={struck ? "Undo" : "Eliminate"}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold line-through",
        struck ? "border-gray-700 bg-gray-700 text-white" : "border-gray-300 text-gray-500 hover:border-gray-500",
        "disabled:cursor-not-allowed",
      )}
    >
      {label}
    </button>
  );
}

const FORMULAS: { title: string; lines: string[] }[] = [
  { title: "Circle", lines: ["A = πr²", "C = 2πr"] },
  { title: "Rectangle", lines: ["A = ℓw"] },
  { title: "Triangle", lines: ["A = ½bh"] },
  { title: "Pythagorean theorem", lines: ["c² = a² + b²"] },
  { title: "Special right triangles", lines: ["30°-60°-90°: x, x√3, 2x", "45°-45°-90°: s, s, s√2"] },
  { title: "Volume", lines: ["Box: V = ℓwh", "Cylinder: V = πr²h", "Sphere: V = ⁴⁄₃πr³", "Cone: V = ⅓πr²h", "Pyramid: V = ⅓ℓwh"] },
];

/** SAT Math reference sheet (formulas given on test day). */
export function ReferenceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reference sheet</DialogTitle>
          <DialogDescription>Formulas you can use in the Math section.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMULAS.map((f) => (
            <div key={f.title} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-semibold text-gray-900">{f.title}</p>
              {f.lines.map((line) => (
                <p key={line} className="font-serif text-sm text-gray-700">{line}</p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          The number of degrees of arc in a circle is 360. The number of radians of arc in a circle is 2π. The sum of the measures in degrees of the
          angles of a triangle is 180.
        </p>
      </DialogContent>
    </Dialog>
  );
}

type Span = { start: number; end: number };
type HighlightsByQuestion = Record<string, Span[]>;

function highlightsSupported() {
  return typeof window !== "undefined" && typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight === "function";
}

function textNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

function offsetOf(root: Node, node: Node, offset: number) {
  let total = 0;
  for (const t of textNodes(root)) {
    if (t === node) return total + offset;
    total += t.data.length;
  }
  return -1;
}

function rangeFor(root: Node, span: Span): Range | null {
  let total = 0;
  const range = document.createRange();
  let started = false;
  for (const t of textNodes(root)) {
    const next = total + t.data.length;
    if (!started && span.start <= next) {
      range.setStart(t, span.start - total);
      started = true;
    }
    if (started && span.end <= next) {
      range.setEnd(t, span.end - total);
      return range;
    }
    total = next;
  }
  return null;
}

/**
 * Text highlights for the passage and question (mockup "Highlight" tool). Uses the CSS Custom
 * Highlight API, so the question markup is never modified. Kept per attempt in this browser only
 * (a per-viewer convenience, like on paper).
 */
export function useQuestionHighlights(storageKey: string, questionId: string | undefined, zone: HTMLElement | null) {
  const [byQuestion, setByQuestion] = useState<HighlightsByQuestion>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setByQuestion(JSON.parse(raw) as HighlightsByQuestion);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!highlightsSupported() || !zone || !questionId) return;
    const ranges = (byQuestion[questionId] ?? []).map((span) => rangeFor(zone, span)).filter((r): r is Range => r !== null);
    CSS.highlights.set("sat-hl", new Highlight(...ranges));
    return () => {
      CSS.highlights.delete("sat-hl");
    };
  }, [byQuestion, questionId, zone]);

  const save = useCallback(
    (next: HighlightsByQuestion) => {
      setByQuestion(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  );

  const highlightSelection = useCallback(() => {
    if (!highlightsSupported()) {
      notify.info("Highlight", "Highlighting isn't available in this browser.");
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !zone || !questionId) {
      notify.info("Highlight", "Select some text in the passage or question first.");
      return;
    }
    const range = sel.getRangeAt(0);
    if (!zone.contains(range.startContainer) || !zone.contains(range.endContainer)) {
      notify.info("Highlight", "You can highlight text in the passage or question only.");
      return;
    }
    const start = offsetOf(zone, range.startContainer, range.startOffset);
    const end = offsetOf(zone, range.endContainer, range.endOffset);
    if (start < 0 || end <= start) {
      notify.info("Highlight", "Select plain text to highlight.");
      return;
    }
    save({ ...byQuestion, [questionId]: [...(byQuestion[questionId] ?? []), { start, end }] });
    sel.removeAllRanges();
  }, [byQuestion, questionId, save, zone]);

  const clearHighlights = useCallback(() => {
    if (!questionId) return;
    const next = { ...byQuestion };
    delete next[questionId];
    save(next);
  }, [byQuestion, questionId, save]);

  return { highlightSelection, clearHighlights, count: questionId ? byQuestion[questionId]?.length ?? 0 : 0 };
}
