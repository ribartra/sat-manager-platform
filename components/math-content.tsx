"use client";

import katex from "katex";
import { cn } from "@/lib/utils";
import { tokenizeMathContent, type ProseSegment } from "@/lib/math-text";

interface MathContentProps {
  content: string;
  className?: string;
}

function renderProseSegments(segments: ProseSegment[], keyPrefix: string) {
  return segments.map((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    if (segment.kind === "bold") {
      return <strong key={key}>{segment.text}</strong>;
    }
    if (segment.kind === "italic") {
      return <em key={key}>{segment.text}</em>;
    }
    if (segment.kind === "underline") {
      return <u key={key}>{segment.text}</u>;
    }
    return <span key={key}>{segment.text}</span>;
  });
}

export function MathContent({ content, className }: MathContentProps) {
  const parts = tokenizeMathContent(content ?? "");

  return (
    <div className={cn("math-content whitespace-pre-wrap", className)}>
      {parts.map((part, index) => {
        if (part.kind === "prose") {
          return <span key={index}>{renderProseSegments(part.segments, String(index))}</span>;
        }

        try {
          const html = katex.renderToString(part.math, {
            throwOnError: false,
            displayMode: part.displayMode,
          });
          const Tag = part.displayMode ? "div" : "span";
          return <Tag key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={index}>{part.raw}</span>;
        }
      })}
    </div>
  );
}
