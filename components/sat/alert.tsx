import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Base for every user-facing message (errors, warnings, notices, confirmations). Specific
 * messages (ErrorState, InvalidatedNotice, OfflineBanner, InlineError, FormMessage, the legal
 * draft banner) are built on it, so tone, colors and accessibility roles stay consistent.
 *
 * - tone: error | warning | info | success | note
 * - layout: "box" (bordered panel, default), "inline" (one line under a field or button),
 *   "banner" (full-width strip at the top of a view)
 * Errors are announced immediately (role="alert"); everything else politely (role="status").
 */
export type AlertTone = "error" | "warning" | "info" | "success" | "note";
export type AlertLayout = "box" | "inline" | "banner";

const TONES: Record<AlertTone, { box: string; text: string; icon: LucideIcon }> = {
  error: { box: "border-red-200 bg-red-50 text-red-800", text: "text-red-700", icon: AlertCircle },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", text: "text-amber-800", icon: AlertTriangle },
  info: { box: "border-blue-200 bg-blue-50 text-blue-900", text: "text-blue-800", icon: Info },
  success: { box: "border-green-200 bg-green-50 text-green-800", text: "text-green-700", icon: CheckCircle2 },
  note: { box: "border-gray-300 bg-gray-50 text-gray-700", text: "text-gray-600", icon: Info },
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  layout?: AlertLayout;
  title?: React.ReactNode;
  action?: React.ReactNode;
  /** Hide the leading icon (e.g. very dense inline messages). */
  hideIcon?: boolean;
  role?: string;
}

export function Alert({ tone = "info", layout = "box", title, action, hideIcon, className, children, role, ...props }: AlertProps) {
  const t = TONES[tone];
  const Icon = t.icon;
  const aria = role ?? (tone === "error" ? "alert" : "status");

  if (layout === "inline") {
    return (
      <p role={aria} className={cn("flex items-start gap-1.5 text-sm", t.text, className)} {...props}>
        {hideIcon ? null : <Icon aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span className="min-w-0">
          {title ? <strong className="font-semibold">{title} </strong> : null}
          {children}
        </span>
      </p>
    );
  }

  return (
    <div
      role={aria}
      aria-live={aria === "alert" ? undefined : "polite"}
      className={cn(
        "flex items-start gap-2.5 text-sm",
        layout === "banner" ? "shrink-0 border-b px-4 py-1.5 text-xs sm:px-6" : "rounded-md border px-3 py-2.5",
        t.box,
        className,
      )}
      {...props}
    >
      {hideIcon ? null : <Icon aria-hidden className={cn("shrink-0", layout === "banner" ? "mt-px h-3.5 w-3.5" : "mt-0.5 h-4 w-4")} />}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** One-line error under a field, a form or a button. Renders nothing without a message. */
export function InlineError({ children, className, ...props }: Omit<AlertProps, "tone" | "layout">) {
  if (children === null || children === undefined || children === false || children === "") return null;
  return (
    <Alert tone="error" layout="inline" className={className} {...props}>
      {children}
    </Alert>
  );
}
