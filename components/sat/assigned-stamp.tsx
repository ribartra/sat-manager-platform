import { cn } from "@/lib/utils";

/**
 * "ALREADY ASSIGNED" stamp laid over an element of the Assign view (a set chip, a Test row) that
 * the student already has. It is absolutely positioned over its parent (which must be `relative`),
 * so the element keeps its size, margins and position: a light veil dims what is underneath (still
 * readable) and the pill sits on top. It never takes clicks (the element itself is disabled).
 *   placement "edge": the pill rides the top edge, centered (small chips: their content stays visible).
 *   placement "end":  the pill sits at the right end, vertically centered (wide rows).
 */
export const ASSIGNED_LABEL = "Already assigned";

export function AssignedStamp({ placement = "edge" }: { placement?: "edge" | "end" }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-white/45">
      <span
        className={cn(
          "absolute whitespace-nowrap rounded-full border border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)] px-1.5 text-[9px] font-bold uppercase leading-[13px] tracking-wide text-green-800 shadow-sm",
          placement === "edge" ? "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" : "right-3 top-1/2 -translate-y-1/2",
        )}
      >
        {ASSIGNED_LABEL}
      </span>
    </span>
  );
}
