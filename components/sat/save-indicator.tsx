import { Alert } from "./alert";
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
  /** On narrow screens show only a colored dot (the label stays available to screen readers). */
  compact?: boolean;
}

const DOT: Record<Exclude<SaveStatus, "idle">, string> = {
  saving: "bg-gray-400",
  saved: "bg-green-500",
  offline: "bg-amber-500",
  syncing: "bg-blue-500",
  error: "bg-red-500",
};

/** Shared persistence signal for Practice and Full Test players. */
export function SaveIndicator({ status, compact, className, ...props }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <span
      role="status"
      aria-live="polite"
      title={LABELS[status]}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        status === "error" ? "text-destructive" : status === "offline" ? "text-warning" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {compact ? <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT[status])} /> : null}
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{LABELS[status]}</span>
    </span>
  );
}

/** Full-width notice while the device has no connection; answers keep being saved locally. */
export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <Alert tone="warning" layout="banner" className="justify-center text-center font-medium">
      You are offline. Your answers are saved on this device and will sync when the connection returns.
    </Alert>
  );
}
