"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { cn } from "@/lib/utils";
import { ISSUE_CATEGORIES, ISSUE_COMMENT_MAX, type IssueCategory, type IssueTarget } from "@/lib/issue-report";
import {
  REPORTER_ATTR,
  captureViewport,
  hookPageErrors,
  isReporterUi,
  targetForArea,
  targetForElement,
  targetForPage,
  type Box,
} from "@/lib/issue-report-target";

/**
 * "Report a problem" (the mockup's feedback.js, for real): the user turns on the selector, clicks an
 * element or drags over an area (or reports the whole screen), and writes what is wrong. The report
 * carries a screenshot and the selected elements' selector, classes, attributes and HTML; the server
 * saves it and emails it (app/api/issue-reports). Rendered by AppShell, the parent nav and the players.
 */
export function IssueReportButton({
  variant = "sidebar",
  collapsed = false,
  className,
  onStart,
}: {
  variant?: "sidebar" | "bar" | "tool";
  collapsed?: boolean;
  className?: string;
  /** Called when selection starts (AppShell closes the mobile menu so the page can be pointed at). */
  onStart?: () => void;
}) {
  const [mode, setMode] = useState<"off" | "select" | "capture" | "compose">("off");
  const [draft, setDraft] = useState<{ target: IssueTarget; shot: Blob | null } | null>(null);

  useEffect(() => hookPageErrors(), []);

  const pick = useCallback(async (target: IssueTarget, highlight?: { x: number; y: number; width: number; height: number }) => {
    setMode("capture");
    // Let the selection UI disappear before rendering the page.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const shot = await captureViewport(highlight);
    setDraft({ target, shot });
    setMode("compose");
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (mode === "off") onStart?.();
          setMode((m) => (m === "off" ? "select" : "off"));
        }}
        aria-label="Report a problem"
        title="Report a problem: point at the part of the screen"
        aria-pressed={mode !== "off"}
        {...{ [REPORTER_ATTR]: "" }}
        className={cn(
          variant === "sidebar" && "flex w-full items-center gap-2.5 whitespace-nowrap rounded-[9px] px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-slate-100",
          variant === "bar" && "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100",
          // Same look as the player's ToolButton (components/sat/player-tools.tsx).
          variant === "tool" && "flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100",
          mode !== "off" && "bg-violet-50 text-violet-700",
          className,
        )}
      >
        <MessageSquareWarning size={variant === "bar" ? 16 : 18} className="shrink-0" />
        {variant === "tool" ? (
          <span className="max-[859px]:hidden">Report</span>
        ) : (
          <span className={collapsed ? "min-[860px]:hidden" : variant === "bar" ? "max-sm:hidden" : ""}>Report a problem</span>
        )}
      </button>
      {mode === "select" ? <SelectionLayer onPick={pick} onCancel={() => setMode("off")} /> : null}
      {mode === "capture" ? <CaptureNotice /> : null}
      {mode === "compose" && draft ? (
        <ReportDialog
          draft={draft}
          onClose={() => {
            setDraft(null);
            setMode("off");
          }}
        />
      ) : null}
    </>
  );
}

const ui = { [REPORTER_ATTR]: "" };
const BLOCKED_EVENTS = ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "dblclick", "submit", "dragstart", "selectstart", "contextmenu"] as const;

