"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ExamOption = {
  id: string;
  name: string;
  moduleCount: number;
  questionCount: number;
  alreadyAssigned: boolean;
};

export function AssignExamForm({
  studentId,
  studentName,
  exams,
}: {
  studentId: string;
  studentName: string;
  exams: ExamOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return exams;
    return exams.filter((exam) => exam.name.toLowerCase().includes(term));
  }, [exams, search]);

  function toggle(id: string, disabled: boolean) {
    if (disabled) return;
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
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to assign exam.");
          return data;
        })
      );
      const created = results.reduce((sum, row) => sum + (Number(row.created) || 0), 0);
      if (created === 0) {
        setError("No new exams were assigned (they may already be assigned).");
        setLoading(false);
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push(`/teacher/students/${studentId}`), 1000);
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
              exam.alreadyAssigned && "opacity-50"
            )}
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(exam.id)}
              disabled={exam.alreadyAssigned}
              onChange={() => toggle(exam.id, exam.alreadyAssigned)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-900">{exam.name}</span>
              <span className="block text-xs text-gray-500">
                {exam.moduleCount} modules · {exam.questionCount} questions
                {exam.alreadyAssigned ? " · Already assigned" : ""}
              </span>
            </span>
          </label>
        ))}
        {visible.length === 0 && <p className="p-4 text-center text-sm text-gray-400">No published exams found.</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Due date (optional)</label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {done && <p className="text-sm font-medium text-green-600">✓ Assigned successfully! Redirecting...</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleAssign} disabled={selected.size === 0 || loading || done}>
          {loading ? "Assigning..." : `Assign Exam${selected.size ? ` (${selected.size})` : ""}`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(`/teacher/students/${studentId}`)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
