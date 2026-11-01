import { cn } from "@/lib/utils";

type CardVariant = "default" | "subtle" | "info" | "warning" | "danger" | "success" | "ghost";
type CardPadding = "none" | "sm" | "md" | "lg";

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: "border-[var(--sat-border)] bg-white",
  subtle: "border-[var(--sat-border)] bg-[var(--sat-surface-2)]",
  info: "border-blue-200 bg-[var(--sat-primary-soft)]",
  warning: "border-[var(--sat-warn-border)] bg-[var(--sat-warn-soft)]",
  danger: "border-[var(--sat-bad-border)] bg-[var(--sat-bad-soft)]",
  success: "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)]",
  ghost: "border-transparent bg-transparent",
};

const CARD_PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  href?: string;
  variant?: CardVariant;
  padding?: CardPadding;
}

// Mockup `.card`: radius 10, slate border, hairline shadow; linked cards get the blue hover.
const CARD_LINK_HOVER =
  "cursor-pointer transition-[border-color,box-shadow] hover:border-[#93c5fd] hover:shadow-[0_4px_14px_rgba(37,99,235,.1)]";

export function Card({ as: Component = "div", className, children, variant = "default", padding = "none", ...props }: CardProps) {
  const clickable = Boolean(props.href) || Component === "button";
  return (
    <Component
      className={cn(
        "rounded-[var(--sat-radius)] border",
        variant !== "ghost" && "shadow-[var(--sat-shadow)]",
        CARD_VARIANTS[variant],
        CARD_PADDING[padding],
        clickable && CARD_LINK_HOVER,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-b border-[var(--sat-border)] px-4 py-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t border-[var(--sat-border)] px-4 py-3", className)} {...props}>
      {children}
    </div>
  );
}
