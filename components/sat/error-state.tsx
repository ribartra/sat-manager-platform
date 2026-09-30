import { Alert } from "./alert";
import { cn } from "@/lib/utils";

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

/** Full-panel error (a whole view or card could not load). Built on Alert. */
export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <Alert tone="error" title={title} className={cn("px-6 py-6", className)} {...props}>
      {description ? <p>{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </Alert>
  );
}
