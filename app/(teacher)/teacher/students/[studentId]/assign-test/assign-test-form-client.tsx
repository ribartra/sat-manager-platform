"use client";

import { nameWithSource } from "@/lib/test-name";
import { Checkbox, Radio } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AssignStep } from "@/components/sat/assign-step";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InlineError } from "@/components/sat/alert";
import { TestNumberAccordion } from "@/components/sat/test-number-accordion";
import { ASSIGNED_LABEL } from "@/components/sat/assigned-stamp";
import { AssignSummaryCard, defaultAssignOptions, type AssignOptions } from "@/components/sat/assign-summary-card";
import { readApiError } from "@/lib/api-client";

/** An assignable test; `assigned` = the student already has it (shown with the stamp, not selectable). */
type ExamOption = {
  id: string;
  assigned: boolean;
  name: string;
  /** "TEST N": the versions of a test across sources share one accordion. */
  number: number | null;
  sourceId: string;
  sourceName: string;
  sourceOrder: number;
  moduleCount: number;
  questionCount: number;
};

export function AssignTestForm({
  studentId,
  studentName,
  exams,
  returnHref,
  editing,
  initialSelected,
  groups = [],
  groupAssignmentEnabled = false,
  areaTabs,
}: {
  /** Math / Reading / Writing / Tests tabs (links), shown in the "Choose the Test" step. */
  areaTabs?: React.ReactNode;
  studentId: string;
  studentName: string;
  exams: ExamOption[];
  /** The student's Tests tab (Cancel, and where it goes after assigning). */
  returnHref: string;
  /** Settings edit of a test the student already has (open). */
  editing?: { id: string; name: string; dueDate: string | null; unlockAt: string | null; feedbackMode: string; showExplanations: boolean };
  /** Test preselected from the URL (`test=`): "Assign" on a Test. */
  initialSelected?: string;
  /** Groups (Admin › Settings group management): assign to every member at once. */
  groups?: { id: string; name: string; memberIds: string[] }[];
  groupAssignmentEnabled?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(editing ? [editing.id] : initialSelected && exams.some((exam) => exam.id === initialSelected && !exam.assigned) ? [initialSelected] : []),
  );
  const [target, setTarget] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const group = groups.find((g) => g.id === groupId);
  const useGroup = groupAssignmentEnabled && target === "group" && !editing;
  // Same options as practice: due the day it is assigned (end of that day), open today, answers at the
  // end, explanations off; editing starts from the stored settings.
  const [options, setOptions] = useState<AssignOptions>(() => defaultAssignOptions(0, editing));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const term = search.trim().toLowerCase();
  const visible = term ? exams.filter((exam) => exam.name.toLowerCase().includes(term) || exam.sourceName.toLowerCase().includes(term)) : exams;

  function toggle(id: string) {
    // Already assigned: never selected or cleared from here.
    if (exams.some((exam) => exam.id === id && exam.assigned)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    if (selected.size === 0) return;
    const studentIds = useGroup ? group?.memberIds ?? [] : [studentId];
    if (studentIds.length === 0) {
      setError("This group has no students yet.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        [...selected].map(async (testId) => {
          const res = await fetch(`/api/full-practice-tests/${testId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentIds,
              dueDate: options.dueDate || null,
              unlockAt: options.unlockAt || null,
              feedbackMode: options.feedbackMode,
              showExplanations: options.showExplanations,
            }),
          });
          if (!res.ok) throw await readApiError(res, "Failed to assign the test.");
          return res.json();
        })
      );
      const total = (key: string) => results.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
      const created = total("created");
      const reassigned = total("reassigned");
      const updated = total("updated");
      if (created + reassigned + updated === 0) {
        setError("Nothing changed: the selected tests are already assigned with these settings.");
        setLoading(false);
        return;
      }
      setDone(true);
      setDoneMessage(
        [
          created ? `${created} assigned` : null,
          reassigned ? `${reassigned} reassigned` : null,
          updated ? `${updated} updated` : null,
        ].filter(Boolean).join(" · ") + ".",
      );
      window.setTimeout(() => router.push(returnHref), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign the test.");
      setLoading(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <AssignStep n={3} title={editing ? "What you are changing" : "Choose the Test"}>
    {editing ? null : areaTabs}
    <Card padding="lg" className="min-w-0 space-y-4">
      <p className="text-sm text-gray-600">
        {editing ? "Settings for" : "Assign tests to"} <span className="font-medium text-blue-700">{useGroup ? group?.name ?? "Group" : studentName}</span>
      </p>
      {groupAssignmentEnabled && !editing && groups.length ? (
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <Radio checked={target === "student"} onChange={() => setTarget("student")} /> This student
          </label>
          <label className="flex items-center gap-2">
            <Radio checked={target === "group"} onChange={() => setTarget("group")} /> Group
          </label>
          {target === "group" ? (
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Group" className="max-w-xs">
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberIds.length} students)
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <p className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800">{editing.name}</p>
      ) : (
        <>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests..." />
          <p className="text-xs text-gray-500">Tests {studentName.split(" ")[0]} already has are marked as already assigned (they can retake them from their Tests page).</p>
          {/* Same structure as the Tests list: one "TEST N" accordion, each source's version inside. */}
          <div className="max-h-[32rem] overflow-y-auto">
            <TestNumberAccordion
              emptyText={search ? "No test matches the search." : "Every published test is already assigned."}
              items={visible.map((exam) => ({
                key: exam.id,
                number: exam.number,
                sourceName: exam.sourceName,
                sourceOrder: exam.sourceOrder,
                // Searching opens the matches, and so does the Test preselected from the URL (selection
                // doesn't drive it, so unticking never collapses it).
                open: Boolean(term) || exam.id === initialSelected,
                // Every source of this TEST N assigned = stamp on its header; one version alone is only disabled.
                assigned: exam.assigned,
                node: (
                  <label
                    title={exam.assigned ? ASSIGNED_LABEL : undefined}
                    className={cn(
                      "relative flex items-start gap-3 rounded-md border border-[var(--sat-border)] bg-white px-3 py-2",
                      exam.assigned ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50",
                      !exam.assigned && selected.has(exam.id) && "border-[var(--sat-primary)] bg-blue-50",
                    )}
                  >
                    <Checkbox
                      className="mt-1"
                      checked={!exam.assigned && selected.has(exam.id)}
                      disabled={exam.assigned}
                      aria-label={exam.assigned ? `${exam.name} · ${ASSIGNED_LABEL}` : undefined}
                      onChange={() => toggle(exam.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-medium", exam.assigned ? "text-gray-400" : "text-gray-900")}>{exam.name}</span>
                      <span className="block text-xs text-gray-500">
                        {exam.moduleCount} modules (2 Reading & Writing + 2 Math) · {exam.questionCount} questions
                      </span>
                    </span>
                  </label>
                ),
              }))}
            />
          </div>
        </>
      )}

      <InlineError>{error}</InlineError>
      {done && <p className="text-sm font-medium text-green-600">✓ {doneMessage} Redirecting...</p>}
    </Card>
    </AssignStep>

    <aside className="lg:sticky lg:top-6">
      <AssignStep n={4} title={editing ? "Change the dates and save" : "Set the dates and assign"}>
      <AssignSummaryCard
        to={useGroup ? group?.name ?? "Group" : studentName}
        countLabel="Tests"
        items={editing ? [editing.name] : exams.filter((exam) => selected.has(exam.id)).map((exam) => nameWithSource(exam.name, exam.sourceName))}
        options={options}
        onOptionsChange={setOptions}
        dueHint="Due at the end of that day. Starts today; change it if needed."
        submitLabel={editing ? (loading ? "Saving..." : "Save changes") : loading ? "Assigning..." : `Assign test${selected.size ? ` (${selected.size})` : ""}`}
        onSubmit={handleAssign}
        loading={loading}
        disabledReason={done ? "Already assigned." : selected.size === 0 ? "Select at least one test." : null}
        onCancel={() => router.push(returnHref)}
      />
      </AssignStep>
    </aside>
    </div>
  );
}
