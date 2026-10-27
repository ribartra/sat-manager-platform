import Link from "next/link";
import type { ReactNode } from "react";
import { MathContent } from "@/components/math-content";
import { cn } from "@/lib/utils";

export type QuestionListItemData = {
  stem: string;
  imageUrl?: string | null;
  stimulus?: string | null;
  optionImageUrls?: string[];
};

/** Shared rich question row: stem + stem/option thumbs (same density as Question Bank). */
export function QuestionListItem({
  question,
  href,
  meta,
  indexLabel,
  className,
  stemClassName,
}: {
  question: QuestionListItemData;
  href?: string;
  meta?: ReactNode;
  indexLabel?: ReactNode;
  className?: string;
  stemClassName?: string;
}) {
  const optionImages = (question.optionImageUrls ?? []).filter(Boolean);
  const imageCount = (question.imageUrl ? 1 : 0) + optionImages.length;
  const body = (
    <div className={cn("space-y-2", className)}>
      {(indexLabel || meta) && (
        <div className="flex flex-wrap items-center gap-2">
          {indexLabel}
          {meta}
        </div>
      )}
      <div className="flex gap-3">
        {question.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.imageUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded border border-gray-200 bg-white object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <MathContent
            content={question.stem}
            className={cn("max-h-28 overflow-auto text-sm text-gray-800", stemClassName)}
          />
          {question.stimulus?.trim() ? (
            // Up to 2 full-width lines (line-clamp), not a fixed 120 characters that left the row half empty.
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
              Stimulus: {question.stimulus.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600)}
            </p>
          ) : null}
          {href ? (
            <p className="mt-1 text-[11px] font-medium text-blue-600 opacity-80 group-hover:opacity-100">
              Open full question{imageCount > 0 ? ` · ${imageCount} image${imageCount === 1 ? "" : "s"}` : ""} →
            </p>
          ) : imageCount > 0 ? (
            <p className="mt-1 text-[11px] text-gray-400">
              {imageCount} image{imageCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>
      {optionImages.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {optionImages.slice(0, 4).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="h-10 w-10 rounded border border-gray-200 bg-white object-cover"
            />
          ))}
          {optionImages.length > 4 ? (
            <span className="self-center text-[10px] text-gray-400">+{optionImages.length - 4}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link
      href={href}
      className="group block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {body}
    </Link>
  );
}

/** Map Prisma question (+ optional options) into list media fields. */
export function toQuestionListMedia(q: {
  stem: string;
  imageUrl?: string | null;
  stimulus?: string | null;
  options?: { imageUrl?: string | null }[];
}): QuestionListItemData {
  return {
    stem: q.stem,
    imageUrl: q.imageUrl ?? null,
    stimulus: q.stimulus ?? null,
    optionImageUrls: (q.options ?? [])
      .map((o) => o.imageUrl)
      .filter((url): url is string => Boolean(url && url.trim())),
  };
}
