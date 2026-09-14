import { cn } from "@/lib/utils";

interface FormSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
}

/** Groups related fields with optional heading — use inside RHF forms. */
export function FormSection({ title, description, className, children, ...props }: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)} {...props}>
      {title || description ? (
        <div>
          {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