/** Hover outline, drag band and a hint bar; every page click is swallowed while it is on. */
function SelectionLayer({ onPick, onCancel }: { onPick: (t: IssueTarget, h?: { x: number; y: number; width: number; height: number }) => void; onCancel: () => void }) {
  const [outline, setOutline] = useState<DOMRect | null>(null);
  const [band, setBand] = useState<Box | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const done = useRef(false);

  useEffect(() => {
    document.body.classList.add("issue-reporter-on");
    const box = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      right: Math.max(a.x, b.x),
      bottom: Math.max(a.y, b.y),
    });
    const onMove = (e: PointerEvent) => {
      if (done.current) return;
      if (drag.current) {
        if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 8) drag.current.moved = true;
        if (drag.current.moved) {
          setOutline(null);
          setBand(box(drag.current, { x: e.clientX, y: e.clientY }));
        }
        return;
      }
      const t = e.target as Element;
      setOutline(isReporterUi(t) || t === document.documentElement || t === document.body ? null : t.getBoundingClientRect());
    };
    const onEvent = (e: Event) => {
      if (isReporterUi(e.target as Element) || done.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const p = e as PointerEvent;
      if (e.type === "pointerdown" && p.button === 0) drag.current = { x: p.clientX, y: p.clientY, moved: false };
      if (e.type === "pointerup" && drag.current) {
        const d = drag.current;
        drag.current = null;
        done.current = true;
        if (d.moved) {
          const B = box(d, { x: p.clientX, y: p.clientY });
          onPick(targetForArea(B), { x: B.left, y: B.top, width: B.right - B.left, height: B.bottom - B.top });
        } else {
          const el = document.elementFromPoint(p.clientX, p.clientY) ?? (p.target as Element);
          const r = el.getBoundingClientRect();
          onPick(targetForElement(el), { x: r.left, y: r.top, width: r.width, height: r.height });
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    const onScroll = () => {
      drag.current = null;
      setBand(null);
    };
    document.addEventListener("pointermove", onMove, true);
    BLOCKED_EVENTS.forEach((ev) => document.addEventListener(ev, onEvent, true));
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.body.classList.remove("issue-reporter-on");
      document.removeEventListener("pointermove", onMove, true);
      BLOCKED_EVENTS.forEach((ev) => document.removeEventListener(ev, onEvent, true));
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onPick, onCancel]);

  return createPortal(
    <div {...ui}>
      <div
        role="status"
        className="fixed left-1/2 top-3 z-[2147483000] flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-xl md:flex-nowrap"
      >
        <span className="text-center">Click the part of the screen with the problem, or drag to select an area · Esc to cancel</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            done.current = true;
            onPick(targetForPage());
          }}
        >
          Whole screen
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {outline && !band ? (
        <div
          className="pointer-events-none fixed z-[2147482990] rounded-md border-2 border-dashed border-violet-600 bg-violet-600/[.08]"
          style={{ left: outline.left - 2, top: outline.top - 2, width: outline.width + 4, height: outline.height + 4 }}
        />
      ) : null}
      {band ? (
        <div
          className="pointer-events-none fixed z-[2147482990] rounded border-2 border-violet-600 bg-violet-600/[.12]"
          style={{ left: band.left, top: band.top, width: band.right - band.left, height: band.bottom - band.top }}
        />
      ) : null}
    </div>,
    document.body,
  );
}

function CaptureNotice() {
  return createPortal(
    <div {...ui} role="status" className="fixed bottom-4 left-1/2 z-[2147483000] -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      Taking a screenshot…
    </div>,
    document.body,
  );
}

function ReportDialog({ draft, onClose }: { draft: { target: IssueTarget; shot: Blob | null }; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<IssueCategory>("PROBLEM");
  const [sending, setSending] = useState(false);
  const { target, shot } = draft;
  // One dialog per draft, so the preview URL is made once and freed on close.
  const [shotUrl] = useState(() => (shot ? URL.createObjectURL(shot) : null));
  useEffect(() => () => (shotUrl ? URL.revokeObjectURL(shotUrl) : undefined), [shotUrl]);

  const selected = target.kind === "area"
    ? target.columns?.length ? `Columns: ${target.columns.join(", ")}` : `${target.inside?.length ?? 0} items in the area`
    : target.element?.text;

  async function send() {
    if (!comment.trim()) return;
    setSending(true);
    try {
      const form = new FormData();
      form.set("comment", comment.trim());
      form.set("category", category);
      form.set("url", window.location.href);
      form.set("pageTitle", document.title);
      form.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
      form.set("target", JSON.stringify(target));
      if (shot) form.set("screenshot", shot, "screenshot.jpg");
      await apiFetch("/api/issue-reports", { method: "POST", body: form, fallback: "The report could not be sent. Try again." });
      notify.success("Thanks — your report was sent.");
      onClose();
    } catch (error) {
      notify.error(error);
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open && !sending ? onClose() : undefined)}>
      <DialogContent {...ui} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>
            About: <b className="text-gray-800">{target.context}</b>
            {selected ? <> · “{selected.slice(0, 80)}”</> : null}
          </DialogDescription>
        </DialogHeader>
        {shotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={shotUrl} alt="Screenshot that will be sent" className="max-h-56 w-full rounded-lg border border-gray-200 object-contain object-top" />
        ) : (
          <p className="text-xs text-gray-500">The screenshot could not be taken; the report is sent without it.</p>
        )}
        <label className="grid gap-1 text-sm font-medium text-gray-800">
          What do you see? What did you expect?
          <Textarea
            autoFocus
            value={comment}
            maxLength={ISSUE_COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="E.g. the score here does not match the one on the results page."
          />
        </label>
        <div role="radiogroup" aria-label="Type of report" className="flex flex-wrap gap-1.5">
          {ISSUE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                category === c.value ? "border-current bg-gray-50" : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
              style={category === c.value ? { color: c.color } : undefined}
            >
              ● {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">The screenshot and the technical details of what you selected are sent to the SAT team.</p>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={sending || !comment.trim()} disabledReason={!comment.trim() ? "Write what you see first" : undefined}>
            {sending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
