import { cn } from "@/lib/utils";

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function LoadingState({ label = "Loading…", className, ...props }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground", className)}
      {...props}
    >
      <span
        className="inline-block size-4 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
