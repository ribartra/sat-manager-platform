"use client";

import { useRouter } from "next/navigation";
import { StudentPicker } from "@/components/student-picker";

/** Jump to another student's page keeping the current tab, area and filters. */
export function StudentSwitcher({
  students,
  selectedStudentId,
  query,
}: {
  students: { id: string; name: string }[];
  selectedStudentId: string;
  /** Query string (without "?") to carry over to the other student. */
  query: string;
}) {
  const router = useRouter();

  return (
    <div className="min-w-[16rem] sm:max-w-xs">
      <StudentPicker
        mode="single"
        label="Student"
        students={students}
        value={selectedStudentId}
        onChange={(nextId) => {
          if (nextId && nextId !== selectedStudentId) {
            router.push(`/teacher/students/${nextId}${query ? `?${query}` : ""}`);
          }
        }}
        emptyLabel="No students match the current search."
      />
    </div>
  );
}
