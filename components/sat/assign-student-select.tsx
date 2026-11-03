"use client";

import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/sat/searchable-select";

/**
 * Step 1 of the Assign view: the student drop-down (search inside for long lists). Picking a student
 * opens their Assign view, carrying what is being assigned (`query`).
 */
export function AssignStudentSelect({
  students,
  selectedStudentId,
  query,
  emptyText,
}: {
  students: { id: string; name: string }[];
  selectedStudentId: string | null;
  /** Query string (without "?") to carry over. */
  query: string;
  emptyText: string;
}) {
  const router = useRouter();
  if (students.length === 0 && !selectedStudentId) return <p className="text-sm text-[var(--sat-muted)]">{emptyText}</p>;
  return (
    <div className="max-w-sm">
      <SearchableSelect
        id="assign-student"
        options={students.map((student) => ({ value: student.id, label: student.name }))}
        allLabel="Choose a student"
        value={selectedStudentId ?? ""}
        searchPlaceholder="Search students"
        onChange={(id) => {
          if (id && id !== selectedStudentId) router.push(`/teacher/students/${encodeURIComponent(id)}/assign${query ? `?${query}` : ""}`);
        }}
      />
    </div>
  );
}
