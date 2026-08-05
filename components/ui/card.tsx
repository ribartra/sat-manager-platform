import { cn } from "@/lib/utils";

type CardVariant = "default" | "subtle" | "info" | "warning" | "danger" | "success" | "ghost";
type CardPadding = "none" | "sm" | "md" | "lg";

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: "border-gray-200 bg-white",
  subtle: "border-gray-200 bg-gray-50",
  info: "border-blue-200 bg-blue-50",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-red-200 bg-red-50",
  success: "border-green-200 bg-green-50",
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

export function Card({ as: Component = "div", className, children, variant = "default", padding = "none", ...props }: CardProps) {
  return (
    <Component className={cn("rounded-lg border", CARD_VARIANTS[variant], CARD_PADDING[padding], className)} {...props}>
      {children}
    </Component>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-b border-gray-200 px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t border-gray-200 px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}
