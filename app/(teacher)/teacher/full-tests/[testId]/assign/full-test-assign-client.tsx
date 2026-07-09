"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function FullTestAssignClient({ testId, students, groups }: { testId: string; students: { id: string; name: string }[]; groups: { id: string; name: string; memberIds: string[] }[] }) {
  const router = useRouter();
  const [target, setTarget] = useState("student");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");

  async function assign() {
    const group = groups.find((g) => g.id === groupId);
    const studentIds = target === "group" ? group?.memberIds ?? [] : [studentId];
    await fetch(`/api/full-practice-tests/${testId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds, dueDate }),
    });
    router.push("/teacher/full-tests");
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <Select value={target} onChange={(e) => setTarget(e.target.value)}><option value="student">Student</option><option value="group">Group</option></Select>
      {target === "student" ? (
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      ) : (
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
      )}
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <Button onClick={assign}>Assign Exam</Button>
    </div>
  );
}
