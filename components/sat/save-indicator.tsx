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

/** Full-width notice while the device has no connection; answers keep being saved locally. */
export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900 sm:px-6"
    >
      You are offline. Your answers are saved on this device and will sync when the connection returns.
    </div>
  );
}
