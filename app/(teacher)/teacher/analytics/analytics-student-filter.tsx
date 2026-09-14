"use client";

import { useRouter } from "next/navigation";
import { StudentPicker } from "@/components/student-picker";

export function AnalyticsStudentFilter({
  students,
  selectedStudentId,
}: {
  students: { id: string; name: string }[];
  selectedStudentId: string;
}) {
  const router = useRouter();

  function selectStudent(nextId: string) {
    if (!nextId) {
      router.push("/teacher/analytics");
      return;
    }
    router.push(`/teacher/analytics?studentId=${encodeURIComponent(nextId)}`);
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
