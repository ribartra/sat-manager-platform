"use client";

import { useRouter } from "next/navigation";
import { StudentPicker } from "@/components/student-picker";
import { buildAreaHref, type AreaTabKey } from "@/lib/practice-area";

export function AnalyticsStudentFilter({
  students,
  selectedStudentId,
  area = "math",
}: {
  students: { id: string; name: string }[];
  selectedStudentId: string;
  area?: AreaTabKey;
}) {
  const router = useRouter();

  function selectStudent(nextId: string) {
    if (!nextId) {
      router.push(buildAreaHref("/teacher/analytics", area));
      return;
    }
    router.push(buildAreaHref("/teacher/analytics", area, { studentId: nextId }));
  }

  return (
    <div className="min-w-[16rem] sm:max-w-xs">
      <StudentPicker
        mode="single"
        label="Student"
        students={students}
        value={selectedStudentId}
        onChange={selectStudent}
        emptyLabel="No students match the current search."
      />
    </div>
  );
}
