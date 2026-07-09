"use client";

import katex from "katex";
import { cn } from "@/lib/utils";

interface MathContentProps {
  content: string;
  className?: string;
}

const mathTokenPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

function parseMathToken(token: string) {
  if (token.startsWith("$$") && token.endsWith("$$")) {
    return { math: token.slice(2, -2), displayMode: true };
  }
  if (token.startsWith("\\[") && token.endsWith("\\]")) {
    return { math: token.slice(2, -2), displayMode: true };
  }
  if (token.startsWith("$") && token.endsWith("$")) {
    return { math: token.slice(1, -1), displayMode: false };
  }
  if (token.startsWith("\\(") && token.endsWith("\\)")) {
    return { math: token.slice(2, -2), displayMode: false };
  }
  return null;
}

export function MathContent({ content, className }: MathContentProps) {
  const parts = content.split(mathTokenPattern).filter(Boolean);

  return (
    <div className={cn("math-content whitespace-pre-wrap", className)}>
      {parts.map((part, index) => {
        const token = parseMathToken(part);
        if (!token) return <span key={index}>{part}</span>;

        try {
          const html = katex.renderToString(token.math, {
            throwOnError: false,
            displayMode: token.displayMode,
          });
          const Tag = token.displayMode ? "div" : "span";
          return <Tag key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={index}>{part}</span>;
        }
      })}
    </div>
  );
}
