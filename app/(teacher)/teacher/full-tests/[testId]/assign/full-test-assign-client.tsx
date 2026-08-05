"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function FullTestAssignClient({
  testId,
  students,
  groups,
  groupAssignmentEnabled,
}: {
  testId: string;
  students: { id: string; name: string }[];
  groups: { id: string; name: string; memberIds: string[] }[];
  groupAssignmentEnabled: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState("student");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  const visibleStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    const filtered = term ? students.filter((student) => student.name.toLowerCase().includes(term)) : students;
    const selected = students.find((student) => student.id === studentId);
    return selected && !filtered.some((student) => student.id === selected.id) ? [selected, ...filtered] : filtered;
  }, [studentId, studentSearch, students]);

  const visibleGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    const filtered = term ? groups.filter((group) => group.name.toLowerCase().includes(term)) : groups;
    const selected = groups.find((group) => group.id === groupId);
    return selected && !filtered.some((group) => group.id === selected.id) ? [selected, ...filtered] : filtered;
  }, [groupId, groupSearch, groups]);

  async function assign() {
    const group = groups.find((g) => g.id === groupId);
    const studentIds = groupAssignmentEnabled && target === "group" ? group?.memberIds ?? [] : [studentId];
    await fetch(`/api/full-practice-tests/${testId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds, dueDate }),
    });
    router.push("/teacher/full-tests");
  }

  return (
    <Card padding="lg" className="space-y-4">
      <Select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="student">Student</option>
        {groupAssignmentEnabled && <option value="group">Group</option>}
      </Select>
      {target === "student" ? (
        <div className="space-y-2">
          <Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search student..." />
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {visibleStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Search group..." />
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {visibleGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
      )}
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <Button onClick={assign}>Assign Exam</Button>
    </Card>
  );
}
