"use client";

import katex from "katex";
import { cn } from "@/lib/utils";
import { splitContentBlocks, tokenizeMathContent, type ProseSegment } from "@/lib/math-text";

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

function renderInline(content: string, keyPrefix: string) {
  return tokenizeMathContent(content).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.kind === "prose") {
      return <span key={key}>{renderProseSegments(part.segments, key)}</span>;
    }
    try {
      const html = katex.renderToString(part.math, {
        throwOnError: false,
        displayMode: part.displayMode,
      });
      const Tag = part.displayMode ? "div" : "span";
      return <Tag key={key} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <span key={key}>{part.raw}</span>;
    }
  });
}

export function MathContent({ content, className }: MathContentProps) {
  const blocks = splitContentBlocks(content ?? "");

  return (
    <div className={cn("math-content whitespace-pre-wrap", className)}>
      {blocks.map((block, index) => {
        if (block.kind === "text") {
          return <span key={index}>{renderInline(block.content, `b${index}`)}</span>;
        }
        // Pipe tables from ingested sources (data tables in R&W and Math): real cells so text wraps.
        // An all-blank header row means the source table has no header (e.g. step-by-step work tables).
        const hasHeader = block.header.some((cell) => cell.trim());
        return (
          <div key={index} className="my-3 overflow-x-auto whitespace-normal">
            <table className="w-full border-collapse text-[0.92em] leading-snug">
              {hasHeader && (
                <thead>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={cellIndex} scope="col" className="border border-gray-300 bg-gray-50 px-2 py-1.5 text-left align-bottom font-semibold">
                        {renderInline(cell, `b${index}h${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border border-gray-300 px-2 py-1.5 align-top">
                        {renderInline(cell, `b${index}r${rowIndex}c${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
