"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { localToday } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InlineError } from "@/components/sat/alert";
import { readApiError } from "@/lib/api-client";

type ExamOption = {
  id: string;
  name: string;
  moduleCount: number;
  questionCount: number;
  /** Current assignment of this exam for the student, if any. */
  assignment: { status: string; dueDate: string | null } | null;
};

/** What assigning again will do, mirroring upsertFullTestAssignment in lib/assignments.ts. */
function assignmentHint(assignment: ExamOption["assignment"]) {
  if (!assignment) return "";
  const due = assignment.dueDate ? ` (due ${new Date(assignment.dueDate).toLocaleDateString()})` : "";
  if (assignment.status === "COMPLETED") return ` · Completed${due} — will reassign`;
  if (assignment.status === "OVERDUE") return ` · Overdue${due} — will reassign`;
  return ` · Not finished${due} — will update due date`;
}

export function AssignExamForm({
  studentId,
  studentName,
  exams,
  returnHref,
}: {
  studentId: string;
  studentName: string;
  exams: ExamOption[];
  returnHref: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Due date starts on the day the exam is assigned (end of that day); the teacher can change it.
  const [dueDate, setDueDate] = useState(localToday);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return exams;
    return exams.filter((exam) => exam.name.toLowerCase().includes(term));
  }, [exams, search]);

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
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        [...selected].map(async (testId) => {
          const res = await fetch(`/api/full-practice-tests/${testId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentIds: [studentId], dueDate: dueDate || null }),
          });
          if (!res.ok) throw await readApiError(res, "Failed to assign exam.");
          return res.json();
        })
      );
      const total = (key: string) => results.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
      const created = total("created");
      const reassigned = total("reassigned");
      const updated = total("updated");
      if (created + reassigned + updated === 0) {
        setError("Nothing changed: the selected exams are already assigned with this due date.");
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
      window.setTimeout(() => {
        const query = new URLSearchParams(returnHref.split("?")[1] ?? "");
        query.set("area", "tests");
        router.push(`/teacher/students/${studentId}?${query.toString()}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign exam.");
      setLoading(false);
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <p className="text-sm text-gray-600">
        Assign exams to <span className="font-medium text-blue-700">{studentName}</span>
      </p>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exams..." />

      <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2">
        {visible.map((exam) => (
          <label
            key={exam.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 hover:bg-gray-50",
            )}
          >
            <Checkbox
              className="mt-1"
              checked={selected.has(exam.id)}
              onChange={() => toggle(exam.id)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-900">{exam.name}</span>
              <span className="block text-xs text-gray-500">
                {exam.moduleCount} modules · {exam.questionCount} questions
                {assignmentHint(exam.assignment)}
              </span>
            </span>
          </label>
        ))}
        {visible.length === 0 && <p className="p-4 text-center text-sm text-gray-400">No published exams found.</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      <InlineError>{error}</InlineError>
      {done && <p className="text-sm font-medium text-green-600">✓ {doneMessage} Redirecting...</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleAssign} disabled={loading} disabledReason={done ? "Already assigned." : selected.size === 0 ? "Select at least one exam." : null}>
          {loading ? "Assigning..." : `Assign Exam${selected.size ? ` (${selected.size})` : ""}`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(returnHref)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
