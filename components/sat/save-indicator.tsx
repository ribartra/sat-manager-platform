import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "syncing" | "error";

const LABELS: Record<Exclude<SaveStatus, "idle">, string> = {
  saving: "Saving…",
  saved: "Saved",
  offline: "Saved locally",
  syncing: "Syncing…",
  error: "Sync problem",
};

interface SaveIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SaveStatus;
}

/** Shared persistence signal for Practice and Full Test players. */
export function SaveIndicator({ status, className, ...props }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "text-xs",
        status === "error" ? "text-destructive" : status === "offline" ? "text-warning" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {LABELS[status]}
    </span>
  );
}
