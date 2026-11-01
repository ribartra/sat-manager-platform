"use client";

import type { ReactElement, ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Tooltip for a control whose meaning is not obvious. Wraps a single element (link/button)
 * so it can be used from server components: <Hint label="…"><Link …/></Hint>.
 */
export function Hint({ label, children, side = "top" }: { label: ReactNode; children: ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs whitespace-normal leading-snug">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Small (i) icon with an explanation, for column headers and KPI labels. */
export function InfoHint({ label, side = "top" }: { label: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Hint label={label} side={side}>
      <button type="button" aria-label={typeof label === "string" ? label : "More information"} className="inline-flex align-middle text-gray-400 hover:text-gray-600">
        <Info size={12} />
      </button>
    </Hint>
  );
}
