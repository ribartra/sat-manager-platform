"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

interface MathContentProps {
  content: string;
  className?: string;
}

export function MathContent({ content, className }: MathContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    // Replace $...$ with rendered KaTeX inline
    el.innerHTML = content.replace(/\$([^$]+)\$/g, (_, math) => {
      try {
        return katex.renderToString(math, { throwOnError: false, displayMode: false });
      } catch {
        return `$${math}$`;
      }
    }).replace(/\$\$([^$]+)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math, { throwOnError: false, displayMode: true });
      } catch {
        return `$$${math}$$`;
      }
    });
  }, [content]);

  return <div ref={ref} className={className} />;
}
