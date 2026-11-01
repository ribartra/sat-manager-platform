import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "easy" | "medium" | "hard" | "test";
  className?: string;
}

const variantClasses: Record<string, string> = {
  // Mockup `.badge .b-*`: soft fill + matching border.
  default: "border-[var(--sat-border)] bg-[var(--sat-surface-2)] text-[var(--sat-muted)]", // b-neutral
  success: "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)] text-[var(--sat-ok)]", // b-done
  warning: "border-[var(--sat-warn-border)] bg-[var(--sat-warn-soft)] text-[var(--sat-warn)]", // b-progress
  danger: "border-[var(--sat-bad-border)] bg-[var(--sat-bad-soft)] text-[var(--sat-bad)]", // b-overdue
  info: "border-blue-200 bg-[var(--sat-primary-soft)] text-[var(--sat-primary)]", // b-todo
  easy: "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)] text-[var(--sat-ok)]",
  medium: "border-[var(--sat-warn-border)] bg-[var(--sat-warn-soft)] text-[var(--sat-warn)]",
  hard: "border-[var(--sat-bad-border)] bg-[var(--sat-bad-soft)] text-[var(--sat-bad)]",
  // Tests (mockup: grey with dark ink, never white text)
  test: "border-[var(--sat-area-tests)] bg-[var(--sat-area-tests)] text-[var(--sat-tests-ink)]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
