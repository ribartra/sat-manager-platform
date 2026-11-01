import { cn } from "@/lib/utils";
import { FIELD_BLOCKED } from "@/components/ui/control-states";
import { InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)] placeholder:text-gray-400 focus:border-[var(--sat-primary)] focus:outline-none focus:ring-[3px] focus:ring-[#93c5fd]/60",
        FIELD_BLOCKED,
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
