"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { localToday } from "@/lib/utils";

export type FeedbackMode = "AFTER_SET" | "IMMEDIATE";

/** The settings of an assignment (practice set or Test): the same four options for both. */
export interface AssignOptions {
  dueDate: string;
  unlockAt: string;
  feedbackMode: FeedbackMode;
  showExplanations: boolean;
}

/**
 * Starting options: due date `dueInDays` from today (practice 7, Test 0), open today, answers at the
 * end, explanations off. When editing, the stored values (an empty open date starts today).
 */
export function defaultAssignOptions(
  dueInDays: number,
  stored?: { dueDate?: string | null; unlockAt?: string | null; feedbackMode?: string | null; showExplanations?: boolean | null },
): AssignOptions {
  const today = localToday();
  return {
    dueDate: stored ? stored.dueDate?.slice(0, 10) ?? "" : addDays(today, dueInDays),
    unlockAt: stored?.unlockAt?.slice(0, 10) || today,
    feedbackMode: stored?.feedbackMode === "IMMEDIATE" ? "IMMEDIATE" : "AFTER_SET",
    showExplanations: stored?.showExplanations ?? false,
  };
}

/**
 * Assign Summary (practice and Tests): who, what, and every option of the assignment (due date, open
 * date, when to show answers, explanations), with Assign / Cancel. Sticky beside the picker on wide
 * screens; under it on phones.
 */
export function AssignSummaryCard({
  to,
  countLabel,
  items,
  options,
  onOptionsChange,
  dueHint,
  extra,
  submitLabel,
  onSubmit,
  loading,
  disabledReason,
  onCancel,
}: {
  to: string;
  countLabel: string;
  items: string[];
  options: AssignOptions;
  onOptionsChange: (options: AssignOptions) => void;
  dueHint?: string;
  /** Extra settings under the options (e.g. "Keep it locked"). */
  extra?: React.ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  loading: boolean;
  disabledReason?: string | null;
  onCancel: () => void;
}) {
  const set = (patch: Partial<AssignOptions>) => onOptionsChange({ ...options, ...patch });
  // YYYY-MM-DD strings compare as dates.
  const dateError = options.dueDate && options.unlockAt && options.dueDate < options.unlockAt ? "The due date is before the open date." : null;
  return (
    <Card padding="md" className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">To</dt>
          <dd className="text-right font-medium text-gray-900">{to}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">{countLabel}</dt>
          <dd className="font-medium text-gray-900">{items.length}</dd>
        </div>
      </dl>
      {items.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-gray-100 pt-2 text-xs text-gray-600">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="truncate">{item}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3 border-t border-gray-100 pt-3">
        <div>
          <label htmlFor="assign-open" className="mb-1 block text-sm font-medium text-gray-700">Open date (optional)</label>
          <Input id="assign-open" type="date" value={options.unlockAt} onChange={(e) => set({ unlockAt: e.target.value })} />
          <p className="mt-1 text-xs text-gray-400">The student can start it from that day. Today by default.</p>
        </div>
        <div>
          <label htmlFor="assign-due" className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
          <Input id="assign-due" type="date" value={options.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          <p className="mt-1 text-xs text-gray-400">{dueHint ?? "Due at the end of that day."}</p>
          {dateError ? <p className="mt-1 text-xs text-red-600">{dateError}</p> : null}
        </div>
        <div>
          <label htmlFor="assign-feedback" className="mb-1 block text-sm font-medium text-gray-700">When to show answers</label>
          <Select id="assign-feedback" value={options.feedbackMode} onChange={(e) => {
              const feedbackMode = e.target.value as FeedbackMode;
              // Explanations only exist with answers after each question.
              set(feedbackMode === "IMMEDIATE" ? { feedbackMode } : { feedbackMode, showExplanations: false });
            }}>
            <option value="AFTER_SET">Show answers at the end</option>
            <option value="IMMEDIATE">Show the answer after each question</option>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Explanations</p>
          {/* Per student: shown in the player when the student checks a question. */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Checkbox
              checked={options.showExplanations}
              onChange={(e) => set({ showExplanations: e.target.checked })}
              disabled={options.feedbackMode !== "IMMEDIATE"}
            />
            Show explanations in the player
          </label>
          <p className="mt-1 text-xs text-gray-500">
            {options.feedbackMode === "IMMEDIATE"
              ? "Shown with the answer when the student checks a question. Only for this assignment."
              : "Only when answers show after each question."}
          </p>
        </div>
        {extra}
      </div>

      <Button className="w-full" onClick={onSubmit} disabled={loading} disabledReason={dateError ?? disabledReason}>
        {submitLabel}
      </Button>
      <Button className="w-full" variant="secondary" onClick={onCancel}>Cancel</Button>
    </Card>
  );
}

/** YYYY-MM-DD plus `days` (calendar days, local). */
function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
