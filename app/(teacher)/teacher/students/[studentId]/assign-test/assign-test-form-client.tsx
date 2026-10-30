"use client";

import { Checkbox, Radio } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { localToday } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InlineError } from "@/components/sat/alert";
import { TestNumberAccordion } from "@/components/sat/test-number-accordion";
import { readApiError } from "@/lib/api-client";

/** A test the student does NOT have yet (already assigned tests are never offered again). */
type ExamOption = {
  id: string;
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
}: {
  studentId: string;
  studentName: string;
  exams: ExamOption[];
  /** The student's Tests tab (Cancel, and where it goes after assigning). */
  returnHref: string;
  /** Due-date edit of a test the student already has (open). */
  editing?: { id: string; name: string; dueDate: string | null; showExplanations: boolean };
  /** Test preselected from the URL (`test=`): "Assign" on a Test. */
  initialSelected?: string;
  /** Groups (Admin › Settings group management): assign to every member at once. */
  groups?: { id: string; name: string; memberIds: string[] }[];
  groupAssignmentEnabled?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(editing ? [editing.id] : initialSelected && exams.some((exam) => exam.id === initialSelected) ? [initialSelected] : []),
  );
  const [target, setTarget] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const group = groups.find((g) => g.id === groupId);
  const useGroup = groupAssignmentEnabled && target === "group" && !editing;
  // Due date starts on the day the test is assigned (end of that day), or the current one when editing.
  const [dueDate, setDueDate] = useState(() => editing?.dueDate?.slice(0, 10) ?? localToday());
  // Per student: Check + explanation per question in the Test player (on by default).
  const [showExplanations, setShowExplanations] = useState(() => editing?.showExplanations ?? true);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const term = search.trim().toLowerCase();
  const visible = term ? exams.filter((exam) => exam.name.toLowerCase().includes(term) || exam.sourceName.toLowerCase().includes(term)) : exams;

  function toggle(id: string) {
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
            body: JSON.stringify({ studentIds, dueDate: dueDate || null, showExplanations }),
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
        setError("Nothing changed: the selected tests are already assigned with this due date.");
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
    <Card padding="lg" className="space-y-4">
      <p className="text-sm text-gray-600">
        {editing ? "Due date for" : "Assign tests to"} <span className="font-medium text-blue-700">{useGroup ? group?.name ?? "Group" : studentName}</span>
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
          <p className="text-xs text-gray-500">Tests {studentName.split(" ")[0]} already has are not listed (they can be retaken).</p>
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
                node: (
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-md border border-[var(--sat-border)] bg-white px-3 py-2 hover:bg-gray-50", selected.has(exam.id) && "border-[var(--sat-primary)] bg-blue-50")}>
                    <Checkbox className="mt-1" checked={selected.has(exam.id)} onChange={() => toggle(exam.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900">{exam.name}</span>
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

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <Checkbox checked={showExplanations} onChange={(e) => setShowExplanations(e.target.checked)} />
        Show explanations in the player
        <span className="text-xs text-gray-500">(a Check button per question shows the answer and its explanation)</span>
      </label>

      <InlineError>{error}</InlineError>
      {done && <p className="text-sm font-medium text-green-600">✓ {doneMessage} Redirecting...</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleAssign} disabled={loading} disabledReason={done ? "Already assigned." : selected.size === 0 ? "Select at least one test." : null}>
          {editing ? (loading ? "Saving..." : "Save changes") : loading ? "Assigning..." : `Assign test${selected.size ? ` (${selected.size})` : ""}`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(returnHref)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
