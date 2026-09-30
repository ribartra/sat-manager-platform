import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";
import { CHOICE_BLOCKED } from "@/components/ui/control-states";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const CHOICE_BASE =
  "h-4 w-4 shrink-0 border-gray-300 text-blue-600 accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1";

/** Native checkbox with the shared look and blocked state. */
const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(({ className, ...props }, ref) => (
  <input ref={ref} type="checkbox" className={cn(CHOICE_BASE, "rounded", CHOICE_BLOCKED, className)} {...props} />
));
Checkbox.displayName = "Checkbox";

/** Native radio with the shared look and blocked state. */
const Radio = forwardRef<HTMLInputElement, ChoiceProps>(({ className, ...props }, ref) => (
  <input ref={ref} type="radio" className={cn(CHOICE_BASE, "rounded-full", CHOICE_BLOCKED, className)} {...props} />
));
Radio.displayName = "Radio";

export { Checkbox, Radio };
