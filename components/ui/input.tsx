import { cn } from "@/lib/utils";
import { FIELD_BLOCKED } from "@/components/ui/control-states";
import { InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
        FIELD_BLOCKED,
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
