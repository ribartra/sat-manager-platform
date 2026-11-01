"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { MathContent } from "@/components/math-content";
import { OptionContent } from "@/components/option-content";
import { QuestionMedia } from "@/components/question-media";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { questionResponseLabel, resolveQuestionType, isAnswerOption } from "@/lib/question-type";

export type PlayerPreviewOption = {
  label: string;
  text: string;
  imageUrl?: string | null;
};

export function QuestionPlayerPreview({
  stem,
  stimulus,
  imageUrl,
  type,
  options,
  className,
}: {
  stem: string;
  stimulus?: string;
  imageUrl?: string | null;
  type: string;
  options: PlayerPreviewOption[];
  className?: string;
}) {
  const [selected, setSelected] = useState<string>("");
  const [marked, setMarked] = useState(false);
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());

  function toggleEliminated(label: string) {
    setEliminated((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const hasPassage = Boolean(stimulus?.trim());
  const responseType = resolveQuestionType(type, options);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">View as player</p>
          <p className="text-xs text-gray-500">Layout matches the student practice player</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-gray-400">Preview only</span>
      </div>

      <div
        className={cn(
          "grid min-h-[28rem] overflow-hidden",
          hasPassage ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        <div
          className={cn(
            "min-h-0 space-y-4 overflow-y-auto p-4 md:p-6",
            hasPassage ? "border-r border-gray-200 bg-gray-50" : "border-r border-gray-200",
          )}
        >
          {hasPassage ? (
            <MathContent content={stimulus!} className="prose prose-base max-w-none leading-relaxed text-gray-800" />
          ) : null}
          <div className={cn(hasPassage && "border-t border-gray-200 pt-4")}>
            {stem.trim() ? (
              <MathContent content={stem} className="text-base font-medium leading-relaxed text-gray-900 md:text-lg" />
            ) : (
              <p className="text-sm text-gray-400">Question stem is empty.</p>
            )}
            <QuestionMedia imageUrl={imageUrl || null} alt="Question image" className="mt-4" />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{questionResponseLabel(responseType)}</p>
            <button
              type="button"
              onClick={() => setMarked((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors",
                marked ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-400 hover:border-gray-300"
              )}
            >
              <Flag size={12} />
              Mark
            </button>
          </div>

          {responseType === "MC" ? (
            <div className="space-y-2.5">
              {options.filter(isAnswerOption).map((opt) => {
                const isEliminated = eliminated.has(opt.label);
                return (
                  <div
                    key={opt.label}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-3 text-sm transition-colors",
                      selected === opt.label ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                      isEliminated && "opacity-55"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(opt.label)}
                      className={cn("flex flex-1 items-start gap-3 text-left", isEliminated && "line-through")}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                          selected === opt.label ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-500"
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        {isAnswerOption(opt) ? (
                          <OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} className="text-base text-gray-800" />
                        ) : (
                          <span className="text-gray-300">Empty</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEliminated(opt.label)}
                      className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                    >
                      {isEliminated ? "Undo" : "Eliminate"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Your answer</label>
              <Input
                type="text"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                placeholder="Enter a number"
                className="w-40"
              />
              <p className="mt-1 text-xs text-gray-400">For fractions, enter as decimal (e.g. 0.5)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
