"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CopyableTruncatedTextProps {
  value: string | null | undefined;
  fallback?: string;
  className?: string;
  textClassName?: string;
  tooltipLabel?: string;
}

export function CopyableTruncatedText({
  value,
  fallback = "-",
  className,
  textClassName,
  tooltipLabel = "Click to copy",
}: CopyableTruncatedTextProps) {
  const [copied, setCopied] = useState(false);
  const displayValue = value?.trim() || fallback;
  const canCopy = Boolean(value?.trim());

  async function copyValue() {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copyValue}
            disabled={!canCopy}
            className={cn(
              "group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded text-left text-inherit disabled:cursor-default",
              canCopy && "cursor-copy hover:text-blue-700",
              className
            )}
          >
            <span className={cn("min-w-0 truncate", textClassName)}>{displayValue}</span>
            {canCopy && (
              <span className="shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm break-words">
          <p className="font-medium">{tooltipLabel}</p>
          <p className="mt-1 text-gray-200">{displayValue}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
